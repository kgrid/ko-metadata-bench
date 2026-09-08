'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runQuestionnaire } = require('../src/index');
const { analyzeQuestionnaireResponse, ANALYSIS_STATUS } = require('../src/scorer');

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

async function payloadFromAnswers(plannedAnswers) {
  return runQuestionnaire(async (question) => plannedAnswers[question.id]);
}

test('section 6 shape is always exactly five fields', async () => {
  const payload = await payloadFromAnswers({ Q01: true });
  const result = analyzeQuestionnaireResponse(payload);

  assert.deepEqual(Object.keys(result).sort(), [
    'analysis_status',
    'grade_label',
    'question_ids',
    'responses',
    'wagner_score'
  ]);
  assert.deepEqual(result.question_ids, QUESTION_IDS);
});

test('Q01 yes payload computes Grade 5', async () => {
  const payload = await payloadFromAnswers({ Q01: true });
  const result = analyzeQuestionnaireResponse(payload);

  assert.equal(result.analysis_status, ANALYSIS_STATUS.GRADE_COMPUTED);
  assert.deepEqual(result.wagner_score, [5]);
  assert.deepEqual(result.grade_label, ['Extensive gangrene']);
});

test('Q02 yes payload computes Grade 4', async () => {
  const payload = await payloadFromAnswers({ Q01: false, Q02: true });
  const result = analyzeQuestionnaireResponse(payload);

  assert.equal(result.analysis_status, ANALYSIS_STATUS.GRADE_COMPUTED);
  assert.deepEqual(result.wagner_score, [4]);
  assert.deepEqual(result.grade_label, ['Localized gangrene']);
});

test('open ulcer deep, no complications computes Grade 2', async () => {
  const payload = await payloadFromAnswers({
    Q01: false,
    Q02: false,
    Q06: true,
    Q07: true,
    Q03: false,
    Q04: false,
    Q05: false
  });
  const result = analyzeQuestionnaireResponse(payload);

  assert.equal(result.analysis_status, ANALYSIS_STATUS.GRADE_COMPUTED);
  assert.deepEqual(result.wagner_score, [2]);
  assert.deepEqual(result.grade_label, ['Deep ulcer']);
});

test('no open ulcer and at-risk site computes Grade 0', async () => {
  const payload = await payloadFromAnswers({
    Q01: false,
    Q02: false,
    Q06: false,
    Q10: true
  });
  const result = analyzeQuestionnaireResponse(payload);

  assert.equal(result.analysis_status, ANALYSIS_STATUS.GRADE_COMPUTED);
  assert.deepEqual(result.wagner_score, [0]);
  assert.deepEqual(result.grade_label, ['At-risk foot without an open ulcer']);
});

test('indeterminate lesion-state payload remains indeterminate after X completion', async () => {
  const payload = await payloadFromAnswers({
    Q01: false,
    Q02: false,
    Q06: false,
    Q10: false
  });
  const result = analyzeQuestionnaireResponse(payload);

  assert.equal(result.analysis_status, ANALYSIS_STATUS.INDETERMINATE);
  assert.deepEqual(result.wagner_score, []);
  assert.deepEqual(result.grade_label, []);
});

test('explicit i returns incomplete_response', () => {
  const result = analyzeQuestionnaireResponse({
    question_ids: QUESTION_IDS,
    responses: ['0', '0', 'X', 'X', 'X', '1', 'i', 'X', '0', '0']
  });

  assert.equal(result.analysis_status, ANALYSIS_STATUS.INCOMPLETE_RESPONSE);
  assert.deepEqual(result.wagner_score, []);
  assert.deepEqual(result.grade_label, []);
});

test('contradictory row returns conflicting_response', () => {
  const result = analyzeQuestionnaireResponse({
    question_ids: QUESTION_IDS,
    responses: ['1', '0', '0', '0', '0', '1', '0', '0', '1', '0']
  });

  assert.equal(result.analysis_status, ANALYSIS_STATUS.CONFLICTING_RESPONSE);
  assert.deepEqual(result.wagner_score, []);
  assert.deepEqual(result.grade_label, []);
});

test('unjustified X that can lead to different outcomes returns conflicting_response', () => {
  const result = analyzeQuestionnaireResponse({
    question_ids: QUESTION_IDS,
    responses: ['0', '0', 'X', 'X', 'X', '1', '1', '0', '0', '0']
  });

  assert.equal(result.analysis_status, ANALYSIS_STATUS.CONFLICTING_RESPONSE);
  assert.deepEqual(result.wagner_score, []);
  assert.deepEqual(result.grade_label, []);
});

test('lowercase x is rejected as invalid raw representation', () => {
  assert.throws(
    () =>
      analyzeQuestionnaireResponse({
        question_ids: QUESTION_IDS,
        responses: ['0', '0', 'x', '0', '0', '1', '0', '1', '0', '0']
      }),
    /responses values must be one of "0", "1", "X", or "i"/i
  );
});

test('uppercase I is rejected as invalid raw representation', () => {
  assert.throws(
    () =>
      analyzeQuestionnaireResponse({
        question_ids: QUESTION_IDS,
        responses: ['0', '0', '0', '0', '0', '1', 'I', '0', '0', '0']
      }),
    /responses values must be one of "0", "1", "X", or "i"/i
  );
});

test('Q10 yes with deep-complication yes is conflicting_response (MW-C004)', () => {
  const result = analyzeQuestionnaireResponse({
    question_ids: QUESTION_IDS,
    responses: ['0', '0', '1', '0', '0', '0', '0', '0', '1', '1']
  });

  assert.equal(result.analysis_status, ANALYSIS_STATUS.CONFLICTING_RESPONSE);
  assert.deepEqual(result.wagner_score, []);
  assert.deepEqual(result.grade_label, []);
});
