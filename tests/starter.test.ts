import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { configureStarter, screensVersion } from '../packages/cli/src/starter.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(version = '0.85.0') {
  const root = mkdtempSync(join(tmpdir(), 'rnx-starter-')); roots.push(root);
  const main = join(root, 'android/app/src/main');
  mkdirSync(join(main, 'java/com/example'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': version } }));
  writeFileSync(join(root, 'App.tsx'), 'default app');
  writeFileSync(join(root, 'index.js'), "import App from './App';\nAppRegistry.registerComponent('App', () => App);\n");
  writeFileSync(join(main, 'java/com/example/MainActivity.kt'), 'package com.example\n\nclass MainActivity : ReactActivity() {\n}\n');
  writeFileSync(join(main, 'AndroidManifest.xml'), '<manifest><application></application></manifest>');
  return root;
}
it('configures navigation, Android, and a working Zustand example without installing', () => {
  const root = fixture();
  configureStarter(root, 'react-navigation', 'zustand');
  const deps = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies;
  expect(deps).toMatchObject({ '@react-navigation/native': '^7.0.0', 'react-native-screens': '~4.26.0', zustand: '^5.0.0' });
  expect(readFileSync(join(root, 'src/App.tsx'), 'utf8')).toContain('<Stack.Screen name="Home" component={HomeScreen}');
  expect(readFileSync(join(root, 'src/store.ts'), 'utf8')).toContain('useCounter');
  expect(readFileSync(join(root, 'android/app/src/main/java/com/example/MainActivity.kt'), 'utf8')).toContain('supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()');
  expect(readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8')).toContain('android:enableOnBackInvokedCallback="false"');
});
it('leaves files untouched for an unsupported React Native version', () => {
  const root = fixture('0.89.0');
  expect(() => configureStarter(root, 'react-navigation', 'none')).toThrow('0.76–0.88');
  expect(readFileSync(join(root, 'App.tsx'), 'utf8')).toBe('default app');
});
it('configures Zustand without requiring Android changes', () => {
  const root = fixture();
  configureStarter(root, 'none', 'zustand');
  expect(readFileSync(join(root, 'src/store.ts'), 'utf8')).toContain('useCounter');
  expect(readFileSync(join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8')).not.toContain('enableOnBackInvokedCallback');
});

it('selects screens versions for the actual React Native version', () => {
  expect(screensVersion('0.76.9')).toEqual({ version: '~4.4.0', factory: false });
  expect(screensVersion('0.80.0').version).toBe('~4.14.0');
  expect(screensVersion('0.85.0').version).toBe('~4.26.0');
  expect(screensVersion('0.88.1').version).toBe('~4.30.0');
  expect(() => screensVersion('latest')).toThrow('Cannot determine');
});
it.each(['redux', 'jotai'])('wires %s into the generated starter', (store) => {
  const root = fixture('0.88.1');
  configureStarter(root, 'react-navigation', store);
  const deps = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies;
  expect(deps[store === 'redux' ? '@reduxjs/toolkit' : 'jotai']).toBeDefined();
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  expect(app).toContain(store === 'redux' ? '<Provider store={store}>' : 'useAtom(counterAtom)');
  expect(readFileSync(join(root, 'src/store.ts'), 'utf8')).toContain(store === 'redux' ? 'configureStore' : 'counterAtom');
  expect(deps['react-native-screens']).toBe('~4.30.0');
});
it('configures the Expo Router template with Redux', () => {
  const root = fixture('0.88.1');
  mkdirSync(join(root, 'src/app'), { recursive: true });
  writeFileSync(join(root, 'src/app/_layout.tsx'), 'expo layout');
  writeFileSync(join(root, 'src/app/index.tsx'), 'expo index');
  configureStarter(root, 'expo-router', 'redux');
  expect(readFileSync(join(root, 'src/app/_layout.tsx'), 'utf8')).toContain("from 'expo-router'");
  expect(readFileSync(join(root, 'src/app/_layout.tsx'), 'utf8')).toContain('<Provider store={store}>');
  expect(readFileSync(join(root, 'src/store.ts'), 'utf8')).toContain('configureStore');
});

it('keeps the React Native entry point while moving app code and local imports into src', () => {
  const root = fixture();
  writeFileSync(join(root, 'App.tsx'), "import Header from './Header';\nimport './styles';\nexport default Header;\n");
  writeFileSync(join(root, 'index.js'), "import App from './App';\n");
  configureStarter(root, 'none', 'none');
  expect(existsSync(join(root, 'App.tsx'))).toBe(false);
  expect(readFileSync(join(root, 'index.js'), 'utf8')).toContain('./src/App');
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  expect(app).toContain("from '../Header'");
  expect(app).toContain("import '../styles'");
});
it('removes the redundant root App wrapper and registers src/App directly', () => {
  const root = fixture();
  configureStarter(root, 'none', 'none');
  expect(existsSync(join(root, 'App.tsx'))).toBe(false);
  expect(readFileSync(join(root, 'index.js'), 'utf8')).toContain("import App from './src/App'");
});
