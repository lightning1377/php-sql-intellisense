import { Parser } from "node-sql-parser";
import { MySqlDatabase } from "./MySqlDatabase";
import { extractSQLQueries } from "../helpers";
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, OutputChannel, Range, TextDocument, languages } from "vscode";

export class MySQLLinter {
    private database: MySqlDatabase | undefined;
    private parser = new Parser();
    private diagnosticCollection: DiagnosticCollection | undefined;
    private outputChannel: OutputChannel;

    constructor(outputChannel: OutputChannel) {
        this.outputChannel = outputChannel;
    }

    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    private parseQuery(query: string) {
        let tcAst;
        try {
            tcAst = this.parser.parse(query.split("\n").join(""));
        } catch (error) {
            this.outputChannel.appendLine("Could not parse sql query: " + query + "\n" + (error as Error).message);
            return { tables: [], fields: [] };
        }

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

    public async parseDocument(document: TextDocument) {
        // Clear current diagnostics collection
        this.diagnosticCollection?.clear();

        if (!this.database) {
            return;
        }

        const documentText = document.getText();
        const queries = extractSQLQueries(documentText);
        const dbTables: string[] = (await this.database.getTableNames()).map((item) => item.insertText as string);
        const dbFields: Record<string, string[]> = {};

        const diagnostics: Diagnostic[] = [];

        for (const query of queries) {
            const queryStartIndex = documentText.indexOf(query);
            const queryEndIndex = queryStartIndex + query.length;

            const { tables, fields } = this.parseQuery(query);

            // check query table names
            for (const table of tables) {
                if (!dbTables.includes(table)) {
                    const tableStartIndex = documentText.indexOf(table, queryStartIndex);
                    const tableEndIndex = tableStartIndex + table.length;
                    diagnostics.push(new Diagnostic(new Range(document.positionAt(tableStartIndex), document.positionAt(tableEndIndex)), `Table name not found in database: ${table}`, DiagnosticSeverity.Error));
                }
            }

            // get db field names
            for (const tableName of fields.map((fieldData) => fieldData.tableName)) {
                if (tableName === "null") {
                    continue;
                }
                if (!(tableName in dbFields) && dbTables.includes(tableName)) {
                    dbFields[tableName] = (await this.database.getFieldNames(tableName)).map((item) => item.insertText as string);
                }
            }

            // check query field names
            for (const { tableName, fieldName } of fields) {
                if (fieldName !== "(.*)" && tableName in dbFields && !dbFields[tableName].includes(fieldName)) {
                    const fieldNameStartIndex = documentText.indexOf(fieldName, queryStartIndex);
                    const fieldNameEndIndex = fieldNameStartIndex + fieldName.length;
                    diagnostics.push(new Diagnostic(new Range(document.positionAt(fieldNameStartIndex), document.positionAt(fieldNameEndIndex)), `Field name '${fieldName}' not found in table '${tableName}'`, DiagnosticSeverity.Error));
                }
            }

            // Create a diagnostic collection for the current document
            if (!this.diagnosticCollection) {
                this.diagnosticCollection = languages.createDiagnosticCollection(document.uri.toString());
            }

            this.diagnosticCollection.set(document.uri, diagnostics);
        }
    }
}
