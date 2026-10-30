const { app, BrowserWindow, WebContentsView, ipcMain, session, protocol, net, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { BASE_HOSTS, parseHost, navigationAllowed, requestAllowed, normalizeSettings } = require('./policy');
protocol.registerSchemesAsPrivileged([{ scheme: 'pokeflix-app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
app.setName('Pokeflix TV');
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
const SHELL = 'pokeflix-app://app/index.html';
let win, view, settings;
let captureAuthorized = false;
let hostsUnlocked = false;
const SETTINGS_PASSWORD = 'pokeflix.tv';
const blocked = new Map();
function send(channel, value) { if (win && !win.isDestroyed()) win.webContents.send(channel, value); }
function trusted(e) { return win && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame && e.senderFrame.url === SHELL; }
function save() { fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings, null, 2)); }
app.whenReady().then(async () => {
  settings = normalizeSettings();
  try {
    const stored = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8'));
    settings = normalizeSettings(stored);
  } catch { /* Use safe defaults. */ }
  save();
  const local = session.fromPartition('persist:controls');
  const assets = new Set(['index.html', 'shell.js', 'style.css', 'routing.js', 'sync.html', 'sync.js']);
  local.protocol.handle('pokeflix-app', request => {
    const u = new URL(request.url), name = u.pathname.slice(1);
    return u.hostname === 'app' && assets.has(name) ? net.fetch(pathToFileURL(path.join(__dirname, name)).href) : new Response('Not found', { status: 404 });
  });
  win = new BrowserWindow({ width: 1280, height: 900, minWidth: 860, minHeight: 600, title: 'Pokeflix TV', backgroundColor: '#111827', webPreferences: { session: local, preload: path.join(__dirname, 'shell-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  Menu.setApplicationMenu(null);
  const remote = session.fromPartition('persist:pokeflix');
  view = new WebContentsView({ webPreferences: { session: remote, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  // Keep transparent player margins opaque, including pillarboxed videos.
  view.setBackgroundColor('#000000');
  win.contentView.addChildView(view);
  let playerFullscreen = false;
  const resize = () => {
    const [width, height] = win.getContentSize();
    const controlsHeight = playerFullscreen || win.isFullScreen() ? 0 : 56;
    send('fullscreen-state', controlsHeight === 0);
    win.setBackgroundColor(controlsHeight === 0 ? '#000000' : '#151515');
    view.setBounds({ x: 0, y: 0, width, height: Math.max(0, height - controlsHeight) });
  };
  win.on('resize', resize);
  win.on('enter-full-screen', resize);
  win.on('leave-full-screen', resize);
  resize();
  const syncView = new WebContentsView({ webPreferences: { session: local, preload: path.join(__dirname, 'shell-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.contentView.addChildView(syncView); syncView.setVisible(false);
  syncView.webContents.loadURL('pokeflix-app://app/sync.html');
  const syncTrusted = e => e.sender === syncView.webContents && e.senderFrame === syncView.webContents.mainFrame;
  ipcMain.handle('sync-offset', (e, value) => {
    if (!trusted(e) || !Number.isInteger(value) || value < 0 || value > 1000 || value % 25) throw Error('Invalid offset');
    settings.syncOffsets ||= {};
    if (settings.output) settings.syncOffsets[JSON.stringify(settings.output)] = value;
    save();
    syncView.setBounds(view.getBounds()); syncView.setVisible(value > 0);
    syncView.webContents.send('sync-offset', value);
  });
  win.on('resize', () => syncView.setBounds(view.getBounds()));
  ipcMain.on('sync-input', (e, event) => {
    if (!syncTrusted(e) || !event || !['mouseMove','mouseDown','mouseUp','mouseWheel','keyDown','keyUp','char'].includes(event.type)) return;
    const bounds = view.getBounds();
    if (event.type.startsWith('mouse') && (!Number.isFinite(event.x) || !Number.isFinite(event.y) || event.x < 0 || event.y < 0 || event.x > bounds.width || event.y > bounds.height)) return;
    try { view.webContents.sendInputEvent(event); } catch {}
  });
  syncView.webContents.on('console-message', (_e, ...args) => {});
  ipcMain.on('sync-failed', e => { if (syncTrusted(e)) { syncView.setVisible(false); send('page', 'Picture delay unavailable'); } });
  const wc = view.webContents;
  wc.setBackgroundThrottling(false);
  const exitFullscreen = () => {
    playerFullscreen = false;
    wc.executeJavaScript('if (document.fullscreenElement) document.exitFullscreen()').catch(() => {});
    win.setFullScreen(false);
    resize();
  };
  wc.on('enter-html-full-screen', () => {
    playerFullscreen = true;
    win.setFullScreen(true);
    resize();
  });
  wc.on('leave-html-full-screen', () => {
    playerFullscreen = false;
    win.setFullScreen(false);
    resize();
  });
  // Permanent mute prevents any source playback on Windows' default output.
  // Whole-tab capture receives audio even while this WebContents is muted.
  wc.setAudioMuted(true);
  remote.webRequest.onBeforeRequest((details, callback) => {
    const allow = requestAllowed(details, [...BASE_HOSTS, ...settings.resourceHosts]);
    if (!allow) {
      try {
        const u = new URL(details.url);
        if (u.protocol === 'https:') { blocked.set(u.hostname, { host: u.hostname, type: details.resourceType }); if (blocked.size > 100) blocked.delete(blocked.keys().next().value); send('blocked', [...blocked.values()]); }
      } catch { /* Invalid URLs stay blocked. */ }
    }
    callback({ cancel: !allow });
  });
  remote.on('will-download', e => e.preventDefault());
  remote.setPermissionCheckHandler((contents, permission) => contents === wc && permission === 'fullscreen');
  remote.setPermissionRequestHandler((contents, permission, cb) => cb(contents === wc && permission === 'fullscreen'));
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  for (const name of ['will-navigate', 'will-redirect']) wc.on(name, (e, url) => { if (!navigationAllowed(url)) e.preventDefault(); });
  wc.on('will-frame-navigate', e => {
    if (!(e.isMainFrame ? navigationAllowed(e.url) : requestAllowed({ url: e.url, resourceType: 'subFrame' }, [...BASE_HOSTS, ...settings.resourceHosts]))) e.preventDefault();
  });
  wc.on('did-finish-load', () => send('page', 'Ready'));
  wc.on('did-fail-load', (_e, code, description, _url, main) => { if (main && code !== -3) send('page', `Page failed: ${description}. Try Reload.`); });
  wc.on('render-process-gone', () => { captureAuthorized = false; send('stop-routing', 'Page stopped. Reload to recover.'); });
  win.webContents.on('render-process-gone', () => { captureAuthorized = false; win.close(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('did-start-navigation', (_e, _url, _inPlace, main) => { if (main) hostsUnlocked = false; });
  local.setPermissionCheckHandler((contents, permission) => [win.webContents, syncView.webContents].includes(contents) && ['speaker-selection', 'display-capture'].includes(permission));
  local.setPermissionRequestHandler((contents, permission, cb) => cb(contents === win.webContents && ['speaker-selection', 'display-capture'].includes(permission)));
  local.setDisplayMediaRequestHandler((request, cb) => {
    if (!captureAuthorized || ![win.webContents.mainFrame, syncView.webContents.mainFrame].includes(request.frame) || !['pokeflix-app://app', 'pokeflix-app://app/'].includes(request.securityOrigin) || wc.isDestroyed()) return cb(null);
    cb({ video: wc.mainFrame, audio: wc.mainFrame, enableLocalEcho: false });
  });
  ipcMain.handle('initialize', e => { if (!trusted(e)) throw Error('Untrusted sender'); return { settings, blocked: [...blocked.values()] }; });
  ipcMain.handle('begin-routing', e => { if (!trusted(e)) throw Error('Untrusted sender'); captureAuthorized = true; return true; });
  ipcMain.handle('save-output', (e, output) => {
    if (!trusted(e) || !output || typeof output.id !== 'string' || typeof output.label !== 'string' || !output.id || ['default', 'communications'].includes(output.id)) throw Error('Select an explicit output');
    settings.output = { id: output.id, label: output.label }; save();
  });
  ipcMain.on('stop-routing', e => { if (trusted(e)) { captureAuthorized = false; syncView.setVisible(false); syncView.webContents.send('sync-offset', 0); } });
  ipcMain.handle('unlock-settings', (e, password) => {
    if (!trusted(e)) throw Error('Untrusted sender');
    hostsUnlocked = typeof password === 'string' && password === SETTINGS_PASSWORD;
    if (hostsUnlocked) send('settings-visible', true);
    return hostsUnlocked;
  });
  ipcMain.handle('resource-host', (e, action, input) => {
    if (!trusted(e)) throw Error('Untrusted sender');
    if (!hostsUnlocked) throw Error('Unlock parent settings before changing allowed hosts.');
    const host = parseHost(input);
    if (action === 'add' && !BASE_HOSTS.includes(host) && !settings.resourceHosts.includes(host)) settings.resourceHosts.push(host);
    else if (action === 'remove') settings.resourceHosts = settings.resourceHosts.filter(item => item !== host);
    save(); return settings.resourceHosts;
  });
  ipcMain.on('command', (e, command) => {
    if (!trusted(e)) return;
    if (command === 'home') wc.loadURL('https://www.pokeflix.tv/').catch(() => {});
    if (command === 'reload') wc.reload();
    if (command === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (command === 'fullscreen') {
      if (win.isFullScreen() || playerFullscreen) exitFullscreen();
      else { win.setFullScreen(true); resize(); wc.focus(); }
    }
    if (command === 'settings') { hostsUnlocked = false; view.setVisible(false); syncView.setVisible(false); send('settings-auth', true); }
    if (command === 'close-settings') { hostsUnlocked = false; view.setVisible(true); }
  });
  for (const contents of [win.webContents, wc]) contents.on('before-input-event', (_e, input) => { if (input.type === 'keyDown' && input.key === 'Escape') { hostsUnlocked = false; exitFullscreen(); view.setVisible(true); send('settings-visible', false); } });
  win.on('closed', () => { captureAuthorized = false; if (!wc.isDestroyed()) wc.close(); win = null; });
  await win.loadURL(SHELL);
  wc.loadURL('https://www.pokeflix.tv/').catch(() => {});
}).catch(error => { console.error(error); app.quit(); });
app.on('window-all-closed', () => app.quit());
