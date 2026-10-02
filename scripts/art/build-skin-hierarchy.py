#!/usr/bin/env python3
"""Build the shell-only API31 live reader; never add a class to the app APK."""
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
sdk = Path('/Users/gentlegen/Library/Android/sdk')
jdk = Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin')
out = root / os.environ.get('ART_SKINS_DIR', 'artifacts/ART-SKINS-08') / 'checks/hierarchy-driver'
out.mkdir(exist_ok=True)
(out / 'classes').mkdir(exist_ok=True)
platform = sdk / 'platforms/android-31'
classpath = ':'.join(map(str, [platform / 'android.jar', platform / 'uiautomator.jar', platform / 'optional/android.test.base.jar']))
commands = [
    [str(jdk / 'javac'), '-source', '8', '-target', '8', '-Xlint:-options', '-cp', classpath,
     '-d', str(out / 'classes'), str(root / 'scripts/art/ArrowsHierarchy.java')],
    [str(jdk / 'jar'), 'cf', str(out / 'classes.jar'), '-C', str(out / 'classes'), '.'],
    [str(sdk / 'build-tools/36.0.0/d8'), '--min-api', '23', '--lib', str(platform / 'android.jar'),
     '--lib', str(platform / 'uiautomator.jar'), '--output', str(out / 'hierarchy.jar'), str(out / 'classes.jar')],
]
for command in commands:
    subprocess.run(command, check=True)
