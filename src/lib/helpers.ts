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
    const matches: { query: string; startIndex: number }[] = [];
    
    const patterns = vscode.workspace.getConfiguration("SQL-PHP.Intellisense").get<string[]>("extractionPatterns") || [
        "Database::prepare",
        "Database::getResults",
        "Database::getValue",
        "Database::getRow",
        "Database::PrepareExecuteTC"
    ];

    // 1. Match configured method/function patterns
    if (patterns.length > 0) {
        const escapedPatterns = patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        // Match patterns like: method('sql') or method("sql")
        const methodRegex = new RegExp(`(?:${escapedPatterns})\\s*\\(\\s*(['"])((?:\\\\.|(?!\\1)[\\s\\S])*?)\\1`, 'g');
        let match;
        while ((match = methodRegex.exec(text)) !== null) {
            const query = match[2];
            const queryStartIndex = match.index + match[0].indexOf(query);
            matches.push({ query, startIndex: queryStartIndex });
        }
    }

    // 2. Match Heredoc / Nowdoc syntax with SQL or MYSQL identifiers
    const heredocRegex = /<<<\s*(['"]?)(SQL|MYSQL)\1\r?\n([\s\S]*?)\r?\n\s*\2\b/gi;
    let hMatch;
    while ((hMatch = heredocRegex.exec(text)) !== null) {
        const query = hMatch[3];
        const queryStartIndex = hMatch.index + hMatch[0].indexOf(query);
        
        // Check for overlap to avoid duplicate matching
        const overlaps = matches.some(m => 
            (queryStartIndex >= m.startIndex && queryStartIndex < m.startIndex + m.query.length) ||
            (m.startIndex >= queryStartIndex && m.startIndex < queryStartIndex + query.length)
        );
        if (!overlaps) {
            matches.push({ query, startIndex: queryStartIndex });
        }
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
