export function search(query = "") {
  return `
    <div class="search">
      <input type="search"
             name="q"
             placeholder="Search objects..."
             value="${query}"
             hx-get="/api/search"
             hx-trigger="keyup changed delay:500ms"
             hx-target="#browser-content">
    </div>
  `;
} 
