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

test("PWA icon files match declared Android and browser sizes", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
  const icons = new Map(manifest.icons.map((icon) => [`${icon.src}:${icon.purpose}`, icon]));

  for (const size of [48, 72, 96, 128, 144, 152, 192, 384, 512]) {
    const icon = icons.get(`assets/icons/icon-${size}.png:any`);
    assert.ok(icon, `Missing standard icon ${size}`);
    assert.equal(icon.sizes, `${size}x${size}`);
    assert.deepEqual(readPngSize(icon.src), { width: size, height: size });
  }

  for (const size of [192, 512]) {
    const icon = icons.get(`assets/icons/maskable-${size}.png:maskable`);
    assert.ok(icon, `Missing maskable icon ${size}`);
    assert.equal(icon.sizes, `${size}x${size}`);
    assert.deepEqual(readPngSize(icon.src), { width: size, height: size });
  }

  assert.ok(html.includes('sizes="16x16" href="assets/icons/favicon-16.png"'));
  assert.ok(html.includes('sizes="32x32" href="assets/icons/favicon-32.png"'));
  assert.ok(html.includes('sizes="180x180" href="assets/icons/apple-touch-icon.png"'));
  assert.deepEqual(readPngSize("assets/icons/favicon-16.png"), { width: 16, height: 16 });
  assert.deepEqual(readPngSize("assets/icons/favicon-32.png"), { width: 32, height: 32 });
  assert.deepEqual(readPngSize("assets/icons/apple-touch-icon.png"), { width: 180, height: 180 });
});

function readPngSize(path) {
  const bytes = fs.readFileSync(path);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${path} is not a PNG`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}
