const PROVIDER_SECTIONS = [
  "cloudProviders",
  "enterpriseProviders",
  "transcriptionProviders",
  "localProviders",
];
const MAP_SECTIONS = ["whisperModels", "parakeetModels"];
const isActive = (model) => !model.retired && !model.legacy;

function retire(model, replacement) {
  model.retired = true;
  delete model.legacy;
  if (replacement) model.replacement = replacement;
  else delete model.replacement;
}

// The data of an earlier publication, made valid to publish again: a rollback never
// revives a retired model and never drops an ID, so anything retired or added since the
// target stays retired.
function rollbackCatalog(target, current) {
  const data = structuredClone(target);
  for (const section of PROVIDER_SECTIONS)
    for (const provider of current[section]) {
      const into = data[section].find((item) => item.id === provider.id);
      for (const model of provider.models) {
        const existing = into.models.find((item) => item.id === model.id);
        if (!existing) {
          const copy = structuredClone(model);
          retire(copy, model.retired ? model.replacement : undefined);
          into.models.push(copy);
        } else if (model.retired) retire(existing, model.replacement);
      }
      for (const model of into.models)
        if (model.replacement && !into.models.some((item) => item.id === model.replacement && isActive(item)))
          delete model.replacement;
      if (!into.models.some((item) => item.id === into.defaultModel && isActive(item)))
        into.defaultModel = into.models.find(isActive)?.id;
    }
  for (const section of MAP_SECTIONS)
    for (const [id, model] of Object.entries(current[section])) {
      if (!Object.hasOwn(data[section], id)) {
        data[section][id] = structuredClone(model);
        retire(data[section][id]);
      } else if (model.retired) retire(data[section][id], model.replacement);
    }
  return data;
}

module.exports = { rollbackCatalog };
