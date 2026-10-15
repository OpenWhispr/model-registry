const test = require("node:test");
const assert = require("node:assert/strict");
const seed = require("./seed.json");
const {
  readCatalog,
  validateCatalog,
  assertCompatibleCatalog,
  selectCatalog,
} = require("../lib/catalog.cjs");

test("compiling split sources preserves every shipping catalog field", () => {
  assert.deepEqual(readCatalog(), seed);
  assert.deepEqual(validateCatalog(seed), seed);
});

test("a supported cloud model can be added without changing provider identity", () => {
  const next = structuredClone(seed);
  next.cloudProviders[0].models.push({
    id: "future-model",
    name: "Future model",
    description: "Fixture",
    tokenParam: "max_completion_tokens",
    supportsTemperature: false,
  });
  assert.doesNotThrow(() => assertCompatibleCatalog(next, seed));
  assert.equal(
    selectCatalog(next, seed, "1.10.3").cloudProviders[0].models.at(-1).id,
    "future-model",
  );
});

test("a future-only entry is hidden without losing an existing selection", () => {
  const next = structuredClone(seed);
  next.cloudProviders[0].models.push({
    id: "future-model",
    name: "Future model",
    description: "Fixture",
    minAppVersion: "2.0.0",
  });
  assert.equal(
    selectCatalog(next, seed, "1.10.3").cloudProviders[0].models.some(
      (m) => m.id === "future-model",
    ),
    false,
  );
  assert.equal(
    selectCatalog(next, seed, "2.0.0").cloudProviders[0].models.at(-1).id,
    "future-model",
  );
  next.cloudProviders[0].models[0].minAppVersion = "2.0.0";
  assert.equal(
    selectCatalog(next, seed, "1.10.3").cloudProviders[0].models[0].id,
    seed.cloudProviders[0].models[0].id,
  );
});

test("a catalog cannot redirect credentials or add an unknown provider", () => {
  for (const change of [
    (x) => {
      x.transcriptionProviders[0].baseUrl = "https://attacker.example/v1";
    },
    (x) => {
      x.cloudProviders.push({ id: "new-provider", name: "New", models: [] });
    },
    (x) => {
      x.cloudProviders[0].keyId = "anthropic";
    },
  ]) {
    const next = structuredClone(seed);
    change(next);
    assert.throws(() => assertCompatibleCatalog(next, seed));
  }
});

test("saved model IDs and policy-required downloads cannot disappear", () => {
  const next = structuredClone(seed);
  delete next.whisperModels.base;
  assert.throws(() => assertCompatibleCatalog(next, seed));
  const first = structuredClone(seed);
  first.cloudProviders[0].models.push({
    id: "new-model",
    name: "New",
    description: "Fixture",
  });
  assert.throws(() => assertCompatibleCatalog(seed, first));
});

test("existing native artifacts cannot be silently replaced under the same ID", () => {
  const next = structuredClone(seed);
  next.whisperModels.base.downloadUrl =
    "https://huggingface.co/example/model/resolve/main/other.bin";
  assert.throws(() => assertCompatibleCatalog(next, seed));
  next.whisperModels.base = seed.whisperModels.base;
  next.localProviders[0].models[0].hfRepo = "example/other";
  assert.throws(() => assertCompatibleCatalog(next, seed));
});

test("new downloads require hashes, safe names, supported URLs and runtime shapes", () => {
  const next = structuredClone(seed);
  const model = {
    ...next.whisperModels.base,
    name: "New",
    fileName: "new.bin",
    downloadUrl: "https://huggingface.co/example/model/resolve/main/new.bin",
  };
  next.whisperModels["new-whisper"] = model;
  assert.throws(() => assertCompatibleCatalog(next, seed));
  model.sha256 = "a".repeat(64);
  assert.doesNotThrow(() => assertCompatibleCatalog(next, seed));
  for (const value of [
    "../evil.bin",
    "..\\evil.bin",
    "C:evil.bin",
    "CON",
    "bad.bin.",
  ]) {
    model.fileName = value;
    assert.throws(() => validateCatalog(next), value);
  }
  model.fileName = "new.bin";
  for (const url of [
    "http://huggingface.co/example/model/resolve/main/new.bin",
    "https://attacker.example/new.bin",
    "https://huggingface.co@example.com/new.bin",
  ]) {
    model.downloadUrl = url;
    assert.throws(() => validateCatalog(next), url);
  }
});

test("duplicate model IDs and malformed capability metadata fail as a whole", () => {
  const next = structuredClone(seed);
  next.cloudProviders[0].models.push(next.cloudProviders[0].models[0]);
  assert.throws(() => validateCatalog(next));
  next.cloudProviders[0].models.pop();
  next.cloudProviders[0].models[0].supportsTemperature = "true";
  assert.throws(() => validateCatalog(next));
});

test("all auxiliary model downloads need integrity checks too", () => {
  const next = structuredClone(seed);
  next.localProviders[0].models.push({
    ...next.localProviders[0].models[0],
    id: "new-gguf",
    fileName: "new.gguf",
    sha256: "a".repeat(64),
    draftHfRepo: "example/model",
    draftFileName: "draft.gguf",
    draftSizeBytes: 1000000,
  });
  assert.throws(() => assertCompatibleCatalog(next, seed));
  next.localProviders[0].models.at(-1).draftSha256 = "b".repeat(64);
  assert.doesNotThrow(() => assertCompatibleCatalog(next, seed));
});
