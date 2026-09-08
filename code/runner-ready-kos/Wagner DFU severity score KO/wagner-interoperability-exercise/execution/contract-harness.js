'use strict';

async function execute(knowledgeObject, input) {
  if (!knowledgeObject || typeof knowledgeObject.run !== 'function') {
    throw new TypeError('An external knowledge object with run(input) is required.');
  }
  return knowledgeObject.run(input);
}

module.exports = { execute };
