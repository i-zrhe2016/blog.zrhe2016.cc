import { cpSync } from "node:fs";
cpSync("dist/pagefind", "public/pagefind", { recursive: true });
