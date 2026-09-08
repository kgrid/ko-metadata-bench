'use strict';

const { analyzeQuestionnaireResponse } = require('./scorer');

async function run(input) {
  return analyzeQuestionnaireResponse(input);
}

module.exports = { run };
