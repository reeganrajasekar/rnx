import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { capture, execute } from './process.js';
import { requireProject } from './project.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export function packageManager(value: string): PackageManager {
  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(value)) throw new Error('Package manager must be npm, pnpm, yarn, or bun.');
  return value as PackageManager;
}
export function detectPackageManager(root: string): PackageManager {
  let dir = root;
  while (true) {
    if (existsSync(join(dir, 'rnx.config.json'))) {
      const config = JSON.parse(readFileSync(join(dir, 'rnx.config.json'), 'utf8'));
      if (config?.packageManager) return packageManager(config.packageManager);
    }
    if (existsSync(join(dir, 'package.json'))) {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      if (manifest.packageManager) return packageManager(manifest.packageManager.split('@')[0]);
    }
    const locks = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm']] as const;
    const found = locks.filter(([file]) => existsSync(join(dir, file)));
    if (found.length > 1) throw new Error(`Multiple package-manager lockfiles in ${dir}. Pass --pm explicitly or remove the stale lockfile.`);
    if (found.length) return found[0][1];
    if (dirname(dir) === dir) return 'npm';
    dir = dirname(dir);
  }
}
export function validatePackages(packages: string[]): void {
  if (!packages.length || packages.some((value) => !value.trim() || value.startsWith('-') || /[\r\n\0]/.test(value))) throw new Error('Provide package names or package specifications, not command options.');
}
export function packageArgs(pm: PackageManager, action: 'add' | 'remove' | 'get' | 'upgrade' | 'outdated', packages: string[] = [], dev = false, yarnMajor = 1): string[] {
  if (action === 'get') return ['install'];
  if (action === 'outdated') return ['outdated'];
  if (action === 'upgrade') return pm === 'yarn' ? yarnMajor >= 2 ? ['up', '-R', ...(packages.length ? packages : ['*'])] : ['upgrade', ...packages] : ['update', ...packages];
  return [action === 'add' ? (pm === 'npm' ? 'install' : 'add') : pm === 'npm' ? 'uninstall' : 'remove', ...packages, ...(dev && action === 'add' ? [pm === 'npm' ? '--save-dev' : '--dev'] : [])];
}
export async function managePackages(action: 'add' | 'remove' | 'get' | 'upgrade' | 'outdated', packages: string[], options: { pm?: string; dev?: boolean }): Promise<number> {
  const project = requireProject();
  if (action === 'get' && packages.length) throw new Error('Use rnx add <package> to add dependencies. rnx pub get installs existing dependencies.');
  if (action === 'add' || action === 'remove') validatePackages(packages);
  else if (packages.length) validatePackages(packages);
  const pm = options.pm ? packageManager(options.pm) : detectPackageManager(project.root);
  const yarnMajor = pm === 'yarn' && (action === 'upgrade' || action === 'outdated') ? Number((await capture('yarn', ['--version'], project.root)).split('.')[0]) : 1;
  const command = pm === 'yarn' && yarnMajor >= 2 && action === 'outdated' ? 'npm' : pm;
  if (command !== pm) console.log('Yarn 2+ has no outdated command; checking installed dependencies with npm outdated (read-only).');
  const code = await execute(command, packageArgs(pm, action, packages, options.dev, yarnMajor), project.root);
  if (code === 0 && action !== 'get' && action !== 'outdated') console.log('Native packages autolink. For iOS, run rnx pods on macOS, then rebuild the app.');
  return code;
}
