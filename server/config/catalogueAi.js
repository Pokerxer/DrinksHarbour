const CATALOGUE_AI_MODEL = 'claude-haiku-5-5';

function catalogueGenerationOptions(model = CATALOGUE_AI_MODEL) {
  if (model === CATALOGUE_AI_MODEL) {
    return { model, output_config: { effort: 'low' } };
  }
  return { model };
}

module.exports = { CATALOGUE_AI_MODEL, catalogueGenerationOptions };
