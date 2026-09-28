import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CAT_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];

export function downloadBytes(name: string, bytes: Uint8Array | string, mime = "application/octet-stream"): Promise<string | null> {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  if (window.dueto) return window.dueto.file.save({ defaultName: name, bytes: data });
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Promise.resolve(name);
}

export async function pickFiles(opts: { title?: string; extensions: string[]; multiple?: boolean }): Promise<{ name: string; bytes: Uint8Array }[]> {
  if (window.dueto) return window.dueto.file.open({ title: opts.title, filters: [{ name: "Arquivos", extensions: opts.extensions }], multiple: opts.multiple });
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = !!opts.multiple;
    input.accept = opts.extensions.map((e) => "." + e).join(",");
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.click();
  });
}
