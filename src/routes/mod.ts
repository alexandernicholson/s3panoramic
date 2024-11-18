import { Hono } from "hono";
import { apiRoutes } from "./api.ts";
import { viewRoutes } from "./views.ts";

const routes = new Hono();

routes.route("/api", apiRoutes);
routes.route("/", viewRoutes);

export { routes }; 
