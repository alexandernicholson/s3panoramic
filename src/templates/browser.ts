import { ListObjectsResult } from "../types/mod.ts";
import { objectList } from "./components/object_list.ts";
import { pagination } from "./components/pagination.ts";
import { search } from "./components/search.ts";

export function browser(
  result: ListObjectsResult,
  prefix = "",
  query = "",
) {
  return `
    <div class="browser">
      <h1>Object Browser</h1>
      
      ${search(query)}
      
      <div id="browser-navigation">
        ${renderBreadcrumbs(prefix)}
      </div>
      
      <div id="browser-content">
        ${objectList(result)}
        ${pagination(result)}
      </div>
    </div>
  `;
}

export function renderBreadcrumbs(prefix: string) {
  const parts = prefix.split("/").filter(Boolean);
  const links = parts.map((part, i) => {
    const path = parts.slice(0, i + 1).join("/");
    return `
      <a href="/?prefix=${path}"
         hx-get="/?prefix=${path}"
         hx-target="#browser-navigation, #browser-content"
         hx-swap="innerHTML"
         hx-push-url="true">${part}</a>
    `;
  });
  
  return `
    <div class="breadcrumbs">
      <a href="/" 
         hx-get="/"
         hx-target="#browser-navigation, #browser-content"
         hx-swap="innerHTML"
         hx-push-url="true">Home</a>
      ${links.length ? " / " + links.join(" / ") : ""}
    </div>
  `;
} 
