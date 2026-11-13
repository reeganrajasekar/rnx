import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/project.js', () => ({ requireProject: vi.fn() }));
vi.mock('../packages/cli/src/process.js', () => ({ execute: vi.fn(), community: vi.fn(), requireMac: vi.fn() }));
import { execute, community } from '../packages/cli/src/process.js';
import { requireProject } from '../packages/cli/src/project.js';
import { build } from '../packages/cli/src/build.js';
let root: string;
beforeEach(() => {
  vi.resetAllMocks(); root = mkdtempSync(join(tmpdir(), 'rnx-build-'));
  mkdirSync(join(root, 'android')); writeFileSync(join(root, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), '');
  vi.mocked(requireProject).mockReturnValue({ root, name: 'app', reactNative: '*' });
  vi.mocked(execute).mockResolvedValue(0); vi.mocked(community).mockResolvedValue(0);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
it('does not report success without an actual matching artifact', async () => {
  const old = join(root, 'android/app/build/outputs/apk/release'); mkdirSync(old, { recursive: true }); writeFileSync(join(old, 'app-release.apk'), 'apk');
  await expect(build('apk', {})).rejects.toThrow('no matching artifact');
});
it('discovers flavored APK artifacts rather than assuming a filename', async () => {
  const folder = join(root, 'android/app/build/outputs/apk/demo/debug'); mkdirSync(folder, { recursive: true }); writeFileSync(join(folder, 'custom-universal.apk'), 'apk');
  expect(await build('apk', { mode: 'demoDebug' })).toBe(0);
  expect(execute).toHaveBeenCalledWith(expect.stringContaining('gradlew'), [':app:assembleDemoDebug'], join(root, 'android'), expect.any(Object));
});
it('preserves native failures and skips artifact reporting', async () => {
  vi.mocked(execute).mockResolvedValue(6);
  expect(await build('aab', {})).toBe(6);
});
it('routes iOS builds with an explicit output folder and verifies the app bundle', async () => {
  const folder = join(root, 'build/rnx/ios/Build/Products/Debug-iphonesimulator/App.app'); mkdirSync(folder, { recursive: true });
  expect(await build('ios', { scheme: 'App' })).toBe(0);
  expect(community).toHaveBeenCalledWith(['build-ios', '--mode', 'Debug', '--buildFolder', join(root, 'build/rnx/ios'), '--scheme', 'App'], expect.anything());
});
