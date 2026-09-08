'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rawHarness = require('../execution/raw-harness');
const contractHarness = require('../execution/contract-harness');

const exerciseRoot = path.resolve(__dirname, '..');

function loadJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(exerciseRoot, relativePath), 'utf8')
  );
}

function assertExerciseLocalFile(relativePath) {
  assert.equal(
    typeof relativePath,
    'string',
    'Artifact reference must be a string.'
  );

  assert.equal(
    relativePath.startsWith('../'),
    false,
    `${relativePath} must remain inside the exercise package.`
  );

  assert.equal(
    path.isAbsolute(relativePath),
    false,
    `${relativePath} must be a relative path.`
  );

  assert.equal(
    fs.existsSync(path.join(exerciseRoot, relativePath)),
    true,
    `${relativePath} must resolve to an existing exercise artifact.`
  );
}

test('raw harness uses only a host-supplied executor', async () => {
  const input = loadJson('examples/raw-input.json');
  const expected = loadJson('examples/raw-output.json');

  const privateExecutor = async (received) => {
    assert.deepEqual(received, input);
    return expected;
  };

  assert.deepEqual(
    await rawHarness.execute(privateExecutor, input),
    expected
  );
});

test('contract harness invokes an externally supplied knowledge object', async () => {
  const input = loadJson('examples/valid-input.json');
  const expected = loadJson('examples/expected-output.json');

  const externalKnowledgeObject = {
    async run(received) {
      assert.deepEqual(received, input);
      return expected;
    }
  };

  assert.deepEqual(
    await contractHarness.execute(externalKnowledgeObject, input),
    expected
  );
});

test('manifests resolve only exercise-local artifacts or external bindings', () => {
  const raw = loadJson('execution/raw-execution.json');
  const contract = loadJson('execution/contract-execution.json');

  for (const relativePath of [
    raw.inputExample,
    raw.expectedOutput,
    contract.interfaceSpecification,
    contract.input.profileArtifact,
    contract.input.example,
    contract.output.profileArtifact,
    contract.output.example
  ]) {
    assertExerciseLocalFile(relativePath);
  }

  assert.equal(
    contract.targetBinding.type,
    'externalKnowledgeObject'
  );
});

test('described facets are explicitly bound to the Wagner KO target', () => {
  const configuration = loadJson('interoperability.exercise.json');
  const contract = loadJson('execution/contract-execution.json');
  const interfaceView = loadJson('interface/interface.json');
  const inputSemantics = loadJson('semantics/input-semantics.json');
  const outputSemantics = loadJson('semantics/output-semantics.json');

  const expectedTarget = {
    identifier: 'meggitt-wagner-cks',
    version: '1.0',
    specification:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0'
  };

  assert.equal(
    configuration.exerciseKit,
    'wagner-ko-interoperability-exercise'
  );

  assert.equal(
    configuration.knowledgeObject,
    expectedTarget.identifier
  );

  assert.deepEqual(
    configuration.targetKnowledgeObject,
    expectedTarget
  );

  assert.deepEqual(
    {
      identifier: contract.targetBinding.identifier,
      version: contract.targetBinding.version,
      specification: contract.targetBinding.specification
    },
    expectedTarget
  );

  assert.equal(
    interfaceView.targetKnowledgeObject,
    expectedTarget.identifier
  );

  assert.equal(
    interfaceView.targetVersion,
    expectedTarget.version
  );

  assert.equal(
    interfaceView.targetSpecification,
    expectedTarget.specification
  );

  assert.equal(
    inputSemantics.identifier.startsWith(
      expectedTarget.specification.replace('/versions/cks-1.0', '')
    ),
    true
  );

  assert.equal(
    outputSemantics.identifier.startsWith(
      expectedTarget.specification
    ),
    true
  );
});

test('progressive states and all independent facet values are supported', () => {
  const names = [
    'state-0-missing-all.json',
    'state-1-semantics-complete.json',
    'state-2-profiles-complete.json',
    'state-3-interface-complete.json'
  ];

  const expected = [
    ['missing', 'missing', 'missing'],
    ['complete', 'missing', 'missing'],
    ['complete', 'complete', 'missing'],
    ['complete', 'complete', 'complete']
  ];

  names.forEach((name, index) => {
    const state = loadJson(`states/${name}`);

    assert.deepEqual(
      [
        state.semantics,
        state.profiles,
        state.interface
      ],
      expected[index]
    );
  });
});

test('State 3 supplies one aggregated interface specification', () => {
  const specification = loadJson('interface/interface.json');
  const contract = loadJson('execution/contract-execution.json');

  assert.equal(
    contract.interfaceSpecification,
    'interface/interface.json'
  );

  assert.equal(
    specification.artifactType,
    'interface-boundary-view'
  );

  assert.deepEqual(
    specification.interfaceSpecification,
    {
      identifier: 'WagnerJavaScriptInterfaceSpecification',
      version: '1.0',
      title: 'Meggitt-Wagner JavaScript Interface',
      description:
        'The teaching interface specification for invoking the Meggitt-Wagner capability with a completed questionnaire response.'
    }
  );

  assert.equal(
    specification.targetKnowledgeObject,
    contract.targetBinding.identifier
  );

  assert.equal(
    specification.targetVersion,
    contract.targetBinding.version
  );

  assert.equal(
    specification.targetSpecification,
    contract.targetBinding.specification
  );
});

test('interface specification declares the complete invocation method', () => {
  const specification = loadJson('interface/interface.json');
  const invocation = specification.invocation;

  assert.equal(invocation.operationId, 'run');
  assert.equal(invocation.interactionStyle, 'javascript-function');
  assert.equal(invocation.language, 'JavaScript');
  assert.equal(invocation.member, 'run');
  assert.equal(invocation.signature, 'run(input)');
  assert.equal(
    invocation.usage,
    'await knowledgeObject.run(input)'
  );
  assert.equal(invocation.asynchronous, true);
  assert.equal(invocation.completionMechanism, 'promise');
});

test('interface specification binds State 2 data objects to the operation', () => {
  const specification = loadJson('interface/interface.json');
  const contract = loadJson('execution/contract-execution.json');

  const input = specification.bindings.input;
  const output = specification.bindings.output;
  const error = specification.bindings.error;

  /*
   * These two string-valued properties preserve compatibility with the
   * current FDO Bench loader.
   */
  assert.equal(
    specification.inputBinding,
    'CompletedQuestionnaireResponseProfile'
  );

  assert.equal(
    specification.outputBinding,
    'WagnerAnalysisResultProfile'
  );

  /*
   * The richer binding declarations specify exactly where the two formal
   * data objects participate in the operation.
   */
  assert.equal(
    input.profile,
    specification.inputBinding
  );

  assert.equal(
    input.profile,
    contract.input.profile
  );

  assert.equal(input.location, 'function-argument');
  assert.equal(input.parameterName, 'input');
  assert.equal(input.position, 0);
  assert.equal(input.required, true);
  assert.equal(input.passingConvention, 'object-value');

  assert.equal(
    output.profile,
    specification.outputBinding
  );

  assert.equal(
    output.profile,
    contract.output.profile
  );

  assert.equal(output.location, 'resolved-return-value');
  assert.equal(output.required, true);

  assert.equal(error.location, 'rejected-promise');
});

test('interface specification declares the successful outcome', () => {
  const specification = loadJson('interface/interface.json');
  const expectedOutput = loadJson('examples/expected-output.json');
  const success = specification.outcomes.success;

  assert.equal(success.code, 'COMPLETED');
  assert.equal(success.delivery, 'resolved-promise');

  assert.equal(
    success.profile,
    specification.outputBinding
  );

  assert.equal(
    typeof success.condition,
    'string'
  );

  assert.equal(
    success.condition.length > 0,
    true
  );

  assert.deepEqual(
    success.example,
    expectedOutput
  );
});

test('interface specification aggregates the error schema', () => {
  const specification = loadJson('interface/interface.json');
  const schema = specification.outcomes.errors.schema;

  assert.equal(schema.type, 'object');

  assert.deepEqual(
    schema.required,
    [
      'code',
      'message',
      'phase'
    ]
  );

  assert.deepEqual(
    schema.properties.code.enum,
    [
      'INVALID_INPUT',
      'CONTRACT_MISMATCH',
      'EXECUTION_FAILED'
    ]
  );

  assert.deepEqual(
    schema.properties.phase.enum,
    [
      'input-validation',
      'contract-binding',
      'invocation'
    ]
  );

  assert.equal(
    schema.properties.message.type,
    'string'
  );

  assert.equal(
    schema.properties.details.type,
    'object'
  );
});

test('interface specification declares all expected error outcomes', () => {
  const specification = loadJson('interface/interface.json');
  const errors = specification.outcomes.errors;
  const definitions = errors.definitions;

  assert.equal(Array.isArray(definitions), true);
  assert.equal(definitions.length, 3);

  assert.deepEqual(
    definitions.map((definition) => definition.code),
    [
      'INVALID_INPUT',
      'CONTRACT_MISMATCH',
      'EXECUTION_FAILED'
    ]
  );

  assert.deepEqual(
    definitions.map((definition) => definition.phase),
    [
      'input-validation',
      'contract-binding',
      'invocation'
    ]
  );

  assert.equal(
    new Set(
      definitions.map((definition) => definition.code)
    ).size,
    definitions.length,
    'Every error code must be unique.'
  );

  for (const definition of definitions) {
    assert.equal(
      errors.schema.properties.code.enum.includes(
        definition.code
      ),
      true,
      `${definition.code} must be admitted by the error schema.`
    );

    assert.equal(
      errors.schema.properties.phase.enum.includes(
        definition.phase
      ),
      true,
      `${definition.phase} must be admitted by the error schema.`
    );

    assert.equal(
      definition.delivery,
      'rejected-promise'
    );

    assert.equal(
      typeof definition.condition,
      'string'
    );

    assert.equal(
      definition.condition.length > 0,
      true
    );

    assert.equal(
      definition.example.code,
      definition.code
    );

    assert.equal(
      definition.example.phase,
      definition.phase
    );

    assert.equal(
      typeof definition.example.message,
      'string'
    );

    assert.equal(
      definition.example.message.length > 0,
      true
    );

    assert.equal(
      typeof definition.example.details,
      'object'
    );

    for (const requiredProperty of errors.schema.required) {
      assert.equal(
        Object.hasOwn(
          definition.example,
          requiredProperty
        ),
        true,
        `${definition.code} example must contain ${requiredProperty}.`
      );
    }
  }
});

test('success and error outcomes use distinct promise channels', () => {
  const specification = loadJson('interface/interface.json');
  const outcomes = specification.outcomes;

  assert.equal(
    outcomes.success.delivery,
    'resolved-promise'
  );

  for (const error of outcomes.errors.definitions) {
    assert.equal(
      error.delivery,
      'rejected-promise'
    );
  }

  assert.notEqual(
    outcomes.success.delivery,
    outcomes.errors.definitions[0].delivery
  );
});

test('State 3 remains an interface specification rather than a KO implementation', () => {
  const specification = loadJson('interface/interface.json');

  assert.equal(
    specification.invocation.interactionStyle,
    'javascript-function'
  );

  assert.equal(
    specification.invocation.usage,
    'await knowledgeObject.run(input)'
  );

  assert.equal(
    Object.hasOwn(specification, 'implementation'),
    false
  );

  assert.equal(
    Object.hasOwn(specification, 'clinicalLogic'),
    false
  );

  assert.equal(
    Object.hasOwn(specification, 'classificationRules'),
    false
  );
});