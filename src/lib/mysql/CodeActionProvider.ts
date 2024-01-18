import * as vscode from "vscode";
import type { MySqlDatabase } from "./MySqlDatabase";

export class CodeActionProvider implements vscode.CodeActionProvider {
    private database: MySqlDatabase | null = null;
    private webViewPanel: vscode.WebviewPanel | null = null;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }
    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    async runSqlQuery(sqlQuery: string) {
        try {
            const results = await this.database?.runQuery(sqlQuery);
            this.displayResultsInWebView(results);
        } catch (error: any) {
            this.outputChannel.appendLine(`Error executing SQL Query: ${error.message}`);
        }
    }

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
        const selectedText = document.getText(range);

        if (selectedText && this.database) {
            const runQueryAction = new vscode.CodeAction("Run Selected SQL Query", vscode.CodeActionKind.QuickFix);
            runQueryAction.command = {
                command: "extension.runSelectedSQLQuery",
                title: "Run Selected SQL Query",
                arguments: [selectedText]
            };

            return [runQueryAction];
        }

        return [];
    }

    private displayResultsInWebView(results?: any[]) {
        if (results && results.length > 0) {
            const htmlContent = this.generateTableHtml(results);
            this.showWebView(htmlContent);
        } else {
            this.outputChannel.appendLine("No results to display.");
        }
    }

    private generateTableHtml(results: any[]): string {
        if (!results || results.length === 0) {
            return "";
        }

        // Extract field names from the first result row
        const fieldNames = Object.keys(results[0]);

        // Get the current theme's border color
        const borderColor = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? "#000000" : "#ffffff";

        // Apply the border to the table
        const fieldsStyle = `style="border: 1px solid ${borderColor}; padding: 5px 10px;"`;

        // Generate the HTML table with title fields as headers
        const tableHeader = `<tr>${fieldNames.map((fieldName) => `<th ${fieldsStyle}>${fieldName}</th>`).join("")}</tr>`;
        const tableRows = results.map((row) => `<tr ${fieldsStyle}>${fieldNames.map((fieldName) => `<td ${fieldsStyle}>${row[fieldName]}</td>`).join("")}</tr>`).join("");

        const tableStyle = `style="order: 1px solid ${borderColor}; border-collapse: collapse;"`;

        return `<table ${tableStyle}>${tableHeader}${tableRows}</table>`;
    }

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

    dispose() {
        // Dispose of the webview panel when the extension is deactivated
        if (this.webViewPanel) {
            this.webViewPanel.dispose();
        }
    }
}
