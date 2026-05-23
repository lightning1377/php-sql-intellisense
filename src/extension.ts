import * as vscode from "vscode";
import { MySQLCompletionProvider } from "./lib/mysql/MySQLCompletionProvider";
import { getDbCredentials, removeDbCredentials } from "./lib/helpers";
import { MySQLLinter } from "./lib/mysql/MySQLLinter";
import { MySqlDatabase } from "./lib/mysql/MySqlDatabase";
import { HoverProvider } from "./lib/mysql/HoverProvider";
import { CodeActionProvider } from "./lib/mysql/CodeActionProvider";

export function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel("SQL-PHP Intellisense");
    outputChannel.appendLine("SQL-PHP Intellisense extension is now active!");
    context.subscriptions.push(outputChannel);

    // Database object for managing connections
    let database: MySqlDatabase | null = null;

    // Register Completion Provider
    const completionProvider = new MySQLCompletionProvider(outputChannel);
    // Trigger characters for auto-completion
    const triggerCharacters = ['"', "`"];
    const disposableCompletion = vscode.languages.registerCompletionItemProvider({ language: "php" }, completionProvider, ...triggerCharacters);
    context.subscriptions.push(disposableCompletion);

    // Register Linter for SQL queries
    const linter = new MySQLLinter(outputChannel);

    // Register Hover Provider for SQL entities
    const hoverProvider = new HoverProvider(outputChannel);

    // Register Code Action Provider for SQL actions
    const codeActionProvider = new CodeActionProvider(outputChannel);
    context.subscriptions.push(codeActionProvider);

    // Register Command for Linting
    const disposableLinting = vscode.commands.registerCommand("SQL-PHP.Intellisense.lint", () => {
        const document = vscode.window.activeTextEditor?.document;
        if (document) {
            linter.parseDocument(document);
        } else {
            vscode.window.showWarningMessage("No active document found.");
        }
    });
    context.subscriptions.push(disposableLinting);

    // Register event handler for document save
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === "php") {
                linter.parseDocument(document);
            }
        })
    );

    // Command for connecting to the database
    context.subscriptions.push(
        vscode.commands.registerCommand("SQL-PHP.Intellisense.connect", async () => {
            if (database) {
                database.destroy();
            }
            const dbConfig = vscode.workspace.getConfiguration("SQL-PHP.Intellisense").get("database") as { host: string; name: string };
            if (!dbConfig.host || !dbConfig.name) {
                vscode.window.showWarningMessage("Configure the MySQL host and database name before connecting.");
                return;
            }
            const connectionOptions = {
                host: dbConfig.host,
                database: dbConfig.name,
                user: "",
                password: ""
            };
            const credentials = await getDbCredentials(context);
            if (credentials) {
                connectionOptions.user = credentials.user;
                connectionOptions.password = credentials.password;
            } else {
                vscode.window.showWarningMessage("Database connection canceled because credentials were not provided.");
                return;
            }
            database = new MySqlDatabase(connectionOptions);
            const status = await database.getIsConnected();
            if (status) {
                vscode.window.showInformationMessage("Successfully connected to database");
                // Update providers with the new database connection
                linter.setDb(database);
                completionProvider.setDb(database);
                hoverProvider.setDb(database);
                codeActionProvider.setDb(database);
            } else {
                vscode.window.showWarningMessage("Could not connect to database. Check the host, database name, username, and password.");
            }
        })
    );

    // Command for clearing stored database credentials
    context.subscriptions.push(
        vscode.commands.registerCommand("SQL-PHP.Intellisense.clear", async () => {
            await removeDbCredentials(context)
                .then(() => {
                    vscode.window.showInformationMessage("Successfully removed database credentials");
                })
                .catch(() => {
                    vscode.window.showInformationMessage("Couldn't remove database credentials");
                });
        })
    );

    // Register hover provider for PHP
    context.subscriptions.push(vscode.languages.registerHoverProvider("php", hoverProvider));

    // Register action provider for running SQL queries
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider("php", codeActionProvider));

    // Register the command handler for running the selected SQL query
    context.subscriptions.push(
        vscode.commands.registerCommand("SQL-PHP.Intellisense.runSelectedSQLQuery", async (sqlQuery: string, documentText: string) => {
            await codeActionProvider.runSqlQuery(sqlQuery, documentText);
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}
