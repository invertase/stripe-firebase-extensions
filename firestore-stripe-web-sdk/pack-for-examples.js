const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

execSync("npm run build", { stdio: "inherit" });
const filename = execSync("npm pack").toString().trim();

const targetName = "invertase-firestore-stripe-payments.tgz";
fs.copyFileSync(filename, path.join("examples/cjs", targetName));
fs.copyFileSync(filename, path.join("examples/esm", targetName));
fs.copyFileSync(
  filename,
  path.join("examples/esm-with-subscriptions", targetName)
);

fs.unlinkSync(filename);
