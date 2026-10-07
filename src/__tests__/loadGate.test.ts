import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * PROCESS-SPEED E4: scripts/process/load-gate.sh records host conditions and waits on a load threshold. Driven with
 * synthetic load-average and process-table files (its LOAD_GATE_* test hooks), so the real host load does not matter.
 * docs/process/speed-experiments-2026-10-07.md.
 */
const SCRIPT = resolve(__dirname, '../../scripts/process/load-gate.sh');
const OWNER = '500';
const PS = [
  '1 0 /sbin/launchd',
  `${OWNER} 1 -zsh`,
  // Started by the owner shell (directly or deeper): never reported.
  `600 ${OWNER} java -cp gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain assembleRelease`,
  '601 600 node /repo/node_modules/jest-worker/build/workers/processChild.js',
  // Foreign: another session's build, daemon, jest run and emulator.
  '700 1 /usr/bin/java org.gradle.wrapper.GradleWrapperMain :app:assembleRelease',
  '701 1 /usr/bin/java org.gradle.launcher.daemon.bootstrap.GradleDaemon 8.14',
  '702 1 node /other/node_modules/.bin/jest --runInBand',
  '703 1 /sdk/emulator/qemu/darwin-aarch64/qemu-system-aarch64 -avd other -port 5554',
  '704 1 /usr/bin/vim notes-about-GradleWrapperMain-in-args-only', // matches: a pattern on args is reported, by design
].join('\n');

function setup(load: string, ps = PS) {
  const dir = mkdtempSync(join(tmpdir(), 'load-gate-'));
  writeFileSync(join(dir, 'loadavg'), load);
  writeFileSync(join(dir, 'ps'), ps + '\n');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    LOAD_GATE_LOADAVG_FILE: join(dir, 'loadavg'),
    LOAD_GATE_PS_FILE: join(dir, 'ps'),
    LOAD_GATE_NCPU: '4',
    LOAD_GATE_OWNER_PID: OWNER,
  };
  delete env.LOAD_GATE_MAX_LOAD;
  return { dir, env };
}

function run(args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync('sh', [SCRIPT, ...args], { env, encoding: 'utf8', timeout: 20000 });
  const lines = result.stdout.trim().split('\n');
  return { status: result.status, json: JSON.parse(lines[lines.length - 1]), stderr: result.stderr };
}

describe('load-gate.sh', () => {
  it('records load, CPU count, disk and only the foreign heavy processes', () => {
    const { env } = setup('1.50 2.25 3.00');
    const { status, json } = run(['record', '--label', 'unit'], env);
    expect(status).toBe(0);
    expect(json).toMatchObject({
      schema: 'load-gate/1', mode: 'record', label: 'unit', load1: 1.5, load5: 2.25, load15: 3, ncpu: 4,
      load1_per_cpu: 0.38, foreign: { gradle_build: 2, gradle_daemon: 1, jest: 1, emulator: 1 },
    });
    expect(json.disk_free_gb).toBeGreaterThan(0);
    const pids = json.foreign_procs.map((p: { pid: number }) => p.pid).sort();
    expect(pids).toEqual([700, 701, 702, 703, 704]);
    expect(json).not.toHaveProperty('result');
  });

  it('wait returns ok at once when the load is below the threshold and no foreign build runs', () => {
    const quietPs = PS.split('\n').filter((l) => !/^70[04] /.test(l)).join('\n');
    const { env } = setup('0.80 1.0 1.0', quietPs);
    const { status, json } = run(['wait', '--max-load', '2', '--timeout', '5', '--interval', '1'], env);
    expect(status).toBe(0);
    expect(json).toMatchObject({ mode: 'wait', result: 'ok', max_load: 2, waited_s: 0 });
  });

  it('defaults the threshold to 1.0 x CPU count', () => {
    const quietPs = PS.split('\n').filter((l) => !/^70[04] /.test(l)).join('\n');
    expect(run(['wait', '--timeout', '1', '--interval', '1'], setup('3.9 0 0', quietPs).env).json)
      .toMatchObject({ result: 'ok', max_load: 4 });
    expect(run(['wait', '--timeout', '1', '--interval', '1'], setup('4.0 0 0', quietPs).env))
      .toMatchObject({ status: 3, json: { result: 'timeout', max_load: 4 } });
  });

  it('wait times out with exit 3 while the load stays high', () => {
    const { env } = setup('9.0 9.0 9.0', '1 0 /sbin/launchd');
    const { status, json } = run(['wait', '--max-load', '2', '--timeout', '2', '--interval', '1'], env);
    expect(status).toBe(3);
    expect(json.result).toBe('timeout');
    expect(json.waited_s).toBeGreaterThanOrEqual(2);
  });

  it('a foreign gradle build blocks a low-load wait unless --quiet none', () => {
    const { env } = setup('0.1 0.1 0.1');
    expect(run(['wait', '--max-load', '2', '--timeout', '1', '--interval', '1'], env).status).toBe(3);
    expect(run(['wait', '--max-load', '2', '--timeout', '1', '--interval', '1', '--quiet', 'none'], env).status).toBe(0);
  });

  it('wait returns when the load drops during the wait', async () => {
    const { dir, env } = setup('9.0 9.0 9.0', '1 0 /sbin/launchd');
    const child = spawn('sh', [SCRIPT, 'wait', '--max-load', '2', '--timeout', '30', '--interval', '1'], { env });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    setTimeout(() => writeFileSync(join(dir, 'loadavg'), '1.0 5.0 9.0'), 2500);
    const status = await new Promise<number | null>((done) => child.on('close', done));
    const json = JSON.parse(out.trim());
    expect(status).toBe(0);
    expect(json).toMatchObject({ result: 'ok', load1: 1 });
    expect(json.waited_s).toBeGreaterThanOrEqual(2);
    expect(json.waited_s).toBeLessThan(10);
  }, 20000);

  it('never signals or kills another process', () => {
    const code = readFileSync(SCRIPT, 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
    expect(code).not.toMatch(/\b(kill|pkill|killall|renice|nice)\b/);
  });
});
