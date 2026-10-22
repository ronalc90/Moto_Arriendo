// Generates the PWA icons in public/icons from scripts/icon.svg.
// Usage: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const svg = await readFile(path.join(root, "icon.svg"));
const out = path.join(root, "..", "public", "icons");
await mkdir(out, { recursive: true });

const render = (size) => sharp(svg, { density: 300 }).resize(size, size).png();

await render(192).toFile(path.join(out, "icon-192.png"));
await render(512).toFile(path.join(out, "icon-512.png"));
await render(180).toFile(path.join(out, "apple-touch-icon.png"));
await render(96).toFile(path.join(out, "badge-96.png"));
await render(48).toFile(path.join(root, "..", "src", "app", "icon.png"));

// Maskable: full-bleed background with the artwork inside the 80% safe zone.
const inner = await sharp(svg, { density: 300 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#1d2025" } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile(path.join(out, "maskable-512.png"));

console.log("Icons generated in public/icons");
