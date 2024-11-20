import { ListObjectsOptions, ListObjectsResult, StorageObject } from "../types/mod.ts";
import { S3, type ListObjectsV2Request } from "https://deno.land/x/aws_api@v0.8.1/services/s3/mod.ts";
import { ApiFactory } from "https://deno.land/x/aws_api@v0.8.1/client/mod.ts";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign@2.2.1/mod.ts";
import { parse as parseXml } from "jsr:@libs/xml";

interface Credentials {
  awsAccessKeyId: string;
  awsSecretKey: string;
  sessionToken?: string;
}

interface StorageServiceConfig {
  bucket: string;
  region: string;
}

export class StorageService {
  private client: S3;
  private credentials!: Credentials;

  constructor(private config: StorageServiceConfig) {
    this.initializeClient();
  }

  private async initializeClient() {
    this.credentials = await this.resolveCredentials();
    const factory = new ApiFactory({
      region: this.config.region,
      credentials: this.credentials,
    });
    
    this.client = new S3(factory);
  }

  // Make sure any method that uses this.client waits for initialization
  private async ensureInitialized() {
    if (!this.client) {
      await this.initializeClient();
    }
  }

  private async fetchInstanceProfileCredentials(): Promise<[Credentials | null, string | null]> {
    try {
      const metadataUrl = "http://169.254.169.254/latest/meta-data/iam/security-credentials/";
      const roleName = await (await fetch(metadataUrl)).text();
      const credentials = await (await fetch(`${metadataUrl}${roleName}`)).json();
      
      return [{
        awsAccessKeyId: credentials.AccessKeyId,
        awsSecretKey: credentials.SecretAccessKey,
        sessionToken: credentials.Token,
      }, null];
    } catch (error) {
      return [null, `Instance profile credentials failed: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  private async fetchIRSACredentials(): Promise<[Credentials | null, string | null]> {
    const roleArn = Deno.env.get("AWS_ROLE_ARN");
    const tokenFile = Deno.env.get("AWS_WEB_IDENTITY_TOKEN_FILE");

    if (!roleArn || !tokenFile) {
      return [null, "IRSA credentials not configured: missing AWS_ROLE_ARN or AWS_WEB_IDENTITY_TOKEN_FILE"];
    }

    try {
      const token = await Deno.readTextFile(tokenFile);
      const sts = new WebIdentityCredentials(roleArn, token);
      const creds = await sts.getCredentials();
      
      return [{
        awsAccessKeyId: creds.accessKeyId,
        awsSecretKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      }, null];
    } catch (error) {
      return [null, `IRSA credentials failed: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  private getStaticCredentials(): [Credentials | null, string | null] {
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");

    if (!accessKeyId || !secretKey) {
      return [null, "Static credentials not configured: missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY"];
    }

    return [{
      awsAccessKeyId: accessKeyId,
      awsSecretKey: secretKey,
    }, null];
  }

  private async resolveCredentials(): Promise<Credentials> {
    const errors: string[] = [];

    // Try IRSA first
    const [irsaCreds, irsaError] = await this.fetchIRSACredentials();
    if (irsaCreds) return irsaCreds;
    if (irsaError) errors.push(irsaError);

    // Then try static credentials
    const [staticCreds, staticError] = this.getStaticCredentials();
    if (staticCreds) return staticCreds;
    if (staticError) errors.push(staticError);

    // Finally try instance profile
    const [instanceCreds, instanceError] = await this.fetchInstanceProfileCredentials();
    if (instanceCreds) return instanceCreds;
    if (instanceError) errors.push(instanceError);

    throw new Error(`No valid AWS credentials found:\n${errors.join('\n')}`);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    await this.ensureInitialized();
    return await getSignedUrl({
      accessKeyId: this.credentials.awsAccessKeyId,
      secretAccessKey: this.credentials.awsSecretKey,
      bucket: this.config.bucket,
      key,
      region: this.config.region,
      expiresIn,
    });
  }

  async listObjects(options: ListObjectsOptions): Promise<ListObjectsResult> {
    await this.ensureInitialized();
    try {
      const params: ListObjectsV2Request = {
        Bucket: this.config.bucket,
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
        Bucket: this.config.bucket,
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

    const url = `https://sts.amazonaws.com?${params}`;
    const response = await fetch(url, {
      method: "GET",
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('IRSA Request Failed:', {
        url,
        requestHeaders: {
          method: "GET",
          RoleArn: this.roleArn,
          TokenLength: this.token.length,
        },
        responseStatus: response.status,
        responseHeaders: Object.fromEntries(response.headers),
        responseBody: responseText
      });
      throw new Error(`Failed to assume role: ${responseText}`);
    }

    const result = parseXml(responseText);
    const credentials = result.AssumeRoleWithWebIdentityResponse?.AssumeRoleWithWebIdentityResult?.Credentials;
    
    if (!credentials) {
      console.error('IRSA Parsing Failed:', {
        parsedXml: JSON.stringify(result, null, 2),
        rawResponse: responseText
      });
      throw new Error("No credentials in response. Full response: " + JSON.stringify(result, null, 2));
    }

    const { AccessKeyId, SecretAccessKey, SessionToken } = credentials;
    if (!AccessKeyId || !SecretAccessKey || !SessionToken) {
      console.error('IRSA Missing Fields:', {
        hasAccessKeyId: !!AccessKeyId,
        hasSecretAccessKey: !!SecretAccessKey,
        hasSessionToken: !!SessionToken,
        parsedCredentials: credentials
      });
      throw new Error("Missing required credential fields in response");
    }

    return {
      accessKeyId: AccessKeyId,
      secretAccessKey: SecretAccessKey,
      sessionToken: SessionToken,
    };
  }
} 
