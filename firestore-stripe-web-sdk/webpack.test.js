const path = require("path");

module.exports = {
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    "test/emulator.spec": "./test/emulator.spec.ts",
    "test/init.spec": "./test/init.spec.ts",
    "test/payment.spec": "./test/payment.spec.ts",
    "test/product.spec": "./test/product.spec.ts",
    "test/session.spec": "./test/session.spec.ts",
    "test/subscription.spec": "./test/subscription.spec.ts",
  },
  output: {
    path: path.resolve(__dirname, "lib"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /\.vitest\.spec\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.test.json",
            },
          },
        ],
      },
    ],
  },
};
