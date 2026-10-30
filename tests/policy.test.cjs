const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BASE_HOSTS, FONT_HOSTS, DEFAULT_RESOURCE_HOSTS, parseHost, navigationAllowed, requestAllowed, normalizeSettings } = require('../policy');
test('font hosts are resource defaults, never browsing destinations', () => {
  for (const host of FONT_HOSTS) {
    assert.ok(DEFAULT_RESOURCE_HOSTS.includes(host));
    assert.equal(requestAllowed({ url: `https://${host}/font`, resourceType: host === 'fonts.googleapis.com' ? 'stylesheet' : 'font' }, DEFAULT_RESOURCE_HOSTS), true);
    assert.equal(navigationAllowed(`https://${host}/`), false);
  }
});
test('older settings receive font hosts once without restoring later removals', () => {
  const output = { id: 'tv', label: 'Roku' };
  const upgraded = normalizeSettings({ output, resourceHosts: ['cdn.example.com'] });
  assert.deepEqual(upgraded.output, output);
  assert.deepEqual(upgraded.resourceHosts, ['cdn.example.com', ...FONT_HOSTS]);
  assert.equal(upgraded.fontHostsMigrated, true);
  upgraded.resourceHosts = ['cdn.example.com'];
  assert.deepEqual(normalizeSettings(upgraded).resourceHosts, ['cdn.example.com']);
  assert.deepEqual(normalizeSettings().resourceHosts, DEFAULT_RESOURCE_HOSTS);
});
test('top-level URLs require exact secure Pokeflix hosts', () => {
  for (const u of ['https://pokeflix.tv/', 'https://www.pokeflix.tv/episode?a=1']) assert.equal(navigationAllowed(u), true);
  for (const u of ['http://pokeflix.tv', 'https://pokeflix.tv.evil.test', 'https://evil.test/pokeflix.tv', 'https://pokeflix.tv@evil.test', 'https://user@pokeflix.tv', 'https://pokeflix.tv:8888', 'file:///test', 'javascript:alert(1)', 'invalid']) assert.equal(navigationAllowed(u), false, u);
});
test('resource approval does not grant top-level navigation', () => {
  const hosts = [...BASE_HOSTS, 'cdn.example.com'];
  assert.equal(requestAllowed({ url: 'https://cdn.example.com/a.mp4', resourceType: 'media' }, hosts), true);
  assert.equal(requestAllowed({ url: 'https://cdn.example.com/', resourceType: 'mainFrame' }, hosts), false);
  assert.equal(requestAllowed({ url: 'https://cdn.example.com/player', resourceType: 'subFrame' }, hosts), true);
  assert.equal(requestAllowed({ url: 'https://unknown.example.com/a', resourceType: 'script' }, hosts), false);
  assert.equal(requestAllowed({ url: 'blob:https://pokeflix.tv/uuid', resourceType: 'media' }, hosts), true);
  assert.equal(requestAllowed({ url: 'blob:https://evil.test/uuid', resourceType: 'media' }, hosts), false);
  assert.equal(requestAllowed({ url: 'data:text/html,hi', resourceType: 'subFrame' }, hosts), false);
});
test('host settings reject URLs, wildcards and paths', () => {
  assert.equal(parseHost(' CDN.Example.com '), 'cdn.example.com');
  for (const h of ['', '*.example.com', 'https://example.com', 'example.com/a', 'example.com\\a', 'example.com:443', 'user@example.com', 'example.com?x', 'example.com#x']) assert.throws(() => parseHost(h));
});

test('numbered video servers are allowed for resources with existing saved settings', () => {
  const hosts = normalizeSettings({ resourceHosts: [], fontHostsMigrated: true }).resourceHosts;
  for (const host of ['v1.pkflx.com', 'v4.pkflx.com', 'v123.pkflx.com']) {
    for (const resourceType of ['xhr', 'media', 'subFrame']) {
      assert.equal(requestAllowed({ url: `https://${host}/playlist.m3u8`, resourceType }, hosts), true);
    }
    assert.equal(requestAllowed({ url: `blob:https://${host}/uuid`, resourceType: 'media' }, hosts), true);
    assert.equal(requestAllowed({ url: `https://${host}/`, resourceType: 'mainFrame' }, hosts), false);
  }
  for (const url of ['https://pkflx.com/', 'https://v.pkflx.com/', 'https://video.pkflx.com/', 'https://v1.pkflx.com.evil.test/', 'https://nested.v1.pkflx.com/', 'https://v1.evil.pkflx.com/', 'http://v1.pkflx.com/', 'https://user@v1.pkflx.com/', 'https://v1.pkflx.com:8888/', 'blob:https://v1.pkflx.com:8888/uuid']) {
    assert.equal(requestAllowed({ url, resourceType: 'xhr' }, hosts), false, url);
  }
});
