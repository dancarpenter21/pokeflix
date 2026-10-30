const { test } = require('node:test');
const assert = require('node:assert/strict');
const { explicitOutputs, resolveOutput } = require('../routing');
const device = (id, label = 'Roku') => ({ kind: 'audiooutput', deviceId: id, label });
test('never selects system default aliases or inputs', () => {
  assert.deepEqual(explicitOutputs([device('default'), device('communications'), device('tv'), { kind: 'audioinput', deviceId: 'mic' }]), [device('tv')]);
});
test('restores exact output and uniquely renamed device identifiers', () => {
  assert.equal(resolveOutput([device('tv')], { id: 'tv', label: 'Roku' }).deviceId, 'tv');
  assert.equal(resolveOutput([device('new')], { id: 'old', label: 'Roku' }).deviceId, 'new');
});
test('missing or ambiguous outputs do not fall back', () => {
  assert.equal(resolveOutput([device('default')], { id: 'old', label: 'Roku' }), null);
  assert.equal(resolveOutput([device('one'), device('two')], { id: 'old', label: 'Roku' }), null);
  assert.equal(resolveOutput([device('one', 'Headphones')], { id: 'old', label: 'Roku' }), null);
  assert.equal(resolveOutput([], null), null);
});
