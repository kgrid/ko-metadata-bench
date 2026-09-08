'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { evaluateFixture, evaluateInputObject } = require('../src/decision');

const vectorsPath = path.join(
  __dirname,  
  'UHMS_Figure_6_DFU_HBO2_Algorithm_CKS_Canonical_Test_Vectors_1_0.json'
);

const vectorFile = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

test('canonical vector count is 51', () => {
  assert.equal(vectorFile.vector_count, 51);
  assert.equal(vectorFile.vectors.length, 51);
});

for (const vector of vectorFile.vectors) {
  test(`canonical vector ${vector.test_id}`, () => {
    const actual = evaluateFixture(vector.input_fixture);
    assert.deepEqual(actual, vector.expected_result);
  });
}

const runtimeSchemaPath = path.join(
  __dirname,
  '..',
  'DFU_HBO2_Treatment_Decision_Schema_Bundle_1_0.json'
);
const testVectorSchemaPath = path.join(
  __dirname,
  'UHMS_Figure_6_DFU_HBO2_Algorithm_CKS_Canonical_Test_Vectors_Schema_1_0.json'
);
const runtimeSchema = JSON.parse(fs.readFileSync(runtimeSchemaPath, 'utf8'));
const testVectorSchema = JSON.parse(fs.readFileSync(testVectorSchemaPath, 'utf8'));

function resolvesFragment(schema, fragment) {
  const pointer = fragment.replace(/^#\//, '').split('/');
  return pointer.reduce((value, token) => value[token.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
}

function validatesInput(value) {
  const profile = runtimeSchema.definitions.input;
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  if (!profile.required.every((name) => Object.prototype.hasOwnProperty.call(value, name))) return false;
  if (!['true', 'false'].includes(value.dfu_confirmed)) return false;
  if (!Number.isInteger(value.wagner_grade) || value.wagner_grade < 0 || value.wagner_grade > 5) return false;
  if (!['true', 'false'].includes(value.acute_surgical_intervention)) return false;
  if (!['true', 'false'].includes(value.not_healed_after_30_days)) return false;
  return true;
}

function validatesResult(value) {
  return runtimeSchema.definitions.result.enum.some(
    (candidate) => JSON.stringify(candidate) === JSON.stringify(value)
  );
}

test('runtime profile identifiers resolve to separate Draft 7 definitions', () => {
  assert.equal(runtimeSchema.$schema, 'http://json-schema.org/draft-07/schema#');
  assert.equal(runtimeSchema.$id, 'https://kgrid.org/cks/dfu-hbo2-treatment-decision/schema-bundles/versions/1.0');
  assert.equal(resolvesFragment(runtimeSchema, '#/definitions/input').$id, '#input');
  assert.equal(resolvesFragment(runtimeSchema, '#/definitions/result').$id, '#result');
  assert.notEqual(runtimeSchema.$id, testVectorSchema.$id);
});

test('every valid canonical native-object invocation validates against #input', () => {
  for (const vector of vectorFile.vectors) {
    if (vector.input_fixture.kind !== 'json-object') continue;
    const input = vector.input_fixture.value;
    const isValidInvocation = !vector.expected_result.result_id.startsWith('ERR-');
    if (isValidInvocation) assert.equal(validatesInput(input), true, vector.test_id);
  }
});

test('canonical invalid native inputs are rejected by #input and handled by the CKS', () => {
  for (const vector of vectorFile.vectors) {
    if (vector.input_fixture.kind !== 'json-object') continue;
    if (!vector.expected_result.result_id.startsWith('ERR-')) continue;
    assert.equal(validatesInput(vector.input_fixture.value), false, vector.test_id);
    assert.deepEqual(evaluateInputObject(vector.input_fixture.value), vector.expected_result, vector.test_id);
  }
});

test('every evaluateInputObject return validates against #result', () => {
  const observedStatuses = new Set();
  for (const vector of vectorFile.vectors) {
    if (vector.input_fixture.kind === 'raw-json') continue;
    const input = vector.input_fixture.kind === 'absent' ? undefined : vector.input_fixture.value;
    const result = evaluateInputObject(input);
    observedStatuses.add(result.status);
    assert.equal(validatesResult(result), true, vector.test_id);
  }
  assert.deepEqual([...observedStatuses].sort(), ['completed', 'error', 'out-of-scope']);
});

test('result profile rejects altered and extra-field shapes', () => {
  const result = evaluateInputObject({
    dfu_confirmed: 'true',
    wagner_grade: 3,
    acute_surgical_intervention: 'false',
    not_healed_after_30_days: 'true'
  });
  assert.equal(validatesResult({ ...result, status: 'altered' }), false);
  assert.equal(validatesResult({ ...result, extra: true }), false);
});
