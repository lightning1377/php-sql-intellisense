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

process.exit(result.status ?? 1);
