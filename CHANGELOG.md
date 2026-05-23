# Changelog

All notable changes to the "php-sql-intellisense" extension will be documented in this file.

## [Unreleased]

## [0.3.0]

- Rewrote the README with accurate setup, supported PHP patterns, settings, commands, limitations, development steps, and roadmap.
- Improved Marketplace metadata with license, repository type, bugs URL, homepage, categories, keywords, and clearer command titles.
- Cleaned packaged extension contents by excluding local guide documents from the VSIX.
- Added a committed `package-lock.json` for reproducible installs.
- Added focused tests for SQL extraction, PHP variable assignment parsing, and completion-context parsing.
- Fixed parser behavior that could hang when completions were requested at the end of a query.
- Improved SQL extraction offsets and added support for single-quoted SQL strings.
- Stopped showing the output channel automatically on activation.
- Kept stored credentials intact after connection failures.
- Registered extension disposables more consistently.
- Escaped query-result webview content and disabled webview scripts.
- Escaped table identifiers when reading MySQL column metadata.

## [0.2.1]

- Updated README content and package metadata.

## [0.2.0]

- Added MySQL query linting against connected database schema.
- Added field hover information based on cached column metadata.
- Added code action support for running selected SQL queries.

## [0.1.0]

- Added database connection command and credential storage through VS Code secrets.
- Added table and field completion for supported PHP database calls.

## [0.0.1]

- Initial extension scaffold and first SQL extraction support.
