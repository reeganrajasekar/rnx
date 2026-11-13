import * as prompts from '@clack/prompts';
import { capture, requireMac } from './process.js';
import { androidTool } from './sdk.js';
import type { Platform } from './config.js';

export interface AndroidDevice { id: string; state: string; model?: string; }
export interface Device { id: string; name: string; platform: Platform; kind: 'device' | 'emulator' | 'simulator'; ready: boolean; state: string; }

export function parseAdbDevices(output: string): AndroidDevice[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^(\S+)\s+(device|offline|unauthorized|no permissions)(?:\s+(.*))?$/);
    if (!match) return [];
    const model = match[3]?.match(/(?:^|\s)model:(\S+)/)?.[1]?.replaceAll('_', ' ');
    return [{ id: match[1], state: match[2], model }];
  });
}

export async function androidDevices(root?: string): Promise<AndroidDevice[]> {
  try { return parseAdbDevices(await capture(androidTool('adb', root), ['devices', '-l'], root)); }
  catch (error) { throw new Error(`Could not list Android devices. Run rnx setup android. ${error instanceof Error ? error.message : String(error)}`); }
}

export function parseIosDevices(xcdevice: string, simctl: string): Device[] {
  const physical = JSON.parse(xcdevice);
  const simulators = JSON.parse(simctl);
  if (!Array.isArray(physical) || !simulators.devices || typeof simulators.devices !== 'object') throw new Error('Unexpected Xcode device output. Run xcrun xcdevice list and xcrun simctl list devices --json.');
  const devices: Device[] = physical.filter((item) => !item.simulator && item.platform === 'com.apple.platform.iphoneos' && typeof item.identifier === 'string').map((item) => ({
    id: item.identifier, name: item.name ?? item.identifier, platform: 'ios', kind: 'device', ready: item.available === true, state: item.available ? 'connected' : item.error?.description ?? 'unavailable',
  }));
  for (const [runtime, list] of Object.entries(simulators.devices)) {
    if (!runtime.includes('.iOS-') || !Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item.udid !== 'string') continue;
      devices.push({ id: item.udid, name: item.name ?? item.udid, platform: 'ios', kind: 'simulator', ready: item.isAvailable === true, state: item.isAvailable ? item.state ?? 'Shutdown' : item.availabilityError ?? 'unavailable' });
    }
  }
  return devices;
}
export async function iosDevices(): Promise<Device[]> {
  requireMac();
  const [physical, simulators] = await Promise.all([capture('xcrun', ['xcdevice', 'list']), capture('xcrun', ['simctl', 'list', 'devices', '--json'])]);
  return parseIosDevices(physical, simulators);
}
export async function devicesFor(platform: Platform, root?: string): Promise<Device[]> {
  if (platform === 'ios') return iosDevices();
  return (await androidDevices(root)).map((item) => ({ id: item.id, name: item.model ?? item.id, platform: 'android', kind: item.id.startsWith('emulator-') ? 'emulator' : 'device', ready: item.state === 'device', state: item.state }));
}
export async function selectDevice(devices: Device[], id?: string): Promise<Device> {
  const ready = devices.filter((device) => device.ready);
  if (id) {
    const selected = devices.find((device) => device.id === id);
    if (!selected?.ready) throw new Error(`Device ${id} is not connected and ready. Run rnx devices to inspect its status, trust/unlock physical devices, or start a simulator.`);
    return selected;
  }
  if (!ready.length) throw new Error('No ready devices found. Run rnx emulators, start one, or connect and authorize a physical device.');
  if (ready.length === 1) return ready[0];
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Multiple devices found. Select one with --device <id>.');
  const choice = await prompts.select({ message: 'Select a device', options: ready.map((device) => ({ value: device.id, label: `${device.name} (${device.kind}, ${device.state})` })) });
  if (prompts.isCancel(choice)) throw new Error('Device selection cancelled.');
  return ready.find((device) => device.id === choice)!;
}
