'use strict';

const INPUT_KEYS = {
  IN_01: 'dfu_confirmed',
  IN_02: 'wagner_grade',
  IN_03: 'acute_surgical_intervention',
  IN_04: 'not_healed_after_30_days'
};

const REQUIRED_FIELDS = [
  { code: 'IN-01', key: INPUT_KEYS.IN_01 },
  { code: 'IN-02', key: INPUT_KEYS.IN_02 },
  { code: 'IN-03', key: INPUT_KEYS.IN_03 },
  { code: 'IN-04', key: INPUT_KEYS.IN_04 }
];

const SPEC_SOURCE_REFERENCE = 'UHMS-DFU-HBO2-F6-CKS-1.0, Section 3.7';
const FIGURE_SOURCE_REFERENCE = 'Huang et al. (2015), Figure 6';

function makeErrorResult(resultId, displayText, errorField) {
  return {
    status: 'error',
    result_id: resultId,
    display_text: displayText,
    evidence_quality: 'not-applicable',
    recommendation_strength: 'none',
    rule_id: null,
    error_field: errorField,
    source_reference: SPEC_SOURCE_REFERENCE,
    warnings: {}
  };
}

const RESULTS = {
  ERR_01: makeErrorResult('ERR-01', 'No input object exists.', null),
  ERR_02: makeErrorResult(
    'ERR-02',
    'Wagner grade is outside the closed value set: IN-02.',
    'IN-02'
  ),
  ERR_03_IN_01: makeErrorResult(
    'ERR-03',
    'Input field has invalid data type: IN-01.',
    'IN-01'
  ),
  ERR_03_IN_02: makeErrorResult(
    'ERR-03',
    'Input field has invalid data type: IN-02.',
    'IN-02'
  ),
  ERR_03_IN_03: makeErrorResult(
    'ERR-03',
    'Input field has invalid data type: IN-03.',
    'IN-03'
  ),
  ERR_03_IN_04: makeErrorResult(
    'ERR-03',
    'Input field has invalid data type: IN-04.',
    'IN-04'
  ),
  ERR_07_IN_01: makeErrorResult(
    'ERR-07',
    'Required input field is missing: IN-01.',
    'IN-01'
  ),
  ERR_07_IN_02: makeErrorResult(
    'ERR-07',
    'Required input field is missing: IN-02.',
    'IN-02'
  ),
  ERR_07_IN_03: makeErrorResult(
    'ERR-07',
    'Required input field is missing: IN-03.',
    'IN-03'
  ),
  ERR_07_IN_04: makeErrorResult(
    'ERR-07',
    'Required input field is missing: IN-04.',
    'IN-04'
  ),
  ERR_08_IN_01: makeErrorResult(
    'ERR-08',
    'Required input field is null: IN-01.',
    'IN-01'
  ),
  ERR_08_IN_02: makeErrorResult(
    'ERR-08',
    'Required input field is null: IN-02.',
    'IN-02'
  ),
  ERR_08_IN_03: makeErrorResult(
    'ERR-08',
    'Required input field is null: IN-03.',
    'IN-03'
  ),
  ERR_08_IN_04: makeErrorResult(
    'ERR-08',
    'Required input field is null: IN-04.',
    'IN-04'
  ),
  ERR_09_IN_01: makeErrorResult(
    'ERR-09',
    'Input field has invalid closed-set value: IN-01.',
    'IN-01'
  ),
  ERR_09_IN_03: makeErrorResult(
    'ERR-09',
    'Input field has invalid closed-set value: IN-03.',
    'IN-03'
  ),
  ERR_09_IN_04: makeErrorResult(
    'ERR-09',
    'Input field has invalid closed-set value: IN-04.',
    'IN-04'
  ),
  OUT_OF_SCOPE: {
    status: 'out-of-scope',
    result_id: 'OUT-OF-SCOPE',
    display_text: 'Input is outside the clinical scope of this CKS.',
    evidence_quality: 'not-applicable',
    recommendation_strength: 'none',
    rule_id: 'ALG-01',
    error_field: null,
    source_reference: FIGURE_SOURCE_REFERENCE,
    warnings: {}
  },
  OUTPUT_01: {
    status: 'completed',
    result_id: 'OUTPUT-01',
    display_text: 'Suggest against adding HBO\u2082.',
    evidence_quality: 'very-low',
    recommendation_strength: 'conditional',
    rule_id: 'ALG-02',
    error_field: null,
    source_reference: FIGURE_SOURCE_REFERENCE,
    warnings: {}
  },
  OUTPUT_02: {
    status: 'completed',
    result_id: 'OUTPUT-02',
    display_text: 'Suggest adding HBO\u2082 urgently after surgery.',
    evidence_quality: 'moderate',
    recommendation_strength: 'conditional',
    rule_id: 'ALG-03',
    error_field: null,
    source_reference: FIGURE_SOURCE_REFERENCE,
    warnings: {}
  },
  OUTPUT_03: {
    status: 'completed',
    result_id: 'OUTPUT-03',
    display_text: 'Suggest adding HBO\u2082 to standard of care.',
    evidence_quality: 'moderate',
    recommendation_strength: 'conditional',
    rule_id: 'ALG-04',
    error_field: null,
    source_reference: FIGURE_SOURCE_REFERENCE,
    warnings: {}
  },
  OUTPUT_04: {
    status: 'completed',
    result_id: 'OUTPUT-04',
    display_text: 'Insufficient data to make a recommendation.',
    evidence_quality: 'not-assigned',
    recommendation_strength: 'none',
    rule_id: 'ALG-05',
    error_field: null,
    source_reference: FIGURE_SOURCE_REFERENCE,
    warnings: {}
  }
};

function cloneResult(result) {
  return {
    ...result,
    warnings: {}
  };
}

function makeDuplicateError(propertyName) {
  return makeErrorResult(
    'ERR-06',
    `Duplicate input property: ${propertyName}.`,
    propertyName
  );
}

function evaluateInputObject(inputObject) {
  if (inputObject === undefined) {
    return cloneResult(RESULTS.ERR_01);
  }

  ensureTopLevelObject(inputObject);
  return validateAndDecide(inputObject);
}

function evaluateSerializedInput(rawJsonText) {
  if (typeof rawJsonText !== 'string') {
    throw new TypeError('rawJsonText must be a JSON string.');
  }

  const { names, parsedObject } = parseTopLevelObjectWithNames(rawJsonText);
  const duplicateName = findCanonicalDuplicateName(names);

  if (duplicateName !== null) {
    return makeDuplicateError(duplicateName);
  }

  return validateAndDecide(parsedObject);
}

function evaluateFixture(inputFixture) {
  if (!inputFixture || typeof inputFixture !== 'object') {
    throw new TypeError('input_fixture must be an object with a supported kind.');
  }

  if (inputFixture.kind === 'absent') {
    return cloneResult(RESULTS.ERR_01);
  }

  if (inputFixture.kind === 'json-object') {
    return evaluateInputObject(inputFixture.value);
  }

  if (inputFixture.kind === 'raw-json') {
    return evaluateSerializedInput(inputFixture.text);
  }

  throw new TypeError('Unsupported input_fixture kind.');
}

function ensureTopLevelObject(value) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new TypeError(
      'Top-level input must be a JSON object. Non-object values are outside the CKS invocation boundary.'
    );
  }
}

function validateAndDecide(inputObject) {
  const validationError = validateObject(inputObject);
  if (validationError) {
    return validationError;
  }

  return runDecisionLogic(inputObject);
}

function validateObject(inputObject) {
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(inputObject, field.key)) {
      return cloneResult(RESULTS[`ERR_07_${field.code.replace('-', '_')}`]);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (inputObject[field.key] === null) {
      return cloneResult(RESULTS[`ERR_08_${field.code.replace('-', '_')}`]);
    }
  }

  const in01 = inputObject[INPUT_KEYS.IN_01];
  if (typeof in01 !== 'string') {
    return cloneResult(RESULTS.ERR_03_IN_01);
  }
  if (in01 !== 'true' && in01 !== 'false') {
    return cloneResult(RESULTS.ERR_09_IN_01);
  }

  const in02 = inputObject[INPUT_KEYS.IN_02];
  if (!isMathematicalInteger(in02)) {
    return cloneResult(RESULTS.ERR_03_IN_02);
  }
  if (in02 < 0 || in02 > 5) {
    return cloneResult(RESULTS.ERR_02);
  }

  const in03 = inputObject[INPUT_KEYS.IN_03];
  if (typeof in03 !== 'string') {
    return cloneResult(RESULTS.ERR_03_IN_03);
  }
  if (in03 !== 'true' && in03 !== 'false') {
    return cloneResult(RESULTS.ERR_09_IN_03);
  }

  const in04 = inputObject[INPUT_KEYS.IN_04];
  if (typeof in04 !== 'string') {
    return cloneResult(RESULTS.ERR_03_IN_04);
  }
  if (in04 !== 'true' && in04 !== 'false') {
    return cloneResult(RESULTS.ERR_09_IN_04);
  }

  return null;
}

function isMathematicalInteger(value) {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function runDecisionLogic(inputObject) {
  const dfuConfirmed = inputObject[INPUT_KEYS.IN_01];
  const wagnerGrade = inputObject[INPUT_KEYS.IN_02];
  const acuteSurgicalIntervention = inputObject[INPUT_KEYS.IN_03];
  const notHealedAfter30Days = inputObject[INPUT_KEYS.IN_04];

  if (dfuConfirmed === 'false') {
    return cloneResult(RESULTS.OUT_OF_SCOPE);
  }

  if (wagnerGrade <= 2) {
    return cloneResult(RESULTS.OUTPUT_01);
  }

  if (acuteSurgicalIntervention === 'true') {
    return cloneResult(RESULTS.OUTPUT_02);
  }

  if (notHealedAfter30Days === 'true') {
    return cloneResult(RESULTS.OUTPUT_03);
  }

  return cloneResult(RESULTS.OUTPUT_04);
}

function findCanonicalDuplicateName(names) {
  const counts = new Map();

  for (const name of names) {
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const duplicateNames = [];
  for (const [name, count] of counts.entries()) {
    if (count > 1) {
      duplicateNames.push(name);
    }
  }

  if (duplicateNames.length === 0) {
    return null;
  }

  duplicateNames.sort(comparePropertyNamesByScalarValue);
  return duplicateNames[0];
}

function comparePropertyNamesByScalarValue(leftName, rightName) {
  const leftScalars = Array.from(leftName, (character) => character.codePointAt(0));
  const rightScalars = Array.from(rightName, (character) => character.codePointAt(0));
  const minLen = Math.min(leftScalars.length, rightScalars.length);

  for (let i = 0; i < minLen; i += 1) {
    if (leftScalars[i] !== rightScalars[i]) {
      return leftScalars[i] - rightScalars[i];
    }
  }

  return leftScalars.length - rightScalars.length;
}

function parseTopLevelObjectWithNames(rawText) {
  let cursor = 0;

  cursor = skipWhitespace(rawText, cursor);
  if (rawText[cursor] !== '{') {
    throw new TypeError('Top-level serialized input must be a JSON object.');
  }

  cursor += 1;
  const propertyNames = [];

  while (true) {
    cursor = skipWhitespace(rawText, cursor);

    if (rawText[cursor] === '}') {
      cursor += 1;
      break;
    }

    if (rawText[cursor] !== '"') {
      throw new SyntaxError('Expected a JSON object property string.');
    }

    const keyToken = readJsonStringToken(rawText, cursor);
    const decodedName = JSON.parse(keyToken.token);
    propertyNames.push(decodedName);
    cursor = keyToken.nextIndex;

    cursor = skipWhitespace(rawText, cursor);
    if (rawText[cursor] !== ':') {
      throw new SyntaxError('Expected ":" after property name.');
    }

    cursor += 1;
    cursor = skipWhitespace(rawText, cursor);
    cursor = skipJsonValue(rawText, cursor);

    cursor = skipWhitespace(rawText, cursor);
    if (rawText[cursor] === ',') {
      cursor += 1;
      continue;
    }

    if (rawText[cursor] === '}') {
      cursor += 1;
      break;
    }

    throw new SyntaxError('Expected "," or "}" after object member.');
  }

  cursor = skipWhitespace(rawText, cursor);
  if (cursor !== rawText.length) {
    throw new SyntaxError('Unexpected trailing content after top-level object.');
  }

  const parsedObject = JSON.parse(rawText);
  ensureTopLevelObject(parsedObject);

  return {
    names: propertyNames,
    parsedObject
  };
}

function skipJsonValue(text, startIndex) {
  const ch = text[startIndex];

  if (ch === '"') {
    return readJsonStringToken(text, startIndex).nextIndex;
  }

  if (ch === '{') {
    return skipJsonObject(text, startIndex);
  }

  if (ch === '[') {
    return skipJsonArray(text, startIndex);
  }

  if (text.startsWith('true', startIndex)) {
    return startIndex + 4;
  }

  if (text.startsWith('false', startIndex)) {
    return startIndex + 5;
  }

  if (text.startsWith('null', startIndex)) {
    return startIndex + 4;
  }

  return skipJsonNumber(text, startIndex);
}

function skipJsonObject(text, startIndex) {
  let cursor = startIndex + 1;

  while (true) {
    cursor = skipWhitespace(text, cursor);

    if (text[cursor] === '}') {
      return cursor + 1;
    }

    if (text[cursor] !== '"') {
      throw new SyntaxError('Expected object key string.');
    }

    cursor = readJsonStringToken(text, cursor).nextIndex;
    cursor = skipWhitespace(text, cursor);

    if (text[cursor] !== ':') {
      throw new SyntaxError('Expected ":" in object.');
    }

    cursor += 1;
    cursor = skipWhitespace(text, cursor);
    cursor = skipJsonValue(text, cursor);
    cursor = skipWhitespace(text, cursor);

    if (text[cursor] === ',') {
      cursor += 1;
      continue;
    }

    if (text[cursor] === '}') {
      return cursor + 1;
    }

    throw new SyntaxError('Expected "," or "}" in object.');
  }
}

function skipJsonArray(text, startIndex) {
  let cursor = startIndex + 1;

  while (true) {
    cursor = skipWhitespace(text, cursor);

    if (text[cursor] === ']') {
      return cursor + 1;
    }

    cursor = skipJsonValue(text, cursor);
    cursor = skipWhitespace(text, cursor);

    if (text[cursor] === ',') {
      cursor += 1;
      continue;
    }

    if (text[cursor] === ']') {
      return cursor + 1;
    }

    throw new SyntaxError('Expected "," or "]" in array.');
  }
}

function skipJsonNumber(text, startIndex) {
  const numberMatch = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
    text.slice(startIndex)
  );

  if (!numberMatch) {
    throw new SyntaxError('Invalid JSON value.');
  }

  return startIndex + numberMatch[0].length;
}

function readJsonStringToken(text, startIndex) {
  let cursor = startIndex + 1;
  let escaped = false;

  while (cursor < text.length) {
    const ch = text[cursor];

    if (escaped) {
      escaped = false;
      cursor += 1;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      cursor += 1;
      continue;
    }

    if (ch === '"') {
      return {
        token: text.slice(startIndex, cursor + 1),
        nextIndex: cursor + 1
      };
    }

    cursor += 1;
  }

  throw new SyntaxError('Unterminated JSON string.');
}

function skipWhitespace(text, startIndex) {
  let cursor = startIndex;

  while (cursor < text.length) {
    const code = text.charCodeAt(cursor);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      cursor += 1;
      continue;
    }
    break;
  }

  return cursor;
}

module.exports = {
  INPUT_KEYS,
  evaluateInputObject,
  evaluateSerializedInput,
  evaluateFixture,
  parseTopLevelObjectWithNames,
  comparePropertyNamesByScalarValue
};
