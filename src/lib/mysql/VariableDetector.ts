import * as vscode from "vscode";

export class VariableDetector {
    // Detect and replace variables in the SQL query
    public static async detectAndReplaceVariables(sqlQuery: string, documentText: string): Promise<string> {
        // Regular expression to match variable declarations and assignments
        const variableRegex = /\$([a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)\s*=\s*(.*?);/g;
        // Regular expression to match parameter placeholders
        const parameterRegex = /:(\w+)/g;

        let match;
        // Store variable values
        const variableValues: Record<string, any> = {};

        // Identify variables and their values from the document text
        while ((match = variableRegex.exec(documentText)) !== null) {
            const variableName = match[1];
            const variableValue = match[2];

            // Store variable values
            variableValues[variableName] = variableValue;
        }

        // Prompt the user for parameter values
        const parameterMatches = sqlQuery.match(parameterRegex);

        if (parameterMatches) {
            for (const parameter of Array.from(new Set(parameterMatches))) {
                const userValue = await vscode.window.showInputBox({
                    prompt: `Enter a value for parameter ${parameter}`
                });

                if (userValue !== undefined) {
                    // Replace parameter placeholders with user input values
                    sqlQuery = sqlQuery.replace(new RegExp(`${parameter}`, "g"), userValue);
                } else {
                    // Handle user cancellation or input failure
                    throw new Error("User canceled input or provided an invalid value.");
                }
            }
        }

        // Replace variables in the SQL query with their values
        const replacedQuery = sqlQuery.replace(/\$(\w+)/g, (_, variableName) => {
            return variableValues[variableName] || "";
        });

        return replacedQuery;
    }
}
