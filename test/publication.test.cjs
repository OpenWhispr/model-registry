const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { createPublication } = require("../lib/publication.cjs");
const { verifyEnvelope } = require("../lib/envelope.cjs");
const seed = require("./seed.json");
const keys = generateKeyPairSync("ed25519");
const options = {
  data: seed,
  sourceCommit: "a".repeat(40),
  headCommit: "a".repeat(40),
  keyId: "test",
  privateKey: keys.privateKey,
  publishedAt: "2026-10-14T12:00:00Z",
};
const trusted = {
  test: keys.publicKey.export({ type: "spki", format: "pem" }),
};
test("publications advance versions, retain IDs, and reruns are idempotent", () => {
  const first = createPublication({ ...options });
  const prior = verifyEnvelope(JSON.stringify(first), trusted);
  assert.equal(prior.manifestVersion, 1);
  assert.equal(createPublication({ ...options, previous: prior }), null);
  const data = structuredClone(seed);
  data.cloudProviders[0].models.push({
    id: "new-published",
    name: "New",
    description: "Fixture",
  });
  const second = createPublication({
    ...options,
    data,
    previous: prior,
    sourceCommit: "b".repeat(40),
    headCommit: "b".repeat(40),
  });
  const manifest = verifyEnvelope(JSON.stringify(second), trusted);
  assert.equal(manifest.manifestVersion, 2);
  assert.throws(
    () =>
      createPublication({
        ...options,
        previous: manifest,
        sourceCommit: "c".repeat(40),
        headCommit: "c".repeat(40),
      }),
    /Removed model|retain their order/,
  );
});
test("a stale queued source cannot publish after a newer main commit", () => {
  assert.throws(
    () => createPublication({ ...options, headCommit: "b".repeat(40) }),
    /Stale source/,
  );
});
