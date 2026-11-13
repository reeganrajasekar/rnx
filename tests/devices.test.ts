import { expect, it } from 'vitest';
import { parseAdbDevices, parseIosDevices, selectDevice } from '../packages/cli/src/devices.js';

it('parses devices and preserves non-ready states', () => {
  expect(parseAdbDevices('List of devices attached\r\nemulator-5554 device product:sdk model:Pixel_8 transport_id:1\r\nabc unauthorized usb:1\r\nxyz offline\r\n\r\n')).toEqual([
    { id: 'emulator-5554', state: 'device', model: 'Pixel 8' },
    { id: 'abc', state: 'unauthorized', model: undefined },
    { id: 'xyz', state: 'offline', model: undefined },
  ]);
});

it('combines physical iOS devices and simulators while excluding other Apple platforms', async () => {
  const physical = [
    { identifier: 'phone', name: 'iPhone', platform: 'com.apple.platform.iphoneos', available: true, simulator: false },
    { identifier: 'locked', name: 'iPad', platform: 'com.apple.platform.iphoneos', available: false, error: { description: 'Locked' } },
    { identifier: 'tv', name: 'Apple TV', platform: 'com.apple.platform.appletvos', available: true },
  ];
  const sims = { devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [{ udid: 'sim', name: 'iPhone Sim', isAvailable: true, state: 'Shutdown' }] } };
  const devices = parseIosDevices(JSON.stringify(physical), JSON.stringify(sims));
  expect(devices.map((device) => device.id)).toEqual(['phone', 'locked', 'sim']);
  expect((await selectDevice(devices, 'sim')).kind).toBe('simulator');
  await expect(selectDevice(devices, 'locked')).rejects.toThrow('not connected and ready');
});
it('requires explicit selection when several devices are found in a non-interactive terminal', async () => {
  await expect(selectDevice([
    { id: 'one', name: 'One', platform: 'android', kind: 'device', ready: true, state: 'device' },
    { id: 'two', name: 'Two', platform: 'android', kind: 'device', ready: true, state: 'device' },
  ])).rejects.toThrow('--device');
});
