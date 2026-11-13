import { execa } from 'execa';
import { constants } from 'node:os';
import { requireProject, resolveCommunityCli, type Project } from './project.js';
import { androidEnvironment } from './sdk.js';

export async function execute(command: string, args: string[], cwd = process.cwd(), env?: NodeJS.ProcessEnv): Promise<number> {
  const result = await execa(command, args, { cwd, stdio: 'inherit', reject: false, ...(env ? { env } : {}) });
  if (result.code === 'ENOENT') throw new Error(`${command} was not found. Run rnx setup for installation instructions.`);
  if (result.signal) return 128 + (constants.signals[result.signal] ?? 1);
  return result.exitCode ?? 1;
}

export async function capture(command: string, args: string[], cwd = process.cwd()): Promise<string> {
  const result = await execa(command, args, { cwd, reject: false, timeout: 30000 });
  if (result.failed) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.shortMessage || result.exitCode}`);
  return result.stdout || result.stderr;
}

export function requireMac(): void {
  if (process.platform !== 'darwin') throw new Error('iOS native tools require macOS with Xcode. Create/edit shared code here, then run the iOS commands on a Mac.');
}

export async function community(args: string[], project: Project = requireProject()): Promise<number> {
  const cli = resolveCommunityCli(project);
  if (!cli) throw new Error('Project Community CLI not found. Run rnx pub get and install a CLI version compatible with this React Native version.');
  return execute(process.execPath, [cli, ...args], project.root, androidEnvironment(project.root));
}
