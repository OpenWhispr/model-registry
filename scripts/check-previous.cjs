const {
  readCatalog,
  assertCompatibleCatalog,
  validateManifest,
} = require("../lib/catalog.cjs");
const { verifyEnvelope, MAX_ENVELOPE_BYTES } = require("../lib/envelope.cjs");
const trusted = require("../trusted-keys.json");
(async () => {
  const response = await fetch(
    "https://raw.githubusercontent.com/OpenWhispr/model-registry/published/manifest.json",
    { signal: AbortSignal.timeout(15000), redirect: "error" },
  );
  if (response.status === 404) {
    console.log(
      "No initial publication yet; the shipping floor still applies.",
    );
    return;
  }
  if (!response.ok)
    throw new Error(`Previous publication HTTP ${response.status}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > MAX_ENVELOPE_BYTES)
      throw new Error("Previous publication too large");
    chunks.push(Buffer.from(chunk));
  }
  const previous = validateManifest(
    verifyEnvelope(Buffer.concat(chunks), trusted),
  );
  assertCompatibleCatalog(readCatalog(), previous.data);
  console.log(`Compatible with published version ${previous.manifestVersion}`);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
