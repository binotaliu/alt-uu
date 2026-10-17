# legacy-fixtures-gen

Regenerates `packages/core/test/fixtures` from the legacy Laravel app (a worktree of `main`, default `../alt-uu-legacy`, override with `LEGACY_DIR`). Remove once parity is reached.

1. `node tools/legacy-fixtures-gen/build.mjs` — wipes the fixtures dir (goldens included) and rewrites payloads, `expected.json`, README, loader and test.
2. In the legacy worktree: `APP_KEY=base64:$(php -r 'echo base64_encode(str_repeat("k",32));') vendor/bin/phpunit <repo>/tools/legacy-fixtures-gen/GoldenTest.php` — writes `*.golden.json`.
