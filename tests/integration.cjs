const { app, session, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pokeflix-test-'));
app.setPath('userData', profile);
let remoteRequests = [];
app.whenReady().then(async () => {
  // All remote content is synthetic: the test never contacts the live site.
  session.fromPartition('persist:pokeflix').protocol.handle('https', request => {
    remoteRequests.push(request.url);
    return new Response('<!doctype html><title>Fixture</title><style>body{background:#181818;color:#000000}nav{background:#242424}a{color:#e53935}</style><nav>Fixture navigation</nav><a id="outside" href="https://evil.test/">Outside</a><a id="inside" href="https://www.pokeflix.tv/episode">Episode</a><img src="https://blocked.example.com/image.png"><iframe src="https://blocked.example.com/player"></iframe>', { headers: { 'content-type': 'text/html' } });
  });
});
require('../main');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(predicate, message) {
  for (let i = 0; i < 100; i++) { const value = await predicate(); if (value) return value; await delay(100); }
  throw Error(message);
}
app.whenReady().then(async () => {
  try {
    const win = await until(() => BrowserWindow.getAllWindows()[0], 'No window');
    const shell = win.webContents;
    await until(() => shell.getURL().startsWith('pokeflix-app:') && !shell.isLoading(), 'Shell failed to load');
    const remoteView = win.contentView.children.find(v => v.webContents && v.webContents !== shell);
    const source = remoteView.webContents;
    await until(() => source.getTitle() === 'Fixture', 'Fixture failed to load');
    assert.equal(source.isAudioMuted(), true);
    assert.equal(remoteView.getBounds().y, 0);
    assert.equal(remoteView.getBounds().height, win.getContentSize()[1] - 56);
    assert.equal(await shell.executeJavaScript('Math.abs(document.querySelector(".app-controls").getBoundingClientRect().bottom - innerHeight) <= 1'), true);
    assert.deepEqual(await shell.executeJavaScript(`['.app-controls', '#status', 'button', 'select', 'input'].map(selector => getComputedStyle(document.querySelector(selector)).color)`), Array(5).fill('rgb(238, 238, 238)'));
    assert.equal(await shell.executeJavaScript('document.querySelectorAll("#connect, #mute, [data-command=home], [data-command=fullscreen]").length'), 0);
    assert.equal(await shell.executeJavaScript('document.querySelector(".app-controls").getBoundingClientRect().height'), 56);
    assert.deepEqual(await shell.executeJavaScript('Array.from(document.querySelectorAll(".icon-button"), b => [b.getAttribute("aria-label"), b.title, b.textContent.includes("?")])'), [['Back', 'Back', false], ['Reload page', 'Reload page', false], ['Refresh audio outputs', 'Refresh audio outputs', false], ['Settings', 'Settings', false]]);
    if (process.env.POKEFLIX_QA_SCREENSHOT) fs.writeFileSync(process.env.POKEFLIX_QA_SCREENSHOT, (await shell.capturePage()).toPNG());
    const assertFullscreenBackdrop = async () => {
      await until(() => shell.executeJavaScript('document.documentElement.classList.contains("fullscreen")'), 'Fullscreen backdrop missing');
      assert.equal(await shell.executeJavaScript('getComputedStyle(document.documentElement).backgroundColor'), 'rgb(0, 0, 0)');
      assert.equal(await shell.executeJavaScript('getComputedStyle(document.querySelector(".app-controls")).visibility'), 'hidden');
    };
    const fillsWindow = () => {
      const [width, height] = win.getContentSize();
      assert.deepEqual(remoteView.getBounds(), { x: 0, y: 0, width, height });
    };
    await shell.executeJavaScript('controls.command("fullscreen")');
    await until(() => win.isFullScreen(), 'Toolbar did not fullscreen the window');
    fillsWindow();
    await assertFullscreenBackdrop();
    source.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    source.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await until(() => !win.isFullScreen() && remoteView.getBounds().height === win.getContentSize()[1] - 56, 'Escape did not restore the toolbar');
    await until(() => shell.executeJavaScript('getComputedStyle(document.querySelector(".app-controls")).visibility === "visible"'), 'Controls did not restore');
    await source.executeJavaScript('document.documentElement.requestFullscreen()', true);
    await until(() => win.isFullScreen() && remoteView.getBounds().y === 0, 'Player did not fullscreen the window');
    fillsWindow();
    await assertFullscreenBackdrop();
    await source.executeJavaScript('document.exitFullscreen()');
    await until(() => !win.isFullScreen() && remoteView.getBounds().height === win.getContentSize()[1] - 56, 'Player exit did not restore the window');
    await until(() => shell.executeJavaScript('typeof controls !== "undefined" && document.querySelector("#outputs").options.length > 1'), 'Outputs not exposed');
    await source.executeJavaScript('document.querySelector("#outside").click()'); await delay(200);
    assert.equal(source.getURL(), 'https://www.pokeflix.tv/');
    assert.equal(remoteRequests.some(u => u.includes('evil.test') || u.includes('blocked.example.com')), false);
    await source.executeJavaScript('window.open("https://evil.test/")'); await delay(100);
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    assert.equal(await shell.executeJavaScript('controls.resourceHost("add", "unapproved.example.com").then(()=>false,()=>true)'), true);
    assert.equal(await shell.executeJavaScript('controls.resourceHost("remove", "cdn.jsdelivr.net").then(()=>false,()=>true)'), true);
    await shell.executeJavaScript('document.querySelector("[data-command=settings]").click()');
    await until(() => !remoteView.getVisible(), 'Settings did not hide remote content');
    assert.equal(await shell.executeJavaScript('document.querySelector("#settings").hidden'), true);
    await until(() => shell.executeJavaScript('!document.querySelector("#settings-auth").hidden'), 'Password form missing');
    await shell.executeJavaScript('document.querySelector("#settings-password").value="wrong";document.querySelector("#unlock-form").requestSubmit()');
    await until(() => shell.executeJavaScript('document.querySelector("#auth-error").textContent.includes("Incorrect")'), 'Wrong password not rejected');
    assert.equal(await shell.executeJavaScript('document.querySelector("#settings").hidden'), true);
    await shell.executeJavaScript('document.querySelector("#settings-password").value="pokeflix.tv";document.querySelector("#unlock-form").requestSubmit()');
    await until(() => shell.executeJavaScript('!document.querySelector("#settings").hidden'), 'Correct password did not unlock');
    assert.equal(await shell.executeJavaScript('document.querySelector("#settings").hidden'), false);
    assert.equal(await shell.executeJavaScript('document.querySelector("#settings-password").value'), '');
    assert.equal(await shell.executeJavaScript('controls.resourceHost("add", "approved.example.com").then(hosts=>hosts.includes("approved.example.com"))'), true);
    assert.equal(await shell.executeJavaScript('controls.resourceHost("remove", "approved.example.com").then(hosts=>!hosts.includes("approved.example.com"))'), true);
    await shell.executeJavaScript('document.querySelector("#close-settings").click()');
    await until(() => remoteView.getVisible(), 'Done did not restore page');
    assert.equal(await shell.executeJavaScript('controls.resourceHost("add", "unapproved.example.com").then(()=>false,()=>true)'), true);
    await shell.executeJavaScript('document.querySelector("[data-command=settings]").click()');
    await until(() => shell.executeJavaScript('!document.querySelector("#settings-auth").hidden'), 'Reopening did not lock settings');
    await shell.executeJavaScript('document.querySelector("#cancel-unlock").click()');
    await until(() => remoteView.getVisible(), 'Cancel did not restore playback');
    assert.equal(await shell.executeJavaScript('navigator.mediaDevices.getUserMedia({audio:true}).then(()=>false,()=>true)'), true);
    // Set volume to zero in the test only; do not emit a tone on the user's speakers.
    await shell.executeJavaScript(`const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.volume=0;return originalPlay.call(this)};document.querySelector('#outputs').selectedIndex=1;document.querySelector('#outputs').dispatchEvent(new Event('change'))`);
    await until(() => shell.executeJavaScript('document.querySelector("#status").textContent.startsWith("Audio →")'), 'Routing did not start');
    assert.equal(source.isAudioMuted(), true);
    await source.executeJavaScript('window.ctx=new AudioContext();window.osc=ctx.createOscillator();osc.connect(ctx.destination);osc.start();ctx.resume()', true);
    const peak = await shell.executeJavaScript(`(async()=>{const ctx=new AudioContext();await ctx.resume();const analyser=ctx.createAnalyser();ctx.createMediaStreamSource(stream).connect(analyser);await new Promise(r=>setTimeout(r,400));const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);await ctx.close();return Math.max(...data)})()`, true);
    assert.ok(peak > 0.01, `Muted source audio was not captured: ${peak}`);
    assert.equal(await shell.executeJavaScript('player.sinkId === saved.id && !["default","communications", ""].includes(player.sinkId)'), true);
    await source.reload();
    await until(() => !source.isLoading(), 'Reload did not finish');
    assert.equal(source.isAudioMuted(), true);
    assert.equal(await shell.executeJavaScript('stream.getAudioTracks()[0].readyState'), 'live');
    await shell.executeJavaScript('navigator.mediaDevices.dispatchEvent(new Event("devicechange"))');
    assert.equal(await shell.executeJavaScript('stream === null && player === null'), true);
    await shell.executeJavaScript('document.querySelector("#refresh").click()');
    await until(() => shell.executeJavaScript('document.querySelector("#status").textContent.startsWith("Audio →")'), 'Reconnect failed');
    await shell.executeJavaScript('document.querySelector("#outputs").value="";document.querySelector("#outputs").dispatchEvent(new Event("change"))');
    assert.equal(await shell.executeJavaScript('stream === null && player === null'), true);
    assert.equal(source.isAudioMuted(), true);
    await shell.executeJavaScript('document.querySelector("#outputs").value="";document.querySelector("#outputs").dispatchEvent(new Event("change"))');
    assert.equal(await shell.executeJavaScript('stream === null && player === null'), true);
    await shell.executeJavaScript('document.querySelector("#outputs").selectedIndex=1;document.querySelector("#outputs").dispatchEvent(new Event("change"));document.querySelector("#outputs").dispatchEvent(new Event("change"))');
    await until(() => shell.executeJavaScript('active && player.sinkId === document.querySelector("#outputs").value'), 'Rapid selection changes did not connect');
    await shell.reload();
    await until(() => !shell.isLoading(), 'Shell reload did not finish');
    await until(() => shell.executeJavaScript('typeof active !== "undefined" && active && player.sinkId === document.querySelector("#outputs").value'), 'Saved output did not connect automatically at startup');
    await shell.executeJavaScript('document.querySelector("#outputs").value="";document.querySelector("#outputs").dispatchEvent(new Event("change"))');
    assert.equal(source.isAudioMuted(), true);
    console.log('PASS: sandboxed shell, navigation/iframe/popup blocking, settings, denied microphone, explicit audio sink, muted-source Web Audio capture, and stop teardown');
    app.exit(0);
  } catch (error) {
    const shell = BrowserWindow.getAllWindows()[0]?.webContents;
    if (shell) console.error('STATUS:', await shell.executeJavaScript('document.querySelector("#status")?.textContent').catch(() => 'Unavailable'));
    console.error(error); app.exit(1);
  }
});
