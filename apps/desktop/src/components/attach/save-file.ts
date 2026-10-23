// Saves one pasted, dropped or picked file where Duskie can read it.
// Images are saved as PNG, the format every vision model here takes.

import { api } from "@/lib/bridge";

export interface Attachment {
  name: string;
  path: string;
  /** A thumbnail for images. */
  url: string | null;
}

/** Larger files are refused: an agent reads them by path, but 20 MB is plenty. */
const MAX_BYTES = 20 * 1024 * 1024;

async function asPng(f: File): Promise<Blob> {
  if (f.type === "image/png") return f;
  const bmp = await createImageBitmap(f);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")?.drawImage(bmp, 0, 0);
  return new Promise((ok, fail) =>
    c.toBlob((b) => (b ? ok(b) : fail(new Error("Could not read the image"))), "image/png"),
  );
}

/** Thumbnails by saved path, so sent messages can show them too. */
const previews = new Map<string, string>();
export const previewOf = (path: string) => previews.get(path) ?? null;

export async function saveFile(f: File): Promise<Attachment> {
  if (f.size > MAX_BYTES) throw new Error(`${f.name} is over 20 MB`);
  const image = f.type.startsWith("image/");
  const blob = image ? await asPng(f) : f;
  const base = (f.name || (image ? "pasted" : "file")).replace(/\.[^.]*$/, "") || "file";
  const name = image ? `${base}.png` : f.name || "file";
  const path = await api.saveAttachment(name, Array.from(new Uint8Array(await blob.arrayBuffer())));
  const url = image ? URL.createObjectURL(blob) : null;
  if (url) previews.set(path, url);
  return { name, path, url };
}

/** Files on a paste or drop event, or none (plain text goes on as usual). */
export function eventFiles(e: { clipboardData?: DataTransfer | null; dataTransfer?: DataTransfer | null }): File[] {
  return Array.from((e.clipboardData ?? e.dataTransfer)?.files ?? []);
}
