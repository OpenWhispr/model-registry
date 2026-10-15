const { assertCompatibleCatalog, validateManifest } = require("./schema.cjs");
const { signEnvelope } = require("./envelope.cjs");
const seed = require("../test/seed.json");

function createPublication({
  data,
  previous,
  sourceCommit,
  headCommit,
  publishedAt = new Date().toISOString(),
  keyId,
  privateKey,
}) {
  if (sourceCommit !== headCommit)
    throw new Error("Stale source: main has advanced");
  if (previous?.sourceCommit === sourceCommit) return null;
  assertCompatibleCatalog(data, seed);
  if (previous) assertCompatibleCatalog(data, previous.data);
  const manifest = validateManifest({
    schemaVersion: 1,
    manifestVersion: (previous?.manifestVersion || 0) + 1,
    publishedAt,
    sourceCommit,
    data,
  });
  return signEnvelope(Buffer.from(JSON.stringify(manifest)), keyId, privateKey);
}
module.exports = { createPublication };
