import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/project.js', () => ({ requireProject: vi.fn() }));
vi.mock('../packages/cli/src/process.js', () => ({ community: vi.fn(), requireMac: vi.fn() }));
vi.mock('../packages/cli/src/devices.js', async (original) => ({ ...await original<typeof import('../packages/cli/src/devices.js')>(), devicesFor: vi.fn() }));
import { devicesFor } from '../packages/cli/src/devices.js';
import { requireProject } from '../packages/cli/src/project.js';
import { community, requireMac } from '../packages/cli/src/process.js';
import { run, runAndroid } from '../packages/cli/src/run.js';

let root: string;
beforeEach(() => {
  vi.resetAllMocks();
  root = mkdtempSync(join(tmpdir(), 'rnx-run-'));
  mkdirSync(join(root, 'android')); mkdirSync(join(root, 'ios'));
  vi.mocked(requireProject).mockReturnValue({ root, name: 'app', reactNative: '*' });
  vi.mocked(devicesFor).mockResolvedValue([{ id: 'abc', name: 'Pixel', state: 'device', kind: 'device', platform: 'android', ready: true }]);
  vi.mocked(community).mockResolvedValue(7);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
it('passes the selected Android device and port and preserves native failure codes', async () => {
  expect(await runAndroid({ port: '8082' })).toBe(7);
  expect(community).toHaveBeenCalledWith(['run-android', '--deviceId', 'abc', '--port', '8082'], expect.objectContaining({ root }));
});
it('rejects unavailable devices and invalid ports before invoking native tools', async () => {
  await expect(runAndroid({ device: 'missing' })).rejects.toThrow('not connected and ready');
  await expect(runAndroid({ port: '65536' })).rejects.toThrow('Port must');
  expect(community).not.toHaveBeenCalled();
});
it('targets iPhones and simulators by UDID with native scheme and release configuration', async () => {
  vi.mocked(devicesFor).mockResolvedValue([{ id: 'phone-udid', name: 'iPhone', state: 'connected', kind: 'device', platform: 'ios', ready: true }]);
  await run('ios', { device: 'phone-udid', release: true, scheme: 'App', packager: false }, ['--force-pods']);
  expect(requireMac).toHaveBeenCalled();
  expect(community).toHaveBeenCalledWith(['run-ios', '--udid', 'phone-udid', '--mode', 'Release', '--scheme', 'App', '--no-packager', '--force-pods'], expect.anything());
});
it('uses saved project defaults for the zero-argument workflow', async () => {
  writeFileSync(join(root, 'rnx.config.json'), JSON.stringify({ defaultPlatform: 'android', port: 8090 }));
  await run(undefined, {});
  expect(community).toHaveBeenCalledWith(['run-android', '--deviceId', 'abc', '--port', '8090'], expect.anything());
});
