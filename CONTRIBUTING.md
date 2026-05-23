# Contributing

Thanks for your interest in improving SQL-PHP IntelliSense.

## Development Setup

```bash
npm install
npm run compile
npm run lint
npm test
```

Open this folder in VS Code and use the **Launch Extension** debug configuration to run the extension in an Extension Development Host.

## Local Packaging

Build a local VSIX with:

```bash
npm run vsce
```

The generated package is written to `releases/`.

## Pull Requests

- Keep changes focused and easy to review.
- Run `npm run lint` and `npm test` before opening a pull request.
- Update the README when adding or changing user-facing settings, commands, supported PHP patterns, or limitations.
- Update the changelog for user-visible behavior changes.
- Include the MySQL version and connection shape when changing database metadata, linting, completion, or query-running behavior.
- Avoid committing generated files from `dist/`, `out/`, `.vscode-test/`, `node_modules/`, or `releases/`.

## Releases

Releases are created from tags named `vX.Y.Z`. The tag version must match `package.json`.
