import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';
const entry = resolve('packages/cli/dist/index.js');
let root: string;
let env: NodeJS.ProcessEnv;
function tool(name: string, script: string) {
  const js = join(root, `${name}.cjs`); writeFileSync(js, script);
  const path = join(root, process.platform === 'win32' ? `${name}.cmd` : name);
  writeFileSync(path, process.platform === 'win32' ? `@echo off\r\n"${process.execPath}" "${js}" %*\r\nexit /b %errorlevel%\r\n` : `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`, { mode: 0o755 });
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rnx-e2e-'));
  env = { ...process.env, PATH: root + (process.platform === 'win32' ? ';' : ':') + process.env.PATH, ANDROID_HOME: root, ANDROID_SDK_ROOT: root, NO_COLOR: '1' };
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
it('streams original local CLI output and keeps its exit code through the real executable', () => {
  tool('adb', "console.log('List of devices attached'); console.log('emulator-5554 device model:Pixel_8');");
  const cli = join(root, 'node_modules/@react-native-community/cli'); mkdirSync(cli, { recursive: true }); mkdirSync(join(root, 'android'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.85.0' } }));
  writeFileSync(join(cli, 'package.json'), JSON.stringify({ bin: { 'rnc-cli': 'bin.cjs' } }));
  writeFileSync(join(cli, 'bin.cjs'), "console.log('NATIVE', process.argv.slice(2).join(' ')); console.error('ORIGINAL ERROR'); process.exit(7);");
  const result = spawnSync(process.execPath, [entry, 'run', 'android', '--port', '8082'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(7);
  expect(result.stdout).toContain('NATIVE run-android --deviceId emulator-5554 --port 8082');
  expect(result.stderr).toContain('ORIGINAL ERROR');
});
it('creates through npx, saves the chosen manager, and respects no-install', () => {
  tool('npx', `const fs=require('node:fs'), path=require('node:path'); const args=process.argv.slice(2); const destination=args[args.indexOf('--directory')+1]; fs.mkdirSync(destination); fs.mkdirSync(path.join(destination,'android')); fs.mkdirSync(path.join(destination,'ios')); fs.writeFileSync(path.join(destination,'package.json'), JSON.stringify({name:'Created',dependencies:{'react-native':'0.85.0'}})); console.log('OFFICIAL INIT',args.join(' '));`);
  const destination = join(root, 'Created');
  const result = spawnSync(process.execPath, [entry, 'create', 'Created', '--directory', destination, '--version', '0.85.0', '--pm', 'pnpm', '--no-install'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('@react-native-community/cli@20 init Created');
  expect(JSON.parse(readFileSync(join(destination, 'rnx.config.json'), 'utf8')).packageManager).toBe('pnpm');
});
it('routes package additions to the selected manager and preserves package-manager errors', () => {
  tool('npm', "console.log('PACKAGES', process.argv.slice(2).join(' ')); process.exit(9);");
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '*' }, packageManager: 'npm@11.0.0' }));
  const result = spawnSync(process.execPath, [entry, 'pub', 'add', 'example@1.0.0', '--dev'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(9);
  expect(result.stdout).toContain('PACKAGES install example@1.0.0 --save-dev');
});
