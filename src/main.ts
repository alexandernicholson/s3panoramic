import { Hono } from 'hono'
import { routes } from "./routes/mod.ts";
import { serveStatic } from 'hono/middleware.ts'
const app = new Hono();

// Serve static files
app.use("/static/*", serveStatic({ root: "./" }));

// Mount all routes
app.route("/", routes);

// Start server
Deno.serve({ port: 3000 }, app.fetch); 
