import * as prompts from '@clack/prompts';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { devicesFor, selectDevice } from './devices.js';
import { requireProject } from './project.js';
import { community, requireMac } from './process.js';
import { loadConfig, platform as parsePlatform, port, type Platform } from './config.js';

export interface RunOptions { device?: string; port?: string; release?: boolean; mode?: string; scheme?: string; packager?: boolean; verbose?: boolean; binary?: string; }
export async function resolvePlatform(value?: string): Promise<Platform> {
  if (value) { const result = parsePlatform(value); if (result === 'ios') requireMac(); return result; }
  const project = requireProject();
  const configured = loadConfig(project.root).defaultPlatform;
  const platforms = (['android', 'ios'] as const).filter((name) => existsSync(join(project.root, name)));
  if (configured) return resolvePlatform(configured);
  const supported = platforms.filter((name) => name !== 'ios' || process.platform === 'darwin');
  if (supported.length === 1) return supported[0];
  if (!supported.length) throw new Error('No supported native project found. iOS commands require macOS; Android commands require an android directory.');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Select a platform: rnx run android or rnx run ios. You can also set defaultPlatform in rnx.config.json.');
  const selected = await prompts.select({ message: 'Select platform', options: supported.map((value) => ({ value, label: value })) });
  if (prompts.isCancel(selected)) throw new Error('Platform selection cancelled.');
  return selected;
}
export async function run(value: string | undefined, options: RunOptions, extra: string[] = []): Promise<number> {
  const target = await resolvePlatform(value);
  const project = requireProject();
  if (!existsSync(join(project.root, target))) throw new Error(`No ${target} directory in this project.`);
  const config = loadConfig(project.root);
  const metroPort = options.port ?? config.port;
  if (metroPort) port(metroPort);
  if (target === 'android' && options.scheme) throw new Error('--scheme is an iOS option. Use --mode for Android variants.');
  const device = await selectDevice(await devicesFor(target, project.root), options.device);
  const args = [`run-${target}`, target === 'ios' ? '--udid' : '--deviceId', device.id];
  if (metroPort) args.push('--port', metroPort);
  if (options.mode || options.release) args.push('--mode', options.mode ?? (target === 'ios' ? 'Release' : 'release'));
  if (options.scheme) args.push('--scheme', options.scheme);
  if (options.packager === false) args.push('--no-packager');
  if (options.verbose) args.push('--verbose');
  if (options.binary) {
    const binary = resolve(options.binary);
    if (!existsSync(binary)) throw new Error(`Binary does not exist: ${binary}`);
    args.push('--binary-path', binary);
  }
  return community([...args, ...extra], project);
}
export async function runAndroid(options: RunOptions): Promise<number> { return run('android', options); }
