import { Hono } from "hono";
import { StorageService } from "../services/storage.ts";
import { browser, renderBreadcrumbs } from "../templates/browser.ts";
import { layout } from "../templates/layout.ts";
import { objectList } from "../templates/components/object_list.ts";
import { pagination } from "../templates/components/pagination.ts";

const viewRoutes = new Hono();

const storageService = new StorageService(
  Deno.env.get("S3_BUCKET") || "",
  Deno.env.get("S3_REGION") || "",
  Deno.env.get("AWS_ACCESS_KEY_ID") || "",
  Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
);

viewRoutes.get("/", async (c) => {
  const prefix = c.req.query("prefix") || "";
  const continuationToken = c.req.query("continuation");
  const query = c.req.query("q") || "";

  const result = await storageService.listObjects({
    prefix,
    delimiter: "/",
    maxKeys: 1000,
    continuationToken,
  });

  // If it's an HTMX request, return both navigation and content
  if (c.req.header("HX-Request")) {
    return c.html(`
      <div id="browser-navigation">
        ${renderBreadcrumbs(prefix)}
      </div>
      <div id="browser-content">
        ${objectList(result)}
        ${pagination(result)}
      </div>
    `);
  }
  
  // Otherwise return the full layout
  const content = browser(result, prefix, query);
  return c.html(layout(content));
});

export { viewRoutes }; 
