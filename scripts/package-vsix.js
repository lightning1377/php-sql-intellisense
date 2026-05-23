const { mkdirSync } = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");
const pkg = require("../package.json");

const outputDirectory = "releases";
const outputPath = join(outputDirectory, `${pkg.name}-${pkg.version}.vsix`);
const command = process.platform === "win32" ? "vsce.cmd" : "vsce";

mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync(command, ["package", "--out", outputPath], {
    stdio: "inherit",
    shell: process.platform === "win32"
});

if (result.error) {
    console.error(`Failed to run ${command}. Install project dependencies with npm install.`);
    console.error(result.error.message);
}

process.exit(result.status ?? 1);
