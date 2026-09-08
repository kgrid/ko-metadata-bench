'use strict';

const crypto = require('node:crypto');

const { showRegimenRange, SPECIFICATION_IRI } = require('./regimen-range');
const { PROVIDER_ROSTER_VERSION_IRI, RESPONSE_MODEL_IRI } = require('./questionnaire-logic');
const { validateByDef, assertByDef } = require('./schema-validation');
const providerRosterSnapshot = require('../spec/DFU_HBOT_Provider_Roster_Snapshot_Version_1_0.json');
const dependencyManifest = require('../spec/DFU_HBOT_CKS_Identifier_and_Dependency_Manifest_1_0.json');

const RESULT_MODEL_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/output-models/1.0';
const SCHEMA_BUNDLE_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/schema-bundles/versions/1.0';
const FIXTURE_BUNDLE_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/conformance-fixtures/versions/1.0';
const MANIFEST_IRI = dependencyManifest.manifest_iri;
const REPEATED_ATTENDANCE_DRIVER = 'Repeated attendance (30–40 episodes; five per week)';

const ASSUMPTIONS = [
  {
    code: 'ASM-01',
    text: 'General DFU planning regimen range of 30–40 episodes at five sessions per week is used; it was not selected or calculated for the patient.'
  },
  {
    code: 'ASM-02',
    text: 'A single fixed three-hour scheduled facility block per treatment episode is used as a conservative, realistic worst-case planning assumption. It is not a validated DFU-specific door-to-door elapsed-time estimate.'
  },
  {
    code: 'ASM-03',
    text: 'Round trip is estimated as two times the patient-reported usual one-way miles and minutes.'
  },
  {
    code: 'ASM-04',
    text: 'Reported travel values are planning estimates and are not independently verified by the engine.'
  }
];

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

function isoNow() {
  return new Date().toISOString();
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function roundingQuantum(value) {
  return value >= 0 && value < 10 ? 0.1 : 1;
}

function lowerEndpoint(value) {
  const quantum = roundingQuantum(value);
  return round3(Math.floor(value / quantum) * quantum);
}

function upperEndpoint(value) {
  const quantum = roundingQuantum(value);
  return round3(Math.ceil(value / quantum) * quantum);
}

function nearestValue(value) {
  const quantum = roundingQuantum(value);
  return round3(Math.floor((value / quantum) + 0.5) * quantum);
}

function makeFingerprint(canonicalization, value) {
  return {
    algorithm: 'SHA-256',
    canonicalization,
    value
  };
}

function makeErrorObject(code, errorField) {
  const byCode = {
    'ERR-01': { error_field: null, message: 'Input object is required.' },
    'ERR-02': { error_field: null, message: 'Top-level input must be an object.' },
    'ERR-03': { error_field: errorField, message: 'Input has an invalid data type.' },
    'ERR-04': {
      error_field: errorField,
      message: 'Unexpected input property is not permitted.'
    },
    'ERR-05': {
      error_field: errorField,
      message: 'Input artifact identity, status, or version is invalid.'
    },
    'ERR-06': { error_field: errorField, message: 'Duplicate property name is not permitted.' },
    'ERR-07': { error_field: errorField, message: 'Required input is missing.' },
    'ERR-08': { error_field: errorField, message: 'Required input must not be null.' },
    'ERR-09': {
      error_field: errorField,
      message: 'Input value is outside the closed value set or constraint.'
    },
    'ERR-10': {
      error_field: 'provider_roster_dependency',
      message: 'Required provider roster is unavailable or invalid.'
    }
  };

  const details = byCode[code];
  return {
    code,
    status: 'error',
    error_field: details.error_field,
    message: details.message
  };
}

const PROJECTION_FIELD_ALIAS = {
  hyperbaric_oxygen_therapy_location: 'IN-01',
  one_way_miles: 'IN-02',
  one_way_travel_minutes: 'IN-03',
  weekday_attendance_difficulty: 'IN-04'
};

function toErrorFieldAlias(field, code) {
  if (code !== 'ERR-03' && code !== 'ERR-07' && code !== 'ERR-08' && code !== 'ERR-09') {
    return field;
  }

  if (!field) {
    return field;
  }

  if (PROJECTION_FIELD_ALIAS[field]) {
    return PROJECTION_FIELD_ALIAS[field];
  }

  const projectionPrefix = 'questionnaire_response.response_projection.';
  if (field.startsWith(projectionPrefix)) {
    const leaf = field.slice(projectionPrefix.length);
    if (PROJECTION_FIELD_ALIAS[leaf]) {
      return PROJECTION_FIELD_ALIAS[leaf];
    }
  }

  return field;
}

function makeBaseProvenance(request, deterministicFingerprint, executionContext = {}) {
  const inputFingerprint = executionContext.input_fingerprint ||
    makeFingerprint('RFC8785', sha256Hex(stableStringify(request)));
  const providerRosterFingerprint = executionContext.provider_roster_fingerprint ||
    makeFingerprint('RFC8785', sha256Hex(stableStringify(providerRosterSnapshot)));

  return {
    engine_implementation_iri:
      executionContext.engine_implementation_iri ||
      'https://kgrid.org/engines/dfu-hbot-burden-node',
    engine_implementation_version: executionContext.engine_implementation_version || '1.0.0',
    specification_iri: SPECIFICATION_IRI,
    schema_bundle_iri: SCHEMA_BUNDLE_IRI,
    fixture_bundle_iri: FIXTURE_BUNDLE_IRI,
    identifier_dependency_manifest_iri: MANIFEST_IRI,
    provider_roster_version_iri: PROVIDER_ROSTER_VERSION_IRI,
    input_received_at: executionContext.input_received_at || isoNow(),
    input_fingerprint: inputFingerprint,
    provider_roster_fingerprint: providerRosterFingerprint,
    deterministic_result_fingerprint: makeFingerprint('RFC8785', deterministicFingerprint)
  };
}

function computeDeterministicResultFingerprint(resultWithoutProvenance) {
  const deterministicPayload = JSON.parse(JSON.stringify(resultWithoutProvenance));
  delete deterministicPayload.result_instance_iri;
  delete deterministicPayload.issued_at;
  delete deterministicPayload.provenance;
  return sha256Hex(stableStringify(deterministicPayload));
}

function makeErrorResult(request, code, field, executionContext) {
  const result = {
    result_instance_iri: `https://kgrid.org/cks/dfu-hbot-burden/result-instances/${crypto.randomUUID()}`,
    specification_iri: SPECIFICATION_IRI,
    result_model_iri: RESULT_MODEL_IRI,
    issued_at: executionContext && executionContext.issued_at ? executionContext.issued_at : isoNow(),
    provenance: makeBaseProvenance(request, '', executionContext),
    status: 'error',
    result_code: code,
    objective_burden: null,
    weekday_attendance_feasibility: null,
    execution_burden_level: null,
    sensitivity: null,
    assumptions: [],
    evidence_sources: [],
    error: makeErrorObject(code, field),
    warnings: []
  };

  if (executionContext && executionContext.result_instance_iri) {
    result.result_instance_iri = executionContext.result_instance_iri;
  }
  result.provenance.deterministic_result_fingerprint.value = computeDeterministicResultFingerprint(result);

  assertByDef('errorAnalysisResult', result, 'Error analysis result');
  return result;
}

function assertNoUnexpectedTopLevelKeys(input) {
  const allowed = [
    'request_type',
    'provider_roster_version_iri',
    'questionnaire_response',
    'fixed_regimen_range_response'
  ];

  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      return key;
    }
  }
  return null;
}

function findRosterRecord(providerIri, rosterSnapshot) {
  if (
    !rosterSnapshot ||
    rosterSnapshot.roster_version_iri !== PROVIDER_ROSTER_VERSION_IRI ||
    !Array.isArray(rosterSnapshot.records)
  ) {
    return null;
  }

  return rosterSnapshot.records.find((record) => record.provider_iri === providerIri) || null;
}

function collectInputFingerprint(input, rawInputJson) {
  if (typeof rawInputJson === 'string') {
    return makeFingerprint('raw-octets', sha256Hex(rawInputJson));
  }

  if (input === null || input === undefined) {
    return makeFingerprint('none', null);
  }

  return makeFingerprint('RFC8785', sha256Hex(stableStringify(input)));
}

function collectRosterFingerprint(loadedRosterSnapshot) {
  if (!loadedRosterSnapshot) {
    return makeFingerprint('none', null);
  }

  return makeFingerprint('RFC8785', sha256Hex(stableStringify(loadedRosterSnapshot)));
}

function findFirstUnexpectedProperty(actualObject, allowedKeys) {
  const extras = Object.keys(actualObject).filter((key) => !allowedKeys.includes(key));
  if (extras.length === 0) {
    return null;
  }
  extras.sort();
  return extras[0];
}

function findFirstMissingRequired(actualObject, orderedRequiredKeys) {
  for (const key of orderedRequiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(actualObject, key)) {
      return key;
    }
  }
  return null;
}

function findFirstNullRequired(actualObject, orderedRequiredKeys) {
  for (const key of orderedRequiredKeys) {
    if (actualObject[key] === null) {
      return key;
    }
  }
  return null;
}

function classifyTravelBand(oneWayMinutes) {
  const roundTripMinutes = oneWayMinutes * 2;
  if (roundTripMinutes < 60) {
    return 'low';
  }
  if (roundTripMinutes < 120) {
    return 'moderate';
  }
  if (roundTripMinutes < 180) {
    return 'high';
  }
  return 'very_high';
}

function buildAttendanceFeasibility(value) {
  const map = {
    none: 'No weekday-attendance difficulty reported',
    some: 'Some weekday-attendance difficulty reported',
    major: 'Major weekday-attendance difficulty reported'
  };

  return {
    reported_value: value,
    display_text: map[value]
  };
}

function formatRoundTripHours(oneWayMinutes) {
  const roundTripHours = nearestValue((oneWayMinutes * 2) / 60);
  return String(roundTripHours).replace(/\.0$/, '');
}

function buildExecutionBurdenLevel(travelBand, attendanceDifficulty, oneWayMinutes) {
  const travelScore = {
    low: 1,
    moderate: 2,
    high: 3,
    very_high: 4
  }[travelBand];

  let score;
  if (attendanceDifficulty === 'none') {
    score = travelScore;
  } else if (attendanceDifficulty === 'some') {
    score = Math.min(5, travelScore + 1);
  } else {
    score = travelScore >= 3 ? 5 : 4;
  }

  const categoryByScore = {
    1: 'low_execution_burden',
    2: 'moderate_execution_burden',
    3: 'high_execution_burden',
    4: 'very_high_execution_burden',
    5: 'extreme_execution_burden'
  };

  const displayByCategory = {
    low_execution_burden: 'Low execution burden',
    moderate_execution_burden: 'Moderate execution burden',
    high_execution_burden: 'High execution burden',
    very_high_execution_burden: 'Very high execution burden',
    extreme_execution_burden: 'Extreme execution burden'
  };

  const roundTripHoursText = formatRoundTripHours(oneWayMinutes);

  const travelDriverTextByBand = {
    moderate: `Moderate reported travel time (${roundTripHoursText} round-trip hours)`,
    high: `High reported travel time (${roundTripHoursText} round-trip hours)`,
    very_high: `Very-high reported travel time (${roundTripHoursText} round-trip hours)`
  };

  const travelDriver = travelDriverTextByBand[travelBand] || null;
  const attendanceDriver = attendanceDifficulty === 'some'
    ? 'Some weekday-attendance difficulty'
    : attendanceDifficulty === 'major'
      ? 'Major weekday-attendance difficulty'
      : null;

  let primaryDriver = REPEATED_ATTENDANCE_DRIVER;
  let secondaryDriver = null;

  if (attendanceDifficulty === 'none') {
    if (travelScore > 1) {
      primaryDriver = travelDriver;
      secondaryDriver = REPEATED_ATTENDANCE_DRIVER;
    }
  } else if (attendanceDifficulty === 'some') {
    if (travelScore <= 2) {
      primaryDriver = attendanceDriver;
      secondaryDriver = travelScore === 1 ? REPEATED_ATTENDANCE_DRIVER : travelDriver;
    } else {
      primaryDriver = travelDriver;
      secondaryDriver = attendanceDriver;
    }
  } else {
    primaryDriver = attendanceDriver;
    secondaryDriver = travelScore === 1 ? REPEATED_ATTENDANCE_DRIVER : travelDriver;
  }

  const category = categoryByScore[score];
  return {
    score,
    category,
    primary_driver: primaryDriver,
    secondary_driver: secondaryDriver,
    display_text: displayByCategory[category]
  };
}

function resultCodeFromCategory(category) {
  const mapping = {
    low_execution_burden: 'RESULT-LOW-EXECUTION-BURDEN',
    moderate_execution_burden: 'RESULT-MODERATE-EXECUTION-BURDEN',
    high_execution_burden: 'RESULT-HIGH-EXECUTION-BURDEN',
    very_high_execution_burden: 'RESULT-VERY-HIGH-EXECUTION-BURDEN',
    extreme_execution_burden: 'RESULT-EXTREME-EXECUTION-BURDEN'
  };
  return mapping[category] || 'RESULT-LOW-EXECUTION-BURDEN';
}

function calculateScenarioBurden(episodes, weeks, oneWayMiles, oneWayMinutes, endpointRounding) {
  const roundTripHours = (oneWayMinutes * 2) / 60;
  const roundTripMiles = oneWayMiles * 2;

  const rounding = endpointRounding === 'upper' ? upperEndpoint : lowerEndpoint;
  const travelRaw = episodes * roundTripHours;
  const totalRaw = travelRaw + (episodes * 3.0);
  const milesRaw = episodes * roundTripMiles;

  const travelHours = rounding(travelRaw);
  const facilityHours = round3(episodes * 3.0);
  const totalPatientHours = rounding(totalRaw);
  const courseMiles = rounding(milesRaw);

  return {
    episodes,
    course_weeks: weeks,
    travel_hours: travelHours,
    facility_hours: facilityHours,
    total_patient_hours: totalPatientHours,
    course_miles: courseMiles
  };
}

function normalizeAndValidateRequest(input, options = {}) {
  if (typeof options.rawInputJson === 'string') {
    const duplicateMatches = options.rawInputJson.match(/"hyperbaric_oxygen_therapy_location"\s*:/g);
    if (duplicateMatches && duplicateMatches.length > 1) {
      return { ok: false, code: 'ERR-06', field: 'hyperbaric_oxygen_therapy_location', rosterLoaded: false };
    }
  }

  if (input === null || input === undefined) {
    return { ok: false, code: 'ERR-01', field: null, rosterLoaded: false };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'ERR-02', field: null, rosterLoaded: false };
  }

  const requestRequired = [
    'request_type',
    'provider_roster_version_iri',
    'questionnaire_response',
    'fixed_regimen_range_response'
  ];
  const requestUnexpected = findFirstUnexpectedProperty(input, requestRequired);
  if (requestUnexpected) {
    return { ok: false, code: 'ERR-04', field: requestUnexpected, rosterLoaded: false };
  }

  const requestMissing = findFirstMissingRequired(input, requestRequired);
  if (requestMissing) {
    return { ok: false, code: 'ERR-07', field: requestMissing, rosterLoaded: false };
  }

  const requestNull = findFirstNullRequired(input, requestRequired);
  if (requestNull) {
    return { ok: false, code: 'ERR-08', field: requestNull, rosterLoaded: false };
  }

  if (typeof input.request_type !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'request_type', rosterLoaded: false };
  }
  if (typeof input.provider_roster_version_iri !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'provider_roster_version_iri', rosterLoaded: false };
  }
  if (typeof input.questionnaire_response !== 'object' || Array.isArray(input.questionnaire_response)) {
    return { ok: false, code: 'ERR-03', field: 'questionnaire_response', rosterLoaded: false };
  }
  if (typeof input.fixed_regimen_range_response !== 'object' || Array.isArray(input.fixed_regimen_range_response)) {
    return { ok: false, code: 'ERR-03', field: 'fixed_regimen_range_response', rosterLoaded: false };
  }

  if (input.request_type !== 'calculate_burden_range') {
    return { ok: false, code: 'ERR-09', field: 'request_type', rosterLoaded: false };
  }
  if (input.provider_roster_version_iri !== PROVIDER_ROSTER_VERSION_IRI) {
    return { ok: false, code: 'ERR-05', field: 'provider_roster_version_iri', rosterLoaded: false };
  }

  const q = input.questionnaire_response;
  const questionnaireRequired = [
    'specification_iri',
    'questionnaire_status',
    'response_model_iri',
    'provider_roster_version_iri',
    'response_projection',
    'confirmed'
  ];
  const questionnaireUnexpected = findFirstUnexpectedProperty(q, questionnaireRequired);
  if (questionnaireUnexpected) {
    return { ok: false, code: 'ERR-04', field: questionnaireUnexpected, rosterLoaded: false };
  }
  const questionnaireMissing = findFirstMissingRequired(q, questionnaireRequired);
  if (questionnaireMissing) {
    return { ok: false, code: 'ERR-07', field: questionnaireMissing, rosterLoaded: false };
  }
  const questionnaireNull = findFirstNullRequired(q, questionnaireRequired);
  if (questionnaireNull) {
    return { ok: false, code: 'ERR-08', field: questionnaireNull, rosterLoaded: false };
  }

  if (typeof q.specification_iri !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'specification_iri', rosterLoaded: false };
  }
  if (typeof q.questionnaire_status !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'questionnaire_status', rosterLoaded: false };
  }
  if (typeof q.response_model_iri !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'response_model_iri', rosterLoaded: false };
  }
  if (typeof q.provider_roster_version_iri !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'provider_roster_version_iri', rosterLoaded: false };
  }
  if (typeof q.response_projection !== 'object' || q.response_projection === null || Array.isArray(q.response_projection)) {
    return { ok: false, code: 'ERR-03', field: 'response_projection', rosterLoaded: false };
  }
  if (typeof q.confirmed !== 'boolean') {
    return { ok: false, code: 'ERR-03', field: 'confirmed', rosterLoaded: false };
  }

  if (q.specification_iri !== SPECIFICATION_IRI) {
    return { ok: false, code: 'ERR-05', field: 'specification_iri', rosterLoaded: false };
  }
  if (q.questionnaire_status !== 'completed') {
    return { ok: false, code: 'ERR-05', field: 'questionnaire_status', rosterLoaded: false };
  }
  if (q.response_model_iri !== RESPONSE_MODEL_IRI) {
    return { ok: false, code: 'ERR-05', field: 'response_model_iri', rosterLoaded: false };
  }
  if (q.confirmed !== true) {
    return { ok: false, code: 'ERR-09', field: 'confirmed', rosterLoaded: false };
  }

  if (q.provider_roster_version_iri !== input.provider_roster_version_iri) {
    return {
      ok: false,
      code: 'ERR-05',
      field: 'questionnaire_response.provider_roster_version_iri',
      rosterLoaded: false
    };
  }

  const regimenCheck = validateByDef('fixedRegimenRangeResponse', input.fixed_regimen_range_response);
  if (!regimenCheck.ok) {
    const first = regimenCheck.errors[0] || null;
    if (first && first.keyword === 'additionalProperties') {
      return {
        ok: false,
        code: 'ERR-04',
        field: first.params && first.params.additionalProperty ? first.params.additionalProperty : 'fixed_regimen_range_response',
        rosterLoaded: false
      };
    }
    if (first && first.keyword === 'required') {
      return {
        ok: false,
        code: 'ERR-07',
        field: first.params && first.params.missingProperty ? first.params.missingProperty : 'fixed_regimen_range_response',
        rosterLoaded: false
      };
    }
    if (first && first.keyword === 'type') {
      const field = first.instancePath ? first.instancePath.slice(1).replace(/\//g, '.') : 'fixed_regimen_range_response';
      return { ok: false, code: 'ERR-03', field, rosterLoaded: false };
    }
    if (first && (first.keyword === 'const' || first.keyword === 'enum' || first.keyword === 'pattern')) {
      const field = first.instancePath ? first.instancePath.slice(1).replace(/\//g, '.') : 'fixed_regimen_range_response';
      const code = field === 'knowledge_package_iri' || field === 'specification_iri' || field === 'response_type' || field === 'response_model_iri' || field === 'status' || field === 'knowledge_scope' || field === 'indication' || field === 'tailored_to_patient'
        ? 'ERR-05'
        : 'ERR-09';
      return { ok: false, code, field, rosterLoaded: false };
    }
    return { ok: false, code: 'ERR-09', field: 'fixed_regimen_range_response', rosterLoaded: false };
  }

  const rp = q.response_projection;
  const projectionRequired = [
    'hyperbaric_oxygen_therapy_location',
    'one_way_miles',
    'one_way_travel_minutes',
    'weekday_attendance_difficulty'
  ];
  const projectionUnexpected = findFirstUnexpectedProperty(rp, projectionRequired);
  if (projectionUnexpected) {
    return { ok: false, code: 'ERR-04', field: projectionUnexpected, rosterLoaded: false };
  }
  const projectionMissing = findFirstMissingRequired(rp, projectionRequired);
  if (projectionMissing) {
    return { ok: false, code: 'ERR-07', field: projectionMissing, rosterLoaded: false };
  }
  const projectionNull = findFirstNullRequired(rp, projectionRequired);
  if (projectionNull) {
    return { ok: false, code: 'ERR-08', field: projectionNull, rosterLoaded: false };
  }

  if (typeof rp.hyperbaric_oxygen_therapy_location !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'hyperbaric_oxygen_therapy_location', rosterLoaded: false };
  }
  if (typeof rp.one_way_miles !== 'number' || !Number.isFinite(rp.one_way_miles)) {
    return { ok: false, code: 'ERR-03', field: 'one_way_miles', rosterLoaded: false };
  }
  if (typeof rp.one_way_travel_minutes !== 'number' || !Number.isFinite(rp.one_way_travel_minutes)) {
    return { ok: false, code: 'ERR-03', field: 'one_way_travel_minutes', rosterLoaded: false };
  }
  if (typeof rp.weekday_attendance_difficulty !== 'string') {
    return { ok: false, code: 'ERR-03', field: 'weekday_attendance_difficulty', rosterLoaded: false };
  }

  if (rp.one_way_miles < 0 || rp.one_way_miles > 1000) {
    return { ok: false, code: 'ERR-09', field: 'one_way_miles', rosterLoaded: false };
  }
  if (rp.one_way_travel_minutes < 0 || rp.one_way_travel_minutes > 1440) {
    return { ok: false, code: 'ERR-09', field: 'one_way_travel_minutes', rosterLoaded: false };
  }
  if (!['none', 'some', 'major'].includes(rp.weekday_attendance_difficulty)) {
    return { ok: false, code: 'ERR-09', field: 'weekday_attendance_difficulty', rosterLoaded: false };
  }

  const expectedRegimen = showRegimenRange({ request_type: 'show_regimen_range' });
  const regimen = input.fixed_regimen_range_response;
  if (typeof regimen !== 'object' || regimen === null) {
    return { ok: false, code: 'ERR-03', field: 'fixed_regimen_range_response', rosterLoaded: false };
  }

  for (const key of [
    'specification_iri',
    'response_type',
    'response_model_iri',
    'status',
    'knowledge_package_iri',
    'knowledge_scope',
    'indication',
    'tailored_to_patient',
    'display_label'
  ]) {
    if (regimen[key] !== expectedRegimen[key]) {
      return { ok: false, code: 'ERR-05', field: key, rosterLoaded: false };
    }
  }

  return { ok: true, normalized: input, rosterLoaded: true };
}

function calculateBurdenRange(input, options = {}) {
  const rosterSnapshot = options.providerRosterSnapshot || providerRosterSnapshot;
  const executionContext = options.executionContext || {};
  const dependencyState = options.dependencyState || {};

  const validation = normalizeAndValidateRequest(input, {
    rawInputJson: options.rawInputJson
  });
  const errorInputFingerprint = collectInputFingerprint(input, options.rawInputJson);
  const errorRosterFingerprint = collectRosterFingerprint(validation.rosterLoaded ? rosterSnapshot : null);

  if (!validation.ok) {
    return makeErrorResult(input, validation.code, toErrorFieldAlias(validation.field, validation.code), {
      ...executionContext,
      input_fingerprint: errorInputFingerprint,
      provider_roster_fingerprint: errorRosterFingerprint
    });
  }

  if (dependencyState.provider_roster === 'unavailable') {
    return makeErrorResult(input, 'ERR-10', 'provider_roster_dependency', {
      ...executionContext,
      input_fingerprint: collectInputFingerprint(input, options.rawInputJson),
      provider_roster_fingerprint: makeFingerprint('none', null)
    });
  }

  if (
    dependencyState.provider_roster === 'available_wrong_self_identifier' ||
    dependencyState.provider_roster === 'available_duplicate_provider_mapping'
  ) {
    return makeErrorResult(input, 'ERR-10', 'provider_roster_dependency', {
      ...executionContext,
      input_fingerprint: collectInputFingerprint(input, options.rawInputJson),
      provider_roster_fingerprint: collectRosterFingerprint(providerRosterSnapshot)
    });
  }

  const request = validation.normalized;
  const rp = request.questionnaire_response.response_projection;
  const rosterRecord = findRosterRecord(rp.hyperbaric_oxygen_therapy_location, rosterSnapshot);
  const nonselectable = new Set(dependencyState.nonselectable_provider_iris || []);
  const retired = new Set(dependencyState.retired_provider_iris || []);

  if (!rosterRecord) {
    return makeErrorResult(input, 'ERR-09', 'IN-01', {
      ...executionContext,
      input_fingerprint: collectInputFingerprint(input, options.rawInputJson),
      provider_roster_fingerprint: collectRosterFingerprint(rosterSnapshot)
    });
  }
  if (
    nonselectable.has(rp.hyperbaric_oxygen_therapy_location) ||
    retired.has(rp.hyperbaric_oxygen_therapy_location)
  ) {
    return makeErrorResult(input, 'ERR-09', 'IN-01', {
      ...executionContext,
      input_fingerprint: collectInputFingerprint(input, options.rawInputJson),
      provider_roster_fingerprint: collectRosterFingerprint(providerRosterSnapshot)
    });
  }
  if (rosterRecord.selectable !== true) {
    return makeErrorResult(input, 'ERR-09', 'IN-01', {
      ...executionContext,
      input_fingerprint: collectInputFingerprint(input, options.rawInputJson),
      provider_roster_fingerprint: collectRosterFingerprint(rosterSnapshot)
    });
  }

  const shorterScenario = calculateScenarioBurden(
    30,
    6.0,
    rp.one_way_miles,
    rp.one_way_travel_minutes,
    'lower'
  );
  const longerScenario = calculateScenarioBurden(
    40,
    8.0,
    rp.one_way_miles,
    rp.one_way_travel_minutes,
    'upper'
  );

  const travelBand = classifyTravelBand(rp.one_way_travel_minutes);
  const weekdayAttendanceFeasibility = buildAttendanceFeasibility(rp.weekday_attendance_difficulty);
  const executionBurdenLevel = buildExecutionBurdenLevel(
    travelBand,
    rp.weekday_attendance_difficulty,
    rp.one_way_travel_minutes
  );

  const objectiveBurden = {
    fixed_regimen_range_response: request.fixed_regimen_range_response,
    hyperbaric_oxygen_therapy_location_reference: {
      provider_roster_version_iri: PROVIDER_ROSTER_VERSION_IRI,
      roster_record_iri: rosterRecord.roster_record_iri,
      provider_iri: rosterRecord.provider_iri,
      compact_id: rosterRecord.compact_id,
      facility_listing: rosterRecord.facility_listing,
      jurisdiction: rosterRecord.jurisdiction,
      address_status: rosterRecord.address_status,
      normalized_address_candidate: rosterRecord.normalized_address_candidate
    },
    reported_one_way_travel: {
      miles: rp.one_way_miles,
      minutes: rp.one_way_travel_minutes
    },
    burden_by_regimen_scenario: {
      shorter_regimen: shorterScenario,
      longer_regimen: longerScenario
    },
    overall_burden_range: {
      episodes: [shorterScenario.episodes, longerScenario.episodes],
      travel_hours: [shorterScenario.travel_hours, longerScenario.travel_hours],
      facility_hours: [shorterScenario.facility_hours, longerScenario.facility_hours],
      total_patient_hours: [shorterScenario.total_patient_hours, longerScenario.total_patient_hours],
      course_miles: [shorterScenario.course_miles, longerScenario.course_miles]
    },
    travel_band: {
      value: travelBand,
      basis: 'reported_one_way_minutes_doubled'
    }
  };

  const sensitivity = {
    longer_minus_shorter_episodes: 10,
    incremental_travel_hours: nearestValue(10 * ((rp.one_way_travel_minutes * 2) / 60)),
    incremental_facility_hours: round3(longerScenario.facility_hours - shorterScenario.facility_hours),
    incremental_total_hours: nearestValue(10 * (((rp.one_way_travel_minutes * 2) / 60) + 3.0)),
    incremental_miles: nearestValue(10 * (rp.one_way_miles * 2)),
    incremental_weeks: 2.0
  };

  const result = {
    result_instance_iri:
      executionContext && executionContext.result_instance_iri
        ? executionContext.result_instance_iri
        : `https://kgrid.org/cks/dfu-hbot-burden/result-instances/${crypto.randomUUID()}`,
    specification_iri: SPECIFICATION_IRI,
    result_model_iri: RESULT_MODEL_IRI,
    issued_at: executionContext && executionContext.issued_at ? executionContext.issued_at : isoNow(),
    provenance: makeBaseProvenance(request, '', executionContext),
    status: 'completed',
    result_code: resultCodeFromCategory(executionBurdenLevel.category),
    objective_burden: objectiveBurden,
    weekday_attendance_feasibility: weekdayAttendanceFeasibility,
    execution_burden_level: executionBurdenLevel,
    sensitivity,
    assumptions: ASSUMPTIONS,
    evidence_sources: [],
    error: null,
    warnings: []
  };

  result.provenance.input_fingerprint = collectInputFingerprint(input, options.rawInputJson);
  result.provenance.provider_roster_fingerprint = collectRosterFingerprint(rosterSnapshot);
  result.provenance.deterministic_result_fingerprint.value = computeDeterministicResultFingerprint(result);

  assertByDef('completedAnalysisResult', result, 'Completed analysis result');
  return result;
}

module.exports = {
  calculateBurdenRange
};
