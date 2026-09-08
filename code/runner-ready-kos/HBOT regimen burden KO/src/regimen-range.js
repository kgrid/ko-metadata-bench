'use strict';

const SPECIFICATION_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/versions/cks-1.0';
const RESPONSE_MODEL_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/response-models/1.0';
const KNOWLEDGE_PACKAGE_IRI =
  'https://kgrid.org/cks/dfu-hbot-burden/knowledge-packages/general-dfu-regimen/versions/1.0';
const { assertByDef } = require('./schema-validation');

function assertRegimenRangeRequest(request) {
  assertByDef('regimenRangeRequest', request, 'Regimen range request');
}

function showRegimenRange(request) {
  assertRegimenRangeRequest(request);

  const response = {
    specification_iri: SPECIFICATION_IRI,
    response_type: 'fixed_regimen_range_response',
    response_model_iri: RESPONSE_MODEL_IRI,
    status: 'completed',
    knowledge_package_iri: KNOWLEDGE_PACKAGE_IRI,
    knowledge_scope: 'general_not_patient_specific',
    indication: 'diabetes_related_foot_ulcer',
    shorter_regimen_scenario: {
      episodes: 30,
      sessions_per_week: 5,
      course_weeks: 6.0
    },
    longer_regimen_scenario: {
      episodes: 40,
      sessions_per_week: 5,
      course_weeks: 8.0
    },
    combined_range: {
      episodes: [30, 40],
      sessions_per_week: 5,
      course_weeks: [6.0, 8.0]
    },
    scheduled_facility_hours_per_episode: {
      value: 3.0,
      unit: 'h'
    },
    tailored_to_patient: false,
    display_label:
      'General DFU HBOT planning range: approximately 30–40 episodes, usually five per week, over approximately 6–8 weeks.'
  };

  assertByDef('fixedRegimenRangeResponse', response, 'Fixed regimen range response');
  return response;
}

module.exports = {
  SPECIFICATION_IRI,
  RESPONSE_MODEL_IRI,
  KNOWLEDGE_PACKAGE_IRI,
  showRegimenRange
};
