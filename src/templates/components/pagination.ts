import { ListObjectsResult } from "../../types/mod.ts";

export function pagination(result: ListObjectsResult) {
  if (!result.truncated) return '';
  
  return `
    <div class="pagination">
      <button hx-get="/?continuation=${result.nextContinuationToken}"
              hx-target="#browser-content"
              hx-swap="innerHTML">
        Load More
      </button>
    </div>
  `;
} 
