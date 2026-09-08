#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  evaluateInputObject,
  evaluateSerializedInput,
  evaluateFixture
} = require('../src/decision');

function printHelp() {
  const helpText = [
    'DFU HBO2 treatment decision CLI',
    '',
    'Usage:',
    '  dfu-hbo2 --input <json-object-text>',
    '  dfu-hbo2 --raw-json <raw-object-json-text>',
    '  dfu-hbo2 --fixture <fixture-json-text>',
    '  dfu-hbo2 --file <path-to-json-file>',
    '  dfu-hbo2 --dfu-confirmed <true|false> --wagner-grade <number> --acute-surgical-intervention <true|false> --not-healed-after-30-days <true|false>',
    '  dfu-hbo2 --help',
    '',
    'Modes:',
    '  --input     Parse text as a unique-name JSON object and evaluateInputObject.',
    '  --raw-json  Evaluate serialized JSON text with duplicate-name detection semantics.',
    '  --fixture   Parse and evaluate an input_fixture object ({kind, ...}).',
    '  --file      Read JSON from file; if it contains {kind}, evaluate as fixture; otherwise as input object.',
    '  --dfu-confirmed/--wagner-grade/--acute-surgical-intervention/--not-healed-after-30-days',
    '             Evaluate using explicit field flags (best for PowerShell).',
    '',
    'Examples:',
    '  dfu-hbo2 --input "{\\"dfu_confirmed\\":\\"true\\",\\"wagner_grade\\":3,\\"acute_surgical_intervention\\":\\"false\\",\\"not_healed_after_30_days\\":\\"true\\"}"',
    '  dfu-hbo2 --raw-json "{\\"dfu_confirmed\\":\\"true\\",\\"dfu_confirmed\\":\\"false\\",\\"wagner_grade\\":3,\\"acute_surgical_intervention\\":\\"false\\",\\"not_healed_after_30_days\\":\\"false\\"}"',
    '  dfu-hbo2 --fixture "{\\"kind\\":\\"absent\\"}"',
    '  dfu-hbo2 --dfu-confirmed true --wagner-grade 3 --acute-surgical-intervention false --not-healed-after-30-days true',
    '  dfu-hbo2 --file input.json'
  ].join('\n');

  process.stdout.write(`${helpText}\n`);
}

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { mode: 'help' };
  }

  if (argv.includes('--dfu-confirmed') || argv.includes('--wagner-grade')) {
    return parseFieldModeArgs(argv);
  }

  if (argv.length !== 2) {
    throw new Error('Expected exactly one flag and one value. Use --help for usage.');
  }

  const [flag, value] = argv;

  if (flag === '--input') {
    return { mode: 'input', value };
  }

  if (flag === '--raw-json') {
    return { mode: 'raw-json', value };
  }

  if (flag === '--fixture') {
    return { mode: 'fixture', value };
  }

  if (flag === '--file') {
    return { mode: 'file', value };
  }

  throw new Error(`Unknown flag: ${flag}`);
}

function parseFieldModeArgs(argv) {
  if (argv.length % 2 !== 0) {
    throw new Error('Field mode expects flag/value pairs.');
  }

  const pairs = {};

  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];

    if (!flag.startsWith('--')) {
      throw new Error(`Invalid argument in field mode: ${flag}`);
    }

    pairs[flag] = value;
  }

  const required = [
    '--dfu-confirmed',
    '--wagner-grade',
    '--acute-surgical-intervention',
    '--not-healed-after-30-days'
  ];

  for (const flag of required) {
    if (!Object.prototype.hasOwnProperty.call(pairs, flag)) {
      throw new Error(`Missing required field flag: ${flag}`);
    }
  }

  const wagnerRaw = pairs['--wagner-grade'];
  const wagnerValue = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(wagnerRaw)
    ? Number(wagnerRaw)
    : wagnerRaw;

  return {
    mode: 'fields',
    value: {
      dfu_confirmed: pairs['--dfu-confirmed'],
      wagner_grade: wagnerValue,
      acute_surgical_intervention: pairs['--acute-surgical-intervention'],
      not_healed_after_30_days: pairs['--not-healed-after-30-days']
    }
  };
}

function parseJsonText(label, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON for ${label}: ${error.message}`);
  }
}

function evaluateFromFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const fileText = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = parseJsonText('--file', fileText);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'kind')) {
    return evaluateFixture(parsed);
  }

  return evaluateInputObject(parsed);
}

function main() {
  let parsedArgs;

  try {
    parsedArgs = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    return;
  }

  if (parsedArgs.mode === 'help') {
    printHelp();
    return;
  }

  try {
    let result;

    if (parsedArgs.mode === 'input') {
      const inputObject = parseJsonText('--input', parsedArgs.value);
      result = evaluateInputObject(inputObject);
    } else if (parsedArgs.mode === 'fields') {
      result = evaluateInputObject(parsedArgs.value);
    } else if (parsedArgs.mode === 'raw-json') {
      result = evaluateSerializedInput(parsedArgs.value);
    } else if (parsedArgs.mode === 'fixture') {
      const fixture = parseJsonText('--fixture', parsedArgs.value);
      result = evaluateFixture(fixture);
    } else {
      result = evaluateFromFile(parsedArgs.value);
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    fail(error.message);
  }
}

main();
