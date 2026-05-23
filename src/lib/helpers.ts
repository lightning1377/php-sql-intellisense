import * as vscode from "vscode";

// Function to retrieve database credentials from the VS Code secrets
export async function getDbCredentials(context: vscode.ExtensionContext) {
    // Retrieve the database user from secrets
    const user = await context.secrets.get("SQL-PHP.Intellisense.user");
    if (!user) {
        // If user is not found, prompt the user to input the username
        const inputUser = await vscode.window.showInputBox({ title: "Database user", ignoreFocusOut: true });
        if (inputUser) {
            // Store the entered username in secrets
            await context.secrets.store("SQL-PHP.Intellisense.user", inputUser);
            // Recursive call to getDbCredentials to retry fetching credentials
            return getDbCredentials(context);
        }
    }
    // Retrieve the database password from secrets
    const password = await context.secrets.get("SQL-PHP.Intellisense.password");
    if (!password) {
        // If password is not found, prompt the user to input the password
        const inputPassword = await vscode.window.showInputBox({ title: "Database password", ignoreFocusOut: true, password: true });
        if (inputPassword) {
            // Store the entered password in secrets
            await context.secrets.store("SQL-PHP.Intellisense.password", inputPassword);
            // Recursive call to getDbCredentials to retry fetching credentials
            return getDbCredentials(context);
        }
    }

    // If both user and password are found, return the credentials
    if (user && password) {
        return { user, password };
    }
}

// Function to remove stored database credentials from secrets
export async function removeDbCredentials(context: vscode.ExtensionContext) {
    await context.secrets.delete("SQL-PHP.Intellisense.user");
    await context.secrets.delete("SQL-PHP.Intellisense.password");
}

// Function to extract SQL queries from text
export function extractSQLQueries(text: string): { query: string; startIndex: number }[] {
    // Regular expression to match supported database call patterns.
    const sqlQueryRegex = /Database::(prepare|getResults|getValue|getRow|PrepareExecuteTC)\(\s*(["'])((?:\\.|(?!\2)[\s\S])+)\2/g;
    const matches: { query: string; startIndex: number }[] = [];
    let match;

    // Iterate over text to find SQL query matches
    while ((match = sqlQueryRegex.exec(text)) !== null) {
        const query = match[3];
        const queryStartIndex = match.index + match[0].indexOf(query);
        // Store the matched query and its starting index
        matches.push({ query, startIndex: queryStartIndex });
    }

    return matches;
}

// Function to find variable assignments in text
export function findVariableAssignments(text: string, variable: string) {
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escapedVariable}\\s*=\\s*([^;]+);`, "gm");
    const matches: string[] = [];
    let match;

    // Iterate over text to find variable assignment matches
    while ((match = regex.exec(text)) !== null) {
        // Store the matched assignments
        matches.push(match[1].trim());
    }

    return matches;
}
