/**
 * W0-06 contrast audit. Reads the hex values in src/ui/theme.ts through src/ui/contrastAudit.ts.
 *
 *   npx tsx scripts/contrast-audit.ts
 *     Prints every usage row for both palettes (ratio, gate, PASS/FAIL), then the composited
 *     scrim rows as information (W5-05 owns them). Exits 1 if any gated row fails.
 *
 *   npx tsx scripts/contrast-audit.ts --solve <role> <bg> <gate>
 *     For each palette, walks <role>'s HSL lightness at its own hue and saturation (0.1-point
 *     steps) until it meets <gate> against <bg>. <bg> is a role, a #RRGGBB hex, or a
 *     comma-separated list of those (the colour must pass against every one). Prints the
 *     from/to hex and HSL so a reviewer can see hue and saturation were kept.
 */
import {
  PALETTES,
  Role,
  audit,
  scrimInfo,
  solveLightness,
  type Hsl,
} from '../src/ui/contrastAudit';

const fmtHsl = ({ h, s, l }: Hsl) => `hsl(${h.toFixed(2)}, ${s.toFixed(2)}%, ${l.toFixed(2)}%)`;

function printAudit(): number {
  const rows = audit();
  let fails = 0;
  for (const { name } of PALETTES) {
    console.log(`\n== ${name}`);
    console.log(
      ['id'.padEnd(30), 'kind'.padEnd(8), 'fg'.padEnd(20), 'bg'.padEnd(20), 'size'.padEnd(12), 'ratio'.padStart(6), 'gate'.padStart(5), 'result', 'site'].join('  '),
    );
    for (const r of rows.filter((x) => x.palette === name)) {
      const u = r.usage;
      if (!r.pass) fails++;
      const fg = `${u.fgRole}${u.fgAlpha !== undefined ? `@${u.fgAlpha}` : ''} ${r.fg}`;
      const size = u.kind === 'text' ? `${u.sizePx} ${u.weight}` : '-';
      console.log(
        [
          u.id.padEnd(30), u.kind.padEnd(8), fg.padEnd(20), `${u.bgRole} ${r.bg}`.padEnd(20), size.padEnd(12),
          r.ratio.toFixed(2).padStart(6), r.gate.toFixed(1).padStart(5), (r.pass ? 'PASS' : 'FAIL').padEnd(6), u.site,
        ].join('  '),
      );
    }
  }
  console.log('\n== Information only, not gated here (W5-05 owns): panel `surface` against its composited scrim');
  for (const s of scrimInfo()) {
    console.log(`${s.palette.padEnd(10)} ${s.state.padEnd(5)} scrim ${s.scrim}  ratio ${s.ratio.toFixed(2)}`);
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(`\n${rows.length} gated rows, ${failed.length} FAIL`);
  for (const r of failed) {
    console.log(`FAIL ${r.palette} / ${r.usage.id}: ${r.ratio.toFixed(2)} < ${r.gate}`);
  }
  return fails;
}

function resolveBg(spec: string, palette: Record<string, string>): string[] {
  return spec.split(',').map((t) => {
    if (/^#[0-9a-f]{6}$/i.test(t)) return t.toUpperCase();
    if (!(t in palette)) throw new Error(`unknown role: ${t}`);
    return palette[t];
  });
}

function solve(role: string, bgSpec: string, gateText: string): number {
  const gate = Number(gateText);
  if (!Number.isFinite(gate)) throw new Error(`gate must be a number: ${gateText}`);
  let unsolved = 0;
  for (const { name, palette } of PALETTES) {
    const p = palette as unknown as Record<string, string>;
    if (!(role in p)) throw new Error(`unknown role: ${role}`);
    const bgs = resolveBg(bgSpec, p);
    const sol = solveLightness(p[role as Role], bgs, gate);
    if (!sol) {
      unsolved++;
      console.log(`${name}: ${role} ${p[role]} cannot reach ${gate}:1 against ${bgs.join(',')} by lightness alone`);
      continue;
    }
    console.log(
      `${name}: ${role} ${sol.from} ${fmtHsl(sol.fromHsl)} -> ${sol.to} ${fmtHsl(sol.toHsl)}` +
        `  dL ${sol.deltaL >= 0 ? '+' : ''}${sol.deltaL.toFixed(1)}  ratio ${sol.ratio.toFixed(2)} vs ${bgSpec} (${bgs.join(',')})`,
    );
  }
  return unsolved;
}

const args = process.argv.slice(2);
if (args[0] === '--solve') {
  if (args.length !== 4) {
    console.error('usage: --solve <role> <bg> <gate>');
    process.exit(2);
  }
  process.exit(solve(args[1], args[2], args[3]) > 0 ? 1 : 0);
}
process.exit(printAudit() > 0 ? 1 : 0);
