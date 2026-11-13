import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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
  expect(result.stdout).toContain('NATIVE run-android --deviceId emulator-5554 --port 8082 --no-packager');
  expect(result.stderr).toContain('ORIGINAL ERROR');
});
it('creates through npx, saves the chosen manager, and respects no-install', () => {
  tool('npx', `const fs=require('node:fs'), path=require('node:path'); const args=process.argv.slice(2); const destination=args[args.indexOf('--directory')+1]; fs.mkdirSync(destination); fs.mkdirSync(path.join(destination,'android')); fs.mkdirSync(path.join(destination,'ios')); fs.writeFileSync(path.join(destination,'App.tsx'),'default app'); fs.writeFileSync(path.join(destination,'index.js'),"import App from './App';"); fs.writeFileSync(path.join(destination,'package.json'), JSON.stringify({name:'Created',dependencies:{'react-native':'0.85.0'}})); console.log('OFFICIAL INIT',args.join(' '));`);
  const destination = join(root, 'Created');
  const result = spawnSync(process.execPath, [entry, 'create', 'Created', '--directory', destination, '--version', '0.85.0', '--pm', 'pnpm', '--no-install'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('@react-native-community/cli@20 init Created');
  expect(JSON.parse(readFileSync(join(destination, 'rnx.config.json'), 'utf8')).packageManager).toBe('pnpm');
});
it('routes package additions to the selected manager and preserves package-manager errors', () => {
  tool('npm', "console.log('PACKAGES', process.argv.slice(2).join(' ')); process.exit(9);");
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '*' }, packageManager: 'npm@11.0.0' }));
  const result = spawnSync(process.execPath, [entry, 'add', 'example@1.0.0', '--dev'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(9);
  expect(result.stdout).toContain('PACKAGES install example@1.0.0 --save-dev');
});

it('rejects the removed pub command', () => {
  const result = spawnSync(process.execPath, [entry, 'pub', 'get'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("unknown command 'pub'");
});

it('creates a selected starter without installing dependencies', () => {
  tool('npx', `const fs=require('node:fs'), path=require('node:path'); const args=process.argv.slice(2); const dest=args[args.indexOf('--directory')+1]; const main=path.join(dest,'android/app/src/main'); fs.mkdirSync(path.join(main,'java/com/example'),{recursive:true}); fs.mkdirSync(path.join(dest,'ios')); fs.writeFileSync(path.join(dest,'package.json'),JSON.stringify({dependencies:{'react-native':'0.85.0'}})); fs.writeFileSync(path.join(dest,'App.tsx'),'default'); fs.writeFileSync(path.join(dest,'index.js'),"import App from './App';"); fs.writeFileSync(path.join(main,'java/com/example/MainActivity.kt'),'package com.example\\nclass MainActivity : ReactActivity() {}'); fs.writeFileSync(path.join(main,'AndroidManifest.xml'),'<manifest><application /></manifest>');`);
  tool('pnpm', "console.error('unexpected install'); process.exit(9);");
  const destination = join(root, 'Created');
  const result = spawnSync(process.execPath, [entry, 'create', 'Created', '--directory', destination, '--pm', 'pnpm', '--router', 'react-navigation', '--store', 'zustand', '--version', '0.85.0', '--no-install'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).not.toContain('unexpected install');
  expect(JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8')).dependencies).toHaveProperty('zustand');
  expect(readFileSync(join(destination, 'src/App.tsx'), 'utf8')).toContain('NavigationContainer');
});

it('creates a bare React Native project with deferred Expo Router setup', () => {
  tool('npx', `const fs=require('node:fs'), path=require('node:path'); const args=process.argv.slice(2); const dest=args[args.indexOf('--directory')+1]; fs.mkdirSync(path.join(dest,'android'),{recursive:true}); fs.mkdirSync(path.join(dest,'ios')); fs.writeFileSync(path.join(dest,'package.json'), JSON.stringify({dependencies:{'react-native':'0.88.1'}})); fs.writeFileSync(path.join(dest,'app.json'),JSON.stringify({name:'ExpoProject',displayName:'ExpoProject'})); fs.writeFileSync(path.join(dest,'App.tsx'),'default'); fs.writeFileSync(path.join(dest,'index.js'),"import App from './App';"); console.log('COMMUNITY',args.join(' '));`);
  tool('pnpm', "console.error('unexpected install'); process.exit(9);");
  const destination = join(root, 'ExpoProject');
  const result = spawnSync(process.execPath, [entry, 'create', 'ExpoProject', '--directory', destination, '--version', '0.88.1', '--router', 'expo-router', '--store', 'redux', '--pm', 'pnpm', '--no-install', '--no-git'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('@react-native-community/cli@20 init');
  expect(result.stderr).not.toContain('unexpected install');
  expect(existsSync(join(destination, 'android'))).toBe(true);
  expect(existsSync(join(destination, 'ios'))).toBe(true);
  expect(existsSync(join(destination, '.rnx-expo-router-setup.json'))).toBe(true);
  expect(readFileSync(join(destination, 'src/app/_layout.tsx'), 'utf8')).toContain('<Provider store={store}>');
  expect(JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8')).main).toBe('expo-router/entry');
  expect(JSON.parse(readFileSync(join(destination, 'rnx.config.json'), 'utf8')).packageManager).toBe('pnpm');
});

it('stages an upgrade in a separate worktree without changing the original project', () => {
  tool('npx', `const fs=require('node:fs'); const path=require('node:path'); const a=process.argv.slice(2); const dest=a[a.indexOf('--directory')+1]; fs.mkdirSync(dest,{recursive:true}); fs.writeFileSync(path.join(dest,'package.json'),JSON.stringify({dependencies:{react:'19.3.0','react-native':'0.88.1'},devDependencies:{'@react-native/metro-config':'0.88.1'}}));`);
  tool('npm', "console.log('dependency installation simulated');");
  const project = join(root, 'App'); mkdirSync(project);
  const original = JSON.stringify({ dependencies: { react: '18.3.0', 'react-native': '0.80.0', 'my-app-lib': '1.0.0' }, devDependencies: { '@react-native/metro-config': '0.80.0' } }, null, 2);
  writeFileSync(join(project, 'package.json'), original);
  writeFileSync(join(project, 'App.tsx'), 'user app');
  for (const args of [['init'], ['config', 'user.email', 'test@example.invalid'], ['config', 'user.name', 'Test'], ['add', '.'], ['commit', '-m', 'initial']]) {
    const git = spawnSync('git', args, { cwd: project, env, encoding: 'utf8' });
    expect(git.status, git.stderr).toBe(0);
  }
  const staged = join(root, 'staged');
  const result = spawnSync(process.execPath, [entry, 'upgrade', '0.88.1', '--directory', staged], { cwd: project, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(join(project, 'package.json'), 'utf8')).toBe(original);
  const updated = JSON.parse(readFileSync(join(staged, 'package.json'), 'utf8'));
  expect(updated.dependencies).toMatchObject({ react: '19.3.0', 'react-native': '0.88.1', 'my-app-lib': '1.0.0' });
  expect(readFileSync(join(staged, 'App.tsx'), 'utf8')).toBe('user app');
  expect(result.stdout).toContain('Review and apply native/template changes');
});
it('refuses to stage an upgrade when the source project has uncommitted changes', () => {
  const project = join(root, 'Dirty'); mkdirSync(project);
  writeFileSync(join(project, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.80.0' } }));
  expect(spawnSync('git', ['init'], { cwd: project, env }).status).toBe(0);
  const staged = join(root, 'dirty-staged');
  const result = spawnSync(process.execPath, [entry, 'upgrade', '0.88.1', '--directory', staged], { cwd: project, env, encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Commit or stash');
  expect(existsSync(staged)).toBe(false);
});

it('refuses an upgrade when the project has conflicting lockfiles', () => {
  const project = join(root, 'Conflicting'); mkdirSync(project);
  writeFileSync(join(project, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.80.0' } }));
  writeFileSync(join(project, 'package-lock.json'), '{}');
  writeFileSync(join(project, 'yarn.lock'), '');
  for (const args of [['init'], ['config', 'user.email', 'test@example.invalid'], ['config', 'user.name', 'Test'], ['add', '.'], ['commit', '-m', 'initial']]) {
    const git = spawnSync('git', args, { cwd: project, env, encoding: 'utf8' });
    expect(git.status, git.stderr).toBe(0);
  }
  const staged = join(root, 'conflicting-staged');
  const result = spawnSync(process.execPath, [entry, 'upgrade', '0.88.1', '--directory', staged], { cwd: project, env, encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/lockfiles/i);
  expect(existsSync(staged)).toBe(false);
});
it('directs Expo projects to SDK-based upgrades before changing files', () => {
  const project = join(root, 'Expo'); mkdirSync(project);
  const original = JSON.stringify({ dependencies: { expo: '~58.0.0', 'react-native': '0.88.1' } });
  writeFileSync(join(project, 'package.json'), original);
  const result = spawnSync(process.execPath, [entry, 'upgrade', '0.89.0'], { cwd: project, env, encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Expo projects must be upgraded by Expo SDK');
  expect(readFileSync(join(project, 'package.json'), 'utf8')).toBe(original);
});

it('starts Expo Metro for a bare Expo Router project', () => {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ main: 'expo-router/entry', dependencies: { 'react-native': '0.88.1' } }));
  const expoDir = join(root, 'node_modules/expo'); mkdirSync(join(expoDir, 'bin'), { recursive: true });
  writeFileSync(join(expoDir, 'package.json'), JSON.stringify({ name: 'expo', exports: { './bin/cli': './bin/cli.js' } }));
  writeFileSync(join(expoDir, 'bin/cli.js'), "console.log('EXPO', process.argv.slice(2).join(' ')); process.exit(6);");
  const result = spawnSync(process.execPath, [entry, 'start', '--port', '8090', '--reset-cache'], { cwd: root, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(6);
  expect(result.stdout).toContain('EXPO start --port 8090 --clear');
});
