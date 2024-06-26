import * as vscode from "vscode";
import type { MySqlDatabase } from "./MySqlDatabase";
import { extractSQLQueries } from "../helpers";
import { Parser } from "node-sql-parser";

export class HoverProvider implements vscode.HoverProvider {
    private database: MySqlDatabase | null = null;
    private outputChannel: vscode.OutputChannel;
    private parser = new Parser();

    // Constructor initializes the output channel
    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    // Method to set the database connection
    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    // Method to parse SQL queries and extract table and field information
    private parseQuery(query: string) {
        let tcAst;
        try {
            // Parse the SQL query using the SQL parser
            tcAst = this.parser.parse(query.split("\n").join(""));
        } catch (error) {
            // Handle parsing errors and log them to the output channel
            this.outputChannel.appendLine("Could not parse sql query: " + query + "\n" + (error as Error).message);
            return { tables: [], fields: [] };
        }

        // Extract tables and fields from the parsed AST
        const tables = tcAst.tableList.map((tableAst) => {
            const [queryType, _, tableName] = tableAst.split("::");
            return tableName;
        });

        const fields = tcAst.columnList.map((fieldAst) => {
            const [queryType, tableName, fieldName] = fieldAst.split("::");
            const finalTableName = tableName === "null" && tables.length === 1 ? tables[0] : tableName;
            return { tableName: finalTableName, fieldName };
        });

        return { tables, fields };
    }

    // Method to provide hover information
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const hoveredWord = document.getText(document.getWordRangeAtPosition(position));

        const documentText = document.getText();
        const queriesData = extractSQLQueries(documentText);

        // Get the index in the whole document
        const indexInDocument = document.offsetAt(position);

        let targetQuery: string = "";
        for (const { query } of queriesData) {
            const queryStartIndex = documentText.indexOf(query);
            const queryEndIndex = queryStartIndex + query.length;

            if (indexInDocument < queryEndIndex && indexInDocument > queryStartIndex) {
                targetQuery = query;
                break;
            }
        }

        if (targetQuery) {
            const { tables, fields } = this.parseQuery(targetQuery);
            const foundField = fields.find((field) => field.fieldName === hoveredWord);
            if (foundField) {
                const type = this.database?.getFieldType(foundField.tableName, foundField.fieldName);
                if (type) {
                    // If the field type is found in the database, provide hover information
                    const hoverContent = `${foundField.tableName}.${foundField.fieldName}: ${type}`;
                    return new vscode.Hover(hoverContent);
                }
            }
        }
    }
}
