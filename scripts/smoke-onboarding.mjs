import { readFileSync } from "node:fs";

const onboardingSource = readFileSync("src/app-parts/40-storage-settings-onboarding.js", "utf8");
const taskSource = readFileSync("src/app-parts/10-tasks-coach.js", "utf8");
const reviewSource = readFileSync("src/app-parts/20-review-wellbeing-journal.js", "utf8");
const html = readFileSync("index.html", "utf8");
const styles = readFileSync("styles.css", "utf8");

function assertIncludes(source, text, message) {
  if (!source.includes(text)) {
    throw new Error(message);
  }
}

function assertMatches(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

assertIncludes(onboardingSource, "function createTaskDraft", "Missing central task draft helper.");
assertIncludes(onboardingSource, "function getOnboardingState", "Missing centralized onboarding state getter.");
assertIncludes(onboardingSource, "function saveOnboardingState", "Missing centralized onboarding state saver.");
assertIncludes(onboardingSource, "input name=\"startingPoint\" type=\"radio\"", "Starting choices must be real radio controls.");
assertIncludes(onboardingSource, "saveOnboardingState({ startingPoint: input.value })", "Starting choice clicks must save state.");
assertIncludes(onboardingSource, "Start with a photo", "Photo onboarding CTA should be primary and direct.");
assertIncludes(onboardingSource, "openTaskBreakdownPrompt(task, { cancelDeletesTask: true, autoPhoto: true })", "Onboarding photo path must open the camera/photo picker.");
assertIncludes(onboardingSource, "getOnboardingStartingContext(onboardingState)", "Photo task must use the selected onboarding context.");
assertIncludes(reviewSource, "currentName.endsWith(\" photo checklist\")", "Contextual photo checklist names must remain renameable.");
assertIncludes(reviewSource, "buildTaskBreakdownAfterPhotoCard", "Checklist must render the after photo at the end of the steps.");
assertIncludes(reviewSource, "label.textContent = \"After\"", "After photo heading must be exactly After.");
assertIncludes(reviewSource, "modal.body.append(...[nameEditor, sourceCard, list, afterPhotoCard, addForm, actions].filter(Boolean))", "After photo must immediately follow the checklist list.");
assertIncludes(reviewSource, "modal?.body?.isConnected", "After photo rendering must tolerate the dialog closing before render.");
assertIncludes(reviewSource, "requestTaskTargetImage", "After picture should be available as an optional manual action.");
assertIncludes(reviewSource, "getTaskBreakdownAfterImageDataUrl", "After block should render saved after or generated target images.");
assertIncludes(reviewSource, 'button.textContent = error ? "Try after picture again" : "Make after picture";', "After picture generation must be user-triggered.");
assertIncludes(reviewSource, "imageDataUrl: String(options.imageDataUrl || \"\").slice(0, 900000)", "Photo checklist uploads must stay small enough to return quickly.");
if (/Add after photo|Replace after photo|Make target picture|Remake target picture/.test(reviewSource)) {
  throw new Error("Manual after/target picture buttons must not be rendered.");
}
assertIncludes(taskSource, "card.addEventListener(\"click\"", "Task cards must open checklist/photos when clicked.");
assertIncludes(taskSource, "openTaskBreakdownDialog(habit)", "Task card click must open checklist/photos.");
if (/task-edit-button|textContent = "Edit"/.test(taskSource)) {
  throw new Error("Task cards must not render a separate Edit button.");
}
assertIncludes(styles, ".onboarding-start-choice", "Starting choices need visible control styling.");
assertIncludes(html, 'class="task-choice-group"', "Task composer dropdowns should render as segmented controls.");
assertIncludes(taskSource, "function syncTaskChoiceButtons", "Segmented task controls must sync back to hidden select values.");
assertMatches(html, /TaskLens Premium/, "Premium panel should remain user-facing.");
if (/premiumTestToggle|Premium test mode/i.test(html)) {
  throw new Error("Developer premium test controls must not be present in settings markup.");
}

console.log("Onboarding smoke checks passed.");
