# RNX CLI

A Flutter-style workflow for standard React Native projects. Requires Node.js 20.19+ and the platform native tools.

```sh
rnx create MyApp
# Or choose options without prompts:
rnx create MyApp --router react-navigation --store redux --pm pnpm
rnx create MyApp --router expo-router --store jotai --pm pnpm
cd MyApp
rnx setup android
rnx boom
rnx doctor
rnx devices
rnx run android
rnx add react-native-device-info
rnx get
rnx exec some-package -- --help
rnx build apk --release
```

On macOS with Xcode:

```sh
rnx setup ios --install
rnx devices ios
rnx run ios --device <UDID>
rnx pods
rnx build ios --release --scheme MyApp
```

Use `rnx --help` for setup, emulators, Wi-Fi pairing, logs, Metro, builds, and maintenance commands. Device workflows include Android USB/Wi-Fi and emulators, iPhones/iPads, and iOS simulators. Native iOS commands require macOS, Xcode, trusted devices, and configured signing. Physical iOS console logs require Xcode 16+ and relaunch the app.

`rnx boom` installs Windows Android tooling using WinGet and Android SDK Manager, sets user environment variables, and works outside a project. It may require license or administrator prompts. It reads literal SDK versions from `android/build.gradle`, or defaults to platform 35 and build-tools 36.0.0. Create an AVD in Android Studio or connect a device. Automatic macOS and Linux setup is not yet supported; use `rnx doctor` for diagnostics without installing anything.

The CLI delegates native builds and Metro to official tools, preserves native output and exit codes, and verifies build artifacts. Packages use the project's package manager. Setup installs project dependencies/pods only with `--install`; system tool installation and signing remain explicit developer actions. Cleanup previews generated paths and requires confirmation.

For standard React Native debug runs in an interactive terminal, `rnx run` keeps Metro in the same terminal and streams Android React Native logs from the selected device. The Android stream can include other React Native apps on that device. Press `r` to reload JavaScript, `R` to rebuild and restart, `h` for help, or `q` to quit. Fast Refresh applies supported edits automatically. An existing Metro is reused and left running; make sure it belongs to the same project. Release, `--no-packager`, and non-interactive runs do not start Metro or the log stream. Expo Router uses Expo CLI's controls and logs.

This package is under development. Native hardware/build compatibility still needs validation across the supported React Native/OS versions; do not infer it from command availability alone.

Interactive creation prompts for the router, state store, React Native version, and package manager. App code lives under `src`. Expo Router is integrated into the Community CLI's bare Android and iOS project using Expo modules and Expo CLI; stable compatible React Native versions are 0.83, 0.85, 0.86, and 0.88. Run `rnx get` to finish Expo Router setup after `--no-install`. Custom templates keep their own setup.

Creation also offers standard React Native styles or NativeWind. Choose NativeWind with `--styling nativewind`; it configures Tailwind CSS, Babel, Metro, and TypeScript. It requires React Native 0.76 or newer.

`rnx upgrade 0.88.1` stages core dependency updates in a separate Git worktree. A clean repository is required; review the printed Upgrade Helper link, apply native changes, resolve package issues, and test before merging. Expo upgrades follow the Expo SDK workflow.
