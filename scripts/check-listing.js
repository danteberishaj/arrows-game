#!/usr/bin/env node
/**
 * Checks store listing drafts (W7-08) for field length limits and banned
 * phrases. Zero dependencies.
 *
 *   node scripts/check-listing.js store/listing/play.md store/listing/apple.md
 *
 * File format: a field starts at column 0 as `key: value`. A value of `|`
 * starts a block: the following lines indented by two spaces (and blank lines
 * between them) are the value, with the indent removed. Every other line
 * (headings, prose, the claims -> evidence list) is ignored, so prose must not
 * start with a lowercase `word:` at column 0; an unknown key is an error.
 *
 * Exits 1 on an over-length field, a banned phrase in any field value, an
 * unknown or duplicate key, an empty value, or a file with no required field.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Store limits in characters (Unicode code points).
// Play: title 30, short description 80, full description 4000.
// Apple: name 30, subtitle 30, keywords 100, promotional text 170, description 4000.
const LIMITS = {
  title: 30, // Play; title_1..title_3 are the owner's candidates
  short_description: 80,
  full_description: 4000,
  name: 30, // Apple; name_1..name_3 are candidates
  subtitle: 30,
  keywords: 100,
  promotional_text: 170,
  description: 4000,
};

const REQUIRED = {
  play: ['title', 'short_description', 'full_description'],
  apple: ['name', 'subtitle', 'keywords', 'description'],
};

// Ruling W7-9: Track A (no ordering mechanic) and the measured flat curve.
// "gets harder" until W3 ships a measured curve; "infinite"/"endless" because
// the curve is flat and the shape catalogue is finite.
const BANNED = [
  'find the order',
  'logic',
  'strategy',
  'plan your',
  'think ahead',
  'brain teaser',
  'gets harder',
  'infinite',
  'endless',
];

const FIELD_START = /^([a-z][a-z0-9_]*):(?: (.*))?$/;

function baseKey(key) {
  return key.replace(/_[0-9]+$/, '');
}

function parse(text, file, errors) {
  const fields = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const m = FIELD_START.exec(lines[i]);
    if (!m) {
      i += 1;
      continue;
    }
    const [, key, rest = ''] = m;
    const lineNo = i + 1;
    let value;
    i += 1;
    if (rest.trim() === '|') {
      const block = [];
      while (i < lines.length && (lines[i] === '' || lines[i].startsWith('  '))) {
        block.push(lines[i].slice(2));
        i += 1;
      }
      while (block.length > 0 && block[block.length - 1].trim() === '') block.pop();
      value = block.join('\n');
    } else {
      value = rest.trim();
    }
    if (!(baseKey(key) in LIMITS)) {
      errors.push(`${file}:${lineNo}: unknown field "${key}"`);
      continue;
    }
    if (fields.some((f) => f.key === key)) {
      errors.push(`${file}:${lineNo}: duplicate field "${key}"`);
      continue;
    }
    fields.push({ key, value, lineNo });
  }
  return fields;
}

function checkFile(file) {
  const errors = [];
  const text = fs.readFileSync(file, 'utf8');
  const fields = parse(text, file, errors);
  const store = path.basename(file).toLowerCase().includes('apple') ? 'apple' : 'play';

  for (const need of REQUIRED[store]) {
    if (!fields.some((f) => baseKey(f.key) === need)) {
      errors.push(`${file}: missing required ${store} field "${need}"`);
    }
  }
  const report = [];
  for (const { key, value, lineNo } of fields) {
    const limit = LIMITS[baseKey(key)];
    const length = [...value].length;
    report.push(`${file}:${lineNo}: ${key} ${length}/${limit}`);
    if (length === 0) errors.push(`${file}:${lineNo}: ${key} is empty`);
    if (length > limit) {
      errors.push(`${file}:${lineNo}: ${key} is ${length} characters, over the ${limit} limit`);
    }
    const lower = value.toLowerCase();
    for (const phrase of BANNED) {
      if (lower.includes(phrase)) {
        errors.push(`${file}:${lineNo}: ${key} contains banned phrase "${phrase}"`);
      }
    }
  }
  return { errors, report };
}

function main(argv) {
  const files = argv.slice(2);
  if (files.length === 0) {
    process.stderr.write('usage: node scripts/check-listing.js <listing.md>...\n');
    return 1;
  }
  let failed = false;
  for (const file of files) {
    const { errors, report } = checkFile(file);
    for (const line of report) process.stdout.write(`${line}\n`);
    for (const line of errors) process.stderr.write(`FAIL ${line}\n`);
    if (errors.length > 0) failed = true;
  }
  process.stdout.write(failed ? 'check-listing: FAIL\n' : 'check-listing: OK\n');
  return failed ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv);

module.exports = { checkFile, BANNED, LIMITS };
