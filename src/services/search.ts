import { SearchOptions, StorageObject } from "../types/mod.ts";
import { StorageService } from "./storage.ts";

export class SearchService {
  constructor(private storageService: StorageService) {}

  async search(options: SearchOptions): Promise<StorageObject[]> {
    const listResult = await this.storageService.listObjects({
      prefix: options.prefix,
      maxKeys: options.maxKeys,
      continuationToken: options.continuationToken
    });

    // Filter objects based on search query
    return listResult.objects.filter(obj => 
      obj.key.toLowerCase().includes(options.query.toLowerCase())
    );
  }
} 
