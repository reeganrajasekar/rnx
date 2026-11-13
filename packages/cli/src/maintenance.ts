import * as prompts from "@clack/prompts";
import { existsSync, lstatSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { requireProject } from "./project.js";
import { devicesFor, selectDevice } from "./devices.js";
import { resolvePlatform } from "./run.js";
import { execute } from "./process.js";
import { androidTool } from "./sdk.js";

export function cleanPaths(root: string, target: string): string[] {
  if (!["all", "android", "ios", "metro"].includes(target))
    throw new Error("Clean target must be all, android, ios, or metro.");
  const paths: Record<string, string[]> = {
    android: ["android/app/build", "android/build"],
    ios: ["ios/build", "build/rnx"],
    metro: [".metro-cache", "node_modules/.cache/metro"],
  };
  const workspace = realpathSync(root);
  return (target === "all" ? Object.values(paths).flat() : paths[target])
    .map((path) => resolve(root, path))
    .filter((path) => {
      if (!existsSync(path)) return false;
      if (lstatSync(path).isSymbolicLink())
        throw new Error(`Refusing to clean a symbolic link: ${path}`);
      const inside = relative(workspace, realpathSync(path));
      if (
        !inside ||
        inside === ".." ||
        inside.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
        isAbsolute(inside)
      )
        throw new Error(`Clean target is outside the project: ${path}`);
      return true;
    });
}
export async function clean(
  target = "all",
  options: { yes?: boolean } = {},
): Promise<number> {
  const root = requireProject().root;
  const paths = cleanPaths(root, target);
  if (!paths.length) {
    console.log("No matching project build/cache directories to clean.");
    return 0;
  }
  console.log(
    `Remove generated output:\n${paths.map((path) => `  ${path}`).join("\n")}`,
  );
  if (!options.yes) {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new Error(
        "Run with --yes to confirm this cleanup in a non-interactive terminal.",
      );
    const confirmed = await prompts.confirm({
      message: "Remove these generated directories?",
    });
    if (prompts.isCancel(confirmed) || !confirmed) {
      console.log("Cleanup cancelled.");
      return 1;
    }
  }
  for (const path of paths) rmSync(path, { recursive: true });
  console.log(
    "Cleaned project output. Use rnx start --reset-cache to reset the active Metro transform cache.",
  );
  return 0;
}
export async function logs(
  value: string | undefined,
  options: {
    device?: string;
    filter?: string;
    clear?: boolean;
    bundleId?: string;
  },
): Promise<number> {
  const target = await resolvePlatform(value);
  const project = requireProject();
  const device = await selectDevice(
    await devicesFor(target, project.root),
    options.device,
  );
  if (target === "android") {
    const adb = androidTool("adb", project.root);
    if (options.clear) {
      const code = await execute(
        adb,
        ["-s", device.id, "logcat", "-c"],
        project.root,
      );
      if (code !== 0) return code;
    }
    const filters = options.filter
      ? options.filter === "react-native"
        ? ["ReactNative:V", "ReactNativeJS:V", "*:S"]
        : options.filter.split(/\s+/)
      : [];
    if (filters.some((filter) => filter.startsWith("-")))
      throw new Error(
        "Use logcat filters such as ReactNativeJS:V, not command flags.",
      );
    return execute(adb, ["-s", device.id, "logcat", ...filters], project.root);
  }
  if (options.clear)
    throw new Error("--clear is supported only for Android logcat.");
  if (device.kind === "device") {
    if (!options.bundleId)
      throw new Error(
        "Physical iOS console logs require Xcode 16+ and --bundle-id <app.bundle.id>. This relaunches the app with its console attached. Use Console.app for system logs.",
      );
    if (options.filter)
      throw new Error(
        "--filter is available for Android and iOS simulators. Physical iOS logs stream the app console.",
      );
    console.log("Relaunching the app with its console attached (Xcode 16+).");
    return execute(
      "xcrun",
      [
        "devicectl",
        "device",
        "process",
        "launch",
        "--device",
        device.id,
        "--terminate-existing",
        "--console",
        options.bundleId,
      ],
      project.root,
    );
  }
  if (device.state !== "Booted")
    throw new Error(
      `Simulator is shut down. Run rnx emulators ios --launch ${device.id}.`,
    );
  const args = [
    "simctl",
    "spawn",
    device.id,
    "log",
    "stream",
    "--level",
    "debug",
    "--style",
    "compact",
  ];
  if (options.filter)
    args.push(
      "--predicate",
      `eventMessage CONTAINS[c] ${JSON.stringify(options.filter)}`,
    );
  return execute("xcrun", args, project.root);
}
