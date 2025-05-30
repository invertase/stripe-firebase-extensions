const path = require("path");
const webpack = require("webpack");
const dotenv = require("dotenv");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// Load environment variables
dotenv.config();

module.exports = {
  mode: "development",
  entry: "./src/main.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  devServer: {
    static: "./dist",
    port: 3002,
    hot: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(process.env),
    }),
    new HtmlWebpackPlugin({
      template: "./index.html",
    }),
  ],
  resolve: {
    // Required for npm link during development
    alias: {
      "firebase/app": path.resolve(__dirname, "node_modules/firebase/app"),
      "firebase/firestore": path.resolve(
        __dirname,
        "node_modules/firebase/firestore"
      ),
      "firebase/auth": path.resolve(__dirname, "node_modules/firebase/auth"),
    },
  },
};
