import * as assert from 'assert';

import { extractSQLQueries, findVariableAssignments } from "../../lib/helpers";
import { parser } from "../../lib/mysql/Parser";

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
});
