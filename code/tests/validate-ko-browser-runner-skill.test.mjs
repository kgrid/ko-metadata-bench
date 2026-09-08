import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const root = path.resolve('skills/validate-ko-browser-runner');
const validator = path.join(root, 'scripts/validate_runner.mjs');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-validator-'));
  fs.mkdirSync(path.join(directory, 'runner'));
  fs.writeFileSync(path.join(directory, 'metadata.json'), JSON.stringify({
    '@id': 'https://example.org/ko',
    'dc:identifier': ['workshop-ko-test', 'https://example.org/ko'],
    'dc:version': '1.0'
  }));
  fs.writeFileSync(path.join(directory, 'runner/runner.manifest.json'), JSON.stringify({
    runnerVersion: '1.0',
    knowledgeObjectId: 'workshop-ko-test',
    knowledgeObjectVersion: '1.0',
    bundle: 'runner/runner.bundle.js'
  }));
  fs.writeFileSync(path.join(directory, 'runner/runner.bundle.js'),
    'globalThis.FAIR_KO_RUNNER={async run(input){return {result:input.value*2}}};');
  return directory;
}

function run(directory, cases, schemas) {
  const suite = path.join(directory, 'suite.json');
  fs.writeFileSync(suite, JSON.stringify({
    suiteVersion: '1.0',
    knowledgeObjectId: 'workshop-ko-test',
    knowledgeObjectVersion: '1.0',
    ...(schemas ? { schemas } : {}),
    cases
  }));
  return spawnSync(process.execPath, [validator, '--ko', directory, '--suite', suite], { encoding: 'utf8' });
}

test('skill is concise, independent, and read-only by instruction', () => {
  const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
  assert.match(skill, /canonical CKS fixtures/);
  assert.match(skill, /Do not rebuild the Runner/);
  assert.match(skill, /prior implementation as an oracle/);
  assert.ok(skill.split('\n').length < 100);
});

test('validator reports conformant for exact canonical evidence', () => {
  const directory = fixture();
  const result = run(directory, [{ name: 'double', input: { value: 2 }, expected: { result: 4 } }]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'conformant');
  assert.deepEqual(report.counts, { total: 1, applicable: 1, passed: 1, failed: 0, unsupported: 0 });
  assert.equal(report.koUnchanged, true);
});

test('validator reports partial validation without hiding unsupported evidence', () => {
  const directory = fixture();
  const result = run(directory, [
    { name: 'double', input: { value: 2 }, expected: { result: 4 } },
    { name: 'terminal case', unsupportedReason: 'Requires a terminal.' }
  ]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'partially-validated');
  assert.equal(report.counts.unsupported, 1);
  assert.equal(report.results[1].reason, 'Requires a terminal.');
});

test('validator reports nonconformance for a canonical mismatch', () => {
  const directory = fixture();
  const result = run(directory, [{ name: 'wrong expectation', input: { value: 2 }, expected: { result: 5 } }]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'nonconformant');
  assert.equal(report.counts.failed, 1);
});

test('validator rejects manifest identity drift', () => {
  const directory = fixture();
  const suite = path.join(directory, 'suite.json');
  fs.writeFileSync(suite, JSON.stringify({
    suiteVersion: '1.0',
    knowledgeObjectId: 'different-ko',
    knowledgeObjectVersion: '1.0',
    cases: [{ name: 'case', input: { value: 1 }, expected: { result: 2 } }]
  }));
  const result = spawnSync(process.execPath, [validator, '--ko', directory, '--suite', suite], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Runner and suite KO identifiers differ/);
});

test('validator can invoke a Runner with an absent argument', () => {
  const directory = fixture();
  fs.writeFileSync(path.join(directory, 'runner/runner.bundle.js'),
    'globalThis.FAIR_KO_RUNNER={async run(input){return input===undefined?{status:"absent"}:{status:"present"}}};');
  const result = run(directory, [{ name: 'absent', absentInput: true, expected: { status: 'absent' } }]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'conformant');
});

test('validator can assert a required thrown error', () => {
  const directory = fixture();
  fs.writeFileSync(path.join(directory, 'runner/runner.bundle.js'),
    'globalThis.FAIR_KO_RUNNER={async run(){throw new TypeError("value must use allowed values")}};');
  const result = run(directory, [{
    name: 'invalid value',
    input: { value: 'bad' },
    expectedError: { name: 'TypeError', messageIncludes: 'allowed values' }
  }]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'conformant');
});

test('Draft 7 schemas do not require the AJV 2020 module', () => {
  const directory = fixture();
  fs.writeFileSync(path.join(directory, 'schema.json'), JSON.stringify({
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
      input: { type: 'object', required: ['value'], properties: { value: { type: 'number' } } },
      output: { type: 'object', required: ['result'], properties: { result: { type: 'number' } } }
    }
  }));
  const schemas = {
    input: { path: 'schema.json', pointer: '#/definitions/input' },
    output: { path: 'schema.json', pointer: '#/definitions/output' }
  };
  const result = run(directory, [{
    name: 'schema checked', input: { value: 2 }, inputSchema: 'input', outputSchema: 'output', expected: { result: 4 }
  }], schemas);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'conformant');
});
