'use strict';

const SPECIFICATION_ID = 'MARGOLIS-DFU-PROGNOSIS-CKS-1.0';
const SPECIFICATION_VERSION = '1.0';
const SOURCE_REFERENCE = 'Margolis et al. 2022, supplementary Table 3';
const AREA_EQUALITY_NOTE = 'Area equality assigned to AREA-GE-2 by CKS specification decision.';
const DURATION_EQUALITY_NOTE = 'Duration equality assigned to DUR-GE-8 by CKS specification decision.';

const RULES = {
  'AREA-GE-2|DUR-GE-8': ['ALG-01', 'AREA_GE_2__DURATION_GE_8', 0.203, '20.3%'],
  'AREA-GE-2|DUR-LT-8': ['ALG-02', 'AREA_GE_2__DURATION_LT_8', 0.304, '30.4%'],
  'AREA-LT-2|DUR-GE-8': ['ALG-03', 'AREA_LT_2__DURATION_GE_8', 0.448, '44.8%'],
  'AREA-LT-2|DUR-LT-8': ['ALG-04', 'AREA_LT_2__DURATION_LT_8', 0.631, '63.1%']
};

function evaluate(input) {
  return evaluateInternal(input, null);
}

function evaluateWithRuleCardinalityFault(input, cardinality = 0) {
  if (cardinality !== 0 && cardinality !== 2) {
    throw new TypeError('cardinality must be 0 or 2.');
  }
  return evaluateInternal(input, cardinality);
}

function evaluateInternal(input, forcedCardinality) {
  const validation = validateInput(input);
  if (validation.errors.length > 0) return failure(validation.errors);
  if (forcedCardinality !== null) return failure([{ code: 'ERR-08', path: 'internal', message: 'Rule lookup cardinality was not exactly one.' }]);

  const area = input.wound_area;
  const duration = input.wound_duration;
  const areaValue = area.ucum_code === 'cm2' ? area.value : area.value / 100;
  const durationValue = duration.ucum_code === 'wk' ? duration.value : duration.value / 7;
  const areaCategory = areaValue >= 2 ? 'AREA-GE-2' : 'AREA-LT-2';
  const durationCategory = durationValue >= 8 ? 'DUR-GE-8' : 'DUR-LT-8';
  const rule = RULES[`${areaCategory}|${durationCategory}`];
  const notes = [];
  if (areaValue === 2) notes.push(AREA_EQUALITY_NOTE);
  if (durationValue === 8) notes.push(DURATION_EQUALITY_NOTE);

  return {
    status: 'success',
    specification_id: SPECIFICATION_ID,
    specification_version: SPECIFICATION_VERSION,
    result_id: rule[0],
    prognostic_group: rule[1],
    healing_probability_16_weeks: rule[2],
    display_probability_percent: rule[3],
    area_category: areaCategory,
    duration_category: durationCategory,
    normalized_inputs: {
      wound_area: { value: areaValue, ucum_code: 'cm2' },
      wound_duration: { exact_value: durationToRational(duration), ucum_code: 'wk' }
    },
    basis: [
      { input: 'wound_area', comparison_value: area.value, ucum_code: area.ucum_code, operator: areaValue >= 2 ? '>=' : '<', threshold: area.ucum_code === 'cm2' ? 2 : 200, category: areaCategory, classification_basis: 'point' },
      { input: 'wound_duration', comparison_value: duration.value, ucum_code: duration.ucum_code, operator: durationValue >= 8 ? '>=' : '<', threshold: duration.ucum_code === 'wk' ? 8 : 56, category: durationCategory, classification_basis: 'point' }
    ],
    source_reference: SOURCE_REFERENCE,
    specification_notes: notes
  };
}

function validateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: [{ code: 'ERR-14', path: '$', message: 'Input must be a JSON object.' }] };
  }
  const keys = Object.keys(input);
  const hasArea = keys.includes('wound_area');
  const hasDuration = keys.includes('wound_duration');
  if (keys.some((key) => !['wound_area', 'wound_duration'].includes(key))) {
    return { errors: [{ code: 'ERR-14', path: '$', message: 'Input contains an undeclared or missing top-level property.' }] };
  }
  const errors = [];
  if (!hasArea) errors.push({ code: 'ERR-01', path: 'wound_area', message: 'Required input is missing.' });
  else validateQuantity(input.wound_area, 'wound_area', 'area', errors);
  if (!hasDuration) errors.push({ code: 'ERR-01', path: 'wound_duration', message: 'Required input is missing.' });
  else validateQuantity(input.wound_duration, 'wound_duration', 'duration', errors);
  return { errors };
}

function validateQuantity(quantity, path, kind, errors) {
  if (quantity === undefined) {
    errors.push({ code: 'ERR-01', path, message: 'Required input is missing.' });
    return;
  }
  if (quantity === null || typeof quantity !== 'object' || Array.isArray(quantity) || typeof quantity.value !== 'number' || !Number.isFinite(quantity.value)) {
    errors.push({ code: 'ERR-02', path, message: 'Quantity value must be a finite JSON number.' });
    return;
  }
  const allowedCode = kind === 'area' ? ['cm2', 'mm2'] : ['wk', 'd'];
  if (quantity.value <= (kind === 'area' ? 0 : -Infinity)) {
    errors.push({ code: kind === 'area' ? 'ERR-03' : 'ERR-04', path, message: 'Quantity is outside the permitted numeric range.' });
    return;
  }
  if (kind === 'duration' && quantity.value < 0) {
    errors.push({ code: 'ERR-04', path, message: 'Quantity is outside the permitted numeric range.' });
    return;
  }
  if (Object.keys(quantity).length !== 2 || typeof quantity.ucum_code !== 'string' || !allowedCode.includes(quantity.ucum_code)) {
    errors.push({ code: 'ERR-05', path, message: 'Quantity does not satisfy the closed core input contract.' });
  }
}

function durationToRational(quantity) {
  const base = decimalRational(quantity.value);
  return quantity.ucum_code === 'wk' ? base : reduce(base.numerator, base.denominator * 7);
}

function decimalRational(value) {
  const text = String(value);
  const [whole, fraction = ''] = text.split('.');
  return reduce(Number(`${whole}${fraction}`), 10 ** fraction.length);
}

function reduce(numerator, denominator) {
  const divisor = gcd(Math.abs(numerator), denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function failure(errors) {
  return { status: 'failure', specification_id: SPECIFICATION_ID, specification_version: SPECIFICATION_VERSION, errors, specification_notes: [] };
}

module.exports = { evaluate, evaluateWithRuleCardinalityFault };