#!/bin/sh
# HALLOWEEN-PLUS: every native contract mode on emulator-5556 with the contract APK installed (prove-apk.py contract
# first). `before` is the frozen ART03 red control: each level exits 1 by design, so its per-level JSON is judged by
# summarize-contract.py instead. Exits non-zero on the first failing mode, then pulls the native Canvas renders.
set -eu
export PATH=/Users/gentlegen/.nvm/versions/node/v20.19.4/bin:$PATH
[ "$(node -v)" = v20.19.4 ]
export ART_SKINS_DIR=artifacts/HALLOWEEN-PLUS
ADB=/Users/gentlegen/Library/Android/sdk/platform-tools/adb
for mode in before after polish halloween; do
  echo "=== $mode $(date)"
  if [ "$mode" = before ]; then
    node scripts/art/run-skin-contract.mjs before || true
  else
    node scripts/art/run-skin-contract.mjs "$mode"
  fi
done
N=$ART_SKINS_DIR/screens/native
mkdir -p "$N"
for id in mummy-a mummy-b potion-slime-a potion-slime-b potion-slime-c little-bat-a little-bat-b pumpkin ghost candy-corn classic; do
  for theme in light dark; do
    for kind in board fixture; do
      "$ADB" -s emulator-5556 pull "/sdcard/Android/data/com.danteb.arrows/files/art07-after-$id-$theme-$kind.png" "$N/" > /dev/null
    done
  done
done
ls "$N" | wc -l
echo "=== done $(date)"
