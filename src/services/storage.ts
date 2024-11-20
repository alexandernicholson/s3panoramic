import { ListObjectsOptions, ListObjectsResult, StorageObject } from "../types/mod.ts";
import { S3, type ListObjectsV2Request } from "https://deno.land/x/aws_api@v0.8.1/services/s3/mod.ts";
import { ApiFactory } from "https://deno.land/x/aws_api@v0.8.1/client/mod.ts";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";

interface Credentials {
  awsAccessKeyId: string;
  awsSecretKey: string;
  sessionToken?: string;
}

export class StorageService {
  private client: S3;
  private credentials: Credentials;

  constructor(private bucket: string, private region: string) {
    this.credentials = this.resolveCredentials();
    const factory = new ApiFactory({
      region: this.region,
      credentials: this.credentials,
    });
    
    this.client = new S3(factory);
  }

  private async fetchInstanceProfileCredentials(): Promise<Credentials | null> {
    try {
      const metadataUrl = "http://169.254.169.254/latest/meta-data/iam/security-credentials/";
      const roleName = await (await fetch(metadataUrl)).text();
      const credentials = await (await fetch(`${metadataUrl}${roleName}`)).json();
      
      return {
        awsAccessKeyId: credentials.AccessKeyId,
        awsSecretKey: credentials.SecretAccessKey,
        sessionToken: credentials.Token,
      };
    } catch {
      return null;
    }
  }

  private async fetchIRSACredentials(): Promise<Credentials | null> {
    const roleArn = Deno.env.get("AWS_ROLE_ARN");
    const tokenFile = Deno.env.get("AWS_WEB_IDENTITY_TOKEN_FILE");

    if (!roleArn || !tokenFile) {
      return null;
    }

    try {
      const token = await Deno.readTextFile(tokenFile);
      const sts = new WebIdentityCredentials(roleArn, token);
      const creds = await sts.getCredentials();
      
      return {
        awsAccessKeyId: creds.accessKeyId,
        awsSecretKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      };
    } catch {
      return null;
    }
  }

  private getStaticCredentials(): Credentials | null {
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");

    if (!accessKeyId || !secretKey) {
      return null;
    }

    return {
      awsAccessKeyId: accessKeyId,
      awsSecretKey: secretKey,
    };
  }

  private async resolveCredentials(): Promise<Credentials> {
    // Try IRSA first
    const irsaCreds = await this.fetchIRSACredentials();
    if (irsaCreds) return irsaCreds;

    // Then try static credentials
    const staticCreds = this.getStaticCredentials();
    if (staticCreds) return staticCreds;

    // Finally try instance profile
    const instanceCreds = await this.fetchInstanceProfileCredentials();
    if (instanceCreds) return instanceCreds;

    throw new Error("No valid AWS credentials found");
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return await getSignedUrl({
      accessKeyId: this.credentials.awsAccessKeyId,
      secretAccessKey: this.credentials.awsSecretKey,
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

class WebIdentityCredentials {
  constructor(
    private roleArn: string,
    private token: string,
  ) {}

  async getCredentials(): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string }> {
    const params = new URLSearchParams({
      Version: "2011-06-15",
      Action: "AssumeRoleWithWebIdentity",
      RoleArn: this.roleArn,
      RoleSessionName: `deno-session-${Date.now()}`,
      WebIdentityToken: this.token,
    });

    const response = await fetch(`https://sts.amazonaws.com?${params}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to assume role: ${await response.text()}`);
    }

    const xml = await response.text();
    const result = new DOMParser().parseFromString(xml, "text/xml");
    
    const credentials = result.querySelector("Credentials");
    if (!credentials) throw new Error("No credentials in response");

    return {
      accessKeyId: credentials.querySelector("AccessKeyId")?.textContent ?? "",
      secretAccessKey: credentials.querySelector("SecretAccessKey")?.textContent ?? "",
      sessionToken: credentials.querySelector("SessionToken")?.textContent ?? "",
    };
  }
} 
