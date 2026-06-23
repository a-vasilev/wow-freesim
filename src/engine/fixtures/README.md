# Engine fixtures

Real `json2` captured from **simc-wasm `v1205.01`** via
[`scripts/capture-report.mjs`](../../../scripts/capture-report.mjs), kept in-repo
as the authoritative shape the engine schemas (`../schemas.ts`) + adapter
(`../json2.ts`) are modeled against, and so report/character UI can be built
without booting the 107 MB binary on every reload.

- **`sample-report.json`** — `MID1_Warrior_Arms` (the simc-generated Arms Warrior
  profile for this exact data build, `daf9f53`), Patchwerk, ~73 iterations.
  Validate the adapter against it with:

  ```sh
  npx tsx scripts/validate-adapter.ts src/engine/fixtures/sample-report.json
  ```

Regenerate after an engine bump by re-running the capture script against the new
release and re-validating (re-shape the adapter only if a field moved).
