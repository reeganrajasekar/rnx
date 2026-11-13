import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { androidSdk, androidEnvironment, androidTool } from '../packages/cli/src/sdk.js';
let root: string;
afterEach(() => { vi.unstubAllEnvs(); if (root) rmSync(root, { recursive: true, force: true }); });
it('resolves the project SDK including escaped Windows properties, and supplies it to native tools', () => {
  root = mkdtempSync(join(tmpdir(), 'rnx-sdk-'));
  const sdk = join(root, 'sdk with spaces');
  mkdirSync(join(root, 'android')); mkdirSync(join(sdk, 'platform-tools'), { recursive: true });
  const executable = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'); writeFileSync(executable, '');
  vi.stubEnv('ANDROID_HOME', ''); vi.stubEnv('ANDROID_SDK_ROOT', '');
  writeFileSync(join(root, 'android/local.properties'), `sdk.dir=${sdk.replaceAll('\\', '\\\\').replaceAll(':', '\\:')}\n`);
  expect(androidSdk(root)).toBe(sdk);
  expect(androidTool('adb', root)).toBe(executable);
  expect(androidEnvironment(root)).toEqual({ ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk });
});
