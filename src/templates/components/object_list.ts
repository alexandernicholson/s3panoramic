import { ListObjectsResult } from "../../types/mod.ts";

export function objectList(result: ListObjectsResult) {
  return `
    <div class="object-list">
      ${result.prefixes.map(prefix => `
        <div class="folder">
          <a href="/?prefix=${prefix}"
             hx-get="/?prefix=${prefix}"
             hx-target="#browser-content"
             hx-push-url="true">
            📁 ${prefix}
          </a>
        </div>
      `).join("")}
      
      ${result.objects.map(obj => `
        <div class="object">
          <span class="name">📄 ${obj.key}</span>
          <span class="size">${formatSize(obj.size)}</span>
          <span class="modified">${formatDate(obj.lastModified)}</span>
          <a href="/api/download/${encodeURIComponent(obj.key)}"
             class="download">
            ⬇️ Download
          </a>
        </div>
      `).join("")}
    </div>
  `;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  
  return `${size.toFixed(1)} ${units[unit]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString();
} 
