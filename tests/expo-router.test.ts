import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/process.js', () => ({ execute: vi.fn().mockResolvedValue(0) }));
import { execute } from '../packages/cli/src/process.js';
import { expoSdk, patchExpoNative, prepareExpoRouter, setupExpoRouter } from '../packages/cli/src/expo-router.js';
const roots: string[] = [];
afterEach(() => { vi.clearAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rnx-expo-bare-')); roots.push(root);
  const main = join(root, 'android/app/src/main'); mkdirSync(join(main, 'java/com/app'), { recursive: true });
  mkdirSync(join(root, 'ios/App'), { recursive: true }); mkdirSync(join(root, 'node_modules/expo/bin'), { recursive: true });
  writeFileSync(join(root, 'node_modules/expo/package.json'), JSON.stringify({ name: 'expo', exports: { './bin/cli': './bin/cli' } }));
  writeFileSync(join(root, 'node_modules/expo/bin/cli'), '');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-native': '0.88.1' } }));
  writeFileSync(join(root, 'app.json'), JSON.stringify({ name: 'App', displayName: 'App' }));
  writeFileSync(join(main, 'java/com/app/MainActivity.kt'), 'package com.app\nclass MainActivity : ReactActivity() {\n override fun getMainComponentName(): String = "App"\n}');
  writeFileSync(join(main, 'AndroidManifest.xml'), '<manifest><application /></manifest>');
  writeFileSync(join(root, 'ios/App/AppDelegate.swift'), 'class AppDelegate: ExpoAppDelegate {}');
  writeFileSync(join(root, 'ios/App/SceneDelegate.swift'), 'class SceneDelegate: RCTDefaultReactNativeFactoryDelegate {}');
  writeFileSync(join(root, 'ios/Podfile'), 'platform :ios, min_ios_version_supported\nuse_expo_modules!');
  return root;
}
it('sets up a bare project with compatible Expo SDK and deferred installation', () => {
  const root = fixture(); prepareExpoRouter(root);
  expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).main).toBe('expo-router/entry');
  expect(JSON.parse(readFileSync(join(root, '.rnx-expo-router-setup.json'), 'utf8'))).toEqual({ sdk: 58, stage: 'install' });
  expect(() => expoSdk('0.87.0')).toThrow('supported Expo SDK');
});
it('finishes the deferred setup using the selected manager and patches both native entry points', async () => {
  const root = fixture(); prepareExpoRouter(root);
  expect(await setupExpoRouter(root, 'pnpm')).toBe(0);
  expect(vi.mocked(execute).mock.calls.map((call) => call[0])).toEqual(['pnpm', 'npx', process.execPath, process.execPath, process.execPath]);
  expect(vi.mocked(execute).mock.calls[1][1]).toContain('58.0.0');
  expect(vi.mocked(execute).mock.calls[2][1]).toContain('--pnpm');
  expect(vi.mocked(execute).mock.calls[2][1]).toContain('react-native-worklets');
  expect(vi.mocked(execute).mock.calls[3][1]).toContain('@types/react');
  expect(vi.mocked(execute).mock.calls[4][1]).toContain('--check');
  expect(existsSync(join(root, '.rnx-expo-router-setup.json'))).toBe(false);
  expect(readFileSync(join(root, 'android/app/src/main/java/com/app/MainActivity.kt'), 'utf8')).toContain('getMainComponentName(): String = "main"');
  expect(readFileSync(join(root, 'android/app/src/main/java/com/app/MainActivity.kt'), 'utf8')).toContain('RNScreensFragmentFactory()');
  expect(readFileSync(join(root, 'ios/App/SceneDelegate.swift'), 'utf8')).toContain('ExpoAppSceneDelegate');
  expect(readFileSync(join(root, 'ios/App/AppDelegate.swift'), 'utf8')).toContain('.expo/.virtual-metro-entry');
  expect(readFileSync(join(root, 'ios/Podfile'), 'utf8')).toContain("platform :ios, '16.4'");
});
it('retains the setup marker if the installer fails', async () => {
  const root = fixture(); prepareExpoRouter(root);
  vi.mocked(execute).mockResolvedValueOnce(0).mockResolvedValueOnce(7);
  expect(await setupExpoRouter(root, 'npm')).toBe(7);
  expect(JSON.parse(readFileSync(join(root, '.rnx-expo-router-setup.json'), 'utf8')).stage).toBe('native');
});
it('is safe to retry the native modifications', () => {
  const root = fixture(); patchExpoNative(root, 58); patchExpoNative(root, 58);
  const activity = readFileSync(join(root, 'android/app/src/main/java/com/app/MainActivity.kt'), 'utf8');
  expect(activity.match(/override fun onCreate/g)).toHaveLength(1);
});

it('uses the Expo entry and module name with older SDK iOS delegates', () => {
  const root = fixture();
  writeFileSync(join(root, 'ios/App/AppDelegate.swift'), 'class AppDelegate: ExpoAppDelegate { func launch() { factory.startReactNative(withModuleName: "App") }; func bundle() { jsBundleURL(forBundleRoot: "index") } }');
  patchExpoNative(root, 56);
  const delegate = readFileSync(join(root, 'ios/App/AppDelegate.swift'), 'utf8');
  expect(delegate).toContain('withModuleName: "main"');
  expect(delegate).toContain('.expo/.virtual-metro-entry');
});
