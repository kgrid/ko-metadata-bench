'use strict';

const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const schema = require('../spec/DFU_HBOT_Burden_CKS_Version_1_0.schema.json');

const ajv = new Ajv2020({
  strict: false,
  allErrors: true
});
addFormats(ajv);
ajv.addSchema(schema, 'dfu-hbot-root-schema');

const validators = {};

function getValidator(defName) {
  if (!validators[defName]) {
    const subSchema = schema.$defs && schema.$defs[defName];
    if (!subSchema) {
      throw new Error(`Unknown schema definition: ${defName}`);
    }

    // Compile a wrapper ref from the full root schema so nested $refs under
    // this $defs entry resolve correctly.
    validators[defName] = ajv.compile({
      $ref: `https://kgrid.org/cks/dfu-hbot-burden/schema-bundles/versions/1.0#/$defs/${defName}`
    });
  }
  return validators[defName];
}

function formatError(error) {
  if (!error) {
    return 'Unknown schema validation error';
  }

  const path = error.instancePath && error.instancePath.length > 0 ? error.instancePath : '/';

  if (error.keyword === 'required' && error.params && error.params.missingProperty) {
    return `${path}: missing required property ${error.params.missingProperty}`;
  }

  if (error.keyword === 'additionalProperties' && error.params && error.params.additionalProperty) {
    return `${path}: unexpected property ${error.params.additionalProperty}`;
  }

  return `${path}: ${error.message || 'schema validation error'}`;
}

function validateByDef(defName, value) {
  const validate = getValidator(defName);
  const ok = validate(value);

  if (ok) {
    return { ok: true, errors: [] };
  }

  return {
    ok: false,
    errors: (validate.errors || []).map((error) => ({
      keyword: error.keyword,
      instancePath: error.instancePath || '',
      schemaPath: error.schemaPath || '',
      params: error.params || {},
      message: error.message || 'schema validation error'
    }))
  };
}

function assertByDef(defName, value, label = defName) {
  const result = validateByDef(defName, value);
  if (!result.ok) {
    const message = result.errors.map((error) => formatError(error)).join('; ');
    throw new Error(`${label} failed schema validation: ${message}`);
  }
}

module.exports = {
  validateByDef,
  assertByDef
};
