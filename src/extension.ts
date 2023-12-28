import * as vscode from "vscode";
import { MySQLCompletionProvider } from "./lib/mysql/MySQLCompletionProvider";
import { getDbCredentials } from "./lib/helpers";
import { MySQLLinter } from "./lib/mysql/MySQLLinter";
import { MySqlDatabase } from "./lib/mysql/MySqlDatabase";

export function activate(context: vscode.ExtensionContext) {
    // Create an output channel
    const outputChannel = vscode.window.createOutputChannel("SQL-PHP Intellisense");
    outputChannel.append("SQL-PHP Intellisense extension is now active!");
    // Show the output channel in the UI
    outputChannel.show();
    // Dispose of the output channel when it's no longer needed
    context.subscriptions.push(outputChannel);

    // Create db helper
    let database: MySqlDatabase | null = null;

    // Register Completion Provider
    const completionProvider = new MySQLCompletionProvider();
    const triggerCharacters = ['"', "`"];

    const disposableCompletion = vscode.languages.registerCompletionItemProvider({ language: "php" }, completionProvider, ...triggerCharacters);

    context.subscriptions.push(disposableCompletion);

    // Register Linter
    const linter = new MySQLLinter(outputChannel);

    // Register Command for Linting
    const disposableLinting = vscode.commands.registerCommand("SQL-PHP.Intellisense.lint", () => {
        // Get the active text editor
        const document = vscode.window.activeTextEditor?.document;

        // Check if there is an active text editor and it has a document
        if (document) {
            linter.parseDocument(document);
        } else {
            vscode.window.showWarningMessage("No active document found.");
        }
    });

    // Register event handler for document save
    vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.languageId === "php") {
            linter.parseDocument(document);
        }
    });

    context.subscriptions.push(disposableLinting);

    context.subscriptions.push(
        vscode.commands.registerCommand("SQL-PHP.Intellisense.connect", async () => {
            if (database) {
                database.destroy();
            }
            // get extension db config
            const dbConfig = vscode.workspace.getConfiguration("SQL-PHP.Intellisense").get("database") as { host: string; name: string };
            const connectionOptions = {
                host: dbConfig.host,
                database: dbConfig.name,
                user: "",
                password: ""
            };
            // get credentials for connecting to db
            const credentials = await getDbCredentials(context);
            if (credentials) {
                connectionOptions.user = credentials.user;
                connectionOptions.password = credentials.password;
            }
            database = new MySqlDatabase(connectionOptions);

            const status = await database.getIsConnected();
            if (status) {
                vscode.window.showInformationMessage("Successfully connected to database");
                linter.setDb(database);
                completionProvider.setDb(database);
            } else {
                vscode.window.showInformationMessage("Could not connect to database");
                await context.secrets.delete("SQL-PHP.Intellisense.user");
                await context.secrets.delete("SQL-PHP.Intellisense.password");
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}
