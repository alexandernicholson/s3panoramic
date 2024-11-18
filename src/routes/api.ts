import { Hono } from "hono";
import { StorageService } from "../services/storage.ts";
import { SearchService } from "../services/search.ts";
import { objectList } from "../templates/components/object_list.ts";

const apiRoutes = new Hono();

const storageService = new StorageService(
  Deno.env.get("S3_BUCKET") || "",
  Deno.env.get("S3_REGION") || "",
  Deno.env.get("AWS_ACCESS_KEY_ID") || "",
  Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
);

const searchService = new SearchService(storageService);

apiRoutes.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  const prefix = c.req.query("prefix") || "";
  
  const objects = await searchService.search({
    query,
    prefix,
    maxKeys: 1000,
  });
  
  return c.html(objectList({ objects, prefixes: [], truncated: false }));
});

apiRoutes.get("/download/:key{.*}", async (c) => {
  try {
    const key = c.req.param("key");
    if (!key) {
      throw new Error("No key provided for download");
    }

    console.log("Attempting to download:", {
      bucket: Deno.env.get("S3_BUCKET"),
      region: Deno.env.get("S3_REGION"),
      key,
    });

    const url = await storageService.getSignedUrl(key);
    if (!url) {
      throw new Error(`Failed to generate signed URL for key: ${key}`);
    }

    return c.redirect(url);
  } catch (error) {
    console.error("Download error details:", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      key: c.req.param("key"),
      bucket: Deno.env.get("S3_BUCKET"),
      region: Deno.env.get("S3_REGION"),
    });
    
    // Return a user-friendly error page with more details
    return c.html(`
      <div class="error">
        <h2>Download Failed</h2>
        <p>Failed to download file: ${error instanceof Error ? error.message : String(error)}</p>
        <div class="error-details">
          <p><strong>File:</strong> ${c.req.param("key")}</p>
          <p><strong>Bucket:</strong> ${Deno.env.get("S3_BUCKET")}</p>
          <p><strong>Region:</strong> ${Deno.env.get("S3_REGION")}</p>
          ${error instanceof Error && error.stack ? `
            <details>
              <summary>Technical Details</summary>
              <pre>${error.stack}</pre>
            </details>
          ` : ''}
        </div>
        <a href="javascript:history.back()" class="button">Go Back</a>
      </div>
    `, 404);
  }
});

export { apiRoutes }; 
