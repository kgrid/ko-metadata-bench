'use strict';

async function execute(privateExecutor, input) {
  if (typeof privateExecutor !== 'function') {
    throw new TypeError('A host-supplied private executor is required.');
  }
  return privateExecutor(input);
}

module.exports = { execute };
