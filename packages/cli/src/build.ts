import { existsSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { community, execute, requireMac } from './process.js';
import { requireProject } from './project.js';
import { androidEnvironment } from './sdk.js';

export function artifacts(directory: string, extension: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const path = join(directory, entry.name);
    if (entry.name.endsWith(extension)) return [path];
    return entry.isDirectory() ? artifacts(path, extension) : [];
  });
}
export interface BuildOptions { mode?: string; release?: boolean; scheme?: string; device?: string; module?: string; exportOptions?: string; }
export async function build(target: string, options: BuildOptions, extra: string[] = []): Promise<number> {
  if (!['apk', 'aab', 'ios', 'ipa'].includes(target)) throw new Error('Build target must be apk, aab, ios, or ipa.');
  const ios = target === 'ios' || target === 'ipa';
  if (ios) requireMac();
  const project = requireProject();
  const mode = options.mode ?? (options.release || target === 'ipa' || target === 'aab' ? (ios ? 'Release' : 'release') : ios ? 'Debug' : 'debug');
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(mode)) throw new Error('Mode must be a native configuration/variant name containing letters and numbers.');
  let code: number;
  let outputs: string[];
  if (!ios) {
    const module = options.module ?? 'app';
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(module)) throw new Error('Invalid Android module name.');
    const android = join(project.root, 'android');
    const wrapper = join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
    if (!existsSync(wrapper)) throw new Error('Android Gradle wrapper not found. Restore the native android project.');
    const task = `${target === 'aab' ? 'bundle' : 'assemble'}${mode[0].toUpperCase()}${mode.slice(1)}`;
    code = await execute(wrapper, [`:${module}:${task}`, ...extra], android, androidEnvironment(project.root));
    if (code !== 0) return code;
    const outputRoot = join(android, module, 'build', 'outputs', target === 'aab' ? 'bundle' : 'apk');
    outputs = artifacts(outputRoot, `.${target}`).filter((path) => relative(outputRoot, path).split(/[\\/]/).slice(0, -1).join('').toLowerCase() === mode.toLowerCase());
  } else if (target === 'ipa') {
    if (!options.scheme || !options.exportOptions) throw new Error('IPA export requires --scheme and --export-options <ExportOptions.plist>, plus signing configured in Xcode.');
    const plist = resolve(options.exportOptions);
    if (!existsSync(plist)) throw new Error(`Export options file not found: ${plist}`);
    const iosRoot = join(project.root, 'ios');
    const entries = existsSync(iosRoot) ? readdirSync(iosRoot) : [];
    const workspaces = entries.filter((entry) => entry.endsWith('.xcworkspace'));
    const projects = entries.filter((entry) => entry.endsWith('.xcodeproj'));
    const candidates = workspaces.length ? workspaces : projects;
    if (candidates.length !== 1) throw new Error('Expected one iOS workspace/project. Use Xcode directly for a project with multiple workspaces.');
    const outputRoot = join(project.root, 'build', 'rnx', 'ipa');
    const archive = join(outputRoot, 'App.xcarchive');
    code = await execute('xcodebuild', [workspaces.length ? '-workspace' : '-project', join(iosRoot, candidates[0]), '-scheme', options.scheme, '-configuration', mode, '-destination', 'generic/platform=iOS', '-archivePath', archive, 'archive', ...extra], project.root);
    if (code !== 0) return code;
    code = await execute('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', plist, '-exportPath', join(outputRoot, 'export')], project.root);
    if (code !== 0) return code;
    outputs = artifacts(join(outputRoot, 'export'), '.ipa');
  } else {
    const outputRoot = join(project.root, 'build', 'rnx', 'ios');
    const args = ['build-ios', '--mode', mode, '--buildFolder', outputRoot];
    if (options.scheme) args.push('--scheme', options.scheme);
    if (options.device) args.push('--device', options.device);
    code = await community([...args, ...extra], project);
    if (code !== 0) return code;
    outputs = artifacts(join(outputRoot, 'Build', 'Products'), '.app').filter((path) => relative(outputRoot, path).includes(`${mode}-`));
  }
  if (!outputs.length) throw new Error('Build exited successfully but no matching artifact was found. Inspect native output and custom build paths.');
  console.log(`Build artifacts:\n${outputs.map((path) => `  ${path}`).join('\n')}`);
  return 0;
}
