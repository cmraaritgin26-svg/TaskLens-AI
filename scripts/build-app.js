import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const partsDir = path.join(root, "src", "app-parts");
const outputPath = path.join(root, "app.js");
const iphoneOutputPath = path.join(root, "iphone", "app.js");

const partFiles = [
  "00-bootstrap-dom-events.js",
  "10-tasks-coach.js",
  "20-review-wellbeing-journal.js",
  "30-charts-nutrition.js",
  "40-storage-settings-onboarding.js",
  "50-dictation-utilities.js"
];

const missing = partFiles.filter((file) => !fs.existsSync(path.join(partsDir, file)));
if (missing.length) {
  throw new Error(`Missing app source part(s): ${missing.join(", ")}`);
}

const output = partFiles
  .map((file) => fs.readFileSync(path.join(partsDir, file), "utf8").trimEnd())
  .join("\n\n");

fs.writeFileSync(outputPath, `${output}\n`);
if (fs.existsSync(path.dirname(iphoneOutputPath))) {
  fs.writeFileSync(iphoneOutputPath, `${output}\n`);
}
