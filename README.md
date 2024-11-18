# S3 Panoramic

A modern, zero-retention S3 bucket browser with a clean interface. View and download files from your S3 buckets without storing any data locally.

## Features

- 📁 Browse S3 buckets with folder-like navigation
- 🔍 Real-time search functionality
- ⬇️ Secure file downloads using signed URLs
- 📱 Responsive design with PicoCSS
- ⚡ Fast navigation using HTMX
- 🔒 No server-side storage of credentials or files

## Quick Start

### Using Deno

1. Set your AWS credentials as environment variables:

```bash
export S3_BUCKET="your-bucket"
export S3_REGION="your-region"
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
```

2. Install Deno if you haven't already:
```bash
curl -fsSL https://deno.land/x/install/install.sh | sh
```

3. Run the application:
```bash
# Development mode with hot reload
deno task dev

# Production mode
deno task start
```

### Using Docker

1. Build the image:
```bash
docker build -t s3panoramic .
```

2. Run the container:
```bash
docker run -p 3000:3000 \
  -e S3_BUCKET="your-bucket" \
  -e S3_REGION="your-region" \
  -e AWS_ACCESS_KEY_ID="your-key" \
  -e AWS_SECRET_ACCESS_KEY="your-secret" \
  s3panoramic
```

4. Open http://localhost:3000 in your browser.
