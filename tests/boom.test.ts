import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../packages/cli/src/process.js', () => ({ capture: vi.fn(), execute: vi.fn() }));
vi.mock('../packages/cli/src/doctor.js', () => ({ diagnose: vi.fn(), printChecks: vi.fn(() => 0) }));
vi.mock('../packages/cli/src/project.js', () => ({ findProject: vi.fn() }));
import { capture, execute } from '../packages/cli/src/process.js';
import { diagnose } from '../packages/cli/src/doctor.js';
import { findProject } from '../packages/cli/src/project.js';
import { boom } from '../packages/cli/src/boom.js';

const originalPlatform = process.platform;
let root = '';
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  vi.unstubAllEnvs(); vi.resetAllMocks();
  if (root) rmSync(root, { recursive: true, force: true });
});

it('reuses existing tools and installs project SDK versions', async () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  root = mkdtempSync(join(tmpdir(), 'rnx-boom-'));
  const sdk = join(root, 'sdk'); const java = join(root, 'jdk');
  mkdirSync(join(sdk, 'cmdline-tools/latest/bin'), { recursive: true });
  mkdirSync(join(java, 'bin'), { recursive: true });
  mkdirSync(join(root, 'android'), { recursive: true });
  writeFileSync(join(sdk, 'cmdline-tools/latest/bin/sdkmanager.bat'), '');
  writeFileSync(join(java, 'bin/javac.exe'), '');
  writeFileSync(join(root, 'android/build.gradle'), 'compileSdkVersion = 34\nbuildToolsVersion = "34.0.0"');
  vi.stubEnv('JAVA_HOME', java); vi.stubEnv('ANDROID_HOME', sdk);
  vi.mocked(findProject).mockReturnValue({ root, name: 'app', reactNative: '0.85.0' });
  vi.mocked(diagnose).mockResolvedValue([{ name: 'Android Studio', ok: true, detail: '' }]);
  vi.mocked(capture).mockResolvedValue('javac 17');
  vi.mocked(execute).mockResolvedValue(0);
  expect(await boom()).toBe(0);
  expect(execute).toHaveBeenCalledOnce();
  expect(execute).toHaveBeenCalledWith(join(sdk, 'cmdline-tools/latest/bin/sdkmanager.bat'), [`--sdk_root=${sdk}`, 'platform-tools', 'emulator', 'platforms;android-34', 'build-tools;34.0.0'], undefined, undefined);
});

it('stops if an installer fails', async () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  vi.mocked(findProject).mockReturnValue(undefined);
  vi.mocked(diagnose).mockResolvedValue([{ name: 'Android Studio', ok: false, detail: '' }]);
  vi.mocked(capture).mockResolvedValue('available');
  vi.mocked(execute).mockResolvedValue(7);
  await expect(boom()).rejects.toThrow('exit code 7');
  expect(execute).toHaveBeenCalledOnce();
});
