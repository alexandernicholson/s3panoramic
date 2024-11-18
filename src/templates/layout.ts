export function layout(content: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Object Storage Browser</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
      <link rel="stylesheet" href="/static/styles.css">
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    </head>
    <body>
      <main class="container">
        ${content}
      </main>
    </body>
    </html>
  `;
} 
