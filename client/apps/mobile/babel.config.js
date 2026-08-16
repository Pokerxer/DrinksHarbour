module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // `reanimated: false` is load-bearing. babel-preset-expo auto-injects
      // react-native-reanimated/plugin whenever reanimated is installed — and
      // it is, as a NativeWind peer. That plugin resolves
      // `react-native-worklets/plugin`, a Reanimated 4 package absent from this
      // tree, which fails the Babel transform on every file. Nothing here uses
      // worklets, so the plugin is switched off at the source.
      ['babel-preset-expo', { jsxImportSource: 'nativewind', reanimated: false }],
      'nativewind/babel',
    ],
    // NOTE: react-native-reanimated/plugin is deliberately NOT enabled.
    // Nothing in this phase uses worklets, and the installed plugin resolves
    // `react-native-worklets/plugin`, which is a Reanimated 4 package not
    // present in this tree — enabling it fails the Babel transform outright.
    // When a later phase needs Reanimated animations, add the plugin back
    // together with its matching worklets package, and keep it LAST in this
    // array (a hard requirement of the worklet transform).
    plugins: [],
  };
};
