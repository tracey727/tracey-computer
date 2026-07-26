import { cp, copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "public");

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "service-worker.js",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  const source = join(root, file);
  const destination = join(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

await cp(join(root, "assets"), join(output, "assets"), { recursive: true });

// A real static homepage at public/index.html prevents Vercel's successful-build/404 failure mode.
const homepage = await stat(join(output, "index.html"));
if (!homepage.isFile() || homepage.size < 100) {
  throw new Error("Build failed: public/index.html was not created correctly.");
}

console.log("Vercel static build ready: public/index.html and all browser assets were created.");
