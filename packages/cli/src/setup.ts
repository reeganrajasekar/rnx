import { existsSync } from "node:fs";
import { join } from "node:path";
import { diagnose, printChecks } from "./doctor.js";
import { capture, execute, requireMac } from "./process.js";
import { findProject, requireProject } from "./project.js";
import { detectPackageManager, packageManager } from "./packages.js";
import { platform as parsePlatform, type Platform } from "./config.js";
import { androidTool } from "./sdk.js";

export async function installPods(
  root = requireProject().root,
): Promise<number> {
  requireMac();
  const ios = join(root, "ios");
  if (!existsSync(join(ios, "Podfile")))
    throw new Error(
      "No ios/Podfile found. Run this inside a standard React Native iOS project.",
    );
  const gemfile = existsSync(join(root, "Gemfile"))
    ? root
    : existsSync(join(ios, "Gemfile"))
      ? ios
      : undefined;
  if (gemfile) {
    const code = await execute("bundle", ["install"], gemfile);
    if (code !== 0) return code;
    return execute("bundle", ["exec", "pod", "install"], ios);
  }
  return execute("pod", ["install"], ios);
}
export async function setup(
  value?: string,
  options: { install?: boolean; pm?: string } = {},
): Promise<number> {
  const target: Platform = value
    ? parsePlatform(value)
    : process.platform === "darwin"
      ? "ios"
      : "android";
  if (target === "ios") {
    requireMac();
    console.log(
      "iOS setup: install Xcode, choose Xcode > Settings > Locations > Command Line Tools, and install an iOS simulator runtime in Xcode Settings.",
    );
    console.log(
      "Use the project Gemfile with Bundler for CocoaPods. For physical devices: trust this Mac, enable Developer Mode, pair in Xcode, and select your signing team in Signing & Capabilities.",
    );
  } else {
    console.log(
      "Android setup: install Android Studio and the JDK required by your React Native version. In SDK Manager install the project compile SDK, build-tools, platform-tools, and emulator.",
    );
    console.log(
      "Set ANDROID_HOME and JAVA_HOME. Enable USB debugging and accept the device authorization prompt, or create an AVD in Android Studio Device Manager.",
    );
  }
  console.log(
    "Version-specific instructions: https://reactnative.dev/docs/set-up-your-environment",
  );
  if (options.install) {
    const project = requireProject();
    const pm = options.pm
      ? packageManager(options.pm)
      : detectPackageManager(project.root);
    console.log(
      `Installing project dependencies with ${pm}${target === "ios" ? ", then Gemfile dependencies and CocoaPods" : ""}.`,
    );
    const code = await execute(pm, ["install"], project.root);
    if (code !== 0) return code;
    if (target === "ios") {
      const podCode = await installPods(project.root);
      if (podCode !== 0) return podCode;
    }
  }
  return printChecks(
    await diagnose(findProject()?.root ?? process.cwd(), target),
  );
}
export async function androidConnection(
  action: "connect" | "pair" | "disconnect",
  address: string,
): Promise<number> {
  if (!/^(?:[a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(?::\d{1,5})?$/.test(address))
    throw new Error(
      "Use a device host or host:port, for example 192.168.1.20:5555.",
    );
  const adb = androidTool("adb", findProject()?.root);
  if (action === "pair") return execute(adb, [action, address]);
  // ADB can exit successfully while reporting a failed connection in its output.
  const output = await capture(adb, [action, address]);
  console.log(output);
  return /failed|cannot|unable|error/i.test(output) ? 1 : 0;
}
