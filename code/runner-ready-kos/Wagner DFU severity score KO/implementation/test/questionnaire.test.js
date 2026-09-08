'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runQuestionnaire } = require('../src/index');

const QUESTION_IDS = [
  'Q01',
  'Q02',
  'Q03',
  'Q04',
  'Q05',
  'Q06',
  'Q07',
  'Q08',
  'Q09',
  'Q10'
];

async function runWithPlannedAnswers(plannedAnswers) {
  const seen = [];

  const outcome = await runQuestionnaire(async (question) => {
    seen.push(question.id);
    if (!(question.id in plannedAnswers)) {
      throw new Error(`No planned answer for ${question.id}`);
    }
    return plannedAnswers[question.id];
  });

  return { outcome, seen };
}

test('TP-01 extensive gangrene path', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({ Q01: true });

  assert.deepEqual(seen, ['Q01']);
  assert.equal(
    outcome.specification_iri,
    'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0'
  );
  assert.equal(
    outcome.response_model_iri,
    'https://kgrid.org/cks/meggitt-wagner/response-models/1.0'
  );
  assert.equal(
    outcome.question_set_iri,
    'https://kgrid.org/cks/meggitt-wagner/question-sets/mw-qs-02/versions/1.0'
  );
  assert.deepEqual(outcome.question_ids, QUESTION_IDS);
  assert.deepEqual(outcome.responses, ['1', '0', 'X', 'X', 'X', '1', 'X', 'X', '0', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01']);
  assert.deepEqual(outcome.entailed_questions, ['Q02', 'Q06', 'Q09', 'Q10']);
});

test('TP-02 localized gangrene path', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02']);
  assert.deepEqual(outcome.responses, ['0', '1', 'X', 'X', 'X', '1', 'X', 'X', '0', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02']);
  assert.deepEqual(outcome.entailed_questions, ['Q06', 'Q09', 'Q10']);
});

test('TP-03 no open ulcer and at-risk site', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: false,
    Q10: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q10']);
  assert.deepEqual(outcome.responses, ['0', '0', '0', '0', '0', '0', '0', '0', '1', '1']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02', 'Q06', 'Q10']);
  assert.deepEqual(outcome.entailed_questions, ['Q03', 'Q04', 'Q05', 'Q07', 'Q08', 'Q09']);
});

test('TP-04 no open ulcer and not at-risk site', async () => {
  const { outcome } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: false,
    Q10: false
  });

  assert.deepEqual(outcome.responses, ['0', '0', 'X', 'X', 'X', '0', '0', '0', 'X', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02', 'Q06', 'Q10']);
  assert.deepEqual(outcome.entailed_questions, ['Q07', 'Q08']);
});

test('TP-06 deep ulcer with osteomyelitis short-circuit at Q04', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: true,
    Q03: false,
    Q04: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q07', 'Q03', 'Q04']);
  assert.deepEqual(outcome.responses, ['0', '0', '0', '1', 'X', '1', '1', '0', '0', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02', 'Q03', 'Q04', 'Q06', 'Q07']);
  assert.deepEqual(outcome.entailed_questions, ['Q08', 'Q09', 'Q10']);
});


test('TP-05 deep ulcer with deep abscess short-circuit at Q03', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: true,
    Q03: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q07', 'Q03']);
  assert.deepEqual(outcome.responses, ['0', '0', '1', 'X', 'X', '1', '1', '0', '0', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02', 'Q03', 'Q06', 'Q07']);
  assert.deepEqual(outcome.entailed_questions, ['Q08', 'Q09', 'Q10']);
});

test('TP-07 deep ulcer with deep infection short-circuit at Q05', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: true,
    Q03: false,
    Q04: false,
    Q05: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q07', 'Q03', 'Q04', 'Q05']);
  assert.deepEqual(outcome.responses, ['0', '0', '0', '0', '1', '1', '1', '0', '0', '0']);
  assert.deepEqual(
    outcome.directly_answered_questions,
    ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07']
  );
  assert.deepEqual(outcome.entailed_questions, ['Q08', 'Q09', 'Q10']);
});

test('TP-08 deep ulcer with no deep complications', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: true,
    Q03: false,
    Q04: false,
    Q05: false
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q07', 'Q03', 'Q04', 'Q05']);
  assert.deepEqual(outcome.responses, ['0', '0', '0', '0', '0', '1', '1', '0', '0', '0']);
  assert.deepEqual(
    outcome.directly_answered_questions,
    ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07']
  );
  assert.deepEqual(outcome.entailed_questions, ['Q08', 'Q09', 'Q10']);
});

test('TP-09 open ulcer but depth unresolved', async () => {
  const { outcome } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: false,
    Q08: false
  });

  assert.deepEqual(outcome.responses, ['0', '0', 'X', 'X', 'X', '1', '0', '0', '0', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02', 'Q06', 'Q07', 'Q08']);
  assert.deepEqual(outcome.entailed_questions, ['Q09', 'Q10']);
});

test('TP-10 superficial-only with deep abscess at Q03', async () => {
  const { outcome } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: false,
    Q08: true,
    Q03: true
  });

  assert.deepEqual(outcome.responses, ['0', '0', '1', 'X', 'X', '1', '0', '1', '0', '0']);
  assert.deepEqual(outcome.directly_answered_questions, ['Q01', 'Q02', 'Q03', 'Q06', 'Q07', 'Q08']);
  assert.deepEqual(outcome.entailed_questions, ['Q09', 'Q10']);
});

test('TP-11 superficial-only with osteomyelitis at Q04', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: false,
    Q08: true,
    Q03: false,
    Q04: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q07', 'Q08', 'Q03', 'Q04']);
  assert.deepEqual(outcome.responses, ['0', '0', '0', '1', 'X', '1', '0', '1', '0', '0']);
  assert.deepEqual(
    outcome.directly_answered_questions,
    ['Q01', 'Q02', 'Q03', 'Q04', 'Q06', 'Q07', 'Q08']
  );
  assert.deepEqual(outcome.entailed_questions, ['Q09', 'Q10']);
});

test('TP-12 superficial-only with deep infection at Q05', async () => {
  const { outcome, seen } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: false,
    Q08: true,
    Q03: false,
    Q04: false,
    Q05: true
  });

  assert.deepEqual(seen, ['Q01', 'Q02', 'Q06', 'Q07', 'Q08', 'Q03', 'Q04', 'Q05']);
  assert.deepEqual(outcome.responses, ['0', '0', '0', '0', '1', '1', '0', '1', '0', '0']);
  assert.deepEqual(
    outcome.directly_answered_questions,
    ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08']
  );
  assert.deepEqual(outcome.entailed_questions, ['Q09', 'Q10']);
});

test('TP-13 superficial-only with no deep complications', async () => {
  const { outcome } = await runWithPlannedAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: false,
    Q08: true,
    Q03: false,
    Q04: false,
    Q05: false
  });

  assert.deepEqual(outcome.responses, ['0', '0', '0', '0', '0', '1', '0', '1', '0', '0']);
  assert.deepEqual(
    outcome.directly_answered_questions,
    ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08']
  );
  assert.deepEqual(outcome.entailed_questions, ['Q09', 'Q10']);
});

test('asked question payload includes related Appendix A definitions as a dictionary', async () => {
  let q01Payload;
  let q10Payload;

  await runQuestionnaire(async (question) => {
    if (question.id === 'Q01') {
      q01Payload = question;
      return false;
    }

    if (question.id === 'Q02') {
      return false;
    }

    if (question.id === 'Q06') {
      return false;
    }

    if (question.id === 'Q10') {
      q10Payload = question;
      return true;
    }

    throw new Error(`Unexpected question in test flow: ${question.id}`);
  });

  assert.ok(q01Payload);
  assert.ok(q01Payload.definitions);
  assert.ok(q01Payload.definitions['extensive gangrene']);
  assert.equal(
    q01Payload.definitions['extensive gangrene'].term_iri,
    'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/extensive-gangrene'
  );

  assert.ok(q10Payload);
  assert.ok(q10Payload.definitions['at-risk site']);
  assert.ok(q10Payload.definitions['intact skin']);
  assert.ok(q10Payload.definitions['open ulcer']);
});
