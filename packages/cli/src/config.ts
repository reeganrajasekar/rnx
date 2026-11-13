import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export type Platform = 'android' | 'ios';
export function platform(value: string): Platform {
  if (value !== 'android' && value !== 'ios') throw new Error('Platform must be android or ios.');
  return value;
}
export function port(value: string | number): string {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 65535) throw new Error('Port must be a number between 1 and 65535.');
  return String(value);
}
export function loadConfig(root: string): { defaultPlatform?: Platform; port?: string } {
  const file = join(root, 'rnx.config.json');
  if (!existsSync(file)) return {};
  const config = JSON.parse(readFileSync(file, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('rnx.config.json must contain an object.');
  return { defaultPlatform: config.defaultPlatform === undefined ? undefined : platform(config.defaultPlatform), port: config.port === undefined ? undefined : port(config.port) };
}
