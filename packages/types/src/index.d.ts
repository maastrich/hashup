export interface HashupOptions {
  entry_files: string[];
  extras?: string[];
  base_dir?: string;
}

export interface HashupResult {
  hash: string;
  files: string[];
}
