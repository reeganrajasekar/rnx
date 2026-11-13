import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { initArgs } from "./create.js";
import { detectPackageManager } from "./packages.js";
import { capture, execute } from "./process.js";
import { requireProject } from "./project.js";

const core = (name: string) => name === "react" || name === "react-native" || name === "react-test-renderer" || name === "@types/react" || name.startsWith("@react-native/") || name === "@react-native-community/cli" || name.startsWith("@react-native-community/cli-platform-");
export function upgradedManifest(current: any, template: any): { manifest: any; changes: string[] } {
  const changes: string[] = [];
  for (const section of ["dependencies", "devDependencies"] as const) {
    const dependencies = current[section] ?? {};
    for (const name of Object.keys(dependencies)) {
      const value = template.dependencies?.[name] ?? template.devDependencies?.[name];
      if (core(name) && typeof value === "string" && dependencies[name] !== value) {
        changes.push(`${name}: ${dependencies[name]} → ${value}`);
        dependencies[name] = value;
      }
    }
  }
  return { manifest: current, changes };
}

export async function upgrade(target: string | undefined, options: { directory?: string }): Promise<number> {
  const project = requireProject();
  const originalManifest = readFileSync(join(project.root, "package.json"), "utf8");
  const manifest = JSON.parse(originalManifest);
  if (manifest.dependencies?.expo || manifest.devDependencies?.expo) throw new Error("Expo projects must be upgraded by Expo SDK, not React Native alone. Follow https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/ in an isolated branch.");
  let from: string | undefined;
  try {
    if (!existsSync(join(project.root, "node_modules", "react-native", "package.json"))) throw new Error("React Native is not installed locally.");
    const require = createRequire(join(project.root, "package.json"));
    from = JSON.parse(readFileSync(require.resolve("react-native/package.json"), "utf8")).version;
  } catch {
    if (/^0\.\d+\.\d+$/.test(project.reactNative)) from = project.reactNative;
  }
  if (!from || !/^0\.\d+\.\d+$/.test(from)) throw new Error("Cannot determine the installed React Native version. Install dependencies or specify an exact version in package.json before staging an upgrade.");
  target ??= (await capture("npm", ["view", "react-native", "version"])).trim();
  if (!/^0\.\d+\.\d+$/.test(target)) throw new Error("Specify an exact stable target version, for example: rnx upgrade 0.88.1.");
  const parts = (s: string) => s.split(".").map(Number);
  const a = parts(from), b = parts(target);
  if (b[1] < a[1] || (b[1] === a[1] && b[2] <= a[2])) throw new Error(`Target ${target} must be newer than ${from}.`);
  const top = await capture("git", ["rev-parse", "--show-toplevel"], project.root);
  if (realpathSync(top).toLowerCase() !== realpathSync(project.root).toLowerCase()) throw new Error("Upgrade staging currently requires the React Native project to be the Git repository root.");
  if ((await capture("git", ["status", "--porcelain", "--untracked-files=all"], project.root)).trim()) throw new Error("Commit or stash all changes, including untracked files, before staging an upgrade.");
  const baseCommit = (await capture("git", ["rev-parse", "HEAD"], project.root)).trim();
  const pm = detectPackageManager(project.root);
  const requestedDestination = resolve(options.directory ?? join(dirname(project.root), `${basename(project.root)}-rnx-upgrade-${target}`));
  if (!existsSync(dirname(requestedDestination))) throw new Error(`Upgrade directory parent does not exist: ${dirname(requestedDestination)}`);
  const lockfiles = [["package-lock.json", "npm"], ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lock", "bun"], ["bun.lockb", "bun"]] as const;
  const locks = [...new Set(lockfiles.filter(([file]) => existsSync(join(project.root, file))).map(([, manager]) => manager))];
  if (locks.length > 1 || (locks.length && locks[0] !== pm)) throw new Error("Conflicting package-manager lockfiles or configuration. Resolve them before staging an upgrade.");
  const destination = join(realpathSync(dirname(requestedDestination)), basename(requestedDestination));
  const within = relative(realpathSync(project.root), destination);
  if (!within || (!within.startsWith("..") && !isAbsolute(within))) throw new Error("The upgrade directory must be outside the existing project.");
  if (existsSync(destination)) throw new Error(`Upgrade destination already exists: ${destination}`);
  const temp = mkdtempSync(join(tmpdir(), "rnx-upgrade-template-"));
  let template: any;
  try {
    const templateDir = join(temp, "Template");
    const args = initArgs("RnxUpgradeTemplate", { version: target, directory: templateDir, git: false });
    console.log(`Inspecting the official React Native ${target} template...`);
    const code = await execute("npx", args);
    if (code !== 0) return code;
    template = JSON.parse(readFileSync(join(templateDir, "package.json"), "utf8"));
    if (template.dependencies?.["react-native"] !== target) throw new Error("The initializer returned a different React Native version than requested.");
  } finally {
    // This directory was created by mkdtemp directly under the system temporary directory.
    if (dirname(realpathSync(temp)).toLowerCase() !== realpathSync(tmpdir()).toLowerCase()) throw new Error("Cannot safely remove the temporary template directory.");
    rmSync(temp, { recursive: true });
  }
  const { changes } = upgradedManifest(manifest, template);
  if (!changes.some((change) => change.startsWith("react-native:"))) throw new Error("The template does not contain a usable React Native dependency; no upgrade was staged.");
  if ((await capture("git", ["status", "--porcelain", "--untracked-files=all"], project.root)).trim() || (await capture("git", ["rev-parse", "HEAD"], project.root)).trim() !== baseCommit || readFileSync(join(project.root, "package.json"), "utf8") !== originalManifest) throw new Error("The source project changed during preparation; no upgrade worktree was created.");
  const branch = `rnx-upgrade-${target}-${randomUUID().slice(0, 8)}`;
  const worktreeCode = await execute("git", ["worktree", "add", "-b", branch, destination, baseCommit], project.root);
  if (worktreeCode !== 0) return worktreeCode;
  writeFileSync(join(destination, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Upgrade worktree: ${destination}\nBranch: ${branch}\nDependency changes:\n${changes.map((change) => `  ${change}`).join("\n")}`);
  const installArgs = ["install", "--ignore-scripts"];
  if (pm === "yarn") {
    const major = Number((await capture("yarn", ["--version"], destination)).split(".")[0]);
    if (major >= 2) installArgs.splice(1, 1, "--mode=skip-builds");
  }
  console.log("Resolving dependencies in the upgrade worktree with lifecycle scripts disabled...");
  const code = await execute(pm, installArgs, destination);
  const helper = `https://react-native-community.github.io/upgrade-helper/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(target)}`;
  console.log(`\nUpgrade is staged at ${destination}; the original project was not modified.\nReview and apply native/template changes: ${helper}\nResolve dependency warnings, run the project tests and native builds, and run normal installation/pods as appropriate before merging. Only tracked files are copied; restore ignored local configuration separately. Dependency resolution cannot guarantee compatibility.`);
  if (code !== 0) console.error("Dependency installation failed in the upgrade worktree; resolve the reported conflict before proceeding.");
  return code;
}
