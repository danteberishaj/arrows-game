/**
 * Reads release/vc<N>.env, the as-shipped record of a Play build (`set -a; . release/vc18.env; set +a`
 * exports it). Format: `# comment` lines and `EXPO_PUBLIC_NAME=value` lines; anything else is an error.
 * Zero dependencies; used by src/__tests__/releaseRecord.test.ts and the store checks in scripts/.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'release');

/** Every release/vc<N>.env, oldest versionCode first. */
function recordFiles() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((name) => /^vc\d+\.env$/.test(name))
    .sort((a, b) => Number(a.slice(2, -4)) - Number(b.slice(2, -4)))
    .map((name) => path.join(DIR, name));
}

/** The newest record (highest versionCode), or null when there is none. */
function latestRecord() {
  const files = recordFiles();
  return files.length > 0 ? files[files.length - 1] : null;
}

function readRecord(file) {
  const flags = new Map();
  const comments = [];
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.trim() === '') return;
      if (line.startsWith('#')) return void comments.push(line);
      const m = /^(EXPO_PUBLIC_[A-Z0-9_]+)=(.*)$/.exec(line);
      if (!m || flags.has(m[1])) throw new Error(`${file}:${i + 1}: not a unique EXPO_PUBLIC_NAME=value line`);
      flags.set(m[1], m[2]);
    });
  return { flags, comments };
}

module.exports = { recordFiles, latestRecord, readRecord };
