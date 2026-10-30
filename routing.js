function explicitOutputs(devices) { return devices.filter(d => d.kind === 'audiooutput' && d.deviceId && !['default', 'communications'].includes(d.deviceId)); }
function resolveOutput(devices, saved) {
  if (!saved) return null;
  const outputs = explicitOutputs(devices);
  const exact = outputs.find(d => d.deviceId === saved.id && d.label === saved.label);
  if (exact) return exact;
  const matches = outputs.filter(d => saved.label && d.label === saved.label);
  return matches.length === 1 ? matches[0] : null;
}
if (typeof module !== 'undefined') module.exports = { explicitOutputs, resolveOutput };
