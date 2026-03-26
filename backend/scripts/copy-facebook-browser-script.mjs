import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = join(root, "src", "scrapers", "facebook-cge-feed-collect.browser.js");
const destDir = join(root, "dist", "scrapers");
const dest = join(destDir, "facebook-cge-feed-collect.browser.js");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Copied facebook-cge-feed-collect.browser.js to dist/scrapers/");
