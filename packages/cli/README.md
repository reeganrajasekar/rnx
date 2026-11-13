# RNX CLI

A Flutter-style workflow for standard React Native projects. Requires Node.js 20.19+ and the platform native tools.

```sh
rnx create MyApp
cd MyApp
rnx setup android
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

The CLI delegates native builds and Metro to official tools, preserves native output and exit codes, and verifies build artifacts. Packages use the project's package manager. Setup installs project dependencies/pods only with `--install`; system tool installation and signing remain explicit developer actions. Cleanup previews generated paths and requires confirmation.

This package is under development. Native hardware/build compatibility still needs validation across the supported React Native/OS versions; do not infer it from command availability alone.
