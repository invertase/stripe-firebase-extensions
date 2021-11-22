const replace = require("replace-in-file");
const pkg = require("./package.json");

const results = replace.sync({
  files: "./lib/*.js",
  from: "__VERSION__",
  to: pkg.version,
});
results
  .filter((result) => result.hasChanged)
  .forEach((result) => {
    console.log(`Replaced version in: ${result.file}`);
  });
