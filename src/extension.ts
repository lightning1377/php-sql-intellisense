import * as vscode from "vscode";
import { MySQLCompletionProvider } from "./lib/mysql/MySQLCompletionProvider";
import { onConnectCommand } from "./lib/helpers";

export function activate(context: vscode.ExtensionContext) {
    console.log("SQL-PHP Intellisense extension is now active!");

    // Register Completion Provider
    const completionProvider = new MySQLCompletionProvider();
    const triggerCharacters = ['"', "`"];

    const disposableCompletion = vscode.languages.registerCompletionItemProvider({ language: "php" }, completionProvider, ...triggerCharacters);

    context.subscriptions.push(disposableCompletion);

    // Register Command for Linting
    const disposableLinting = vscode.commands.registerCommand("SQL-PHP.Intellisense.lint", () => {
        // Display a message box to the user
        vscode.window.showInformationMessage("Linting is not implemented yet");
    });

    context.subscriptions.push(disposableLinting);

    context.subscriptions.push(
        vscode.commands.registerCommand("SQL-PHP.Intellisense.connect", () => {
            onConnectCommand(completionProvider, context);
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}
