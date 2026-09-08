'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  showRegimenRange,
  questionnaireResponseFromObject,
  calculateBurdenRange
} = require('../src');
const { validateByDef } = require('../src/schema-validation');

function expectSchema(defName, payload) {
  const outcome = validateByDef(defName, payload);
  assert.equal(outcome.ok, true, `${defName} schema validation failed: ${JSON.stringify(outcome.errors)}`);
}

test('regimen-range request and response conform to schema', () => {
  const request = { request_type: 'show_regimen_range' };
  expectSchema('regimenRangeRequest', request);

  const response = showRegimenRange(request);
  expectSchema('fixedRegimenRangeResponse', response);
});

test('questionnaire response conforms to completedQuestionnaireResponse schema', () => {
  const response = questionnaireResponseFromObject({
    hyperbaric_oxygen_therapy_location: 'https://kgrid.org/cks/dfu-hbot-burden/providers/e-001',
    one_way_miles: 10,
    one_way_travel_minutes: 30,
    weekday_attendance_difficulty: 'some'
  });

  expectSchema('completedQuestionnaireResponse', response);
  expectSchema('analysisQuestionnaireResponse', response);
});

test('analysis request and completed analysis result conform to schema', () => {
  const regimen = showRegimenRange({ request_type: 'show_regimen_range' });
  const questionnaire = questionnaireResponseFromObject({
    hyperbaric_oxygen_therapy_location: 'https://kgrid.org/cks/dfu-hbot-burden/providers/e-001',
    one_way_miles: 12,
    one_way_travel_minutes: 45,
    weekday_attendance_difficulty: 'major'
  });

  const request = {
    request_type: 'calculate_burden_range',
    provider_roster_version_iri:
      'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
    questionnaire_response: questionnaire,
    fixed_regimen_range_response: regimen
  };

  expectSchema('analysisRequest', request);

  const result = calculateBurdenRange(request);
  expectSchema('analysisResult', result);
  expectSchema('completedAnalysisResult', result);
  assert.equal(result.status, 'completed');
});

test('analysis error result conforms to schema for ERR-07 missing required input', () => {
  const result = calculateBurdenRange({
    request_type: 'calculate_burden_range',
    provider_roster_version_iri:
      'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0'
  });

  assert.equal(result.status, 'error');
  assert.equal(result.result_code, 'ERR-07');
  expectSchema('analysisResult', result);
  expectSchema('errorAnalysisResult', result);
});
