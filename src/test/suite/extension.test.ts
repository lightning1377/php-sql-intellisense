import * as assert from "assert";
import * as vscode from "vscode";

import { extractSQLQueries, findVariableAssignments } from "../../lib/helpers";
import { parser } from "../../lib/mysql/Parser";
import { MySQLCompletionProvider } from "../../lib/mysql/MySQLCompletionProvider";
import { MySqlDatabase } from "../../lib/mysql/MySqlDatabase";
import { MySQLLinter } from "../../lib/mysql/linter";

function createMockDocument(text: string, uriString = "file:///test.php"): vscode.TextDocument {
    const uri = vscode.Uri.parse(uriString);
    const doc = {
        uri,
        positionAt: (offset: number) => {
            const lines = text.slice(0, offset).split("\n");
            const line = lines.length - 1;
            const character = lines[line].length;
            return new vscode.Position(line, character);
        },
        offsetAt: (position: vscode.Position) => {
            const lines = text.split("\n");
            let offset = 0;
            for (let i = 0; i < position.line; i++) {
                offset += lines[i].length + 1;
            }
            offset += position.character;
            return offset;
        }
    } as any;
    doc.getText = (range?: vscode.Range) => {
        if (range) {
            const start = doc.offsetAt(range.start);
            const end = doc.offsetAt(range.end);
            return text.substring(start, end);
        }
        return text;
    };
    return doc as vscode.TextDocument;
}

async function getCompletionItems(documentText: string, cursorOffset: number, mockDatabase: Partial<MySqlDatabase> | null = {}): Promise<vscode.CompletionItem[]> {
    const mockOutputChannel = {
        appendLine: () => {}
    } as unknown as vscode.OutputChannel;
    const provider = new MySQLCompletionProvider(mockOutputChannel);
    if (mockDatabase !== null) {
        provider.setDb(mockDatabase as MySqlDatabase);
    }

    const mockDocument = createMockDocument(documentText);
    const position = mockDocument.positionAt(cursorOffset);
    const token = new vscode.CancellationTokenSource().token;

    return await provider.provideCompletionItems(mockDocument, position, token);
}

suite("SQL-PHP IntelliSense", () => {
    test("extracts supported SQL calls and preserves query offsets", () => {
        const documentText = `<?php
Database::prepare("SELECT id, name FROM users");
Database::getRow('SELECT email FROM users WHERE id = :id');
`;

        const queries = extractSQLQueries(documentText);

        assert.deepStrictEqual(
            queries.map(({ query }) => query),
            ["SELECT id, name FROM users", "SELECT email FROM users WHERE id = :id"]
        );

        for (const { query, startIndex } of queries) {
            assert.strictEqual(documentText.slice(startIndex, startIndex + query.length), query);
        }
    });

    test("finds PHP variable assignments used inside SQL", () => {
        const documentText = `<?php
$field = 'email';
$table = "users";
`;

        assert.deepStrictEqual(findVariableAssignments(documentText, "$field"), ["'email'"]);
        assert.deepStrictEqual(findVariableAssignments(documentText, "$table"), ['"users"']);
    });

    test("detects table completion context after FROM", () => {
        const query = "SELECT id FROM ";

        const result = parser(query, query.length);

        assert.strictEqual(result.context, "table");
    });

    test("detects field completion context with a single source table", () => {
        const query = "SELECT id FROM users WHERE ";

        const result = parser(query, query.length);

        assert.strictEqual(result.context, "field");
        assert.strictEqual(result.fromTable, "users");
    });

    suite("MySQLCompletionProvider", () => {
        test("returns empty array when database is not set", async () => {
            const results = await getCompletionItems(`<?php Database::prepare("SELECT * FROM ");`, 39, null);
            assert.deepStrictEqual(results, []);
        });

        test("returns empty array when cursor is not in a query", async () => {
            const results = await getCompletionItems(`<?php $foo = "bar";`, 10);
            assert.deepStrictEqual(results, []);
        });

        test("suggests tables in table context", async () => {
            const mockTableItems = [new vscode.CompletionItem("users", vscode.CompletionItemKind.Struct), new vscode.CompletionItem("orders", vscode.CompletionItemKind.Struct)];
            const results = await getCompletionItems(`<?php Database::prepare("SELECT * FROM  ");`, 40, { getTableNames: async () => mockTableItems });
            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].label, "users");
            assert.strictEqual(results[1].label, "orders");
        });

        test("suggests fields in field context", async () => {
            const mockFieldItems = [new vscode.CompletionItem("id", vscode.CompletionItemKind.Field), new vscode.CompletionItem("name", vscode.CompletionItemKind.Field)];
            const results = await getCompletionItems(`<?php Database::prepare("SELECT id FROM users WHERE  ");`, 53, {
                getFieldNames: async (tableName: string) => {
                    assert.strictEqual(tableName, "users");
                    return mockFieldItems;
                }
            });
            assert.strictEqual(results.length, 2);
            assert.strictEqual(results[0].label, "id");
            assert.strictEqual(results[1].label, "name");
        });

        test("suggests tables at the end of a single-spaced FROM query", async () => {
            const mockTableItems = [new vscode.CompletionItem("users", vscode.CompletionItemKind.Struct)];
            const results = await getCompletionItems(`<?php Database::prepare("SELECT * FROM ");`, 39, { getTableNames: async () => mockTableItems });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].label, "users");
        });

        test("suggests fields at the end of a single-spaced WHERE query", async () => {
            const mockFieldItems = [new vscode.CompletionItem("id", vscode.CompletionItemKind.Field)];
            const results = await getCompletionItems(`<?php Database::prepare("SELECT id FROM users WHERE ");`, 52, {
                getFieldNames: async (tableName: string) => {
                    assert.strictEqual(tableName, "users");
                    return mockFieldItems;
                }
            });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].label, "id");
        });

        test("suggests tables when cursor is after a backtick after FROM", async () => {
            const mockTableItems = [new vscode.CompletionItem("users", vscode.CompletionItemKind.Struct)];
            const results = await getCompletionItems(`<?php Database::prepare("SELECT * FROM \` ");`, 41, { getTableNames: async () => mockTableItems });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].label, "users");
        });

        test("does NOT suggest tables when cursor is after a closing backtick", async () => {
            const mockTableItems = [new vscode.CompletionItem("users", vscode.CompletionItemKind.Struct)];
            const documentText = `<?php Database::prepare("SELECT * FROM \`orders\`");`;
            const results = await getCompletionItems(documentText, documentText.indexOf("\`orders\`") + 8, { getTableNames: async () => mockTableItems });
            assert.deepStrictEqual(results, []);
        });

        test("appends a closing backtick to suggest tables when cursor is after an opening backtick", async () => {
            const mockTableItems = [new vscode.CompletionItem("users", vscode.CompletionItemKind.Struct)];
            mockTableItems[0].insertText = "users";
            mockTableItems[0].detail = "Table name";
            const results = await getCompletionItems(`<?php Database::prepare("SELECT * FROM \` ");`, 40, { getTableNames: async () => mockTableItems });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].insertText, "users`");
        });

        test("suggests fields when cursor is after a backtick in field context", async () => {
            const mockFieldItems = [new vscode.CompletionItem("id", vscode.CompletionItemKind.Field)];
            const results = await getCompletionItems(`<?php Database::prepare("SELECT id FROM users WHERE \` ");`, 54, {
                getFieldNames: async (tableName: string) => {
                    assert.strictEqual(tableName, "users");
                    return mockFieldItems;
                }
            });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].label, "id");
        });
    });

    suite("MySQLLinter", () => {
        let mockOutputChannel: vscode.OutputChannel;

        setup(() => {
            mockOutputChannel = {
                appendLine: () => {}
            } as unknown as vscode.OutputChannel;
        });

        async function getLintDiagnostics(documentText: string, mockDatabase: Partial<MySqlDatabase> | null = {}): Promise<vscode.Diagnostic[]> {
            const linter = new MySQLLinter(mockOutputChannel);
            if (mockDatabase !== null) {
                linter.setDb(mockDatabase as MySqlDatabase);
            }
            const doc = createMockDocument(documentText);
            await linter.parseDocument(doc);
            return (linter as any).diagnosticCollection.get(doc.uri) || [];
        }

        function mockCompletionItem(label: string, kind: vscode.CompletionItemKind): vscode.CompletionItem {
            const item = new vscode.CompletionItem(label, kind);
            item.insertText = label;
            return item;
        }

        test("does not lint if database is not set", async () => {
            const diagnostics = await getLintDiagnostics(`<?php Database::prepare("SELECT * FROM users");`, null);
            assert.strictEqual(diagnostics.length, 0);
        });

        test("logs when no SQL queries are found", async () => {
            let loggedMessage = "";
            const customOutput = {
                appendLine: (msg: string) => {
                    loggedMessage = msg;
                }
            } as unknown as vscode.OutputChannel;
            const linter = new MySQLLinter(customOutput);
            const mockDatabase = {} as unknown as MySqlDatabase;
            linter.setDb(mockDatabase);

            const doc = createMockDocument(`<?php $foo = "bar";`);
            await linter.parseDocument(doc);
            assert.ok(loggedMessage.includes("Could not find any valid SQL queries in document"));
        });

        test("generates diagnostic error when table does not exist in DB", async () => {
            const diagnostics = await getLintDiagnostics(`<?php Database::prepare("SELECT id FROM orders");`, {
                getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                getFieldNames: async () => []
            });
            assert.strictEqual(diagnostics.length, 1);
            assert.strictEqual(diagnostics[0].message, "Table name not found in database: orders");
            assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Error);
        });

        test("generates diagnostic error when field does not exist in DB table", async () => {
            const diagnostics = await getLintDiagnostics(`<?php Database::prepare("SELECT email FROM users");`, {
                getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                getFieldNames: async (tableName: string) => {
                    if (tableName === "users") {
                        return [mockCompletionItem("id", vscode.CompletionItemKind.Field)];
                    }
                    return [];
                }
            });
            assert.strictEqual(diagnostics.length, 1);
            assert.strictEqual(diagnostics[0].message, "Field name 'email' not found in table 'users'");
        });

        test("does not generate diagnostics for SELECT aliases or CTE/derived tables", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
Database::prepare("
    WITH order_summary AS (SELECT price FROM orders)
    SELECT SUM(price) AS total FROM order_summary HAVING total > 10 ORDER BY total
");
`,
                {
                    getTableNames: async () => [mockCompletionItem("orders", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async (tableName: string) => {
                        if (tableName === "orders") {
                            return [mockCompletionItem("price", vscode.CompletionItemKind.Field)];
                        }
                        return [];
                    }
                }
            );
            assert.strictEqual(diagnostics.length, 0, "Should have no errors for aliases and CTEs");
        });

        test("handles PHP variable assignments inside SQL", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
$field = 'email';
$field = 'username';
Database::prepare("SELECT $field FROM users");
`,
                {
                    getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async (tableName: string) => {
                        if (tableName === "users") {
                            return [mockCompletionItem("email", vscode.CompletionItemKind.Field)];
                        }
                        return [];
                    }
                }
            );
            assert.strictEqual(diagnostics.length, 1);
            assert.ok(diagnostics[0].message.includes("Field name 'username' not found in table 'users'"));
        });

        test("ignores SQL value variables in WHERE clause and does not validate them as fields", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
$id = '123';
$field = 'invalid_col';
Database::prepare("SELECT id FROM users WHERE id = $id ORDER BY $field");
`,
                {
                    getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async (tableName: string) => {
                        if (tableName === "users") {
                            return [mockCompletionItem("id", vscode.CompletionItemKind.Field)];
                        }
                        return [];
                    }
                }
            );
            assert.strictEqual(diagnostics.length, 1);
            assert.ok(diagnostics[0].message.includes("Field name 'invalid_col' not found in table 'users'"));
        });

        test("failed field schema loading does not mark every field as invalid", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
Database::prepare("SELECT users.email, orders.invalid_col FROM users JOIN orders ON users.id = orders.user_id");
`,
                {
                    getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct), mockCompletionItem("orders", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async (tableName: string) => {
                        if (tableName === "users") {
                            throw new Error("DB connection timeout");
                        }
                        if (tableName === "orders") {
                            return [mockCompletionItem("id", vscode.CompletionItemKind.Field), mockCompletionItem("user_id", vscode.CompletionItemKind.Field)];
                        }
                        return [];
                    }
                }
            );
            assert.strictEqual(diagnostics.length, 1);
            assert.ok(diagnostics[0].message.includes("Field name 'invalid_col' not found in table 'orders'"));
        });

        test("unqualified fields over CTE or derived source do not fall back to other physical tables", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
Database::prepare("
    WITH order_summary AS (SELECT 100 AS price)
    SELECT users.id, price FROM users JOIN order_summary
");
`,
                {
                    getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async (tableName: string) => {
                        if (tableName === "users") {
                            return [mockCompletionItem("id", vscode.CompletionItemKind.Field)];
                        }
                        return [];
                    }
                }
            );
            assert.strictEqual(diagnostics.length, 0, "Price should be treated as derived and not validated against physical tables");
        });

        test("diagnostic range points to exact whole-token matches and avoids substring matches", async () => {
            const documentText = `<?php
Database::prepare("SELECT id, user, user_id, username FROM users");
`;
            const doc = createMockDocument(documentText);
            const diagnostics = await getLintDiagnostics(documentText, {
                getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                getFieldNames: async (tableName: string) => {
                    if (tableName === "users") {
                        return [mockCompletionItem("user_id", vscode.CompletionItemKind.Field), mockCompletionItem("username", vscode.CompletionItemKind.Field)];
                    }
                    return [];
                }
            });
            assert.strictEqual(diagnostics.length, 2);

            const idDiag = diagnostics.find((d) => d.message.includes("Field name 'id'"));
            assert.ok(idDiag);
            assert.strictEqual(doc.getText(idDiag.range), "id");

            const userDiag = diagnostics.find((d) => d.message.includes("Field name 'user'"));
            assert.ok(userDiag);
            assert.strictEqual(doc.getText(userDiag.range), "user");
        });

        test("validates target columns of UPDATE and INSERT statements", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
Database::prepare("UPDATE users SET invalid_col = 1 WHERE id = 2");
Database::prepare("INSERT INTO users (invalid_col) VALUES (3)");
`,
                {
                    getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async (tableName: string) => {
                        if (tableName === "users") {
                            return [mockCompletionItem("id", vscode.CompletionItemKind.Field)];
                        }
                        return [];
                    }
                }
            );
            assert.strictEqual(diagnostics.length, 2);
            assert.ok(diagnostics[0].message.includes("Field name 'invalid_col' not found in table 'users'"));
            assert.ok(diagnostics[1].message.includes("Field name 'invalid_col' not found in table 'users'"));
        });

        test("switching database connections invalidates older lint runs", async () => {
            const linter = new MySQLLinter(mockOutputChannel);

            let resolveOldTables: (items: vscode.CompletionItem[]) => void = () => {};

            const oldDatabase = {
                getTableNames: () =>
                    new Promise<vscode.CompletionItem[]>((resolve) => {
                        resolveOldTables = resolve;
                    }),
                getFieldNames: async () => []
            } as unknown as MySqlDatabase;

            linter.setDb(oldDatabase);

            const doc = createMockDocument(
                `<?php Database::prepare(
            "SELECT id FROM users"
        );`
            );

            const oldRun = linter.parseDocument(doc);

            const newDatabase = {
                getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                getFieldNames: async () => [mockCompletionItem("id", vscode.CompletionItemKind.Field)]
            } as unknown as MySqlDatabase;

            linter.setDb(newDatabase);

            await linter.parseDocument(doc);

            let diagnostics: vscode.Diagnostic[] = (linter as any).diagnosticCollection.get(doc.uri) || [];

            assert.strictEqual(diagnostics.length, 0);

            resolveOldTables([mockCompletionItem("users", vscode.CompletionItemKind.Struct)]);

            await oldRun;

            diagnostics = (linter as any).diagnosticCollection.get(doc.uri) || [];

            assert.strictEqual(diagnostics.length, 0, "The older database run must not overwrite newer diagnostics");
        });

        test("validates unqualified fields when the only physical table has an alias", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php Database::prepare(
            "SELECT invalid_col FROM users u"
        );`,
                {
                    getTableNames: async () => [mockCompletionItem("users", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async () => [mockCompletionItem("id", vscode.CompletionItemKind.Field)]
                }
            );
            assert.strictEqual(diagnostics.length, 1);
            assert.strictEqual(diagnostics[0].message, "Field name 'invalid_col' not found in table 'users'");
        });

        test("validates physical fields inside CTE bodies", async () => {
            const diagnostics = await getLintDiagnostics(
                `<?php
Database::prepare("
    WITH order_summary AS (
        SELECT invalid_col FROM orders
    )
    SELECT * FROM order_summary
");
`,
                {
                    getTableNames: async () => [mockCompletionItem("orders", vscode.CompletionItemKind.Struct)],
                    getFieldNames: async () => [mockCompletionItem("price", vscode.CompletionItemKind.Field)]
                }
            );
            assert.strictEqual(diagnostics.length, 1);
            assert.strictEqual(diagnostics[0].message, "Field name 'invalid_col' not found in table 'orders'");
        });
    });
});
