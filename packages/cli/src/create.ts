import { existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execute, requireMac } from './process.js';
import { packageManager } from './packages.js';
import { findProject } from './project.js';
import { installPods } from './setup.js';

export interface CreateOptions { directory?: string; version?: string; cliVersion?: string; template?: string; pm?: string; install?: boolean; pods?: boolean; git?: boolean; }
export function initArgs(name: string, options: CreateOptions): string[] {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || ['React', 'ReactNative'].includes(name)) throw new Error('Use a project name beginning with a letter and containing only letters and numbers.');
  const destination = resolve(options.directory ?? name);
  if (existsSync(destination)) throw new Error(`Destination already exists: ${destination}. Choose a new directory.`);
  const known: Record<number, string> = { 76: '15', 77: '15', 78: '15', 79: '18', 80: '19', 81: '20', 82: '20', 83: '20', 84: '20', 85: '20' };
  const match = options.version?.match(/^0\.(\d+)(?:\.\d+)?$/);
  const compatible = match ? known[Number(match[1])] : undefined;
  if (options.version && !compatible && !options.cliVersion) throw new Error('For this React Native version, provide --cli-version from the official Community CLI compatibility matrix.');
  const cliVersion = options.cliVersion ?? compatible ?? 'latest';
  if (!/^[\w.+-]+$/.test(cliVersion)) throw new Error('Invalid --cli-version. Use a version, major version, or npm tag.');
  const initManager = options.pm === 'pnpm' ? 'npm' : options.pm ?? 'npm';
  const args = ['--yes', `@react-native-community/cli@${cliVersion}`, 'init', name, '--directory', destination, '--skip-install', '--install-pods', 'false', '--pm', initManager];
  if (options.version) args.push('--version', options.version);
  if (options.template) args.push('--template', options.template);
  if (options.git === false) args.push('--skip-git-init', 'true');
  return args;
}
export async function createProject(name: string, options: CreateOptions): Promise<number> {
  if (options.pods) { requireMac(); if (options.install === false) throw new Error('--pods requires dependency installation.'); }
  const pm = packageManager(options.pm ?? 'npm');
  const args = initArgs(name, options);
  console.log('Creating Android and iOS projects using the official Community CLI template.');
  let code = await execute('npx', args);
  if (code !== 0) return code;
  const root = resolve(options.directory ?? name);
  if (findProject(root)?.root !== root) throw new Error(`Initialization exited successfully but no React Native project was created at ${root}.`);
  const config = join(root, 'rnx.config.json');
  if (!existsSync(config)) writeFileSync(config, JSON.stringify({ defaultPlatform: 'android', port: 8081, packageManager: pm }, null, 2) + '\n');
  if (options.install !== false) { code = await execute(pm, ['install'], root); if (code !== 0) return code; }
  if (options.pods) { code = await installPods(root); if (code !== 0) return code; }
  console.log(`Project ready at ${root}\nNext: cd into the project, then rnx doctor and rnx run.\nFor iOS: rnx setup ios --install, then rnx run ios (on macOS).`);
  return 0;
}
