import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../packages/cli/src/project.js', () => ({ requireProject: vi.fn() }));
vi.mock('../packages/cli/src/run.js', () => ({ resolvePlatform: vi.fn() }));
vi.mock('../packages/cli/src/process.js', () => ({ execute: vi.fn(), capture: vi.fn(), requireMac: vi.fn() }));
vi.mock('../packages/cli/src/devices.js', async (original) => ({ ...await original<typeof import('../packages/cli/src/devices.js')>(), devicesFor: vi.fn() }));
import { devicesFor } from '../packages/cli/src/devices.js';
import { execute } from '../packages/cli/src/process.js';
import { requireProject } from '../packages/cli/src/project.js';
import { resolvePlatform } from '../packages/cli/src/run.js';
import { logs } from '../packages/cli/src/maintenance.js';
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requireProject).mockReturnValue({ root: process.cwd(), name: 'App', reactNative: '*' }); vi.mocked(execute).mockResolvedValue(0); });
it('streams only the selected Android device and can clear/filter its logcat', async () => {
  vi.mocked(resolvePlatform).mockResolvedValue('android');
  vi.mocked(devicesFor).mockResolvedValue([{ id: 'phone', name: 'Pixel', ready: true, kind: 'device', platform: 'android', state: 'device' }]);
  await logs('android', { device: 'phone', clear: true, filter: 'react-native' });
  expect(execute).toHaveBeenNthCalledWith(1, expect.any(String), ['-s', 'phone', 'logcat', '-c'], process.cwd());
  expect(execute).toHaveBeenNthCalledWith(2, expect.any(String), ['-s', 'phone', 'logcat', 'ReactNative:V', 'ReactNativeJS:V', '*:S'], process.cwd());
});
it('requires the app bundle ID before relaunching a physical iOS app for console logs', async () => {
  vi.mocked(resolvePlatform).mockResolvedValue('ios');
  vi.mocked(devicesFor).mockResolvedValue([{ id: 'phone', name: 'iPhone', ready: true, kind: 'device', platform: 'ios', state: 'connected' }]);
  await expect(logs('ios', {})).rejects.toThrow('--bundle-id');
  expect(execute).not.toHaveBeenCalled();
  await logs('ios', { bundleId: 'com.example.App' });
  expect(execute).toHaveBeenCalledWith('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', 'phone', '--terminate-existing', '--console', 'com.example.App'], process.cwd());
});
