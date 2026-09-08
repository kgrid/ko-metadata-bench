#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { stdin, stdout, stderr } = require('node:process');
const { runQuestionnaire } = require('../src/index');
const { analyzeQuestionnaireResponse } = require('../src/scorer');

function formatJsonCompactArrays(value, indentSize = 2, depth = 0) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '{}';
    }

    const indent = ' '.repeat(indentSize * depth);
    const childIndent = ' '.repeat(indentSize * (depth + 1));
    const body = entries
      .map(
        ([key, child]) =>
          `${childIndent}${JSON.stringify(key)}: ${formatJsonCompactArrays(child, indentSize, depth + 1)}`
      )
      .join(',\n');

    return `{\n${body}\n${indent}}`;
  }

  return JSON.stringify(value);
}

function renderDefinitions(definitions) {
  if (!definitions || typeof definitions !== 'object') {
    return '';
  }

  const entries = Object.entries(definitions);
  if (entries.length === 0) {
    return '';
  }

  const lines = ['Related definitions:'];
  for (const [term, value] of entries) {
    lines.push(`- ${term}: ${value.definition}`);
    lines.push(`  iri: ${value.term_iri}`);
  }

  return lines.join('\n') + '\n';
}

function createPrompter() {
  const rl = readline.createInterface({
    input: stdin,
    output: stdout
  });

  const askLine = (prompt) =>
    new Promise((resolve) => {
      rl.question(prompt, resolve);
    });

  const askYesNo = async (question) => {
    while (true) {
      const definitionsBlock = renderDefinitions(question.definitions);
      if (definitionsBlock) {
        stdout.write(definitionsBlock);
      }

      const line = await askLine(`${question.id} ${question.text} [y/n]: `);
      const normalized = String(line).trim().toLowerCase();

      if (normalized === 'y' || normalized === 'yes') {
        return true;
      }
      if (normalized === 'n' || normalized === 'no') {
        return false;
      }

      stdout.write('Please answer with y/yes or n/no.\n');
    }
  };

  const close = () => rl.close();

  return { askYesNo, close };
}

async function main() {
  const { askYesNo, close } = createPrompter();

  try {
    stdout.write('Wagner adaptive questionnaire\n\n');
    const outcome = await runQuestionnaire(askYesNo);
    const analysis = analyzeQuestionnaireResponse(outcome);

    stdout.write('\n' + formatJsonCompactArrays(outcome) + '\n');
    stdout.write('\n' + formatJsonCompactArrays(analysis) + '\n');

    close();
    process.exitCode = 0;
  } catch (error) {
    close();
    stderr.write((error && error.message ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  }
}

main();
