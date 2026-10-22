/** A model OpenRouter offers; prices in US dollars per million tokens. */
export interface RouterModel {
  id: string;
  name: string;
  free: boolean;
  input: number;
  output: number;
  context: number;
  tools: boolean;
}

/** One group in the Storage view. */
export interface DiskGroup {
  id: string;
  label: string;
  what: string;
  bytes: number;
  partial: boolean;
  items: { path: string; bytes: number }[];
  clearable: boolean;
}
