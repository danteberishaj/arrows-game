#!/usr/bin/env node
/**
 * The privacy policy must describe what the release build does. For every flag the release record (default: the
 * newest SHIPPED release/vc<N>.env; pass a path to judge a candidate) turns on that has a pending row in docs/data-safety.md section 8, the policy text
 * (store/privacy-policy.md, HTML comments dropped, as on the published page) must contain that row's phrase,
 * and must not contain a phrase the flag makes false. Zero dependencies.
 *
 *   node scripts/check-policy.js                     # the newest shipped record; exits 1 on a missing or stale sentence
 *   node scripts/check-policy.js release/vc19.env    # a candidate
 *
 * P-4 (TELEMETRY_TRANSPORT) and P-5 (REMOTE_KILL_SWITCH) are literal constants in src/featureFlags.ts, not
 * release flags; P-8 (a new native dependency) needs an AAB dump. They stay manual.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { latestRecord, readRecord } = require('./release-record');

const POLICY = path.join(__dirname, '..', 'store', 'privacy-policy.md');

const ROWS = [
  { id: 'P-1', flags: ['EXPO_PUBLIC_CONSENT_GATE'], present: "Google's consent message", absent: 'does not show a consent message' },
  { id: 'P-2', flags: ['EXPO_PUBLIC_CONSENT_GATE'], present: 'Ad privacy choices' },
  { id: 'P-3', flags: ['EXPO_PUBLIC_META_BANNER'], present: 'a banner on the menu screen' },
  { id: 'P-6', flags: ['EXPO_PUBLIC_META_REVIEW_PROMPT'], present: 'rating card' },
  { id: 'P-7', flags: ['EXPO_PUBLIC_META_SHARE_CARD', 'EXPO_PUBLIC_META_SHARE_CARD_LEVEL'], present: 'share sheet' },
  { id: 'P-9', flags: ['EXPO_PUBLIC_META_PETAL_ADS'], present: 'earn petals in the collection book' },
];

function check(recordFile, policyText) {
  const { flags } = readRecord(recordFile);
  const text = policyText.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
  const errors = [];
  for (const row of ROWS) {
    const on = row.flags.filter((f) => flags.get(f) === '1');
    if (on.length === 0) continue;
    if (!text.includes(row.present)) errors.push(`${row.id} (${on.join(', ')}): policy lacks "${row.present}"`);
    if (row.absent && text.includes(row.absent)) errors.push(`${row.id} (${on.join(', ')}): policy still says "${row.absent}"`);
  }
  return errors;
}

function main(argv) {
  const record = argv[2] || latestRecord();
  if (!record) {
    process.stderr.write('check-policy: no shipped release/vc<N>.env\n');
    return 1;
  }
  const errors = check(record, fs.readFileSync(POLICY, 'utf8'));
  for (const e of errors) process.stderr.write(`FAIL ${e}\n`);
  process.stdout.write(`check-policy: ${path.basename(record)} ${errors.length > 0 ? 'FAIL' : 'OK'}\n`);
  return errors.length > 0 ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv);

module.exports = { check, ROWS };
