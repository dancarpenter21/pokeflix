const outputSelect = document.querySelector('#outputs'), status = document.querySelector('#status');
let saved = null, stream = null, player = null, generation = 0, active = false, starting = false, checking = false;
let resourceHosts = [], blockedHosts = [];
function stop(message = 'Muted · Connect audio to resume.') {
  generation++; active = false;
  if (player) { player.pause(); player.srcObject = null; player = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  controls.stopRouting(); status.textContent = message;
}
async function refresh() {
  const devices = explicitOutputs(await navigator.mediaDevices.enumerateDevices()), selected = outputSelect.value;
  outputSelect.replaceChildren(new Option('Select TV output', ''));
  for (const d of devices) outputSelect.add(new Option(d.label || 'Unnamed audio output', d.deviceId));
  const restored = resolveOutput(devices, saved);
  outputSelect.value = devices.some(d => d.deviceId === selected) ? selected : restored?.deviceId || '';
  return devices;
}
async function connect() {
  if (starting) return;
  starting = true; stop('Connecting TV audio…');
  const token = generation; let captured;
  try {
    const devices = explicitOutputs(await navigator.mediaDevices.enumerateDevices()), selected = devices.find(d => d.deviceId === outputSelect.value);
    if (!selected) throw Error('Select an available TV output first.');
    const audio = new Audio(); await audio.setSinkId(selected.deviceId);
    if (token !== generation) return;
    await controls.beginRouting();
    captured = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    if (token !== generation) { captured.getTracks().forEach(t => t.stop()); return; }
    if (!captured.getAudioTracks().length) throw Error('Tab audio capture is unavailable.');
    stream = captured;
    // Retain the video track to keep capture alive; render only captured audio.
    audio.srcObject = new MediaStream(captured.getAudioTracks());
    audio.addEventListener('error', () => stop('Muted · Audio output failed. Reconnect the TV.'));
    for (const t of captured.getTracks()) t.addEventListener('ended', () => stop('Muted · Capture ended. Connect audio to resume.'));
    player = audio; await audio.play();
    if (token !== generation) return;
    saved = { id: selected.deviceId, label: selected.label }; await controls.saveOutput(saved);
    if (token !== generation) return;
    active = true; status.textContent = `Audio → ${selected.label || 'Selected TV output'}`;
  } catch (error) {
    if (token === generation) stop(`Muted · ${error.message}`);
    if (captured && captured !== stream) captured.getTracks().forEach(t => t.stop());
  } finally { starting = false; }
}
async function checkDevice() {
  if (checking || !active) return;
  checking = true;
  try {
    const devices = explicitOutputs(await navigator.mediaDevices.enumerateDevices());
    if (!devices.some(d => d.deviceId === saved?.id) || player?.sinkId !== saved?.id) stop('Muted · TV output disconnected. Reconnect and select it again.');
  } catch { stop('Muted · Could not verify TV audio.'); } finally { checking = false; }
}
navigator.mediaDevices.addEventListener('devicechange', async () => { stop('Muted · Audio devices changed. Verify the TV and reconnect audio.'); try { await refresh(); } catch { /* Remain muted. */ } });
setInterval(checkDevice, 500);
document.querySelector('#refresh').onclick = () => refresh().catch(e => { status.textContent = e.message; });
document.querySelector('#connect').onclick = connect;
document.querySelector('#mute').onclick = () => stop();
outputSelect.onchange = () => stop('Muted · Press Connect audio for the selected output.');
function closeSettings() {
  document.querySelector('#settings').hidden = true;
  document.querySelector('#settings-auth').hidden = true;
  document.querySelector('#settings-password').value = '';
  document.querySelector('#auth-error').textContent = '';
  controls.command('close-settings');
}
document.querySelectorAll('[data-command]').forEach(b => { b.onclick = () => {
  if (b.dataset.command === 'settings' && (!document.querySelector('#settings').hidden || !document.querySelector('#settings-auth').hidden)) closeSettings();
  else controls.command(b.dataset.command);
}; });
document.querySelector('#close-settings').onclick = closeSettings;
document.querySelector('#cancel-unlock').onclick = closeSettings;
document.querySelector('#unlock-form').onsubmit = async e => {
  e.preventDefault();
  const field = document.querySelector('#settings-password');
  const password = field.value; field.value = '';
  try {
    if (!await controls.unlockSettings(password)) { document.querySelector('#auth-error').textContent = 'Incorrect password. Try again.'; field.focus(); }
  } catch { document.querySelector('#auth-error').textContent = 'Could not unlock settings. Try again.'; }
};
function renderHosts() {
  const approved = document.querySelector('#approved'); approved.replaceChildren();
  for (const host of ['pokeflix.tv', 'www.pokeflix.tv', ...resourceHosts]) {
    const item = document.createElement('li'); item.textContent = host;
    if (resourceHosts.includes(host)) {
      const b = document.createElement('button'); b.textContent = 'Remove';
      b.onclick = async () => { try { resourceHosts = await controls.resourceHost('remove', host); controls.command('reload'); renderHosts(); } catch (e) { document.querySelector('#settings-error').textContent = e.message; } }; item.append(b);
    }
    approved.append(item);
  }
  const list = document.querySelector('#blocked'); list.replaceChildren();
  for (const e of blockedHosts.filter(e => !resourceHosts.includes(e.host))) { const item = document.createElement('li'); item.textContent = `${e.host} (${e.type})`; list.append(item); }
  if (!list.children.length) { const item = document.createElement('li'); item.textContent = 'No blocked hosts recorded yet.'; list.append(item); }
}
document.querySelector('#host-form').onsubmit = async e => {
  e.preventDefault();
  try {
    resourceHosts = await controls.resourceHost('add', document.querySelector('#host').value);
    document.querySelector('#host').value = ''; document.querySelector('#settings-error').textContent = ''; renderHosts(); controls.command('reload');
  } catch (error) { document.querySelector('#settings-error').textContent = error.message; }
};
controls.on('blocked', entries => { blockedHosts = entries; renderHosts(); });
controls.on('settings-auth', () => {
  document.querySelector('#settings').hidden = true;
  document.querySelector('#settings-auth').hidden = false;
  document.querySelector('#settings-password').value = '';
  document.querySelector('#auth-error').textContent = '';
  document.querySelector('#settings-password').focus();
});
controls.on('settings-visible', visible => {
  document.querySelector('#settings-auth').hidden = true;
  document.querySelector('#settings-password').value = '';
  document.querySelector('#auth-error').textContent = '';
  document.querySelector('#settings').hidden = !visible;
});
controls.on('stop-routing', message => stop(`Muted · ${message}`));
controls.on('page', message => { document.querySelector('#page').textContent = message; });
window.addEventListener('beforeunload', () => stop());
controls.initialize().then(async ({ settings, blocked }) => {
  saved = settings.output; resourceHosts = settings.resourceHosts; blockedHosts = blocked; renderHosts(); await refresh();
  if (outputSelect.value && saved) status.textContent = 'Muted · Saved output found. Press Connect audio.';
}).catch(e => { status.textContent = `Muted · ${e.message}`; });
