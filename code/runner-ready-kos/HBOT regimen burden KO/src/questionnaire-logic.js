'use strict';

const readline = require('node:readline');
const { stdin, stdout } = require('node:process');

const SPECIFICATION_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/versions/cks-1.0';
const RESPONSE_MODEL_IRI = 'https://kgrid.org/cks/dfu-hbot-burden/response-models/1.0';
const QUESTION_SET_IRI =
  'https://kgrid.org/cks/dfu-hbot-burden/question-sets/burden-questionnaire/versions/1.0';
const PROVIDER_ROSTER_VERSION_IRI =
  'https://kgrid.org/cks/dfu-hbot-burden/provider-rosters/appendix-e/versions/1.0';
const { assertByDef } = require('./schema-validation');

const QUESTIONS = [
  {
    id: 'Q01',
    field: 'hyperbaric_oxygen_therapy_location',
    text: 'Where will you receive hyperbaric oxygen therapy?',
    prompt:
      'Enter the confirmed provider IRI for hyperbaric_oxygen_therapy_location (for example: https://kgrid.org/cks/dfu-hbot-burden/providers/e-001):'
  },
  {
    id: 'Q02',
    field: 'one_way_miles',
    text:
      'About how many miles is it one way from where you usually start to this hyperbaric oxygen therapy location?',
    prompt: 'Enter one_way_miles (0 to 1000):'
  },
  {
    id: 'Q03',
    field: 'one_way_travel_minutes',
    text: 'About how long does that trip usually take one way?',
    prompt: 'Enter one_way_travel_minutes (0 to 1440):'
  },
  {
    id: 'Q04',
    field: 'weekday_attendance_difficulty',
    text:
      'Thinking about receiving treatment at [confirmed location name] five weekdays per week for approximately 6-8 weeks - and apart from the miles and travel time you reported - how much difficulty do you expect with attending the scheduled treatments?',
    prompt:
      'Enter weekday_attendance_difficulty using one of: none, some, major:'
  }
];

function normalizeProviderIri(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Q01 must be a provider IRI string.');
  }
  const trimmed = value.trim();
  const pattern = /^https:\/\/kgrid\.org\/cks\/dfu-hbot-burden\/providers\/e-(00[1-9]|0[1-9][0-9]|1[0-3][0-9]|14[01])$/;
  if (!pattern.test(trimmed)) {
    throw new TypeError('Q01 provider IRI is outside the allowed closed set pattern.');
  }
  return trimmed;
}

function normalizeNumber(value, min, max, label) {
  if (typeof value === 'string' && value.trim() !== '') {
    value = Number(value);
  }
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  if (value < min || value > max) {
    throw new TypeError(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function normalizeDifficulty(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Q04 must be a string.');
  }
  const normalized = value.trim().toLowerCase();
  if (!['none', 'some', 'major'].includes(normalized)) {
    throw new TypeError('Q04 must be one of: none, some, major.');
  }
  return normalized;
}

function buildQuestionPayload(questionId) {
  const question = QUESTIONS.find((q) => q.id === questionId);
  if (!question) {
    throw new Error(`Unknown question id: ${questionId}`);
  }
  return {
    id: question.id,
    field: question.field,
    text: question.text,
    prompt: question.prompt
  };
}

function createCompletedQuestionnaireResponse(responseProjection) {
  const response = {
    specification_iri: SPECIFICATION_IRI,
    questionnaire_status: 'completed',
    response_model_iri: RESPONSE_MODEL_IRI,
    provider_roster_version_iri: PROVIDER_ROSTER_VERSION_IRI,
    response_projection: responseProjection,
    confirmed: true
  };

  assertByDef(
    'completedQuestionnaireResponse',
    response,
    'Completed questionnaire response'
  );

  return response;
}

function createDefaultPrompter() {
  let rl = null;

  const askLine = (prompt) => {
    if (globalThis.$$ && typeof globalThis.$$.input === 'function') {
      return globalThis.$$.input({ prompt });
    }

    if (!rl) {
      rl = readline.createInterface({
        input: stdin,
        output: stdout
      });
    }

    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  const askQuestion = async (question) => {
    while (true) {
      stdout.write(`\n${question.id}: ${question.text}\n`);
      const raw = await askLine(`${question.prompt} `);
      const value = String(raw || '').trim();

      if (value.length === 0) {
        stdout.write('Please provide a value.\n');
        continue;
      }

      if (question.id === 'Q02' || question.id === 'Q03') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          stdout.write('Please enter a numeric value.\n');
          continue;
        }
        return numeric;
      }

      return value;
    }
  };

  const close = () => {
    if (rl) {
      rl.close();
    }
  };

  return { askQuestion, close };
}

async function runBurdenQuestionnaire(askQuestionFn) {
  let ask = askQuestionFn;
  let close = null;

  if (ask === undefined) {
    const prompter = createDefaultPrompter();
    ask = prompter.askQuestion;
    close = prompter.close;
  } else if (typeof ask !== 'function') {
    throw new TypeError('runBurdenQuestionnaire requires an askQuestionFn function when provided.');
  }

  try {
    const answers = {};
    for (const question of QUESTIONS) {
      const payload = buildQuestionPayload(question.id);
      const raw = await ask(payload);
      answers[question.id] = raw;
    }

    const responseProjection = {
      hyperbaric_oxygen_therapy_location: normalizeProviderIri(answers.Q01),
      one_way_miles: normalizeNumber(answers.Q02, 0, 1000, 'Q02 one_way_miles'),
      one_way_travel_minutes: normalizeNumber(answers.Q03, 0, 1440, 'Q03 one_way_travel_minutes'),
      weekday_attendance_difficulty: normalizeDifficulty(answers.Q04)
    };

    return createCompletedQuestionnaireResponse(responseProjection);
  } finally {
    if (close) {
      close();
    }
  }
}

function questionnaireResponseFromObject(responseProjection) {
  if (!responseProjection || typeof responseProjection !== 'object') {
    throw new TypeError('responseProjection must be an object.');
  }

  return createCompletedQuestionnaireResponse({
    hyperbaric_oxygen_therapy_location: normalizeProviderIri(
      responseProjection.hyperbaric_oxygen_therapy_location
    ),
    one_way_miles: normalizeNumber(responseProjection.one_way_miles, 0, 1000, 'one_way_miles'),
    one_way_travel_minutes: normalizeNumber(
      responseProjection.one_way_travel_minutes,
      0,
      1440,
      'one_way_travel_minutes'
    ),
    weekday_attendance_difficulty: normalizeDifficulty(
      responseProjection.weekday_attendance_difficulty
    )
  });
}

module.exports = {
  QUESTIONS,
  SPECIFICATION_IRI,
  RESPONSE_MODEL_IRI,
  QUESTION_SET_IRI,
  PROVIDER_ROSTER_VERSION_IRI,
  buildQuestionPayload,
  runBurdenQuestionnaire,
  questionnaireResponseFromObject
};
