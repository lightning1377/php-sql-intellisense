// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {
//     // Use the console to output diagnostic information (console.log) and errors (console.error)
//     // This line of code will only be executed once when your extension is activated
//     console.log('Congratulations, your extension "php-sql-intellisense" is now active!');

//     // The command has been defined in the package.json file
//     // Now provide the implementation of the command with registerCommand
//     // The commandId parameter must match the command field in package.json
//     let disposable = vscode.commands.registerCommand("php-sql-intellisense.lintSql", () => {
//         // The code you place here will be executed every time your command is executed
//         // Display a message box to the user
//         vscode.window.showInformationMessage("We're linting your sql code now");
//     });

//     context.subscriptions.push(disposable);
// }

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-mysql-intellisense" is now active!');

    let disposable = vscode.languages.registerCompletionItemProvider(
        { language: "sql" },
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
                // Extract the word that the cursor is currently on
                const wordRange = document.getWordRangeAtPosition(position);
                const currentWord = wordRange ? document.getText(wordRange) : "";

                // If the word is "FROM", provide table names as suggestions
                if (currentWord.toUpperCase() === "FROM") {
                    return getTableCompletionItems();
                }

                // If the word is "SELECT" or "JOIN", provide column names as suggestions
                if (currentWord.toUpperCase() === "SELECT" || currentWord.toUpperCase() === "JOIN") {
                    return getColumnCompletionItems();
                }

                return [];
            }
        }
    );

    context.subscriptions.push(disposable);
}

function getTableCompletionItems(): vscode.CompletionItem[] {
    // Replace this with logic to fetch available tables from your database
    // For simplicity, we'll provide a static list of tables
    const tables = ["table1", "table2", "table3"];

    return tables.map((table) => {
        const item = new vscode.CompletionItem(table);
        item.kind = vscode.CompletionItemKind.Class;
        return item;
    });
}

function getColumnCompletionItems(): vscode.CompletionItem[] {
    // Replace this with logic to fetch column names based on the selected table
    // For simplicity, we'll provide a static list of columns
    const columns = ["column1", "column2", "column3"];

    return columns.map((column) => {
        const item = new vscode.CompletionItem(column);
        item.kind = vscode.CompletionItemKind.Property;
        return item;
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}
