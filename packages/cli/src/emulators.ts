import { spawn } from "node:child_process";
import { capture, execute, requireMac } from "./process.js";
import { iosDevices } from "./devices.js";
import { androidTool } from "./sdk.js";
import { findProject } from "./project.js";
import { platform as parsePlatform } from "./config.js";

export async function emulators(
  value?: string,
  options: { launch?: string } = {},
): Promise<number> {
  const target = parsePlatform(
    value ?? (process.platform === "darwin" ? "ios" : "android"),
  );
  if (target === "ios") {
    requireMac();
    const devices = (await iosDevices()).filter(
      (device) => device.kind === "simulator" && device.ready,
    );
    if (!options.launch) {
      for (const device of devices)
        console.log(`${device.id}  ${device.name}  ${device.state}`);
      if (!devices.length)
        console.log("No iOS simulators. Install a runtime in Xcode Settings.");
      return 0;
    }
    const device = devices.find(
      (device) =>
        device.id === options.launch || device.name === options.launch,
    );
    if (!device)
      throw new Error("Simulator not found. Use an ID from rnx emulators ios.");
    if (device.state !== "Booted") {
      const code = await execute("xcrun", ["simctl", "boot", device.id]);
      if (code !== 0) return code;
    }
    const code = await execute("xcrun", [
      "simctl",
      "bootstatus",
      device.id,
      "-b",
    ]);
    return code === 0 ? execute("open", ["-a", "Simulator"]) : code;
  }
  const emulator = androidTool("emulator", findProject()?.root);
  const avds = (await capture(emulator, ["-list-avds"]))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!options.launch) {
    console.log(
      avds.join("\n") ||
        "No Android AVDs. Create one in Android Studio Device Manager.",
    );
    return 0;
  }
  if (!avds.includes(options.launch))
    throw new Error("AVD not found. Use a name from rnx emulators android.");
  const child = spawn(emulator, ["-avd", options.launch], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", resolve);
  });
  child.unref();
  console.log(
    "Emulator starting. Wait until it appears in rnx devices before running your app.",
  );
  return 0;
}
