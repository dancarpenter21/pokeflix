const { spawn } = require('node:child_process');
const path = require('node:path');
const electron = require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.join(__dirname, 'integration.cjs')], { stdio: 'inherit', windowsHide: true, env });
const timeout = setTimeout(() => { child.kill(); process.exitCode = 1; console.error('Integration test timed out'); }, 45000);
child.on('error', error => { clearTimeout(timeout); console.error(error); process.exitCode = 1; });
child.on('exit', code => { clearTimeout(timeout); process.exitCode = code === 0 ? 0 : 1; });
