// Loads Monaco only when the editor opens, so the island never pays for it.
// Workers are bundled into public/monaco by scripts/build-monaco-workers.mjs
// and served as plain files, which keeps them working in the static export.

type Monaco = typeof import("monaco-editor");

let loading: Promise<Monaco> | null = null;

export function loadMonaco(): Promise<Monaco> {
  if (!loading) {
    (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
      getWorker(_id: string, label: string) {
        const name =
          label === "json"
            ? "json"
            : ["css", "scss", "less"].includes(label)
              ? "css"
              : label === "html"
                ? "html"
                : label === "typescript" || label === "javascript"
                  ? "ts"
                  : "editor";
        return new Worker(`/monaco/${name}.worker.js`);
      },
    };
    loading = import("monaco-editor");
  }
  return loading;
}

const LANGS: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  rs: "rust",
  py: "python",
  go: "go",
  java: "java",
  cs: "csharp",
  toml: "ini",
  yml: "yaml",
  yaml: "yaml",
  sh: "shell",
  ps1: "powershell",
  sql: "sql",
};

export function languageOf(path: string): string {
  return LANGS[path.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext";
}
