export interface Issue {
  readonly id: string;
  readonly number: number;
  readonly year: number;
  readonly variantCovers: number;
  readonly pages: number;
  readonly ratios: readonly number[];
  readonly size: number;
  readonly fingerprint: string;
  readonly file: string;
  readonly cover: string;
}

export interface LibraryManifest {
  readonly version: 1;
  readonly series: string;
  readonly publisher: string;
  readonly generatedAt: string;
  readonly issues: readonly Issue[];
}
