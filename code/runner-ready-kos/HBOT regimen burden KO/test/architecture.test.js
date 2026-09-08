'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  showRegimenRange,
  runBurdenQuestionnaire,
  questionnaireResponseFromObject,
  calculateBurdenRange
} = require('../src');

test('regimen range returns fixed-spec response shape', () => {
  const response = showRegimenRange({ request_type: 'show_regimen_range' });

  assert.equal(response.status, 'completed');
  assert.equal(response.response_type, 'fixed_regimen_range_response');
  assert.deepEqual(response.combined_range.episodes, [30, 40]);
  assert.deepEqual(response.combined_range.course_weeks, [6.0, 8.0]);
  assert.equal(response.scheduled_facility_hours_per_episode.value, 3.0);
  assert.equal(response.scheduled_facility_hours_per_episode.unit, 'h');
  assert.equal(response.tailored_to_patient, false);
});

test('questionnaire logic returns completedQuestionnaireResponse', async () => {
  const qResponse = await runBurdenQuestionnaire(async (question) => {
    if (question.id === 'Q01') {
      return 'https://kgrid.org/cks/dfu-hbot-burden/providers/e-001';
    }
    if (question.id === 'Q02') {
      return 10;
    }
    if (question.id === 'Q03') {
      return 30;
    }
    if (question.id === 'Q04') {
      return 'some';
    }
    throw new Error('unexpected question id');
  });

  assert.equal(qResponse.questionnaire_status, 'completed');
  assert.equal(qResponse.confirmed, true);
  assert.equal(
    qResponse.response_projection.hyperbaric_oxygen_therapy_location,
    'https://kgrid.org/cks/dfu-hbot-burden/providers/e-001'
  );
});

test('analysis returns completed result with burden ranges', () => {
  const regimen = showRegimenRange({ request_type: 'show_regimen_range' });
  const questionnaireResponse = questionnaireResponseFromObject({
    hyperbaric_oxygen_therapy_location: 'https://kgrid.org/cks/dfu-hbot-burden/providers/e-001',
    one_way_miles: 10,
    one_way_travel_minutes: 30,
    weekday_attendance_difficulty: 'some'
  });

  const result = calculateBurdenRange({
    request_type: 'calculate_burden_range',
    provider_roster_version_iri:
      'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
    questionnaire_response: questionnaireResponse,
    fixed_regimen_range_response: regimen
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.error, null);
  assert.equal(result.result_code, 'RESULT-HIGH-EXECUTION-BURDEN');
  assert.deepEqual(result.objective_burden.overall_burden_range.episodes, [30, 40]);
  assert.equal(result.execution_burden_level.display_text, 'High execution burden');
});

test('analysis returns ERR-09 for invalid request_type', () => {
  const result = calculateBurdenRange({
    request_type: 'wrong_type',
    provider_roster_version_iri:
      'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
    questionnaire_response: {},
    fixed_regimen_range_response: {}
  });

  assert.equal(result.status, 'error');
  assert.equal(result.result_code, 'ERR-09');
  assert.equal(result.error.code, 'ERR-09');
});

test('analysis returns ERR-09 for unknown provider location', () => {
  const regimen = showRegimenRange({ request_type: 'show_regimen_range' });
  const questionnaireResponse = questionnaireResponseFromObject({
    hyperbaric_oxygen_therapy_location: 'https://kgrid.org/cks/dfu-hbot-burden/providers/e-141',
    one_way_miles: 12,
    one_way_travel_minutes: 25,
    weekday_attendance_difficulty: 'none'
  });

  const result = calculateBurdenRange({
    request_type: 'calculate_burden_range',
    provider_roster_version_iri:
      'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
    questionnaire_response: questionnaireResponse,
    fixed_regimen_range_response: regimen
  }, {
    providerRosterSnapshot: {
      roster_version_iri:
        'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
      record_count: 0,
      record_order: 'ascending_compact_id',
      records: []
    }
  });

  assert.equal(result.status, 'error');
  assert.equal(result.result_code, 'ERR-09');
  assert.equal(result.error.code, 'ERR-09');
});
