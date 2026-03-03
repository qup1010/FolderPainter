const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readCargoPackageVersion(cargoTomlPath) {
  const content = fs.readFileSync(cargoTomlPath, "utf8");
  const packageSection = content.match(/\[package\]([\s\S]*?)(\n\[|$)/);
  if (!packageSection) {
    throw new Error("Cannot find [package] section in Cargo.toml");
  }

  const versionMatch = packageSection[1].match(/^\s*version\s*=\s*"([^"]+)"/m);
  if (!versionMatch) {
    throw new Error("Cannot find package.version in Cargo.toml");
  }
  return versionMatch[1].trim();
}

function fail(message) {
  console.error(`Version check failed: ${message}`);
  process.exit(1);
}

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");

const packageVersion = readJson(packageJsonPath).version;
const tauriVersion = readJson(tauriConfigPath).version;
const cargoVersion = readCargoPackageVersion(cargoTomlPath);

if (!packageVersion || !tauriVersion || !cargoVersion) {
  fail("Missing version in one or more files.");
}

if (packageVersion !== tauriVersion || packageVersion !== cargoVersion) {
  fail(
    `Mismatch detected. package.json=${packageVersion}, tauri.conf.json=${tauriVersion}, Cargo.toml=${cargoVersion}`
  );
}

const expectedTag = process.env.EXPECT_TAG;
if (expectedTag) {
  const expected = `v${packageVersion}`;
  if (expectedTag !== expected) {
    fail(`Tag mismatch. git tag=${expectedTag}, expected=${expected}`);
  }
}

console.log(
  `Version check passed. package.json, tauri.conf.json, Cargo.toml => ${packageVersion}`
);
if (expectedTag) {
  console.log(`Tag check passed. ${expectedTag}`);
}
