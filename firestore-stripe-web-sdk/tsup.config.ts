import { defineConfig } from "tsup";
import { version } from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["firebase", "firebase/app", "firebase/auth", "firebase/firestore"],
  noExternal: [],
  minify: false,
  splitting: false,
  treeshake: true,
  target: "es2020",
  outDir: "lib",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".mjs",
    };
  },
  esbuildOptions(options) {
    // Ensure Firebase imports stay as external imports
    options.platform = "neutral";
    // Replace __VERSION__ with actual version
    options.define = {
      __VERSION__: JSON.stringify(version),
    };
  },
});
