import * as vscode from "vscode";
import type { MySqlDatabase } from "./MySqlDatabase";
import { VariableDetector } from "./VariableDetector";

export class CodeActionProvider implements vscode.CodeActionProvider {
    private database: MySqlDatabase | null = null;
    private webViewPanel: vscode.WebviewPanel | null = null;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    // Set the database instance
    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    // Run the SQL query and display results in a webview
    async runSqlQuery(sqlQuery: string, documentText: string) {
        // Replace variables in the SQL query
        const replacedQuery = await VariableDetector.detectAndReplaceVariables(sqlQuery, documentText);
        this.outputChannel.appendLine(`Running query: ${replacedQuery}`);

        // Run the replaced query against the database
        const results = await this.database?.runQuery(replacedQuery).catch((err) => {
            this.outputChannel.appendLine(`Error occurred: ${err}`);
        });

        // Display results in a webview
        if (results) {
            this.displayResultsInWebView(results);
        }
    }

    // Provide code actions for running selected SQL queries
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
        const selectedText = document.getText(range);
        const documentText = document.getText();

        if (selectedText && this.database) {
            const runQueryAction = new vscode.CodeAction("Run Selected SQL Query", vscode.CodeActionKind.QuickFix);
            runQueryAction.command = {
                command: "extension.runSelectedSQLQuery",
                title: "Run Selected SQL Query",
                arguments: [selectedText, documentText]
            };

            return [runQueryAction];
        }

        return [];
    }

    // Display query results in a webview
    private displayResultsInWebView(results?: any[]) {
        if (results && results.length > 0) {
            const htmlContent = this.generateTableHtml(results);
            this.showWebView(htmlContent);
        } else {
            this.outputChannel.appendLine("No results to display.");
        }
    }

    // Generate HTML table from query results
    private generateTableHtml(results: any[]): string {
        if (!results || results.length === 0) {
            return "";
        }

        // Extract field names from the first result row
        const fieldNames = Object.keys(results[0]);

        // Determine border color based on active color theme
        const borderColor = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? "#000000" : "#ffffff";

        // Define CSS style for table fields
        const fieldsStyle = `style="border: 1px solid ${borderColor}; padding: 5px 10px;"`;

        // Generate HTML table with field names as headers
        const tableHeader = `<tr>${fieldNames.map((fieldName) => `<th ${fieldsStyle}>${fieldName}</th>`).join("")}</tr>`;
        const tableRows = results.map((row) => `<tr ${fieldsStyle}>${fieldNames.map((fieldName) => `<td ${fieldsStyle}>${row[fieldName]}</td>`).join("")}</tr>`).join("");

        const tableStyle = `style="order: 1px solid ${borderColor}; border-collapse: collapse;"`;

        return `<table ${tableStyle}>${tableHeader}${tableRows}</table>`;
    }

    // Show the webview panel with query results
    private showWebView(htmlContent: string) {
        if (this.webViewPanel) {
            this.webViewPanel.webview.html = htmlContent;
            this.webViewPanel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.webViewPanel = vscode.window.createWebviewPanel("sqlQueryResults", "SQL Query Results", vscode.ViewColumn.Beside, {
                enableScripts: true
            });

            this.webViewPanel.webview.html = htmlContent;

            // Dispose the webview panel when the user closes it
            this.webViewPanel.onDidDispose(() => {
                this.webViewPanel = null;
            }, null);
        }
    }

    // Dispose of resources when the extension is deactivated
    dispose() {
        if (this.webViewPanel) {
            this.webViewPanel.dispose();
        }
    }
}
