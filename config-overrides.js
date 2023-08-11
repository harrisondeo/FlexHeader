const {
  override,
  overrideDevServer,
  addWebpackPlugin,
} = require("customize-cra");
const CopyPlugin = require("copy-webpack-plugin");

const devServerConfig = () => (config) => {
  return {
    ...config,
    // webpackDevService doesn't write the files to desk
    // so we need to tell it to do so so we can load the
    // extension with chrome
    devMiddleware: {
      ...config.devMiddleware,
      writeToDisk: true,
    },
  };
};

const copyPlugin = new CopyPlugin({
  patterns: [
    // copy assets
    // { from: "public", to: "" },
    { from: "src/background.js", to: "" },
  ],
});

module.exports = {
  webpack: override(addWebpackPlugin(copyPlugin)),
  devServer: overrideDevServer(devServerConfig()),
};
