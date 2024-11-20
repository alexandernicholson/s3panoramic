import { Hono } from "hono";
import { StorageService } from "../services/storage.ts";
import { browser } from "../templates/browser.ts";
import { layout } from "../templates/layout.ts";
import { objectList } from "../templates/components/object_list.ts";
import { pagination } from "../templates/components/pagination.ts";

const viewRoutes = new Hono();

const storageService = new StorageService({
  bucket: Deno.env.get("S3_BUCKET") || "",
  region: Deno.env.get("S3_REGION") || ""
});

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
      <div class="breadcrumbs">
        <a href="/" 
           hx-get="/"
           hx-target="#browser-content"
           hx-push-url="true">Home</a>
        ${prefix.split("/").filter(Boolean).map((part, i, parts) => {
          const path = parts.slice(0, i + 1).join("/");
          return `
            <a href="/?prefix=${path}"
               hx-get="/?prefix=${path}"
               hx-target="#browser-content"
               hx-push-url="true">${part}</a>
          `;
        }).join(" / ")}
      </div>
      ${objectList(result)}
      ${pagination(result)}
    `);
  }
  
  // Otherwise return the full layout
  const content = browser(result, prefix, query);
  return c.html(layout(content));
});

export { viewRoutes }; 
