#!/usr/bin/env node
/**
 * Verify app.json / plugin asset paths exist before Metro starts.
 * Creates splash-icon.png from splash-image.png when missing.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const imagesDir = path.join(root, "assets", "images");

const required = [
  "icon.png",
  "adaptive-icon.png",
  "favicon.png",
  "splash-icon.png",
];

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const splashIcon = path.join(imagesDir, "splash-icon.png");
const splashImage = path.join(imagesDir, "splash-image.png");
if (!fs.existsSync(splashIcon) && fs.existsSync(splashImage)) {
  fs.copyFileSync(splashImage, splashIcon);
  console.log("[assets] Created assets/images/splash-icon.png from splash-image.png");
}

const missing = required.filter(
  (name) => !fs.existsSync(path.join(imagesDir, name))
);

if (missing.length > 0) {
  console.error(
    `[assets] Missing manifest files: ${missing.map((n) => `assets/images/${n}`).join(", ")}`
  );
  process.exit(1);
}
