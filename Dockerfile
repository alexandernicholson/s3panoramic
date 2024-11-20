# Use the official Deno image
FROM denoland/deno:2.0.6

# Set working directory
WORKDIR /app

# Copy source code
COPY . .

# Expose the port
EXPOSE 3000

# Set environment variables with defaults
ENV S3_BUCKET=""
ENV S3_REGION=""
ENV AWS_ACCESS_KEY_ID=""
ENV AWS_SECRET_ACCESS_KEY=""

# Run the app
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "src/main.ts"] 
