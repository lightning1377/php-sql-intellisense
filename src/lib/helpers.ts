import { parser } from "./mysql/Parser";
import * as vscode from "vscode";

export function processLine(line: string, pointerIndex: number) {
    const query = extractSQLQueries(line)[0];
    if (query) {
        const index = line.indexOf(query);
        return parser(query, pointerIndex - (index + 1));
    }
    return false;
}

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

export function extractSQLQueries(text: string): string[] {
    const sqlQueryRegex = /Database::(prepare|getResults|getValue|getRow|PrepareExecuteTC)\("([^"]+)"/g;
    const matches: string[] = [];
    let match;

    while ((match = sqlQueryRegex.exec(text)) !== null) {
        matches.push(match[2]);
    }

    return matches;
}
