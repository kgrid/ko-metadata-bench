'use strict';

const QUESTIONS = [
  {
    id: 'Q01',
    text: 'Is extensive gangrene present involving most or all of the foot?'
  },
  {
    id: 'Q02',
    text: 'Is localized gangrene present involving only part of the foot?'
  },
  {
    id: 'Q03',
    text: 'Is a deep abscess present?'
  },
  {
    id: 'Q04',
    text: 'Is osteomyelitis present?'
  },
  {
    id: 'Q05',
    text: 'Is comparably deep infection present?'
  },
  {
    id: 'Q06',
    text: 'Is an open ulcer present?'
  },
  {
    id: 'Q07',
    text: 'Does the ulcer extend into a deep anatomical structure such as tendon, joint capsule, muscle, joint, or bone?'
  },
  {
    id: 'Q08',
    text: 'Is the ulcer limited to skin or superficial subcutaneous tissue?'
  },
  {
    id: 'Q09',
    text: 'Is the skin intact?'
  },
  {
    id: 'Q10',
    text: 'Does this assessment site represent an at-risk or previously ulcerated site with intact skin and no current open ulcer or higher-grade lesion?'
  }
];

const QUESTION_MAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

const TERM_DEFINITIONS = {
  'extensive gangrene': {
    definition: 'Gangrene involving most or all of the foot.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/extensive-gangrene'
  },
  'localized gangrene': {
    definition:
      'Gangrene confined to a limited portion of the foot, such as one or more toes or part of the forefoot, rather than most or all of the foot.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/localized-gangrene'
  },
  gangrene: {
    definition:
      'Death of body tissue, commonly associated with severely impaired blood supply, infection, or both.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/gangrene'
  },
  'deep abscess': {
    definition:
      'An abscess located beneath the skin and superficial subcutaneous tissue or involving a deeper compartment or structure of the foot.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/deep-abscess'
  },
  osteomyelitis: {
    definition: 'Infection and inflammation of bone, including bone marrow.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/osteomyelitis'
  },
  'deep infection': {
    definition:
      'Infection involving tissue or structures deeper than the skin and superficial subcutaneous tissue, such as a deep space, tendon, fascia, joint, or bone.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/deep-infection'
  },
  'open ulcer': {
    definition: 'An ulcer in which the skin surface is broken and underlying tissue is exposed.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/open-ulcer'
  },
  ulcer: {
    definition:
      'A break or full-thickness defect in the skin of the foot in a person with diabetes that may extend into tissue beneath the skin.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/diabetic-foot-ulcer'
  },
  'deep anatomical structure': {
    definition:
      'A structure beneath the skin and superficial subcutaneous tissue, including tendon, joint capsule, muscle, joint, or bone.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/deep-anatomical-structure'
  },
  tendon: {
    definition: 'Strong fibrous tissue that connects muscle to bone.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/tendon'
  },
  'joint capsule': {
    definition: 'The fibrous tissue envelope that surrounds a movable joint.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/joint-capsule'
  },
  muscle: {
    definition: 'Contractile soft tissue that produces or controls movement.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/muscle'
  },
  joint: {
    definition: 'A location where two or more bones meet.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/joint'
  },
  bone: {
    definition: 'Rigid, mineralized connective tissue forming the skeleton.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/bone'
  },
  skin: {
    definition:
      'The outer tissue covering the body. In this questionnaire, the relevant issue is whether the skin at the assessed site is continuous and unbroken.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/skin'
  },
  'subcutaneous tissue': {
    definition: 'Connective and fatty tissue immediately beneath the skin.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/subcutaneous-tissue'
  },
  'intact skin': {
    definition: 'Skin that is continuous and unbroken at the assessed site, with no open ulcer present.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/intact-skin'
  },
  'at-risk site': {
    definition:
      'The specifically assessed site when it has intact skin, no current open ulcer or higher-grade lesion, and one or more findings associated with future ulceration, such as deformity, callus, a pre-ulcerative site, or a healed-ulcer site.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/at-risk-site'
  },
  'previously ulcerated site': {
    definition:
      'The site of a previous ulcer that has closed and regained skin continuity, although increased risk of another ulcer may remain.',
    term_iri:
      'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/healed-ulcer-site'
  },
  'higher-grade lesion': {
    definition:
      'An ulcerative, infectious, or gangrenous finding consistent with Wagner Grade 1 through Grade 5 rather than the Grade 0 at-risk state.',
    term_iri: 'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0/terms/diabetic-foot-lesion'
  }
};

const QUESTION_TERM_KEYS = {
  Q01: ['extensive gangrene', 'gangrene'],
  Q02: ['localized gangrene', 'gangrene'],
  Q03: ['deep abscess'],
  Q04: ['osteomyelitis'],
  Q05: ['deep infection'],
  Q06: ['open ulcer', 'ulcer'],
  Q07: ['ulcer', 'deep anatomical structure', 'tendon', 'joint capsule', 'muscle', 'joint', 'bone'],
  Q08: ['ulcer', 'skin', 'subcutaneous tissue'],
  Q09: ['skin', 'intact skin'],
  Q10: ['at-risk site', 'previously ulcerated site', 'intact skin', 'open ulcer', 'higher-grade lesion']
};

function buildQuestionPayload(questionId) {
  const q = QUESTION_MAP[questionId];
  if (!q) {
    throw new Error(`Unknown question id: ${questionId}`);
  }

  const termKeys = QUESTION_TERM_KEYS[questionId] || [];
  const definitions = {};

  for (const termKey of termKeys) {
    const termDefinition = TERM_DEFINITIONS[termKey];
    if (termDefinition) {
      definitions[termKey] = termDefinition;
    }
  }

  return {
    id: q.id,
    text: q.text,
    definitions
  };
}

const SPECIFICATION_IRI =
  'https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0';
const RESPONSE_MODEL_IRI =
  'https://kgrid.org/cks/meggitt-wagner/response-models/1.0';
const QUESTION_SET_IRI =
  'https://kgrid.org/cks/meggitt-wagner/question-sets/mw-qs-02/versions/1.0';

/**
 * Run adaptive Wagner questionnaire.
 *
 * @param {(question: {
 *   id: string,
 *   text: string,
 *   definitions: Record<string, {definition: string, term_iri: string}>
 * }) => (boolean|Promise<boolean>)} askYesNo
 * @returns {Promise<{
 *   specification_iri: string,
 *   response_model_iri: string,
 *   question_set_iri: string,
 *   question_ids: string[],
 *   responses: string[],
 *   directly_answered_questions: string[],
 *   entailed_questions: string[]
 * }>}
 */
async function runQuestionnaire(askYesNo) {
  if (typeof askYesNo !== 'function') {
    throw new TypeError('askYesNo must be a function that returns true/false.');
  }

  const state = createInitialState();
  const directlyAnsweredQuestions = [];
  const entailedQuestions = [];

  const ask = async (questionId) => {
    const existing = state[questionId];
    if (existing === 'X') {
      throw new Error(`Cannot ask ${questionId}; it is marked as not applicable.`);
    }
    if (existing === 0 || existing === 1) {
      return existing === 1;
    }

    const q = QUESTION_MAP[questionId];
    if (!q) {
      throw new Error(`Unknown question id: ${questionId}`);
    }

    const raw = await askYesNo(buildQuestionPayload(questionId));
    if (typeof raw !== 'boolean') {
      throw new TypeError(`Answer for ${questionId} must be boolean.`);
    }

    state[questionId] = raw ? 1 : 0;
    directlyAnsweredQuestions.push(questionId);
    return raw;
  };

  const entail = (questionId, value) => {
    const isNewAnswer = state[questionId] === undefined;
    assertCompatible(state[questionId], value, questionId);
    state[questionId] = value;
    if (isNewAnswer) {
      entailedQuestions.push(questionId);
    }
  };

  const markX = (questionId) => {
    assertCompatible(state[questionId], 'X', questionId);
    state[questionId] = 'X';
  };

  const markManyX = (questionIds) => {
    for (const questionId of questionIds) {
      markX(questionId);
    }
  };

  const askDeepComplications = async () => {
    for (const questionId of ['Q03', 'Q04', 'Q05']) {
      const yes = await ask(questionId);
      if (yes) {
        for (const remainingId of ['Q03', 'Q04', 'Q05']) {
          if (state[remainingId] === undefined) {
            markX(remainingId);
          }
        }
        return true;
      }
    }
    return false;
  };

  if (await ask('Q01')) {
    entail('Q02', 0);
    entail('Q06', 1);
    entail('Q09', 0);
    entail('Q10', 0);
    markManyX(['Q03', 'Q04', 'Q05', 'Q07', 'Q08']);
    return finalize(state, directlyAnsweredQuestions, entailedQuestions);
  }

  if (await ask('Q02')) {
    entail('Q06', 1);
    entail('Q09', 0);
    entail('Q10', 0);
    markManyX(['Q03', 'Q04', 'Q05', 'Q07', 'Q08']);
    return finalize(state, directlyAnsweredQuestions, entailedQuestions);
  }

  if (!(await ask('Q06'))) {
    entail('Q07', 0);
    entail('Q08', 0);

    if (await ask('Q10')) {
      entail('Q03', 0);
      entail('Q04', 0);
      entail('Q05', 0);
      entail('Q09', 1);
      return finalize(state, directlyAnsweredQuestions, entailedQuestions);
    }

    markManyX(['Q03', 'Q04', 'Q05', 'Q09']);
    return finalize(state, directlyAnsweredQuestions, entailedQuestions);
  }

  entail('Q09', 0);
  entail('Q10', 0);

  if (await ask('Q07')) {
    entail('Q08', 0);
    if (await askDeepComplications()) {
      return finalize(state, directlyAnsweredQuestions, entailedQuestions);
    }
    return finalize(state, directlyAnsweredQuestions, entailedQuestions);
  }

  if (!(await ask('Q08'))) {
    markManyX(['Q03', 'Q04', 'Q05']);
    return finalize(state, directlyAnsweredQuestions, entailedQuestions);
  }

  if (await askDeepComplications()) {
    return finalize(state, directlyAnsweredQuestions, entailedQuestions);
  }

  return finalize(state, directlyAnsweredQuestions, entailedQuestions);
}

function createInitialState() {
  const answers = {};
  for (const { id } of QUESTIONS) {
    answers[id] = undefined;
  }
  return answers;
}

function assertCompatible(previous, next, questionId) {
  if (previous === undefined || previous === next) {
    return;
  }
  throw new Error(
    `Incompatible state for ${questionId}: existing=${String(previous)}, next=${String(next)}`
  );
}

function finalize(state, directlyAnsweredQuestions, entailedQuestions) {
  const questionIds = QUESTIONS.map((q) => q.id);
  const responses = questionIds.map((id) => {
    const value = state[id];
    return value === undefined ? '' : String(value);
  });

  const canonicalPosition = new Map(questionIds.map((id, idx) => [id, idx]));
  const sortCanonical = (a, b) => canonicalPosition.get(a) - canonicalPosition.get(b);
  const sortedDirectlyAnsweredQuestions = [...directlyAnsweredQuestions].sort(sortCanonical);
  const sortedEntailedQuestions = [...entailedQuestions].sort(sortCanonical);

  return {
    specification_iri: SPECIFICATION_IRI,
    response_model_iri: RESPONSE_MODEL_IRI,
    question_set_iri: QUESTION_SET_IRI,
    question_ids: questionIds,
    responses,
    directly_answered_questions: sortedDirectlyAnsweredQuestions,
    entailed_questions: sortedEntailedQuestions
  };
}

const readline = require('node:readline');
const { stdin, stdout } = require('node:process');

async function promptLine(promptText) {
  if (globalThis.$$ && typeof globalThis.$$.input === 'function') {
    return globalThis.$$.input({ prompt: promptText });
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout
    });

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function askYesNo(question) {
  console.log(`\n${question.id}: ${question.text}`);

  const definitionEntries = Object.entries(question.definitions || {});
  if (definitionEntries.length > 0) {
    console.log('Definitions:');
    for (const [term, info] of definitionEntries) {
      console.log(`- ${term}: ${info.definition}`);
    }
  }

  while (true) {
    const raw = await promptLine('Your answer [y/n]: ');
    const value = String(raw || '').trim().toLowerCase();
    if (value === 'y' || value === 'yes') {
      return true;
    }
    if (value === 'n' || value === 'no') {
      return false;
    }
    console.log("Please answer with 'y'/'yes' or 'n'/'no'.");
  }
}

(async () => {
  console.log('Starting interactive Wagner questionnaire from embedded index.js logic...');
  const outcome = await runQuestionnaire(askYesNo);

  console.log('\nQuestionnaire outcome:');
  console.log(JSON.stringify(outcome, null, 2));
})();
