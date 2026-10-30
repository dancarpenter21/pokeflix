const BASE_HOSTS = ['pokeflix.tv', 'www.pokeflix.tv'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const DEFAULT_RESOURCE_HOSTS = ['ajax.googleapis.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'www.gstatic.com', ...FONT_HOSTS, 'v2.pkflx.com', 'v3.pkflx.com'];
function parseHost(value) {
  if (typeof value !== 'string' || !value.trim() || /[/:@*?#\s]/.test(value.trim())) throw Error('Enter an exact hostname without a path, port, or wildcard.');
  const url = new URL(`https://${value.trim()}`);
  if (!url.hostname.includes('.') || url.pathname !== '/') throw Error('Enter a valid hostname without a path.');
  return url.hostname;
}
function navigationAllowed(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && BASE_HOSTS.includes(u.hostname); } catch { return false; }
}
// Only numbered video servers; never sibling domains or nested subdomains.
function resourceHostAllowed(host, hosts) {
  return hosts.includes(host) || /^v\d+\.pkflx\.com$/.test(host);
}
function requestAllowed(details, hosts) {
  if (details.resourceType === 'mainFrame') return navigationAllowed(details.url);
  try {
    const u = new URL(details.url);
    if (u.protocol === 'data:') return details.resourceType === 'image';
    if (u.protocol === 'blob:') { const origin = new URL(u.pathname); return origin.protocol === 'https:' && !origin.username && !origin.password && !origin.port && resourceHostAllowed(origin.hostname, hosts); }
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && resourceHostAllowed(u.hostname, hosts);
  } catch { return false; }
}
function normalizeSettings(stored = {}) {
  const settings = { output: null, syncOffsets: {}, resourceHosts: [...DEFAULT_RESOURCE_HOSTS], fontHostsMigrated: true };
  if (!stored || typeof stored !== 'object') return settings;
  if (stored.syncOffsets && typeof stored.syncOffsets === 'object') for (const [key,value] of Object.entries(stored.syncOffsets)) if (Number.isInteger(value) && value >= 0 && value <= 1000 && value % 25 === 0) settings.syncOffsets[key] = value;
  if (stored.output && typeof stored.output.id === 'string' && typeof stored.output.label === 'string') settings.output = { id: stored.output.id, label: stored.output.label };
  if (Array.isArray(stored.resourceHosts)) settings.resourceHosts = stored.resourceHosts.map(parseHost);
  // Upgrade the original saved allowlist once. Later explicit removals stay removed.
  if (stored.fontHostsMigrated !== true) settings.resourceHosts = [...new Set([...settings.resourceHosts, ...FONT_HOSTS])];
  return settings;
}
module.exports = { BASE_HOSTS, FONT_HOSTS, DEFAULT_RESOURCE_HOSTS, parseHost, navigationAllowed, requestAllowed, normalizeSettings };
