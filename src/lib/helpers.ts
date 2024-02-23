import * as vscode from "vscode";

export async function getDbCredentials(context: vscode.ExtensionContext) {
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

export async function removeDbCredentials(context: vscode.ExtensionContext) {
    await context.secrets.delete("SQL-PHP.Intellisense.user");
    await context.secrets.delete("SQL-PHP.Intellisense.password");
}

export function extractSQLQueries(text: string): { query: string; startIndex: number }[] {
    const sqlQueryRegex = /Database::(prepare|getResults|getValue|getRow|PrepareExecuteTC)\(\s*"([^"]+)"/g;
    const matches: { query: string; startIndex: number }[] = [];
    let match;

    while ((match = sqlQueryRegex.exec(text)) !== null) {
        matches.push({ query: match[2], startIndex: match.index + "Database::".length + match[1].length + 2 });
    }

    return matches;
}

export function findVariableAssignments(text: string, variable: string) {
    const regex = new RegExp(`\\${variable}\\s=[^=]([^\\\\s]+);`, "gm");
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push(match[1]);
    }

    return matches;
}
