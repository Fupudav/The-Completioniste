import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("manifest and service worker reference existing app shell files", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
  const serviceWorker = fs.readFileSync("service-worker.js", "utf8");

  assert.equal(manifest.display, "standalone");
  assert.ok(html.includes('type="module" src="assets/js/app.js"'));

  const refs = [
    ...html.matchAll(/(?:href|src)="([^"]+)"/g),
    ...manifest.icons.map((icon) => [null, icon.src]),
    ...serviceWorker.matchAll(/"(\.\/[^"]+)"/g)
  ]
    .map((match) => match[1])
    .filter(Boolean)
    .map((ref) => ref.replace(/^\.\//, ""))
    .filter((ref) => ref && ref !== ".");

  for (const ref of refs) {
    assert.ok(fs.existsSync(ref), `Expected ${ref} to exist`);
  }
});
