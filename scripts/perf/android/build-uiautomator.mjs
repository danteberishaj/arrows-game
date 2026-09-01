import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export function resolveAndroidSdkRoot() {
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    '/Users/gentlegen/Library/Android/sdk',
  ].filter(Boolean);
  const root = candidates.find((candidate) => existsSync(join(candidate, 'platform-tools', 'adb')));
  if (!root) throw new Error('Android SDK was not found');
  return root;
}

export function buildInputDriver({ sdkRoot, apiLevel, outputDir }) {
  const platformDir = join(sdkRoot, 'platforms', `android-${apiLevel}`);
  const androidJar = join(platformDir, 'android.jar');
  for (const file of [androidJar]) {
    if (!existsSync(file)) throw new Error(`Android SDK file is missing: ${file}`);
  }

  const buildToolsRoot = join(sdkRoot, 'build-tools');
  const versions = readdirSync(buildToolsRoot)
    .filter((version) => existsSync(join(buildToolsRoot, version, 'd8')))
    .sort(compareVersions);
  const d8 = join(buildToolsRoot, versions[versions.length - 1], 'd8');
  const classesDir = join(outputDir, 'classes');
  const classesJar = join(outputDir, 'classes.jar');
  const outputJar = join(outputDir, 'arrows-perf-input.jar');
  mkdirSync(classesDir, { recursive: true });

  run('javac', [
    '-source', '8',
    '-target', '8',
    '-Xlint:-options',
    '-cp', androidJar,
    '-d', classesDir,
    join(SCRIPT_DIR, 'ArrowsWorkload.java'),
  ]);
  run('jar', ['cf', classesJar, '-C', classesDir, '.']);
  run(d8, [
    '--release',
    '--min-api', '23',
    '--lib', androidJar,
    '--output', outputJar,
    classesJar,
  ]);

  if (!existsSync(outputJar)) throw new Error('d8 did not create the workload JAR');
  return outputJar;
}

function compareVersions(a, b) {
  const aa = a.split(/[^0-9]+/).map(Number);
  const bb = b.split(/[^0-9]+/).map(Number);
  for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
    const difference = (aa[index] ?? 0) - (bb[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.localeCompare(b);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status})\n${result.stdout}${result.stderr}`);
  }
}
