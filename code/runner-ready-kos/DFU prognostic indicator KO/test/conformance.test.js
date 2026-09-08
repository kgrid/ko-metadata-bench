'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('../spec/Margolis_2022_DFU_Prognostic_CKS-1_0.fixtures.json');
const { evaluate, evaluateWithRuleCardinalityFault } = require('../src');

function pointer(value, path) {
  return path.slice(1).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~')).reduce((current, key) => {
    if (current === null || current === undefined || !Object.prototype.hasOwnProperty.call(current, key)) throw new Error(`Missing JSON Pointer: ${path}`);
    return current[key];
  }, value);
}

function hasPointer(value, path) {
  try {
    pointer(value, path);
    return true;
  } catch {
    return false;
  }
}

for (const fixture of fixtures.cases) {
  test(`${fixture.id}: ${fixture.title}`, () => {
    const input = JSON.parse(fixture.input_document);
    const output = fixture.mode === 'invoke' ? evaluate(input) : evaluateWithRuleCardinalityFault(input, 0);
    assert.equal(output.status, fixture.expected.status);
    for (const [path, expected] of Object.entries(fixture.expected.path_equals)) assert.deepEqual(pointer(output, path), expected);
    for (const path of fixture.expected.path_absent) assert.equal(hasPointer(output, path), false);
    if (fixture.expected.ordered_errors) assert.deepEqual(output.errors.map(({ code, path }) => ({ code, path })), fixture.expected.ordered_errors);
  });
}