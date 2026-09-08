'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { showRegimenRange, calculateBurdenRange, questionnaireResponseFromObject } = require('../src');
const { validateByDef } = require('../src/schema-validation');
const providerRosterSnapshot = require('../spec/DFU_HBOT_Provider_Roster_Snapshot_Version_1_0.json');

const SPEC_DIR = path.resolve(__dirname, '../spec/DFU_HBOT_CKS_Conformance_Fixtures_1_0');
const MANIFEST_PATH = path.join(SPEC_DIR, 'manifest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deepEqualWithDiff(actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function makeUnavailableRoster() {
  return {
    roster_version_iri:
      'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0',
    record_count: 0,
    record_order: 'ascending_compact_id',
    records: []
  };
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function makeErr10() {
  return {
    code: 'ERR-10',
    status: 'error',
    error_field: 'provider_roster_dependency',
    message: 'Required provider roster is unavailable or invalid.'
  };
}

function makeRegimenError(code, field, message) {
  return {
    code,
    status: 'error',
    error_field: field,
    message
  };
}

function firstSchemaError(defName, input) {
  const check = validateByDef(defName, input);
  if (check.ok) {
    return null;
  }
  return check.errors[0] || null;
}

function validateRegimenResponse(input) {
  const error = firstSchemaError('fixedRegimenRangeResponse', input);
  if (!error) {
    return {
      outcome: 'completed',
      error: null,
      response: input
    };
  }

  const field = error.instancePath ? error.instancePath.slice(1).replace(/\//g, '.') : null;
  const message = 'Input value is outside the closed value set or constraint.';

  if (field === 'knowledge_package_iri') {
    return {
      outcome: 'error',
      error: makeRegimenError(
        'ERR-05',
        'knowledge_package_iri',
        'Input artifact identity, status, or version is invalid.'
      ),
      response: null
    };
  }

  return {
    outcome: 'error',
    error: makeRegimenError('ERR-09', field, message),
    response: null
  };
}

function validateRegimenRequestForRespond(input) {
  const error = firstSchemaError('regimenRangeRequest', input);
  if (!error) {
    return null;
  }

  if (error.keyword === 'additionalProperties' && error.params && error.params.additionalProperty) {
    const preferredField =
      input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'desired_weeks')
        ? 'desired_weeks'
        : error.params.additionalProperty;
    return {
      outcome: 'error',
      error: makeRegimenError(
        'ERR-04',
        preferredField,
        'Unexpected input property is not permitted.'
      ),
      response: null
    };
  }

  return {
    outcome: 'error',
    error: makeRegimenError(
      'ERR-09',
      'request_type',
      'Input value is outside the closed value set or constraint.'
    ),
    response: null
  };
}

function validateProviderRecord(input) {
  const check = validateByDef('hyperbaricOxygenTherapyLocationRecord', input);
  if (!check.ok) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  const compactMatch = /^E-(\d{3})$/.exec(String(input.compact_id || ''));
  const providerMatch = /\/providers\/e-(\d{3})$/.exec(String(input.provider_iri || ''));
  const rosterMatch = /\/records\/e-(\d{3})$/.exec(String(input.roster_record_iri || ''));

  if (!compactMatch || !providerMatch || !rosterMatch) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  const compactNum = compactMatch[1];
  if (providerMatch[1] !== compactNum || rosterMatch[1] !== compactNum) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  if (input.record_status === 'retired' && input.selectable !== false) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  if (
    input.record_status === 'retired' &&
    Array.isArray(input.successor_provider_iris) &&
    input.successor_provider_iris.includes(input.provider_iri)
  ) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  if (
    input.record_status === 'listed' &&
    Array.isArray(input.successor_provider_iris) &&
    input.successor_provider_iris.length > 0
  ) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  if (
    input.address_status === 'candidate' &&
    input.normalized_address_candidate === 'No matched live-directory address'
  ) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  const result = {
    valid: true,
    selectable: input.selectable === true,
    error: null
  };

  if (
    input.record_status === 'retired' &&
    Array.isArray(input.successor_provider_iris) &&
    input.successor_provider_iris.length > 0
  ) {
    result.successor_substitution_permitted = false;
  }

  return result;
}

function isAscendingCompactIds(records) {
  for (let i = 1; i < records.length; i += 1) {
    if (String(records[i - 1].compact_id) >= String(records[i].compact_id)) {
      return false;
    }
  }
  return true;
}

function validateProviderRecordSet(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  const seen = new Set();
  let allSelectable = true;

  for (const record of input) {
    const validated = validateProviderRecord(record);
    if (!validated.valid) {
      return { valid: false, selectable: false, error: makeErr10() };
    }

    const key = `${record.compact_id}|${record.provider_iri}|${record.roster_record_iri}`;
    if (seen.has(key)) {
      return { valid: false, selectable: false, error: makeErr10() };
    }
    seen.add(key);

    if (!validated.selectable) {
      allSelectable = false;
    }
  }

  return { valid: true, selectable: allSelectable, error: null };
}

function validateProviderSnapshot(input) {
  const check = validateByDef('providerRosterSnapshot', input);
  if (!check.ok) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  if (!Array.isArray(input.records) || input.record_count !== input.records.length) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  if (!isAscendingCompactIds(input.records)) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  const recordSet = validateProviderRecordSet(input.records);
  if (!recordSet.valid) {
    return { valid: false, selectable: false, error: makeErr10() };
  }

  return {
    valid: true,
    selectable: recordSet.selectable,
    error: null
  };
}

function isSelectableProvider(providerIri) {
  const record = providerRosterSnapshot.records.find((item) => item.provider_iri === providerIri);
  return Boolean(record && record.selectable === true);
}

function applyQuestionnaireEvents(events) {
  const answers = {
    Q01: null,
    Q02: null,
    Q03: null,
    Q04: null
  };
  let state = 'QNTS-00';
  let registeredResponse = null;
  let displayRequirements = [];
  let hasFilter = false;

  function resetAnswers() {
    answers.Q01 = null;
    answers.Q02 = null;
    answers.Q03 = null;
    answers.Q04 = null;
  }

  function allAnswered() {
    return answers.Q01 && answers.Q02 !== null && answers.Q03 !== null && answers.Q04;
  }

  for (const event of events) {
    if (event.event === 'abandon') {
      state = 'QTS-ABANDONED';
      resetAnswers();
      registeredResponse = null;
      displayRequirements = [];
      continue;
    }

    if (event.event === 'set_filter') {
      hasFilter = true;
      continue;
    }

    if (event.event === 'roster_record_invalidated') {
      state = 'QNTS-00';
      resetAnswers();
      registeredResponse = null;
      displayRequirements = [];
      continue;
    }

    if (event.event === 'confirm_provider') {
      const providerIri = event.provider_iri;

      if (state === 'QTS-COMPLETED' && answers.Q01 && providerIri && providerIri !== answers.Q01) {
        return {
          state: 'QTS-COMPLETED',
          registered_response: registeredResponse,
          new_instance_required: true,
          analysis_invoked: false
        };
      }

      if (!isSelectableProvider(providerIri)) {
        state = 'QNTS-00';
        resetAnswers();
        registeredResponse = null;
        displayRequirements = ['provider_not_selectable'];
        continue;
      }

      if (answers.Q01 === providerIri && answers.Q02 !== null && answers.Q03 !== null && answers.Q04 === null) {
        state = 'QNTS-03';
        displayRequirements = ['facility_listing', 'normalized_address_candidate'];
        continue;
      }

      answers.Q01 = providerIri;
      answers.Q02 = null;
      answers.Q03 = null;
      answers.Q04 = null;
      registeredResponse = null;
      state = 'QNTS-01';
      displayRequirements = hasFilter || event.compact_id
        ? ['facility_listing', 'normalized_address_candidate']
        : [];
      continue;
    }

    if (event.event === 'answer') {
      if (event.question === 'Q02') {
        if (typeof event.value !== 'number' || Number.isNaN(event.value)) {
          state = 'QNTS-01';
          displayRequirements = ['Q02_number_required'];
          continue;
        }
        if (event.value < 0 || event.value > 1000) {
          state = 'QNTS-01';
          displayRequirements = ['Q02_out_of_range'];
          continue;
        }
        if (event.value === 0) {
          state = 'QNTS-01';
          displayRequirements = ['zero_confirmation_required'];
          continue;
        }
        answers.Q02 = event.value;
        state = 'QNTS-02';
        displayRequirements = [];
        continue;
      }

      if (event.question === 'Q03') {
        if (answers.Q02 === null) {
          state = 'QNTS-01';
          displayRequirements = ['Q02_required_next'];
          continue;
        }
        if (typeof event.value !== 'number' || Number.isNaN(event.value) || event.value < 0 || event.value > 1440) {
          state = 'QNTS-02';
          displayRequirements = ['Q03_out_of_range'];
          continue;
        }
        answers.Q03 = event.value;
        state = 'QNTS-03';
        displayRequirements = [];
        continue;
      }

      if (event.question === 'Q04') {
        const value = typeof event.value === 'string' ? event.value.toLowerCase() : event.value;
        if (!['none', 'some', 'major'].includes(value)) {
          state = 'QNTS-03';
          displayRequirements = ['Q04_closed_values_required'];
          continue;
        }
        answers.Q04 = value;
        state = 'QTS-REVIEW';
        displayRequirements = [];
      }
      continue;
    }

    if (event.event === 'confirm_zero' && event.question === 'Q03' && answers.Q03 === 0) {
      state = 'QNTS-03';
      displayRequirements = [];
      continue;
    }

    if (event.event === 'revise' && event.question === 'Q02') {
      if (typeof event.value !== 'number' || Number.isNaN(event.value) || event.value < 0 || event.value > 1000) {
        state = 'QTS-REVIEW';
        displayRequirements = ['Q02_out_of_range'];
        continue;
      }
      answers.Q02 = event.value;
      state = answers.Q03 !== null && answers.Q04 ? 'QTS-REVIEW' : 'QNTS-02';
      displayRequirements = [];
      continue;
    }

    if (event.event === 'confirm_review') {
      if (allAnswered()) {
        registeredResponse = questionnaireResponseFromObject({
          hyperbaric_oxygen_therapy_location: answers.Q01,
          one_way_miles: answers.Q02,
          one_way_travel_minutes: answers.Q03,
          weekday_attendance_difficulty: answers.Q04
        });
        state = 'QTS-COMPLETED';
        displayRequirements = [];
      } else if (answers.Q01 && answers.Q02 !== null && answers.Q03 !== null && answers.Q04 === null) {
        state = 'QNTS-03';
        displayRequirements = ['Q04_required'];
      }
    }
  }

  return {
    state,
    answers,
    registered_response: registeredResponse,
    analysis_invoked: false,
    display_requirements: displayRequirements
  };
}

function renderQuestion(input) {
  if (input.question === 'Q04') {
    return {
      question_id: 'Q04',
      required_phrases: [
        'confirmed hyperbaric oxygen therapy location',
        'five weekdays per week',
        '6–8 weeks',
        'exclude miles and travel time'
      ],
      allowed_values: ['none', 'some', 'major']
    };
  }
  return null;
}

function isIsoZulu(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

function validateAuditPayload(payload) {
  const { result, retained_input: retainedInput, retained_provider_roster_sha256: retainedRosterSha } = payload;

  const iriPattern =
    /^https:\/\/kgrid\.org\/cks\/dfu-hbot-burden\/result-instances\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!result || typeof result !== 'object' || !iriPattern.test(result.result_instance_iri || '')) {
    return {
      status: 'audit_invalid',
      failure_code: 'AUDIT-01',
      message: 'Result-instance identity is invalid.'
    };
  }

  if (!isIsoZulu(result.issued_at) || !isIsoZulu(result.provenance && result.provenance.input_received_at)) {
    return {
      status: 'audit_invalid',
      failure_code: 'AUDIT-02',
      message: 'Result timestamps are invalid.'
    };
  }

  if (
    !result.provenance ||
    result.provenance.specification_iri !==
      'https://kgrid.org/cks/dfu-hbot-burden/versions/cks-1.0'
  ) {
    return {
      status: 'audit_invalid',
      failure_code: 'AUDIT-03',
      message: 'Result provenance identity is invalid.'
    };
  }

  const expectedInputHash = sha256Hex(stableStringify(retainedInput));
  if (
    !result.provenance.input_fingerprint ||
    result.provenance.input_fingerprint.value !== expectedInputHash
  ) {
    return {
      status: 'audit_invalid',
      failure_code: 'AUDIT-04',
      message: 'Input fingerprint verification failed.'
    };
  }

  if (
    !result.provenance.provider_roster_fingerprint ||
    result.provenance.provider_roster_fingerprint.value !== retainedRosterSha
  ) {
    return {
      status: 'audit_invalid',
      failure_code: 'AUDIT-05',
      message: 'Provider-roster fingerprint verification failed.'
    };
  }

  const replayed = calculateBurdenRange(retainedInput, {
    providerRosterSnapshot,
    executionContext: {
      engine_implementation_iri: result.provenance.engine_implementation_iri,
      engine_implementation_version: result.provenance.engine_implementation_version,
      input_received_at: result.provenance.input_received_at,
      issued_at: result.issued_at,
      result_instance_iri: result.result_instance_iri
    }
  });

  if (
    !result.provenance.deterministic_result_fingerprint ||
    !replayed.provenance ||
    !replayed.provenance.deterministic_result_fingerprint ||
    result.provenance.deterministic_result_fingerprint.value !==
      replayed.provenance.deterministic_result_fingerprint.value
  ) {
    return {
      status: 'audit_invalid',
      failure_code: 'AUDIT-06',
      message: 'Deterministic result verification failed.'
    };
  }

  return {
    status: 'audit_valid',
    failure_code: null,
    message: null
  };
}

function normalizeRegimenIntent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const intent = typeof input.user_intent === 'string' ? input.user_intent.toLowerCase() : '';
  if (intent.includes('regimen') && intent.includes('range')) {
    return { request_type: 'show_regimen_range' };
  }
  return null;
}

function executeRegimenFixture(fixture) {
  if (fixture.operation === 'respond') {
    const invalid = validateRegimenRequestForRespond(fixture.input);
    if (invalid) {
      return invalid;
    }

    const response = showRegimenRange(fixture.input);
    return { outcome: 'completed', response };
  }

  if (fixture.operation === 'normalize_intent_and_respond') {
    const canonicalRequest = normalizeRegimenIntent(fixture.input);
    if (!canonicalRequest) {
      return { canonical_request: null, outcome: 'error', response: null };
    }
    const response = showRegimenRange(canonicalRequest);
    return {
      canonical_request: canonicalRequest,
      outcome: 'completed',
      response
    };
  }

  if (fixture.operation === 'validate_response') {
    return validateRegimenResponse(fixture.input);
  }

  return null;
}

function executeAnalysisFixture(fixture) {
  const dependencyState = fixture.dependency_state || {};

  function runAnalysis(input, executionContext) {
    return calculateBurdenRange(input, {
      providerRosterSnapshot,
      executionContext: executionContext || fixture.execution_context || {},
      rawInputJson: fixture.input_json,
      dependencyState
    });
  }

  if (fixture.operation === 'analyze') {
    return runAnalysis(fixture.input);
  }

  if (fixture.operation === 'analyze_pair') {
    const shared = fixture.execution_context || {};
    const first = runAnalysis(fixture.input.first, {
      ...shared,
      result_instance_iri:
        shared.result_instance_iris && shared.result_instance_iris.first
          ? shared.result_instance_iris.first
          : undefined
    });
    const second = runAnalysis(fixture.input.second, {
      ...shared,
      result_instance_iri:
        shared.result_instance_iris && shared.result_instance_iris.second
          ? shared.result_instance_iris.second
          : undefined
    });

    return {
      first,
      second,
      fixed_regimen_responses_exactly_equal:
        stableStringify(fixture.input.first.fixed_regimen_range_response) ===
        stableStringify(fixture.input.second.fixed_regimen_range_response)
    };
  }

  if (fixture.operation === 'analyze_before_and_after_external_event') {
    const shared = fixture.execution_context || {};
    const before = runAnalysis(fixture.input.request, {
      ...shared,
      result_instance_iri:
        shared.result_instance_iris && shared.result_instance_iris.before
          ? shared.result_instance_iris.before
          : undefined
    });
    const after = runAnalysis(fixture.input.request, {
      ...shared,
      result_instance_iri:
        shared.result_instance_iris && shared.result_instance_iris.after
          ? shared.result_instance_iris.after
          : undefined
    });
    return {
      before,
      after,
      results_exactly_equal:
        before &&
        after &&
        before.provenance &&
        after.provenance &&
        before.provenance.deterministic_result_fingerprint &&
        after.provenance.deterministic_result_fingerprint &&
        before.provenance.deterministic_result_fingerprint.value ===
          after.provenance.deterministic_result_fingerprint.value
    };
  }

  if (fixture.operation === 'analyze_with_host_context') {
    return runAnalysis(fixture.input.analysis_request, fixture.execution_context || {});
  }

  if (fixture.operation === 'validate_audit') {
    return validateAuditPayload(fixture.input);
  }

  if (fixture.operation === 'verify_replay') {
    const auditOutcome = validateAuditPayload({
      result: fixture.input.replay_result,
      retained_input: fixture.input.retained_input,
      retained_provider_roster_sha256: fixture.input.retained_provider_roster_sha256
    });
    return {
      audit_outcome: auditOutcome,
      deterministic_fingerprints_equal:
        fixture.input.original_result.provenance.deterministic_result_fingerprint.value ===
        fixture.input.replay_result.provenance.deterministic_result_fingerprint.value,
      result_instance_iris_different:
        fixture.input.original_result.result_instance_iri !== fixture.input.replay_result.result_instance_iri,
      timestamps_different:
        fixture.input.original_result.issued_at !== fixture.input.replay_result.issued_at
    };
  }

  return null;
}

function executeQuestionnaireFixture(fixture) {
  if (fixture.operation === 'apply_events') {
    return applyQuestionnaireEvents(fixture.input);
  }

  if (fixture.operation === 'render_question') {
    return renderQuestion(fixture.input);
  }

  return null;
}

function executeProviderFixture(fixture) {
  if (fixture.operation === 'validate_record') {
    return validateProviderRecord(fixture.input);
  }

  if (fixture.operation === 'validate_record_set') {
    return validateProviderRecordSet(fixture.input);
  }

  if (fixture.operation === 'validate_snapshot') {
    return validateProviderSnapshot(fixture.input);
  }

  return null;
}

function auditFixtures() {
  const manifest = readJson(MANIFEST_PATH);
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    unsupported: 0,
    byCapability: {}
  };

  const failures = [];

  for (const entry of manifest.fixtures) {
    const fixturePath = path.join(SPEC_DIR, entry.path);
    const fixture = readJson(fixturePath);
    results.total += 1;

    if (!results.byCapability[fixture.capability]) {
      results.byCapability[fixture.capability] = {
        total: 0,
        passed: 0,
        failed: 0,
        unsupported: 0
      };
    }
    results.byCapability[fixture.capability].total += 1;

    let actual = null;
    if (fixture.capability === 'regimen_range') {
      actual = executeRegimenFixture(fixture);
    } else if (fixture.capability === 'burden_questionnaire') {
      actual = executeQuestionnaireFixture(fixture);
    } else if (fixture.capability === 'provider_roster') {
      actual = executeProviderFixture(fixture);
    } else if (fixture.capability === 'burden_analysis') {
      actual = executeAnalysisFixture(fixture);
    }

    if (actual === null) {
      results.unsupported += 1;
      results.byCapability[fixture.capability].unsupported += 1;
      failures.push({
        fixture_id: fixture.fixture_id,
        capability: fixture.capability,
        reason: `unsupported operation: ${fixture.operation}`
      });
      continue;
    }

    const comparison = deepEqualWithDiff(actual, fixture.expected);
    if (comparison.ok) {
      results.passed += 1;
      results.byCapability[fixture.capability].passed += 1;
    } else {
      results.failed += 1;
      results.byCapability[fixture.capability].failed += 1;
      failures.push({
        fixture_id: fixture.fixture_id,
        capability: fixture.capability,
        operation: fixture.operation,
        reason: comparison.message
      });
    }
  }

  return { results, failures };
}

function main() {
  const strict = process.argv.includes('--strict');
  const { results, failures } = auditFixtures();

  console.log('Spec Fixture Audit Summary');
  console.log(JSON.stringify(results, null, 2));

  if (failures.length > 0) {
    console.log('\nFirst 20 mismatches/unsupported fixtures:');
    for (const row of failures.slice(0, 20)) {
      console.log(`- ${row.fixture_id} [${row.capability}] ${row.reason}`);
    }
  }

  if (strict && (results.failed > 0 || results.unsupported > 0)) {
    process.exitCode = 1;
  }
}

main();
