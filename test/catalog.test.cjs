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
  assert.doesNotThrow(() => assertCompatibleCatalog(readCatalog(), seed));
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

test("transcription adapters without model selection cannot advertise additional IDs", () => {
  for (const providerId of ["xai", "corti"]) {
    const next = structuredClone(seed);
    const provider = next.transcriptionProviders.find((p) => p.id === providerId);
    provider.models.push({ ...provider.models[0], id: `${providerId}-new-model` });
    assert.throws(
      () => assertCompatibleCatalog(next, seed),
      /does not support model selection/,
      providerId,
    );
  }
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
    downloadUrl: "https://huggingface.co/example/model/resolve/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/new.bin",
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
    revision: "a".repeat(40),
    draftRevision: "b".repeat(40),
    draftHfRepo: "example/model",
    draftFileName: "new-draft.gguf",
    draftSizeBytes: 1000000,
  });
  assert.throws(() => assertCompatibleCatalog(next, seed));
  next.localProviders[0].models.at(-1).draftSha256 = "b".repeat(64);
  assert.doesNotThrow(() => assertCompatibleCatalog(next, seed));
});

test("new entries cannot collide with installed artifacts, invent transports, or change defaults", () => {
  const changes = [
    (data) =>
      data.localProviders[0].models.push({
        ...data.localProviders[0].models[0],
        id: "collision",
        sha256: "a".repeat(64),
      }),
    (data) =>
      (data.whisperModels.collision = {
        ...data.whisperModels.base,
        sha256: "a".repeat(64),
      }),
    (data) => data.cloudProviders.reverse(),
    (data) =>
      data.transcriptionProviders
        .find((p) => p.id === "groq")
        .models.push({
          id: "groq-live",
          name: "Live",
          description: "Fixture",
          streaming: true,
        }),
    (data) =>
      data.cloudProviders[1].models.push({
        ...data.cloudProviders[0].models[0],
      }),
  ];
  for (const change of changes) {
    const next = structuredClone(seed);
    change(next);
    assert.throws(() => assertCompatibleCatalog(next, seed));
  }
});

test("case aliases and scratch paths cannot become installed model identities", () => {
  const changes = [
    (data) =>
      (data.whisperModels.alias = {
        ...data.whisperModels.base,
        fileName: data.whisperModels.base.fileName.toUpperCase(),
        sha256: "a".repeat(64),
      }),
    (data) =>
      data.localProviders[0].models.push({
        ...data.localProviders[0].models[0],
        id: "case-alias",
        fileName: data.localProviders[0].models[0].fileName.toLowerCase(),
        sha256: "a".repeat(64),
      }),
    (data) =>
      (data.parakeetModels["PARAKEET-TDT-0.6B-V3"] = {
        ...data.parakeetModels["parakeet-tdt-0.6b-v3"],
        sha256: "a".repeat(64),
      }),
  ];
  for (const id of ["temp-extract-model", "model.tmp", "other.tar.bz2"])
    changes.push(
      (data) =>
        (data.parakeetModels[id] = {
          ...data.parakeetModels["parakeet-tdt-0.6b-v3"],
          sha256: "a".repeat(64),
        }),
    );
  for (const change of changes) {
    const next = structuredClone(seed);
    change(next);
    assert.throws(() => assertCompatibleCatalog(next, seed));
  }
});

test("a later publication cannot raise a selected model's version floor and lose it on restart", () => {
  const previous = structuredClone(seed);
  previous.cloudProviders[0].models.push({
    id: "persisted",
    name: "Persisted",
    description: "Fixture",
    minAppVersion: "1.10.3",
  });
  const next = structuredClone(previous);
  next.cloudProviders[0].models.at(-1).minAppVersion = "2.0.0";
  assert.throws(
    () => assertCompatibleCatalog(next, previous),
    /minimum app version/,
  );
});

test("offline bundled selection hides future models until the client version supports them", () => {
  const { selectCatalogForVersion } = require("../lib/registrySelection.js");
  const next = structuredClone(seed);
  next.cloudProviders[0].models.push({
    id: "future",
    name: "Future",
    description: "Fixture",
    minAppVersion: "1.10.4",
  });
  assert.equal(
    selectCatalogForVersion(next, {}, "1.10.3").cloudProviders[0].models.some(
      (m) => m.id === "future",
    ),
    false,
  );
  assert.equal(
    selectCatalogForVersion(next, {}, "1.10.4").cloudProviders[0].models.at(-1)
      .id,
    "future",
  );
});

test("Object prototype names still require new-model integrity and supported engines", () => {
  for (const id of ["toString", "valueOf", "hasOwnProperty"]) {
    const next = structuredClone(seed);
    next.parakeetModels[id] = {
      ...seed.parakeetModels["parakeet-tdt-0.6b-v3"],
      downloadUrl: "https://huggingface.co/test/model/resolve/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/model.tar.bz2",
    };
    assert.throws(() => assertCompatibleCatalog(next, seed), /sha256/);
    next.parakeetModels[id].sha256 = "a".repeat(64);
    assert.doesNotThrow(() => assertCompatibleCatalog(next, seed));
    next.parakeetModels[id].runtime = "online";
    next.parakeetModels[id].modelType = "cohere-transcribe";
    assert.throws(() => assertCompatibleCatalog(next, seed), /engine combination/);
  }
});
