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

## Publication and recovery

`Validate catalog / validate` runs on PRs with read-only permissions and no signing secret. `Publish signed catalog` runs only on `main`, repeats validation/tests, checks the last signed catalog, and signs with Ed25519. The `registry-publish` environment permits only the `main` branch. A non-cancelling concurrency group serializes runs, and the publisher checks the latest main SHA immediately before pushing so an older queued job cannot overwrite a newer publication. Reruns of an already-published source do nothing.

The public artifact is `https://raw.githubusercontent.com/OpenWhispr/model-registry/published/manifest.json`. The `published` branch retains `history/<version>.json` and the exact shared schema. Every publication records its source commit. Consumers verify exact decoded payload bytes against their compiled public key, then validate the schema and additive compatibility before applying anything. A failed publication leaves the previous artifact available.

To recover from incorrect metadata, submit a corrective PR retaining all published IDs. It publishes a higher version; history is never force-reset. Do not replace an existing local artifact or its hash. To add a different artifact, use a new ID and its verified digest. Existing installed artifacts are not silently changed.

The signing private key lives in the protected environment secret `REGISTRY_SIGNING_KEY`. PR checks cannot access it. The maintainer retains a local backup outside the repository with owner-only permissions. Never put private keys in issues, logs, commits, artifacts, or review text. Only the public key is checked in. Maintain strict access to repository administration and main-branch/workflow changes: an authorized main workflow can access the secret. This is not an OIDC signing service or threshold-signature system.

Key rotation requires a desktop release that trusts the new key before switching the signer. A compromised signing key requires a desktop trust-root update; a catalog alone cannot revoke its own trust. Offline/managed installations may set `OPENWHISPR_MODEL_REGISTRY_MODE=bundled` to skip cache activation and network refresh. Native application release and device acceptance are separate from publishing this catalog.
