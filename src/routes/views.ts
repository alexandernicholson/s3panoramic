import { Hono } from "hono";
import { StorageService } from "../services/storage.ts";
import { browser } from "../templates/browser.ts";
import { layout } from "../templates/layout.ts";
import { objectList } from "../templates/components/object_list.ts";
import { pagination } from "../templates/components/pagination.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

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

  // If it's an HTMX request, return just the browser content
  if (c.req.header("HX-Request")) {
    const content = browser(result, prefix, query);
    const doc = new DOMParser().parseFromString(content, "text/html");
    const browserContent = doc?.querySelector("#browser-content")?.innerHTML || "";
    return c.html(browserContent);
  }
  
  // Otherwise return the full layout
  const content = browser(result, prefix, query);
  return c.html(layout(content));
});

export { viewRoutes }; 
