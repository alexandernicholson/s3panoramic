import { ListObjectsOptions, ListObjectsResult, StorageObject } from "../types/mod.ts";
import { S3, type ListObjectsV2Request } from "https://deno.land/x/aws_api@v0.8.1/services/s3/mod.ts";
import { ApiFactory } from "https://deno.land/x/aws_api@v0.8.1/client/mod.ts";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

export class StorageService {
  private client: S3;

  constructor(
    private bucket: string,
    private region: string,
    private accessKeyId: string,
    private secretAccessKey: string,
  ) {
    const factory = new ApiFactory({
      region: this.region,
      credentials: {
        awsAccessKeyId: this.accessKeyId,
        awsSecretKey: this.secretAccessKey,
      },
    });
    
    this.client = new S3(factory);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return await getSignedUrl({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      bucket: this.bucket,
      key,
      region: this.region,
      expiresIn,
    });
  }

  async listObjects(options: ListObjectsOptions): Promise<ListObjectsResult> {
    try {
      const params: ListObjectsV2Request = {
        Bucket: this.bucket,
        Prefix: options.prefix,
        Delimiter: options.delimiter,
        MaxKeys: options.maxKeys,
        ContinuationToken: options.continuationToken,
      };

      const response = await this.client.listObjectsV2(params);

      const objects: StorageObject[] = response.Contents?.map(obj => ({
        key: obj.Key || "",
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: (obj.ETag || "").replace(/^"|"$/g, ""),
        contentType: undefined, // Content type requires separate HEAD request
      })) || [];

      // Get content types in parallel for better performance
      await Promise.all(objects.map(async (obj) => {
        obj.contentType = await this.getContentType(obj.key);
      }));

      return {
        objects,
        prefixes: response.CommonPrefixes?.map(p => p.Prefix || "") || [],
        truncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
      };
    } catch (error) {
      throw new Error(
        `Failed to list objects: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getContentType(key: string): Promise<string | undefined> {
    try {
      const response = await this.client.headObject({
        Bucket: this.bucket,
        Key: key,
      });
      return response.ContentType;
    } catch {
      return undefined;
    }
  }
} 
