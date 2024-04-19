# php-sql-intellisense README

Welcome to the README for your "php-sql-intellisense" extension! This extension provides SQL IntelliSense support for writing MySQL queries in PHP using the PDO library.

## Features

Currently, the extension offers the following features:

-   SQL IntelliSense support for MySQL queries (A custom parser is used for this as I couldn't get any of the parsers out there to correctly parse an unfinished query)
-   Parsing and validation of SQL queries in PHP documents (To report any invalid field/table names used in queries)
-   Type provider for db fields

## Requirements

This extension requires Visual Studio Code.

## Extension Settings

This extension does not contribute any custom settings.

## Known Issues

-   Given db username and password are removed on connection error, although the error might not be with authentication

## Usage Guide

1. Open Extension settings and provide address of database server and the name of database in either User or Workspace settings.

-   Enter the address without the port, port is considered 3306 as default.

2. Open command palette and select the action Connect to database.

-   All of this extension’s commands can be found by searching SQL-PHP in the command palette.

3. Enter the username and password for your remote connection to database.

You should see a message window indicating that the connection was successful in the bottom-side corner after a few moments.
Username and password are stored in secrets and can only be cleared by the Delete database credentials command.

## How to Improve

This is the first version of the extension, and your feedback is valuable for improving it. If you have any suggestions, feature requests, or encounter any issues, please feel free to open an issue on the GitHub repository.

## Following Extension Guidelines

This extension follows the best practices and guidelines provided by Visual Studio Code. For more information, please refer to the [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines).

## Contribution

Contributions to this extension are welcome! If you'd like to contribute, please check out the GitHub repository and submit a pull request.

## For More Information

You can find more information about Visual Studio Code's Markdown support and syntax reference using the following links:

-   [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
-   [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

Thank you for using "php-sql-intellisense"! Enjoy coding with SQL IntelliSense support in PHP.
