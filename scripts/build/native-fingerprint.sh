#!/bin/sh
# Native-input fingerprint for test-APK builds (PROCESS-SPEED E3, docs/process/speed-experiments-2026-10-07.md).
#
#   scripts/build/native-fingerprint.sh [manifest-out]     prints the sha256; writes the per-input manifest if asked
#
# Covers every input that can change what `expo prebuild` generates or what Gradle compiles natively:
#   - app config: app.json / app.config.*, and every ./assets path app.json names (icons, splash images go to res/);
#   - package.json, package-lock.json, and node_modules/.package-lock.json (the INSTALLED tree, so an `npm install`
#     without a lockfile change still counts);
#   - plugins/, patches/, modules/*/android, modules/*/ios, modules/*/expo-module.config.json, modules/*/package.json
#     (tracked and untracked-not-ignored files; build outputs are gitignored and so never hashed);
#   - credentials/* (content hashes only; signing config is native);
#   - the build script and this script (their android/ edits are native inputs);
#   - environment: ABIS, Node version, JAVA_HOME, ANDROID_HOME, and every EXPO_* / ARROWS_* variable EXCEPT
#     EXPO_PUBLIC_* (values hashed, never printed). EXPO_PUBLIC_* only reach the JS bundle (babel inlining; app.json is
#     static and no config plugin reads them), and the bundle task always reruns with --reset-cache.
# Residual risk (documented, not covered): a hand edit inside node_modules/<pkg>/android without a patches/ file.
# Run from the repo root. Prints nothing else on stdout.
set -eu
out=${1:-}
[ -f app.json ] && [ -f package.json ] || { echo 'native-fingerprint: run from the repo root' >&2; exit 2; }
assets=$(grep -o '"\./[^"]*"' app.json | tr -d '"' | sed 's#^\./##' | sort -u)
manifest=$(
  {
    # shellcheck disable=SC2086
    git ls-files -co --exclude-standard -- app.json 'app.config.*' package.json package-lock.json plugins patches \
      'modules/*/android/*' 'modules/*/ios/*' 'modules/*/expo-module.config.json' 'modules/*/package.json' \
      scripts/build/build-test-apk.sh scripts/build/native-fingerprint.sh $assets
    echo node_modules/.package-lock.json
    for f in credentials/*; do [ -f "$f" ] && echo "$f"; done
  } | sort -u | while IFS= read -r f; do
    if [ -f "$f" ]; then printf 'file\t%s\t%s\n' "$f" "$(shasum -a 256 < "$f" | cut -c1-64)"; else printf 'missing\t%s\t-\n' "$f"; fi
  done
  printf 'env\tABIS\t%s\n' "${ABIS:-unset}"
  printf 'env\tnode\t%s\n' "$(node -v 2>/dev/null || echo none)"
  printf 'env\tJAVA_HOME\t%s\n' "${JAVA_HOME:-unset}"
  printf 'env\tANDROID_HOME\t%s\n' "${ANDROID_HOME:-unset}"
  env | sed -nE 's/^((EXPO|ARROWS)_[A-Za-z0-9_]*)=.*/\1/p' | grep -v '^EXPO_PUBLIC_' | sort -u | while IFS= read -r name; do
    value=$(printenv "$name" || true)
    printf 'env\t%s\t%s\n' "$name" "$(printf '%s' "$value" | shasum -a 256 | cut -c1-64)"
  done
)
[ -n "$out" ] && printf '%s\n' "$manifest" > "$out"
printf '%s\n' "$manifest" | shasum -a 256 | cut -c1-64
