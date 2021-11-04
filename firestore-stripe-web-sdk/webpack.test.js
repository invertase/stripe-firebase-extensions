module.exports = {
  mode: "development",
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            compilerOptions: {
              module: "commonjs",
              target: "es2017",
            },
          },
        },
      },
      {
        test: /\.[tj]sx?$/,
        use: "source-map-loader",
        enforce: "pre",
      },
    ],
  },
  resolve: {
    extensions: [".js", ".ts"],
  },
  plugins: [],
};
