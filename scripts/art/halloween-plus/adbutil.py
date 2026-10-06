"""HALLOWEEN-PLUS shared adb helpers. emulator-5556 ONLY; every command is logged with its exit status."""
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path('artifacts/HALLOWEEN-PLUS')
DEVICE = ROOT / 'device'
SCREENS = ROOT / 'screens'
for folder in (DEVICE, SCREENS):
    folder.mkdir(parents=True, exist_ok=True)
ADB = '/Users/gentlegen/Library/Android/sdk/platform-tools/adb'
SERIAL = 'emulator-5556'
PKG = 'com.danteb.arrows'
DATA = f'/data/data/{PKG}'
DB = f'{DATA}/databases/RKStorage'


def run(args, binary=False, timeout=180, check=True):
    started = time.time()
    command = [ADB, '-s', SERIAL, *args]
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    output = result.stdout if binary else result.stdout.decode(errors='replace')
    record = {'time': started, 'argv': command[:3] + [a if len(a) < 300 else a[:300] + '...' for a in command[3:]],
              'exit': result.returncode, 'seconds': round(time.time() - started, 3),
              'stdout': {'bytes': len(output), 'sha256': hashlib.sha256(output).hexdigest()} if binary else output[-4000:],
              'stderr': result.stderr.decode(errors='replace')[-2000:]}
    with (DEVICE / 'commands.jsonl').open('a') as log:
        log.write(json.dumps(record) + '\n')
    if check and result.returncode:
        raise RuntimeError(json.dumps(record))
    return output


def sh(command, timeout=180):
    return run(['shell', command], timeout=timeout).strip()


def su(command, timeout=180):
    return run(['shell', 'su', '0', 'sh', '-c', shell_quote(command)], timeout=timeout).strip()


def shell_quote(text):
    return "'" + text.replace("'", "'\\''") + "'"


def identity():
    """Refuse to touch anything but the owned fleet_floor_api31 emulator on port 5556."""
    assert sh('getprop ro.build.version.sdk') == '31'
    name = run(['emu', 'avd', 'name'])
    assert 'fleet_floor_api31' in name, name


def stopped():
    sh(f'am force-stop {PKG}')


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
