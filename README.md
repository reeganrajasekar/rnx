# RNX

A Flutter-style command-line workflow for standard React Native projects, powered by the project's Community CLI, Metro, Gradle, ADB, and Xcode.

## Quick start

RNX requires Node.js 20.19 or newer. Your selected React Native version may require a newer Node version. Develop RNX with pnpm 10:

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
node packages/cli/dist/index.js --help
```

To use the local package without publishing it:

```sh
pnpm --filter @rnx/cli pack
# Use the absolute path of the tarball printed by pack:
npm install --global /path/to/rnx-cli-0.2.0.tgz
# Or run without a global install:
npx --yes --package /path/to/rnx-cli-0.2.0.tgz rnx --help
```

The npm scope is provisional; this repository has not been published to npm. The binary is `rnx`.

```sh
rnx create MyApp
cd MyApp
rnx setup android
rnx doctor android
rnx emulators android
rnx emulators android --launch Pixel_API_35
rnx run android
```

`create` (also `init`) generates **both Android and iOS native projects** with the official initializer through npx. Dependencies install with your selected package manager. It refuses an existing destination and never replaces existing project files. `--no-install` and `--no-git` skip those steps.

```sh
rnx create MyApp --pm pnpm
rnx create MyApp --version 0.85.0
rnx create MyApp --template some-community-template --directory ./apps/MyApp
rnx create MyApp --pods                 # macOS only
```

Explicit RN versions 0.76–0.85 select the matching CLI major from the [official compatibility matrix](https://github.com/react-native-community/cli/tree/main/packages/cli#compatibility). Other RN versions or tags require an explicit `--cli-version`. Without `--version`, the official initializer uses its current default. RNX never upgrades the CLI inside an existing project independently.

## Everyday commands

| Task | Command |
| --- | --- |
| Diagnose host/project | `rnx doctor [android\|ios] --verbose` |
| Setup instructions | `rnx setup [android\|ios]` |
| Install project dependencies and iOS gems/pods | `rnx setup ios --install` |
| List physical/virtual devices | `rnx devices [android\|ios]` |
| Device JSON | `rnx devices --json` |
| List/start virtual devices | `rnx emulators android --launch <AVD>` / `rnx emulators ios --launch <UDID>` |
| Build/install/launch | `rnx run [android\|ios] --device <id>` |
| Release run | `rnx run ios --release --scheme MyApp` |
| Install an existing build | `rnx run android --binary ./app-debug.apk` |
| Start Metro | `rnx start --port 8082 --reset-cache` |
| Check Metro | `rnx metro status --port 8082` |
| Native logs | `rnx logs android --device <id> --filter react-native` |
| Android build | `rnx build apk --release` / `rnx build aab` |
| iOS build | `rnx build ios --scheme MyApp --release` |
| Signed IPA | `rnx build ipa --scheme MyApp --export-options ./ExportOptions.plist` |
| Clear generated files | `rnx clean [all\|android\|ios\|metro]` |
| Environment/native config | `rnx info` / `rnx config` |
| Tests / static analysis | `rnx test` / `rnx analyze` (project scripts) |

Commands can run from any directory inside a React Native project. One ready device is selected automatically; several devices prompt interactively. Non-interactive sessions require `--device`. Devices that are offline, unauthorized, or unavailable are shown and rejected for runs. `run` without a platform uses saved defaults, the sole supported platform, or a prompt. Use `--` for additional native options:

```sh
rnx run android --device emulator-5554 -- --active-arch-only
rnx run ios -- --force-pods
rnx build apk --mode stagingRelease
rnx build apk --module mobile -- --stacktrace
rnx test -- --watch
```

`run` delegates Metro ownership to the Community CLI. `start`/`metro start` are foreground official Metro sessions; Ctrl-C stops that foreground process. Metro status checks the selected port, without claiming project ownership. Builds retain native output/exit codes and verify the resulting artifact paths. APK defaults to debug, AAB and IPA to release. Android signing and flavors remain in Gradle; iOS signing and schemes remain in Xcode. Custom Android app modules use `--module`; automatic discovery assumes standard native directories. IPA export expects one workspace/project under `ios`.

## Packages and npx

```sh
rnx add react-native-device-info
rnx add -D prettier
rnx remove old-package
rnx pub add @react-navigation/native
rnx pub remove old-package
rnx pub get                             # also: rnx get
rnx pub outdated
rnx pub upgrade
rnx exec some-package -- --help         # npx downloads/runs its executable
```

Package commands use the selected package manager, preserving its lockfile and autolinking. RNX detects project/workspace `packageManager` and lockfiles, and refuses conflicting lockfiles. Override with `--pm npm|pnpm|yarn|bun`. Native package changes require a rebuild; on macOS, run `rnx pods` for iOS. `pub upgrade` updates within package constraints (modern Yarn re-resolves matching ranges with `up -R`); review dependency changes, particularly React Native/CLI compatibility. For Yarn 2+, `pub outdated` uses read-only `npm outdated` against installed dependencies. `exec` runs code from the named package via npx.

## Android devices

Install Android Studio, the project JDK, Android SDK/platform-tools/build-tools, and emulator images. RNX looks for the SDK in environment variables, project `android/local.properties`, and common OS locations, so ADB/emulator need not be on PATH when found in the SDK. RNX passes the discovered SDK location to native child processes, and recognizes JAVA_HOME for Java diagnostics. Gradle keeps its normal Java and signing configuration.

For USB, enable Developer options and USB debugging, then accept the authorization prompt. For Android Wireless debugging, pair and connect with the distinct addresses displayed by the device:

```sh
rnx pair 192.168.1.20:37123
rnx connect 192.168.1.20:40211
rnx devices android
rnx run android --device 192.168.1.20:40211
rnx disconnect 192.168.1.20:40211
```

The pairing code is entered directly into ADB's prompt. Android Studio Device Manager creates AVDs; RNX lists and launches them.

## iOS setup and devices

iOS native commands run on **macOS with full Xcode**. Android commands run on Windows, macOS, and Linux with the native prerequisites. Shared code and both native project directories can be created on any of these hosts.

1. Install/open Xcode, finish its initial setup/license steps, and select its command-line tools in Xcode Settings > Locations.
2. Install an iOS simulator runtime in Xcode Settings > Components/Platforms.
3. Install the Ruby/Bundler version required by the project Gemfile. `rnx setup ios --install` installs JS dependencies, runs `bundle install`, then `bundle exec pod install`. With no Gemfile it uses installed CocoaPods.
4. For a physical iPhone/iPad: connect or pair through Xcode, trust the Mac, enable Developer Mode, and configure a signing team and bundle ID in Xcode Signing & Capabilities. RNX preserves those settings.

```sh
rnx doctor ios
rnx devices ios
rnx emulators ios --launch <simulator-UDID>
rnx run ios --device <simulator-or-physical-device-UDID>
rnx pods
rnx build ios --device 'My iPhone' --scheme MyApp --release
```

Simulators, iPhones, and iPads are selected by UDID; shutdown available simulators can be started by the Community CLI during `run`. Physical devices must be paired, trusted, unlocked, and provisioned. Setup explains missing system tools; it does not silently install global software or change shell profiles, Xcode selection, licenses, or signing.

```sh
rnx logs ios --device <booted-simulator-UDID> --filter MyMessage
rnx logs ios --device <physical-UDID> --bundle-id com.example.MyApp
```

Physical console streaming relaunches the app and requires Xcode 16+ `devicectl --console`; it captures app stdout/stderr. Use Apple's Console app for physical-device system logs. Simulator logs use `simctl log stream`. Android log filters accept `react-native` or logcat filters such as `ReactNativeJS:V *:S`; `--clear` clears Android logcat first.

## Project defaults and cleanup

Optional `rnx.config.json`:

```json
{
  "defaultPlatform": "android",
  "port": 8081,
  "packageManager": "pnpm"
}
```

RNX validates platform/port and uses this optional package-manager preference before lockfile detection. Existing standard React Native projects need no RNX config. RNX does not replace native or Metro configuration. TypeScript config/build profiles and managed background Metro sessions from the blueprint are not implemented yet.

`clean` previews project build/cache paths and asks for confirmation. `--yes` confirms that preview in scripts. It preserves dependencies, lockfiles, Pods, signing, and device/user data, rejects symlink escapes, and leaves system-wide caches alone. Metro cache reset uses `rnx start --reset-cache`.

## Validation

Unit/integration tests cover command parsing, project and device discovery, package managers, Android/iOS adapter arguments, CocoaPods errors, process exits, artifact verification, and cleanup containment. CLI CI is configured for Windows, macOS, and Linux. The manual Native workflow smoke test creates RN 0.85 projects and exercises Android emulator and iOS simulator run/build workflows; it has not been executed from this checkout. Real initializer smoke checks use the official template. Native Android/iOS builds, signing, and hardware runs still require validation with actual SDK/Xcode installations and devices; a comprehensive React Native version/device matrix is not claimed.

References: [RNX blueprint](RNX-Project-Blueprint.md), [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment), [Community CLI commands](https://github.com/react-native-community/cli/blob/main/docs/commands.md), [Apple command-line tools](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference).
