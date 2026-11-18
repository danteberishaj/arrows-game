#!/bin/bash
# usage: render.sh <app> <variant>  -> out/<app>-<variant>/pano.png + 01..05.png (1080x1920 RGB)
set -euo pipefail
cd "$(dirname "$0")"
app=$1 v=$2 out=out/$app-$v
mkdir -p "$out"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=1 --virtual-time-budget=4000 \
  --user-data-dir="$PWD/.chrome" --window-size=5400,1920 --screenshot="$out/pano.png" "file://$PWD/$app.html#$v" 2>/dev/null
~/.claude/tools/earshot/.venv/bin/python - "$out" <<'PY'
import sys; from PIL import Image
o=sys.argv[1]; p=Image.open(o+'/pano.png').convert('RGB'); assert p.size==(5400,1920), p.size
for i in range(5): p.crop((i*1080,0,(i+1)*1080,1920)).save(f'{o}/{i+1:02d}.png', optimize=True)
p.resize((1350,480)).save(o+'/strip.png')
PY
echo "$out ok"
