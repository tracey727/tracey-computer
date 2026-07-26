import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("GitHub/Vercel deployment contract prevents a successful-build 404", async () => {
  const pkg = await readJson("package.json");
  const vercel = await readJson("vercel.json");
  const homepage = await readFile(new URL("public/index.html", root), "utf8");
  const homepageInfo = await stat(new URL("public/index.html", root));

  assert.equal(pkg.scripts.build, "node scripts/build.mjs");
  assert.match(pkg.scripts.verify, /npm run build/);
  assert.equal(vercel.framework, null);
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.outputDirectory, "public");
  assert.ok(vercel.rewrites.some((rule) => rule.source === "/" && rule.destination === "/index.html"));
  assert.ok(homepageInfo.isFile());
  assert.ok(homepageInfo.size > 1000);
  assert.match(homepage, /GENEVIEVE Super Response/);
  assert.match(homepage, /src="\/app\.js"/);
});
