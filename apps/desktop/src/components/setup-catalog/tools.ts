// Setup rows for tools. Titles mirror apps/desktop/src-tauri/src/setup.rs.

import type { CatalogRow } from "./row";

export const TOOL_ROWS: CatalogRow[] = [
  {
    id: "gh",
    group: "tools",
    title: "GitHub CLI",
    why: "Open PRs in the morning brief.",
    recommended: true,
  },
  {
    id: "git",
    group: "tools",
    title: "Git",
    why: "Repo status and unsaved work.",
    recommended: true,
  },
  {
    id: "vscode",
    group: "tools",
    title: "Code editor",
    why: "Opens your projects and files: Cursor, VS Code, Antigravity, PyCharm and others.",
    recommended: true,
  },
  {
    id: "tesseract",
    group: "tools",
    title: "Tesseract",
    why: "Copy text out of screenshots.",
    recommended: true,
  },
  {
    id: "poppler",
    group: "tools",
    title: "Poppler",
    why: "Summarize PDFs.",
    recommended: false,
  },
  {
    id: "pandoc",
    group: "tools",
    title: "Pandoc",
    why: "Summarize Word files and convert documents.",
    recommended: false,
  },
  {
    id: "ffmpeg",
    group: "tools",
    title: "FFmpeg",
    why: "Convert videos and audio.",
    recommended: false,
  },
  {
    id: "magick",
    group: "tools",
    title: "ImageMagick",
    why: "Convert and resize images.",
    recommended: false,
  },
  {
    id: "docker",
    group: "tools",
    title: "Docker Desktop",
    why: "Start Docker when a project needs it.",
    recommended: false,
  },
  {
    id: "libreoffice",
    group: "tools",
    title: "LibreOffice",
    why: "Convert Office files to PDF.",
    recommended: false,
  },
];
