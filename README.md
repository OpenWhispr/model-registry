# OpenWhispr model registry

Reviewed model data for OpenWhispr desktop. GitHub edits, pull requests, automated validation, and publication history provide the catalog CMS. A merged catalog edit can reach an installed compatible desktop without a new app release. Provider integrations and native engines still ship in the app.

## Edit a catalog

Use Node 24, run `npm ci`, edit the matching JSON file in `registry/`, then run `npm test` and `npm run validate`. Open a pull request. The publishing workflow signs validated merged changes; pull requests never receive the signing key.

- `cloud-providers.json`: reasoning models for existing cloud providers.
- `transcription-providers.json`: transcription models and supported streaming flags.
- `enterprise-providers.json`: built-in model suggestions, independent of tenant deployments and policy.
- `local-gguf.json`: local reasoning models and optional draft models.
- `whisper.json` / `parakeet.json`: local transcription model metadata.
- `legacy.json`: preserved compatibility data, not an editable runtime surface.

Append models; keep every existing ID, provider, default, and native artifact identity. Model names and descriptions are required English fallbacks; an existing translation key may be included. Set `minAppVersion` to a canonical `major.minor.patch` when a new model needs a newer supported client. New downloadable models require a verified SHA-256 for the main file and every draft file. Only already supported model formats, runtimes, URLs and provider transports work. A new adapter, endpoint, credential binding or engine requires application changes.

Existing models cannot be removed through this schema. Correct a bad publication with a higher version while retaining published identities. Do not republish an older catalog that loses newer entries or silently replace a downloaded artifact under its old ID.

## Compatibility floor

`test/seed.json` preserves the complete desktop catalog extracted from `OpenWhispr/openwhispr` commit `2516e6e000b866a06099f69fd851b914069653d4`, `src/models/modelRegistryData.json`. CI validates against that floor and the last signed publication. The desktop vendors the same pure schema with its exact source digest; normal desktop builds do not contact this repository.

This registry does not replace API inference routes, organization policy catalogs, admin required-model choices, mobile native catalogs, or credential storage. It does not change saved selections. Existing unhashed desktop downloads remain supported with their original immutable identities; hashes are mandatory for new downloads.
