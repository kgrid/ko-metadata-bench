'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const knowledgeObject = require('../src/knowledge-object');

test('published run boundary delegates to the scorer', async () => {
  const input = {
    question_ids: ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10'],
    responses: ['0', '0', '0', '0', '0', '1', '1', 'X', '0', '0']
  };

  assert.deepEqual(await knowledgeObject.run(input), {
    question_ids: input.question_ids,
    responses: input.responses,
    analysis_status: 'grade_computed',
    wagner_score: [2],
    grade_label: ['Deep ulcer']
  });
});
