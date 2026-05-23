const pkg = require("../package.json");

const tag = process.argv[2] || process.env.GITHUB_REF_NAME;

if (!tag) {
    console.error("Missing release tag. Pass a tag like v0.4.0.");
    process.exit(1);
}

const normalizedTag = tag.replace(/^refs\/tags\//, "").replace(/^v/, "");

if (normalizedTag !== pkg.version) {
    console.error(`Release tag ${tag} does not match package version ${pkg.version}.`);
    process.exit(1);
}

console.log(`Release tag ${tag} matches package version ${pkg.version}.`);
