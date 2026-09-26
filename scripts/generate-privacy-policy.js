#!/usr/bin/env node
/**
 * Generates docs/privacy-policy.html from store/privacy-policy.md (the
 * canonical text). Zero dependencies, deterministic (no timestamps), so running
 * it twice changes nothing and `git diff --exit-code docs/privacy-policy.html`
 * proves the committed HTML matches the Markdown.
 *
 *   node scripts/generate-privacy-policy.js
 *
 * Supported Markdown (exactly what the policy uses; anything else is an error,
 * so the page can never silently render raw syntax):
 *   # H1, ## H2, paragraphs (consecutive lines), `- ` list items (a following
 *   line indented by two spaces continues the item), **bold**, _italic_,
 *   <https://…> autolinks and [text](url) links.
 * HTML comments (`<!-- ev: ev-01 -->` evidence tags and draft notes) are
 * dropped from the output. The inline stylesheet is kept verbatim from the
 * hand-written page it replaces (W7-05).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'store', 'privacy-policy.md');
const OUT = path.join(ROOT, 'docs', 'privacy-policy.html');

const STYLE = `<style>
  body { background:#13111C; color:#EFEDF9; font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
         max-width:42rem; margin:0 auto; padding:2.5rem 1.25rem 4rem; line-height:1.6; }
  h1 { color:#A98FF8; font-size:1.6rem; }
  h2 { color:#CBC4F0; font-size:1.15rem; margin-top:2rem; }
  a  { color:#7C5CF5; }
  em { color:#A29DC1; font-style:normal; font-size:.9rem; }
  ul { padding-left:1.25rem; }
</style>`;

function fail(message) {
  process.stderr.write(`generate-privacy-policy: ${message}\n`);
  process.exit(1);
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

/** Inline Markdown → HTML for one block of text (may span lines). */
function inline(text, where) {
  const links = [];
  const hold = (html) => `\u0000${links.push(html) - 1}\u0000`;
  let out = text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) =>
      hold(`<a href="${escapeAttr(url)}">${escapeHtml(label)}</a>`))
    .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_, url) =>
      hold(`<a href="${escapeAttr(url)}">${escapeHtml(url.replace(/^mailto:/, ''))}</a>`));
  out = escapeHtml(out)
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/(^|[^\w])_(.+?)_(?!\w)/gs, '$1<em>$2</em>');
  if (out.includes('**')) fail(`unmatched ** in ${where}`);
  if (/\]\(/.test(out)) fail(`malformed link in ${where}`);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

function convert(markdown) {
  // Drop whole-line comments with their newline, then inline comments.
  let text = markdown.replace(/\r\n/g, '\n');
  text = text.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm, '');
  text = text.replace(/[ \t]*<!--[\s\S]*?-->/g, '');
  if (text.includes('<!--') || text.includes('-->')) fail('unterminated HTML comment');

  const lines = text.split('\n').map((line) => line.replace(/[ \t]+$/, ''));
  const body = [];
  let title = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const where = `store/privacy-policy.md line ${i + 1} (counted after comments are removed)`;
    if (line === '') {
      i += 1;
      continue;
    }
    if (/^# /.test(line)) {
      if (title !== null) fail(`second # heading at ${where}`);
      title = line.slice(2).trim();
      body.push(`<h1>${inline(title, where)}</h1>`);
      i += 1;
      continue;
    }
    if (/^## /.test(line)) {
      body.push(`\n<h2>${inline(line.slice(3).trim(), where)}</h2>`);
      i += 1;
      continue;
    }
    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        const itemLines = [lines[i].slice(2)];
        const itemWhere = `store/privacy-policy.md line ${i + 1} (counted after comments are removed)`;
        i += 1;
        while (i < lines.length && /^ {2}\S/.test(lines[i])) {
          itemLines.push(lines[i].slice(2));
          i += 1;
        }
        items.push(`  <li>${inline(itemLines.join('\n'), itemWhere)}</li>`);
      }
      body.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }
    if (/^(#{3,}|\s|\d+[.)]\s|[*+]\s|[>|`]|-{3,}|={3,})/.test(line)) {
      fail(`unsupported Markdown at ${where}: ${JSON.stringify(line)}`);
    }
    const para = [];
    while (i < lines.length && lines[i] !== '' && !/^(#|- )/.test(lines[i])) {
      para.push(lines[i].replace(/ {2,}/g, ' '));
      i += 1;
    }
    body.push(`<p>${inline(para.join('\n'), where)}</p>`);
  }
  if (title === null) fail('missing # title');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    STYLE,
    '</head>',
    '<body>',
    body.join('\n'),
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

if (require.main === module) {
  const html = convert(fs.readFileSync(SRC, 'utf8'));
  fs.writeFileSync(OUT, html);
}

module.exports = { convert };
