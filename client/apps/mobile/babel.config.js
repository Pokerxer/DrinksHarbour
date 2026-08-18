module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo auto-injects the Reanimated worklets Babel plugin
      // whenever react-native-reanimated is installed — and it is, as a
      // NativeWind peer. Under SDK 52 that injection had to be switched off
      // (`reanimated: false`): Reanimated 3 shipped a plugin that resolved
      // `react-native-worklets/plugin`, a Reanimated 4 package that was not in
      // the tree, and the Babel transform failed on every file.
      //
      // SDK 54 ships Reanimated 4, and react-native-worklets@0.5.1 is now a
      // declared dependency (the version SDK 54 pins in bundledNativeModules).
      // The injection therefore resolves correctly and is left ENABLED — the
      // suppression is not merely unnecessary now, it would disable worklets
      // for any later phase that animates.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // The worklets plugin is injected by babel-preset-expo above, so it is not
    // listed here. If it ever needs to be declared explicitly it must be LAST
    // in this array — a hard requirement of the worklet transform.
    plugins: [],
  };
};
