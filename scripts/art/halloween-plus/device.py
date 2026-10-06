#!/usr/bin/env python3
"""HALLOWEEN-PLUS device state: info, byte-exact app-data + installed-APK backup, save fixtures, restore + proof.
Run from the repo root. emulator-5556 only. Never uninstalls; installs use `install -r -d`."""
import json
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from adbutil import DATA, DB, DEVICE, PKG, identity, run, sh, sha, stopped, su  # noqa: E402

BACKUP_DIR = DEVICE / 'backup'
REMOTE_TAR = '/data/local/tmp/halloween-plus-appdata.tar'
SETTINGS = ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale', 'auto_time', 'auto_time_zone']
# Directories whose content the OS/ART regenerates on install; excluded from the byte-exact data manifest.
VOLATILE = ('cache', 'code_cache')


def apksigner():
    tools = sorted(pathlib.Path('/Users/gentlegen/Library/Android/sdk/build-tools').glob('*/apksigner'))
    assert tools, 'apksigner not found'
    return str(tools[-1])


def cert(apk):
    out = subprocess.run([apksigner(), 'verify', '--print-certs', str(apk)], capture_output=True, text=True, check=True).stdout
    digest = re.search(r'certificate SHA-256 digest: ([0-9a-f]+)', out)
    assert digest, out
    return digest.group(1)


def manifest():
    """sha256 + owner/mode of every regular file under the app data dir (volatile dirs excluded)."""
    lines = su(f'cd {DATA} && find . -type f | sort | while read f; do '
               f'case "$f" in ./cache/*|./code_cache/*) continue;; esac; '
               f'echo "$(sha256sum "$f" | cut -d" " -f1) $(stat -c %u:%g:%a "$f") $f"; done', timeout=120)
    return [line for line in lines.splitlines() if line.strip()]


def rows():
    if su(f'stat -c %s {DB}') == '0':
        return None
    return su(f"sqlite3 {DB} \"SELECT key||char(9)||value FROM catalystLocalStorage ORDER BY key;\"")


def info():
    identity()
    print('wm', sh('wm size'), sh('wm density'))
    print('pm path', sh(f'pm path {PKG}'))
    print(sh(f'dumpsys package {PKG} | grep -E "versionName|versionCode|lastUpdateTime|firstInstallTime"'))
    print(su(f'ls -laR {DATA} | head -80'))
    print(sh('ls -la /data/local/tmp'))


def backup():
    identity(); stopped()
    meta_path = DEVICE / 'backup.json'
    assert not meta_path.exists(), 'Refusing to replace the original backup'
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    paths = [line.split(':', 1)[1] for line in sh(f'pm path {PKG}').splitlines() if line.startswith('package:')]
    apks = []
    for remote in paths:
        local = BACKUP_DIR / ('installed-' + pathlib.Path(remote).name)
        run(['pull', remote, str(local)], timeout=180)
        apks.append({'remote': remote, 'local': str(local), 'sha256': sha(local), 'certSha256': cert(local)})
    su(f'rm -f {REMOTE_TAR} && cd /data/data && tar -cpf {REMOTE_TAR} {PKG} && chmod 644 {REMOTE_TAR}', timeout=180)
    run(['pull', REMOTE_TAR, str(BACKUP_DIR / 'appdata.tar')], timeout=180)
    meta = {'time': time.time(), 'apks': apks, 'appDataTarSha256': sha(BACKUP_DIR / 'appdata.tar'),
            'dataOwner': su(f'stat -c %u:%g {DATA}'), 'manifest': manifest(), 'rows': rows(),
            'settings': {k: sh(f'settings get global {k}') for k in SETTINGS},
            'display': {k: sh(f'wm {k}') for k in ['size', 'density']},
            'version': sh(f'dumpsys package {PKG} | grep -E "versionName|versionCode|lastUpdateTime"')}
    meta_path.write_text(json.dumps(meta, indent=2) + '\n')
    print('BACKED UP', len(meta['manifest']), 'files;', [(a['local'], a['sha256'][:12], a['certSha256'][:12]) for a in apks])


def restore():
    identity(); stopped()
    meta = json.loads((DEVICE / 'backup.json').read_text())
    assert len(meta['apks']) == 1, 'split APK restore not implemented'
    apk = meta['apks'][0]
    assert sha(apk['local']) == apk['sha256']
    print(run(['install', '-r', '-d', apk['local']], timeout=240))
    stopped()
    # Byte-exact data: remove everything except the lib symlink, then untar the original tree with owners/modes.
    su(f'cd {DATA} && for f in $(ls -A); do [ "$f" = lib ] || rm -rf "$f"; done')
    run(['push', str(BACKUP_DIR / 'appdata.tar'), REMOTE_TAR], timeout=180)
    su(f'cd /data/data && tar -xpf {REMOTE_TAR} && restorecon -RF {DATA}', timeout=180)
    for key, value in meta['settings'].items():
        if sh(f'settings get global {key}') != value:
            sh(f'settings delete global {key}' if value == 'null' else f'settings put global {key} {value}')
    stopped()
    now = {}
    installed = [line.split(':', 1)[1] for line in sh(f'pm path {PKG}').splitlines() if line.startswith('package:')]
    run(['pull', installed[0], str(BACKUP_DIR / 'reinstalled-check.apk')], timeout=180)
    now['apkSha256'] = sha(BACKUP_DIR / 'reinstalled-check.apk')
    now['manifest'] = manifest(); now['rows'] = rows()
    now['settings'] = {k: sh(f'settings get global {k}') for k in SETTINGS}
    now['display'] = {k: sh(f'wm {k}') for k in ['size', 'density']}
    checks = {'apkBytesEqual': now['apkSha256'] == apk['sha256'], 'dataManifestEqual': now['manifest'] == meta['manifest'],
              'rowsEqual': now['rows'] == meta['rows'], 'settingsEqual': now['settings'] == meta['settings'],
              'displayEqual': now['display'] == meta['display']}
    proof = {'time': time.time(), 'checks': checks, 'files': len(now['manifest']),
             'apkSha256': now['apkSha256'], 'version': sh(f'dumpsys package {PKG} | grep -E "versionName|versionCode|lastUpdateTime"')}
    (DEVICE / 'restore-proof.json').write_text(json.dumps(proof, indent=2) + '\n')
    if not all(checks.values()):
        diff = sorted(set(now['manifest']) ^ set(meta['manifest']))
        (DEVICE / 'restore-diff.txt').write_text('\n'.join(diff) + '\n')
        raise SystemExit('RESTORE MISMATCH ' + json.dumps(checks))
    print('RESTORED', json.dumps(proof))


def fixture(values):
    """Writes save keys with the app stopped; owner/mode/label of the DB are kept."""
    stopped()
    query = ("DELETE FROM catalystLocalStorage WHERE key LIKE 'arrows_reward%' OR key LIKE 'arrows_path%' OR key = 'arrows_petals'; "
             "INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES " +
             ','.join(f"('{k}','{v}')" for k, v in values.items()) + ';')
    owner = su(f'stat -c %u:%g:%a {DB}')
    su(f'sqlite3 {DB} "{query}"')
    uid, gid, mode = owner.split(':')
    su(f'chown {uid}:{gid} {DB} && chmod {mode} {DB} && restorecon {DB}')


if __name__ == '__main__':
    action = sys.argv[1]
    if action == 'info': info()
    elif action == 'backup': backup()
    elif action == 'restore': restore()
    elif action == 'cleanup':
        # Device files this task created: the contract's external-files dir (absent before the contract run), the guest
        # screenrecord probes and the remote data tar. Proven gone afterwards.
        identity()
        sh(f'rm -rf /sdcard/Android/data/{PKG} /sdcard/hp-test.mp4 /sdcard/hp-test2.mp4 /sdcard/hp-burst')
        su(f'rm -f {REMOTE_TAR}')
        left = sh(f'ls -d /sdcard/Android/data/{PKG} /sdcard/hp-test.mp4 /sdcard/hp-test2.mp4 /sdcard/hp-burst {REMOTE_TAR} 2>/dev/null || true')
        assert left == '', left
        print('CLEAN; RKStorage', su(f'stat -c "%s %a %U" {DB}'))
    elif action == 'rows': print(rows())
    elif action == 'cert': print(cert(sys.argv[2]))
    else: raise SystemExit('unknown action ' + action)
