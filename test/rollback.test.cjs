const test = require("node:test");
const assert = require("node:assert/strict");
const { rollbackCatalog } = require("../lib/rollback.cjs");
const { assertCompatibleCatalog, validateCatalog } = require("../lib/schema.cjs");
const { readCatalog } = require("../lib/catalog.cjs");

const base = readCatalog();
const openai = (data) => data.cloudProviders.find((p) => p.id === "openai");

test("rolling back keeps retirements and retires what was added since", () => {
  const current = structuredClone(base);
  openai(current).models.push({ id: "bad-add", name: "Bad", description: "Fixture" });
  openai(current).defaultModel = "bad-add";
  Object.assign(openai(current).models.find((m) => m.id === "gpt-5.5"), {
    retired: true,
    replacement: "gpt-6-luna",
  });
  current.whisperModels["bad-whisper"] = {
    ...structuredClone(current.whisperModels.base),
    fileName: "ggml-bad.bin",
  };
  const rolled = rollbackCatalog(base, current);
  assert.doesNotThrow(() => validateCatalog(rolled));
  assert.doesNotThrow(() => assertCompatibleCatalog(rolled, current));
  const models = openai(rolled).models;
  assert.equal(models.find((m) => m.id === "bad-add").retired, true);
  assert.equal(models.find((m) => m.id === "gpt-5.5").replacement, "gpt-6-luna");
  assert.equal(openai(rolled).defaultModel, openai(base).defaultModel);
  assert.equal(rolled.whisperModels["bad-whisper"].retired, true);
});
