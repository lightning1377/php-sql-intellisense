import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, OutputChannel, TextDocument, languages } from "vscode";
import { extractSQLQueries, findVariableAssignments } from "../../helpers";
import type { MySqlDatabase } from "../MySqlDatabase";
import { loadDatabaseFields } from "./databaseSchema";
import { findQueryTokenRange } from "./queryRange";
import { SqlQueryAnalyzer } from "./SqlQueryAnalyzer";

export class MySQLLinter {
    private database: MySqlDatabase | undefined;
    private readonly diagnosticCollection: DiagnosticCollection;
    private readonly queryAnalyzer: SqlQueryAnalyzer;
    private readonly lintRuns = new Map<string, number>();
    private databaseVersion = 0;

    constructor(private readonly outputChannel: OutputChannel) {
        this.diagnosticCollection = languages.createDiagnosticCollection("sql-php-intellisense");
        this.queryAnalyzer = new SqlQueryAnalyzer(outputChannel);
    }

    public setDb(database: MySqlDatabase): void {
        this.database = database;
        this.databaseVersion += 1;
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
        this.lintRuns.clear();
    }

    public async parseDocument(document: TextDocument): Promise<void> {
        const documentKey = document.uri.toString();
        const runId = (this.lintRuns.get(documentKey) ?? 0) + 1;
        const databaseVersion = this.databaseVersion;

        this.lintRuns.set(documentKey, runId);
        this.diagnosticCollection.delete(document.uri);

        const database = this.database;

        if (!database) {
            return;
        }

        const isCurrentRun = (): boolean => this.lintRuns.get(documentKey) === runId && this.databaseVersion === databaseVersion;

        const documentText = document.getText();
        const queriesData = extractSQLQueries(documentText);

        if (!queriesData.length) {
            this.outputChannel.appendLine("Could not find any valid SQL queries in document");
            return;
        }

        try {
            const dbTableItems = await database.getTableNames();

            if (!isCurrentRun()) {
                return;
            }

            const dbTables = dbTableItems.map((item) => item.insertText).filter((insertText): insertText is string => typeof insertText === "string" && insertText.length > 0);
            const dbTableSet = new Set(dbTables);

            const parsedQueries = queriesData.map(({ query, startIndex: queryStartIndex }) => ({
                query,
                queryStartIndex,
                parsed: this.queryAnalyzer.parse(query)
            }));

            const referencedTables = new Set<string>();

            for (const { parsed } of parsedQueries) {
                for (const field of parsed.fields) {
                    if (field.tableName && dbTableSet.has(field.tableName)) {
                        referencedTables.add(field.tableName);
                    }
                }
            }

            const dbFields = await loadDatabaseFields(database, referencedTables, this.outputChannel);

            if (!isCurrentRun()) {
                return;
            }

            const diagnostics: Diagnostic[] = [];

            for (const { query, queryStartIndex, parsed } of parsedQueries) {
                const tokenCursors = new Map<string, number>();

                for (const tableName of parsed.tables) {
                    if (dbTableSet.has(tableName)) {
                        continue;
                    }

                    const range = findQueryTokenRange(document, documentText, tableName, queryStartIndex, query.length, tokenCursors, `table:${tableName}`);

                    if (range) {
                        diagnostics.push(new Diagnostic(range, `Table name not found in database: ${tableName}`, DiagnosticSeverity.Error));
                    }
                }

                for (const { tableName, fieldName } of parsed.fields) {
                    if (!tableName || fieldName === "(.*)" || fieldName === "*") {
                        continue;
                    }

                    const tableFields = dbFields.get(tableName);

                    // A missing entry means schema loading failed; avoid false diagnostics.
                    if (!tableFields) {
                        continue;
                    }

                    if (fieldName.startsWith("$")) {
                        const assignments = findVariableAssignments(documentText, fieldName);
                        const invalidAssignments = Array.from(new Set(assignments.map((assignment) => assignment.replace(/['"‘“’”]/g, "")).filter((assignment) => assignment && !tableFields.has(assignment))));

                        if (!invalidAssignments.length) {
                            continue;
                        }

                        const range = findQueryTokenRange(document, documentText, fieldName, queryStartIndex, query.length, tokenCursors, `field:${fieldName}`);

                        if (range) {
                            const invalidFieldText = invalidAssignments.map((assignment) => `'${assignment}'`).join(", ");

                            diagnostics.push(new Diagnostic(range, `Field name ${invalidFieldText} not found in table '${tableName}'`, DiagnosticSeverity.Error));
                        }

                        continue;
                    }

                    if (tableFields.has(fieldName)) {
                        continue;
                    }

                    const range = findQueryTokenRange(document, documentText, fieldName, queryStartIndex, query.length, tokenCursors, `field:${fieldName}`);

                    if (range) {
                        diagnostics.push(new Diagnostic(range, `Field name '${fieldName}' not found in table '${tableName}'`, DiagnosticSeverity.Error));
                    }
                }
            }

            if (isCurrentRun()) {
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        } catch (error) {
            if (!isCurrentRun()) {
                return;
            }

            this.diagnosticCollection.delete(document.uri);
            this.outputChannel.appendLine(`Could not lint document: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
