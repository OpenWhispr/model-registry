const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { contractId } = require("./schema.cjs");
const { readerHashes } = require("./publication.cjs");
const { isModelSupported } = require("./registrySelection.js");
const seed = require("../test/seed.json");

const CLIENTS_DIR = path.join(__dirname, "..", "compat", "clients");
const PROVIDER_SECTIONS = [
  "cloudProviders",
  "enterpriseProviders",
  "transcriptionProviders",
  "localProviders",
];
const MAP_SECTIONS = ["whisperModels", "parakeetModels"];

function entries(catalog) {
  const result = [];
  for (const section of PROVIDER_SECTIONS)
    for (const provider of catalog[section] || [])
      for (const model of provider.models || [])
        result.push({ key: `${section}/${provider.id}/${model.id}`, model });
  for (const section of MAP_SECTIONS)
    for (const [id, model] of Object.entries(catalog[section] || {}))
      result.push({ key: `${section}/${id}`, model });
  return result;
}

// Every app reader the registry still serves: the vendored copies of shipped readers,
// plus this repository's own, which the next app release will vendor.
function listClients() {
  const hashes = readerHashes();
  const clients = [
    { id: contractId(hashes), dir: __dirname, appVersion: "0.0.0-0", floor: seed, own: true },
  ];
  if (!fs.existsSync(CLIENTS_DIR)) return clients;
  for (const id of fs.readdirSync(CLIENTS_DIR).sort()) {
    const dir = path.join(CLIENTS_DIR, id);
    const client = JSON.parse(fs.readFileSync(path.join(dir, "client.json"), "utf8"));
    const hash = (file) =>
      createHash("sha256")
        .update(fs.readFileSync(path.join(dir, file)))
        .digest("hex");
    const actual = contractId({
      schema: hash("schema.cjs"),
      envelope: hash("envelope.cjs"),
      selection: hash("registrySelection.js"),
    });
    if (actual !== id) throw new Error(`compat/clients/${id} does not match its files (${actual})`);
    if (clients.some((known) => known.id === id)) continue;
    clients.push({
      id,
      dir,
      appVersion: client.appVersion,
      floor: JSON.parse(fs.readFileSync(path.join(dir, "floor.json"), "utf8")),
    });
  }
  return clients;
}

// Problems a released reader would have with this catalog. An entry may only be
// unreadable to a reader that its minAppVersion already excludes.
function checkClient(client, catalog) {
  const { acceptCatalog } = require(path.join(client.dir, "schema.cjs"));
  const problems = [];
  let accepted;
  try {
    accepted = acceptCatalog(catalog, client.floor, client.appVersion);
  } catch (error) {
    return [`reader threw: ${error.message}`];
  }
  const kept = new Set(entries(accepted).map((entry) => entry.key));
  for (const { key } of entries(client.floor))
    if (!kept.has(key)) problems.push(`loses bundled model ${key}`);
  for (const { key, model } of entries(catalog))
    if (!kept.has(key) && isModelSupported(model, client.appVersion))
      problems.push(`cannot read ${key}; give it a minAppVersion above ${client.appVersion}`);
  for (const section of PROVIDER_SECTIONS)
    for (const provider of accepted[section] || []) {
      const active = provider.models.filter((model) => !model.retired && !model.legacy);
      if (active.length && !active.some((model) => model.id === provider.defaultModel))
        problems.push(`${section}/${provider.id} has no usable default`);
    }
  return problems;
}

function checkCompatibility(catalog, clients = listClients()) {
  const failures = [];
  for (const client of clients)
    for (const problem of checkClient(client, catalog))
      failures.push(`${client.own ? "this repository" : `client ${client.id}`}: ${problem}`);
  if (failures.length) throw new Error(`Older app readers would break:\n${failures.join("\n")}`);
  return clients.map((client) => client.id);
}

module.exports = { listClients, checkClient, checkCompatibility };
