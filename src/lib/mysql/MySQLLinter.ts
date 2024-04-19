import { Parser } from "node-sql-parser";
import { MySqlDatabase } from "./MySqlDatabase";
import { extractSQLQueries, findVariableAssignments } from "../helpers";
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, OutputChannel, Range, TextDocument, languages } from "vscode";

export class MySQLLinter {
    private database: MySqlDatabase | undefined;
    private parser = new Parser();
    private diagnosticCollection: DiagnosticCollection | undefined;
    private outputChannel: OutputChannel;

    constructor(outputChannel: OutputChannel) {
        this.outputChannel = outputChannel;
    }

    // Set the MySQL database instance for linting
    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    // Parse the SQL query string
    private parseQuery(query: string) {
        let tcAst;
        try {
            tcAst = this.parser.parse(query.split("\n").join(""));
        } catch (error) {
            // Log parsing errors to the output channel
            this.outputChannel.appendLine("Could not parse sql query: " + query + "\n" + (error as Error).message);
            return { tables: [], fields: [] };
        }

        // Extract tables and fields from the parsed query AST
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

    // Parse the entire document for SQL queries and perform linting
    public async parseDocument(document: TextDocument) {
        // Clear current diagnostics collection
        this.diagnosticCollection?.clear();

        // Check if a MySQL database instance is available
        if (!this.database) {
            return;
        }

        const documentText = document.getText();
        const queriesData = extractSQLQueries(documentText);

        if (!queriesData.length) {
            // Log a message if no valid queries are found in the document
            this.outputChannel.appendLine("Could not find any valid queries in document");
            return;
        }

        // Retrieve table names from the MySQL database
        const dbTables: string[] = (await this.database.getTableNames()).map((item) => item.insertText as string);
        const dbFields: Record<string, string[]> = {};

        const diagnostics: Diagnostic[] = [];

        for (const { query } of queriesData) {
            const queryStartIndex = documentText.indexOf(query);
            const queryEndIndex = queryStartIndex + query.length;

            // Parse the SQL query to extract tables and fields
            const { tables, fields } = this.parseQuery(query);

            // Check table names in the query against the database tables
            for (const table of tables) {
                if (!dbTables.includes(table)) {
                    const tableStartIndex = documentText.indexOf(table, queryStartIndex);
                    const tableEndIndex = tableStartIndex + table.length;
                    diagnostics.push(new Diagnostic(new Range(document.positionAt(tableStartIndex), document.positionAt(tableEndIndex)), `Table name not found in database: ${table}`, DiagnosticSeverity.Error));
                }
            }

            // Retrieve field names for each table from the MySQL database
            for (const tableName of fields.map((fieldData) => fieldData.tableName)) {
                if (tableName === "null") {
                    continue;
                }
                if (!(tableName in dbFields) && dbTables.includes(tableName)) {
                    dbFields[tableName] = (await this.database.getFieldNames(tableName)).map((item) => item.insertText as string);
                }
            }

            // Check field names in the query against the database fields
            for (const { tableName, fieldName } of fields) {
                if (fieldName !== "(.*)" && tableName in dbFields) {
                    if (fieldName.startsWith("$")) {
                        const assignments = findVariableAssignments(documentText, fieldName);
                        for (const assigned of assignments) {
                            const cleaned = assigned.replace(/['"‘“’”]/g, "");
                            if (!dbFields[tableName].includes(cleaned)) {
                                const fieldNameStartIndex = documentText.indexOf(fieldName, queryStartIndex);
                                const fieldNameEndIndex = fieldNameStartIndex + fieldName.length;
                                diagnostics.push(new Diagnostic(new Range(document.positionAt(fieldNameStartIndex), document.positionAt(fieldNameEndIndex)), `Field name '${cleaned}' not found in table '${tableName}'`, DiagnosticSeverity.Error));
                            }
                        }
                    } else if (!dbFields[tableName].includes(fieldName)) {
                        const fieldNameStartIndex = documentText.indexOf(fieldName, queryStartIndex);
                        const fieldNameEndIndex = fieldNameStartIndex + fieldName.length;
                        diagnostics.push(new Diagnostic(new Range(document.positionAt(fieldNameStartIndex), document.positionAt(fieldNameEndIndex)), `Field name '${fieldName}' not found in table '${tableName}'`, DiagnosticSeverity.Error));
                    }
                }
            }

            // Create a diagnostic collection for the current document
            if (!this.diagnosticCollection) {
                if (document.uri) {
                    this.diagnosticCollection = languages.createDiagnosticCollection(document.uri.toString());
                } else {
                    this.outputChannel.appendLine("Could not create diagnostics collection for document");
                }
            }

            this.diagnosticCollection?.set(document.uri, diagnostics);
        }
    }
}
