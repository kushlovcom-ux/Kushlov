module.exports = function (api) {
  api.cache(true);
  return {
    // require.resolve: Babel string names can fail under pnpm/EAS when the
    // resolver's starting directory is not apps/mobile.
    presets: [
      [require.resolve('babel-preset-expo'), { jsxImportSource: 'nativewind' }],
      require.resolve('nativewind/babel'),
    ],
    plugins: [
      [
        require.resolve('babel-plugin-module-resolver'),
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
          extensions: [
            '.ios.js',
            '.android.js',
            '.js',
            '.ts',
            '.tsx',
            '.json',
          ],
        },
      ],
      // Must be listed last.
      require.resolve('react-native-reanimated/plugin'),
    ],
  };
};
