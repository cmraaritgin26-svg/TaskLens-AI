import { readFileSync } from "node:fs";

const bootstrapSource = readFileSync("src/app-parts/00-bootstrap-dom-events.js", "utf8");
const reviewSource = readFileSync("src/app-parts/20-review-wellbeing-journal.js", "utf8");
const taskSource = readFileSync("src/app-parts/10-tasks-coach.js", "utf8");
const html = readFileSync("index.html", "utf8");

function assertIncludes(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

assertIncludes(bootstrapSource, 'const photoAiTelemetryStoreKey = "tasklens-ai:photo-ai-telemetry:v1";', "Photo telemetry storage key is missing.");
assertIncludes(reviewSource, "recordPhotoAiTelemetry", "Photo flow telemetry must be recorded.");
assertIncludes(reviewSource, "performance.now()", "Photo flow telemetry must use real elapsed timing.");
assertIncludes(reviewSource, "Compressing photo", "Photo flow should show compression progress.");
assertIncludes(reviewSource, "Reading visible items", "Photo flow should show AI reading progress.");
assertIncludes(reviewSource, "Building checklist", "Photo flow should show checklist progress.");
assertIncludes(reviewSource, "function requestTaskTargetImage(task, modal, breakdown)", "After image generation must stay user-triggered.");
assertIncludes(reviewSource, 'button.textContent = error ? "Try after picture again" : "Make after picture";', "After image must be optional in the UI.");
assertIncludes(taskSource, "buildTaskCardPhotoThumb", "Task cards must render photo thumbnails when available.");
assertIncludes(taskSource, "buildTaskCardChecklistMeta", "Task cards must render checklist progress when available.");
assertIncludes(html, "<span>Take Photo</span>", "Primary hero action must be Take Photo.");
assertIncludes(html, ">Brain Dump<", "Secondary hero action must be Brain Dump.");
assertIncludes(html, "icons/tasklens-camera-button.png", "Primary photo button must use the cropped TaskLens camera mark.");
assertIncludes(html, 'id="winsPanel"', "Wins panel must be addressable.");
assertIncludes(html, 'role="button"', "Wins panel must be clickable.");
assertIncludes(taskSource, "function scrollToTaskList", "Wins panel must lead to the task list.");
assertIncludes(taskSource, 'habitList?.querySelector(".habit-card")', "Wins panel must prefer existing task cards.");

console.log("Photo flow smoke checks passed.");
