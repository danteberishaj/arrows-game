#!/usr/bin/env python3
"""Build the shell-only clock anchor using the existing local Android toolchain."""
import os, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[2]
out=root/'artifacts/ART-SKINS-06/perf/clock'
classes=out/'classes';classes.mkdir(parents=True,exist_ok=True)
sdk=pathlib.Path('/Users/gentlegen/Library/Android/sdk')
java=pathlib.Path('/Applications/Android Studio.app/Contents/jbr/Contents/Home')
android=sdk/'platforms/android-36/android.jar'
env=dict(os.environ,JAVA_HOME=str(java));env['PATH']=str(java/'bin')+':'+env['PATH']
subprocess.run([str(java/'bin/javac'),'--release','8','-cp',str(android),'-d',str(classes),str(root/'scripts/art/SkinPickerClock.java')],env=env,check=True)
subprocess.run([str(sdk/'build-tools/36.0.0/d8'),'--lib',str(android),'--min-api','31','--output',str(out/'clock.jar'),str(classes/'com/arrows/art/SkinPickerClock.class')],env=env,check=True)
