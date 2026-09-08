#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { evaluate } = require('../src');

const args = process.argv.slice(2);
if (args.length !== 2 || !['--input', '--file'].includes(args[0])) {
  process.stderr.write('Usage: margolis-dfu-prognostic --input <json> | --file <path>\n');
  process.exitCode = 1;
} else {
  try {
    const text = args[0] === '--file' ? fs.readFileSync(args[1], 'utf8') : args[1];
    process.stdout.write(`${JSON.stringify(evaluate(JSON.parse(text)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}