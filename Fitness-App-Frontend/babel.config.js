module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    // Legacy decorators (WatermelonDB models) require class properties in
    // loose mode; the three loose flags must match or Babel errors.
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ['@babel/plugin-transform-flow-strip-types'],
    'react-native-worklets/plugin',
  ],
};
