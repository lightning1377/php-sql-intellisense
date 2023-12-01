import * as vscode from "vscode";
import { MySQLCompletionProvider } from "./lib/mysql/MySQLCompletionProvider";

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

    const dbConfig = vscode.workspace.getConfiguration("SQL-PHP.Intellisense").get("database") as { host: string; name: string };

    const connectionOptions = {
        host: dbConfig.host,
        database: dbConfig.name,
        user: "",
        password: ""
    };

    context.subscriptions.push(
        vscode.commands.registerCommand("SQL-PHP.Intellisense.connect", async () => {
            const credentials = await getDbCredentials(context);
            if (credentials) {
                connectionOptions.user = credentials.user;
                connectionOptions.password = credentials.password;
                const status = await completionProvider.connect(connectionOptions);
                if (status) {
                    vscode.window.showInformationMessage("Successfully connected to database");
                } else {
                    vscode.window.showInformationMessage("Could not connect to database");
                    await context.secrets.delete("SQL-PHP.Intellisense.user");
                    await context.secrets.delete("SQL-PHP.Intellisense.password");
                }
            }
        })
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function getDbCredentials(context: vscode.ExtensionContext) {
    const user = await context.secrets.get("SQL-PHP.Intellisense.user");
    if (!user) {
        const inputUser = await vscode.window.showInputBox({ title: "Database user", ignoreFocusOut: true });
        if (inputUser) {
            await context.secrets.store("SQL-PHP.Intellisense.user", inputUser);
            return getDbCredentials(context);
        }
    }
    const password = await context.secrets.get("SQL-PHP.Intellisense.password");
    if (!password) {
        const inputPassword = await vscode.window.showInputBox({ title: "Database password", ignoreFocusOut: true });
        if (inputPassword) {
            await context.secrets.store("SQL-PHP.Intellisense.password", inputPassword);
            return getDbCredentials(context);
        }
    }

    if (user && password) {
        return { user, password };
    }
}
