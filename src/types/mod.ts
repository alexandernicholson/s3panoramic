export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
}

export interface ListObjectsResult {
  objects: StorageObject[];
  prefixes: string[];
  nextContinuationToken?: string;
  truncated: boolean;
}

export interface ListObjectsOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface SearchOptions extends ListObjectsOptions {
  query: string;
} 
