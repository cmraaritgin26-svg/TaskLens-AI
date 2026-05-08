#!/usr/bin/env sh
set -eu

echo "Checking Play Store readiness..."

npm run check

TARGET_SDK="$(grep -E 'targetSdkVersion' android/variables.gradle | head -1)"
COMPILE_SDK="$(grep -E 'compileSdkVersion' android/variables.gradle | head -1)"

echo "SDK config:"
echo "  $COMPILE_SDK"
echo "  $TARGET_SDK"

grep -q "35" android/variables.gradle || {
  echo "Expected API 35 in android/variables.gradle." >&2
  exit 1
}

test -f .github/workflows/play-release.yml || {
  echo "Missing GitHub Actions release workflow." >&2
  exit 1
}

test -f PLAYSTORE_DEPLOYMENT.md || {
  echo "Missing PLAYSTORE_DEPLOYMENT.md." >&2
  exit 1
}

test -f PRIVACY_POLICY_DRAFT.md || {
  echo "Missing PRIVACY_POLICY_DRAFT.md." >&2
  exit 1
}

echo "Local readiness checks passed."
echo "Final signed API 35 AAB still requires GitHub Actions or a desktop Android build environment."

