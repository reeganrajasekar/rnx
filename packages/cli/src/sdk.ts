import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function androidSdk(root?: string): string | undefined {
  const local = root && join(root, "android", "local.properties");
  const property =
    local && existsSync(local)
      ? readFileSync(local, "utf8")
          .match(/^sdk\.dir\s*=\s*(.+)$/m)?.[1]
          ?.trim()
          .replace(/\\([\\: ])/g, "$1")
      : undefined;
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    property,
    process.platform === "win32"
      ? join(
          process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
          "Android",
          "Sdk",
        )
      : process.platform === "darwin"
        ? join(homedir(), "Library", "Android", "sdk")
        : join(homedir(), "Android", "Sdk"),
  ];
  return candidates.find((path): path is string => !!path && existsSync(path));
}
export function androidTool(name: "adb" | "emulator", root?: string): string {
  const sdk = androidSdk(root);
  const path =
    sdk &&
    join(
      sdk,
      name === "adb" ? "platform-tools" : "emulator",
      `${name}${process.platform === "win32" ? ".exe" : ""}`,
    );
  return path && existsSync(path) ? path : name;
}
export function androidEnvironment(root: string): NodeJS.ProcessEnv {
  const sdk = androidSdk(root);
  return sdk ? { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } : {};
}
export function javaTool(): string {
  const java =
    process.env.JAVA_HOME &&
    join(
      process.env.JAVA_HOME,
      "bin",
      process.platform === "win32" ? "java.exe" : "java",
    );
  return java && existsSync(java) ? java : "java";
}
