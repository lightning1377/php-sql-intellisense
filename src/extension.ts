// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { MySQLCompletionProvider } from "./completionProvider";

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-mysql-intellisense" is now active!');

    {
        const completionProvider = new MySQLCompletionProvider();
        const triggerCharacters = ['"', "'"]; // Trigger the completion on the specified characters

        const disposable = vscode.languages.registerCompletionItemProvider(
            "php",
            completionProvider,
            ...triggerCharacters // Pass the trigger characters
        );

        context.subscriptions.push(disposable);
    }
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand("cloudtree-intellisense.helloWorld", function () {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage("Hello World from CloudTree Intellisense!");
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
