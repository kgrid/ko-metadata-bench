'use strict';

const CANONICAL_QUESTION_IDS = [
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

const ANALYSIS_STATUS = {
  GRADE_COMPUTED: 'grade_computed',
  INDETERMINATE: 'indeterminate',
  AMBIGUOUS: 'ambiguous',
  INCOMPLETE_RESPONSE: 'incomplete_response',
  CONFLICTING_RESPONSE: 'conflicting_response'
};

const GRADE_LABEL_BY_SCORE = {
  0: 'At-risk foot without an open ulcer',
  1: 'Superficial ulcer',
  2: 'Deep ulcer',
  3: 'Deep ulcer with abscess or osteomyelitis',
  4: 'Localized gangrene',
  5: 'Extensive gangrene'
};

/**
 * Analyze questionnaire responses and return the constant-shape Section 6 result.
 * Accepts either a minimal 3B-like input ({question_ids, responses}) or a
 * Questionnaire Logic payload that includes those two fields.
 *
 * @param {{question_ids: string[], responses: Array<string|number>}} input
 * @returns {{
 *   question_ids: string[],
 *   responses: string[],
 *   analysis_status: 'grade_computed'|'indeterminate'|'ambiguous'|'incomplete_response'|'conflicting_response',
 *   wagner_score: number[],
 *   grade_label: string[]
 * }}
 */
function analyzeQuestionnaireResponse(input) {
  const normalized = normalizeInput(input);
  const { question_ids, responses } = normalized;

  if (responses.includes('i')) {
    return makeResult(question_ids, responses, ANALYSIS_STATUS.INCOMPLETE_RESPONSE);
  }

  if (responses.includes('X')) {
    return analyzeWithXCompletion(question_ids, responses);
  }

  return analyzeBooleanRow(question_ids, responses);
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Input must be an object with question_ids and responses.');
  }

  const questionIds = input.question_ids;
  const responses = input.responses;

  if (!Array.isArray(questionIds) || !Array.isArray(responses)) {
    throw new TypeError('question_ids and responses must both be arrays.');
  }

  if (questionIds.length !== CANONICAL_QUESTION_IDS.length) {
    throw new TypeError('question_ids must contain exactly 10 items in canonical order.');
  }

  if (responses.length !== CANONICAL_QUESTION_IDS.length) {
    throw new TypeError('responses must contain exactly 10 items aligned to question_ids.');
  }

  for (let i = 0; i < CANONICAL_QUESTION_IDS.length; i += 1) {
    if (questionIds[i] !== CANONICAL_QUESTION_IDS[i]) {
      throw new TypeError('question_ids must be canonical Q01-through-Q10 order.');
    }
  }

  const normalizedResponses = responses.map((value) => normalizeResponseValue(value));

  return {
    question_ids: [...CANONICAL_QUESTION_IDS],
    responses: normalizedResponses
  };
}

function normalizeResponseValue(value) {
  if (value === 0 || value === '0') {
    return '0';
  }
  if (value === 1 || value === '1') {
    return '1';
  }
  if (value === 'X') {
    return 'X';
  }
  if (value === 'i') {
    return 'i';
  }

  throw new TypeError('responses values must be one of "0", "1", "X", or "i".');
}

function analyzeWithXCompletion(questionIds, responsesWithX) {
  const xIndexes = [];
  for (let i = 0; i < responsesWithX.length; i += 1) {
    if (responsesWithX[i] === 'X') {
      xIndexes.push(i);
    }
  }

  const completionCount = 2 ** xIndexes.length;
  const validOutcomes = [];

  for (let mask = 0; mask < completionCount; mask += 1) {
    const completion = [...responsesWithX];

    for (let bit = 0; bit < xIndexes.length; bit += 1) {
      const idx = xIndexes[bit];
      completion[idx] = (mask & (1 << bit)) === 0 ? '0' : '1';
    }

    const outcome = classifyBooleanRow(completion);
    if (outcome.analysis_status !== ANALYSIS_STATUS.CONFLICTING_RESPONSE) {
      validOutcomes.push(outcome);
    }
  }

  if (validOutcomes.length === 0) {
    return makeResult(questionIds, responsesWithX, ANALYSIS_STATUS.CONFLICTING_RESPONSE);
  }

  const allGradeComputed = validOutcomes.every(
    (outcome) => outcome.analysis_status === ANALYSIS_STATUS.GRADE_COMPUTED
  );

  if (allGradeComputed) {
    const firstScore = validOutcomes[0].wagner_score[0];
    const sameScore = validOutcomes.every(
      (outcome) => outcome.wagner_score[0] === firstScore
    );

    if (sameScore) {
      return makeResult(
        questionIds,
        responsesWithX,
        ANALYSIS_STATUS.GRADE_COMPUTED,
        [firstScore],
        [GRADE_LABEL_BY_SCORE[firstScore]]
      );
    }
  }

  const allIndeterminate = validOutcomes.every(
    (outcome) => outcome.analysis_status === ANALYSIS_STATUS.INDETERMINATE
  );

  if (allIndeterminate) {
    return makeResult(questionIds, responsesWithX, ANALYSIS_STATUS.INDETERMINATE);
  }

  return makeResult(questionIds, responsesWithX, ANALYSIS_STATUS.CONFLICTING_RESPONSE);
}

function analyzeBooleanRow(questionIds, responses) {
  const outcome = classifyBooleanRow(responses);
  return makeResult(
    questionIds,
    responses,
    outcome.analysis_status,
    outcome.wagner_score,
    outcome.grade_label
  );
}

function classifyBooleanRow(responses) {
  const q = makeQuestionAccessor(responses);

  if (violatesHardConstraints(q)) {
    return {
      analysis_status: ANALYSIS_STATUS.CONFLICTING_RESPONSE,
      wagner_score: [],
      grade_label: []
    };
  }

  const truePredicates = [];

  if (q('Q01') === 1) {
    truePredicates.push(5);
  }
  if (q('Q01') === 0 && q('Q02') === 1) {
    truePredicates.push(4);
  }
  if (
    q('Q01') === 0 &&
    q('Q02') === 0 &&
    q('Q06') === 1 &&
    q('Q07') === 1 &&
    (q('Q03') === 1 || q('Q04') === 1 || q('Q05') === 1)
  ) {
    truePredicates.push(3);
  }
  if (
    q('Q01') === 0 &&
    q('Q02') === 0 &&
    q('Q06') === 1 &&
    q('Q07') === 1 &&
    q('Q03') === 0 &&
    q('Q04') === 0 &&
    q('Q05') === 0
  ) {
    truePredicates.push(2);
  }
  if (
    q('Q01') === 0 &&
    q('Q02') === 0 &&
    q('Q06') === 1 &&
    q('Q07') === 0 &&
    q('Q08') === 1 &&
    q('Q03') === 0 &&
    q('Q04') === 0 &&
    q('Q05') === 0
  ) {
    truePredicates.push(1);
  }
  if (q('Q01') === 0 && q('Q02') === 0 && q('Q06') === 0 && q('Q10') === 1) {
    truePredicates.push(0);
  }

  if (truePredicates.length === 1) {
    const score = truePredicates[0];
    return {
      analysis_status: ANALYSIS_STATUS.GRADE_COMPUTED,
      wagner_score: [score],
      grade_label: [GRADE_LABEL_BY_SCORE[score]]
    };
  }

  if (truePredicates.length > 1) {
    return {
      analysis_status: ANALYSIS_STATUS.AMBIGUOUS,
      wagner_score: [],
      grade_label: []
    };
  }

  return {
    analysis_status: ANALYSIS_STATUS.INDETERMINATE,
    wagner_score: [],
    grade_label: []
  };
}

function violatesHardConstraints(q) {
  if (q('Q01') === 1 && q('Q02') === 1) {
    return true;
  }

  if (q('Q01') === 1 && (q('Q06') !== 1 || q('Q09') !== 0 || q('Q10') !== 0)) {
    return true;
  }

  if (q('Q02') === 1 && (q('Q06') !== 1 || q('Q09') !== 0 || q('Q10') !== 0)) {
    return true;
  }

  if (q('Q06') === 1 && (q('Q09') !== 0 || q('Q10') !== 0)) {
    return true;
  }

  if (q('Q10') === 1 && (q('Q06') !== 0 || q('Q09') !== 1)) {
    return true;
  }

  if (q('Q10') === 1 && (q('Q03') === 1 || q('Q04') === 1 || q('Q05') === 1)) {
    return true;
  }

  if (q('Q06') === 0 && (q('Q07') !== 0 || q('Q08') !== 0)) {
    return true;
  }

  if (q('Q07') === 1 && (q('Q06') !== 1 || q('Q08') !== 0)) {
    return true;
  }

  if (q('Q08') === 1 && (q('Q06') !== 1 || q('Q07') !== 0)) {
    return true;
  }

  return false;
}

function makeQuestionAccessor(responses) {
  const map = {};
  for (let i = 0; i < CANONICAL_QUESTION_IDS.length; i += 1) {
    map[CANONICAL_QUESTION_IDS[i]] = responses[i] === '1' ? 1 : 0;
  }
  return (id) => map[id];
}

function makeResult(questionIds, responses, status, score = [], label = []) {
  return {
    question_ids: questionIds,
    responses,
    analysis_status: status,
    wagner_score: score,
    grade_label: label
  };
}

module.exports = {
  ANALYSIS_STATUS,
  GRADE_LABEL_BY_SCORE,
  analyzeQuestionnaireResponse
};
