# SQL-PHP IntelliSense

SQL-PHP IntelliSense helps PHP projects write MySQL queries with schema-aware completions, lightweight linting, field hovers, and a quick action for running selected SQL.

The extension connects to your MySQL database, reads table and column metadata, and uses that schema while you edit SQL strings in PHP files.

<img src="images/php_mysql.png" alt="SQL-PHP IntelliSense icon" width="240">

## Features

- Table-name completion in supported MySQL query strings.
- Field-name completion when the source table can be inferred.
- Diagnostics for table and field names that do not exist in the connected database.
- Hover information for known fields, including the MySQL column type.
- Command palette actions for connecting to MySQL, linting the active file, and clearing stored credentials.
- Code action for running a selected SQL query and viewing results in a VS Code webview.

## Supported PHP Patterns

SQL extraction currently targets string literals passed to these static calls:

```php
Database::prepare("SELECT id, name FROM users");
Database::getResults("SELECT * FROM users");
Database::getValue("SELECT email FROM users WHERE id = :id");
Database::getRow("SELECT * FROM users WHERE id = :id");
Database::PrepareExecuteTC("SELECT * FROM users");
```

Current limitations:

- Queries must be quoted string literals.
- The extension is optimized for MySQL.
- Advanced SQL syntax, aliases, and dynamically constructed queries may not always be understood.

## Requirements

- Visual Studio Code `1.84.0` or newer.
- Access to a MySQL database whose schema should power completions and linting.

## Setup

1. Install the extension.
2. Open VS Code settings and configure:
   - `SQL-PHP.Intellisense.database.host`
   - `SQL-PHP.Intellisense.database.port`
   - `SQL-PHP.Intellisense.database.name`
3. Run `SQL-PHP: Connect to MySQL Database` from the command palette.
4. Enter the database username and password when prompted.

Credentials are stored with VS Code SecretStorage. Run `SQL-PHP: Delete Database Credentials` to clear them.

## Commands

| Command | Description |
| --- | --- |
| `SQL-PHP: Connect to MySQL Database` | Connects to the configured MySQL database and loads schema metadata. |
| `SQL-PHP: Lint MySQL Queries` | Lints SQL queries in the active PHP document. |
| `SQL-PHP: Delete Database Credentials` | Removes the stored username and password. |

## Extension Settings

| Setting | Default | Description |
| --- | --- | --- |
| `SQL-PHP.Intellisense.database.host` | `localhost` | MySQL server host name or IP address. |
| `SQL-PHP.Intellisense.database.port` | `3306` | MySQL server port. |
| `SQL-PHP.Intellisense.database.name` | empty | Name of the MySQL database to inspect. |

## Development

```sh
npm install
npm run compile
npm run lint
npm test
```

Package the extension locally with:

```sh
npm run vsce
```

For manual installation from a VSIX file, see the [VSIX installation guide](docs/SQL-PHP%20Extension%20Guide.pdf).

## Roadmap

- Configurable PHP function/method patterns for SQL extraction.
- Better support for single-quoted and multiline SQL strings.
- Workspace-wide linting for PHP files.
- Broader SQL parser coverage for joins, aliases, and dynamic query fragments.

## Contributing

Issues and pull requests are welcome on the [GitHub repository](https://github.com/lightning1377/php-sql-intellisense).

## License

MIT
