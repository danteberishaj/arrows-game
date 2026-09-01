# Upload keystore backup

`credentials.backup.enc` at the repo root is an AES-256-CBC encrypted archive
(PBKDF2, 600k iterations) of the `credentials/` folder:

- `arrows-upload.keystore` — the Play upload keystore (alias `arrows-upload`)
- `keystore.properties` — the store/key passwords used by the release signing
  config

The decryption passphrase is **not** in this repository. It is stored privately
by the maintainer (see `BACKUP-PASSPHRASE.txt` in the Desktop release kit —
move it to a password manager).

**The archive itself is NOT committed.** This repository is public, and an
encrypted signing key in a public history cannot be withdrawn: removing it
later needs a history rewrite, and anyone may have cloned it first. The archive
is gitignored and lives only where you put it. Keep a durable off-machine copy
somewhere private — a password manager attachment or a private repo — because
the whole point of the backup is surviving the loss of this machine.

## Restore

```sh
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in credentials.backup.enc | tar -xzf -
```

Enter the passphrase when prompted. This recreates `credentials/` at the repo
root, which is where the release signing config expects it.

## Re-create the backup after changing credentials

```sh
tar -czf - credentials | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 \
  -salt -out credentials.backup.enc
```

## Notes

- Both `credentials/` and `credentials.backup.enc` are gitignored. Nothing
  key-related is tracked; this file is the only thing about them in the repo.
- Unlike block-blaster/Rowflare, no manual gradle re-editing is needed after
  `expo prebuild --clean`: the release signing config is injected automatically
  by `plugins/withUploadKeystore.js`. When `credentials/` is absent, release
  builds fall back to the debug keystore.
- On the first Play Console upload, enroll in **Play App Signing** so this
  keystore is only the upload key and Google can reset it if it is ever lost.
