const { override, addWebpackResolve } = require('customize-cra');

module.exports = override(
  addWebpackResolve({
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  })
);
