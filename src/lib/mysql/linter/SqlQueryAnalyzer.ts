import { Parser } from "node-sql-parser";
import type { OutputChannel } from "vscode";
import { getNestedAst, isRecord, normalizeIdentifier, readIdentifier } from "./astUtils";
import type { AstRecord, ParsedField, ParsedQuery, SqlScope } from "./types";

interface WalkOptions {
    allowSelectAliases: boolean;
    collectDynamicFields: boolean;
}

const VALUE_CONTEXT: WalkOptions = {
    allowSelectAliases: false,
    collectDynamicFields: false
};

const SELECT_FIELD_CONTEXT: WalkOptions = {
    allowSelectAliases: false,
    collectDynamicFields: true
};

const ALIAS_CONTEXT: WalkOptions = {
    allowSelectAliases: true,
    collectDynamicFields: false
};

const ORDERING_FIELD_CONTEXT: WalkOptions = {
    allowSelectAliases: true,
    collectDynamicFields: true
};

export class SqlQueryAnalyzer {
    private readonly parser = new Parser();

    constructor(private readonly outputChannel: OutputChannel) {}

    public parse(query: string): ParsedQuery {
        let parsed: {
            tableList?: unknown[];
            ast?: unknown;
        };

        try {
            parsed = this.parser.parse(query.replace(/\r?\n/g, " ")) as {
                tableList?: unknown[];
                ast?: unknown;
            };
        } catch (error) {
            this.outputChannel.appendLine(["Could not parse SQL query:", query, error instanceof Error ? error.message : String(error)].join("\n"));

            return {
                tables: [],
                fields: []
            };
        }

        const tables = Array.from(
            new Set(
                (parsed.tableList ?? [])
                    .filter((tableEntry): tableEntry is string => typeof tableEntry === "string")
                    .map((tableEntry) => {
                        const parts = tableEntry.split("::");
                        return parts[parts.length - 1] ?? "";
                    })
                    .filter(Boolean)
            )
        );

        const { fields, cteNames } = this.extractFieldsFromAst(parsed.ast, tables);

        return {
            tables: tables.filter((table) => !cteNames.has(normalizeIdentifier(table))),
            fields
        };
    }

    private extractFieldsFromAst(ast: unknown, fallbackTables: string[]): { fields: ParsedField[]; cteNames: Set<string> } {
        const fields: ParsedField[] = [];
        const cteNames = new Set<string>();

        const createScope = (parentScope?: SqlScope): SqlScope => ({
            sources: new Map(parentScope?.sources ?? []),
            physicalTables: new Set<string>(),
            selectAliases: new Set<string>(),
            hasLocalDerivedSource: false
        });

        const registerSource = (value: unknown, scope: SqlScope, derivedNames: Set<string>): void => {
            if (Array.isArray(value)) {
                value.forEach((item) => registerSource(item, scope, derivedNames));
                return;
            }

            if (typeof value === "string") {
                const normalized = normalizeIdentifier(value);
                const isKnownDerivedSource = derivedNames.has(normalized) || scope.sources.get(normalized) === null;

                if (isKnownDerivedSource) {
                    scope.hasLocalDerivedSource = true;
                    scope.sources.set(normalized, null);
                    return;
                }

                scope.sources.set(normalized, value);
                scope.physicalTables.add(value);
                return;
            }

            if (!isRecord(value)) {
                return;
            }

            const alias = readIdentifier(value.as);
            const nestedAst = getNestedAst(value);

            if (nestedAst !== undefined) {
                scope.hasLocalDerivedSource = true;

                if (alias) {
                    scope.sources.set(normalizeIdentifier(alias), null);
                }

                return;
            }

            const tableName = readIdentifier(value.table);

            if (!tableName) {
                return;
            }

            const normalizedTableName = normalizeIdentifier(tableName);
            const isKnownDerivedSource = derivedNames.has(normalizedTableName) || scope.sources.get(normalizedTableName) === null;

            if (isKnownDerivedSource) {
                scope.hasLocalDerivedSource = true;
                scope.sources.set(normalizedTableName, null);

                if (alias) {
                    scope.sources.set(normalizeIdentifier(alias), null);
                }

                return;
            }

            scope.sources.set(normalizedTableName, tableName);

            if (alias) {
                scope.sources.set(normalizeIdentifier(alias), tableName);
            }

            scope.physicalTables.add(tableName);
        };

        const resolveFieldTable = (rawTableName: string | null, scope: SqlScope): { tableName: string | null; isDerived: boolean } => {
            if (rawTableName) {
                const mappedTable = scope.sources.get(normalizeIdentifier(rawTableName));

                if (mappedTable === null) {
                    return { tableName: null, isDerived: true };
                }

                return {
                    tableName: mappedTable ?? rawTableName,
                    isDerived: false
                };
            }

            if (scope.physicalTables.size === 1 && !scope.hasLocalDerivedSource) {
                return {
                    tableName: scope.physicalTables.values().next().value ?? null,
                    isDerived: false
                };
            }

            // Only use the parser fallback when this scope has no known source.
            // A derived-only scope must not fall through to its underlying table.
            if (scope.sources.size === 0 && fallbackTables.length === 1) {
                return {
                    tableName: fallbackTables[0],
                    isDerived: false
                };
            }

            return { tableName: null, isDerived: false };
        };

        const addField = (fieldName: string, rawTableName: string | null, scope: SqlScope): void => {
            const resolved = resolveFieldTable(rawTableName, scope);

            if (resolved.isDerived) {
                return;
            }

            fields.push({
                tableName: resolved.tableName,
                fieldName: fieldName === "*" ? "(.*)" : fieldName
            });
        };

        let walkStatement: (value: unknown, parentScope?: SqlScope) => void;
        let processSelect: (node: AstRecord, parentScope?: SqlScope) => void;

        const walkValue = (value: unknown, scope: SqlScope, options: WalkOptions): void => {
            if (Array.isArray(value)) {
                value.forEach((item) => walkValue(item, scope, options));
                return;
            }

            if (!isRecord(value)) {
                return;
            }

            if (value.type === "select") {
                processSelect(value, scope);
                return;
            }

            if (value.type === "column_ref") {
                const rawFieldName = readIdentifier(value.column);

                if (!rawFieldName) {
                    return;
                }

                const rawTableName = readIdentifier(value.table);

                if (!rawTableName && options.allowSelectAliases && scope.selectAliases.has(normalizeIdentifier(rawFieldName))) {
                    return;
                }

                addField(rawFieldName, rawTableName, scope);
                return;
            }

            if (value.type === "var" && options.collectDynamicFields) {
                const prefix = typeof value.prefix === "string" ? value.prefix : "";
                const name = typeof value.name === "string" ? value.name : "";
                const rawFieldName = prefix + name;

                if (rawFieldName.startsWith("$") && rawFieldName.length > 1) {
                    addField(rawFieldName, null, scope);
                }
                return;
            }

            for (const child of Object.values(value)) {
                walkValue(child, scope, options);
            }
        };

        const walkFromSource = (source: unknown, scope: SqlScope, parentScope?: SqlScope): void => {
            if (Array.isArray(source)) {
                source.forEach((item) => walkFromSource(item, scope, parentScope));
                return;
            }

            if (!isRecord(source)) {
                return;
            }

            const nestedAst = getNestedAst(source);

            if (nestedAst !== undefined) {
                walkStatement(nestedAst, parentScope);
            }

            for (const [key, child] of Object.entries(source)) {
                if (key === "table" || key === "db" || key === "as" || key === "join") {
                    continue;
                }

                if (key === "expr" && nestedAst !== undefined) {
                    continue;
                }

                walkValue(child, scope, VALUE_CONTEXT);
            }
        };

        const registerCtes = (node: AstRecord, scope: SqlScope): Set<string> => {
            const derivedNames = new Set<string>();
            const withEntries = Array.isArray(node.with) ? node.with : node.with ? [node.with] : [];

            // Register all names first so chained and recursive CTE references remain derived.
            for (const withEntry of withEntries) {
                if (!isRecord(withEntry)) {
                    continue;
                }

                const cteName = readIdentifier(withEntry.name);

                if (!cteName) {
                    continue;
                }

                const normalizedName = normalizeIdentifier(cteName);
                cteNames.add(normalizedName);
                derivedNames.add(normalizedName);
                scope.sources.set(normalizedName, null);
            }

            for (const withEntry of withEntries) {
                const cteAst = getNestedAst(withEntry);

                if (cteAst !== undefined) {
                    walkStatement(cteAst, scope);
                }
            }

            return derivedNames;
        };

        processSelect = (node: AstRecord, parentScope?: SqlScope): void => {
            const scope = createScope(parentScope);
            const derivedNames = registerCtes(node, scope);

            registerSource(node.from, scope, derivedNames);

            if (Array.isArray(node.columns)) {
                for (const column of node.columns) {
                    if (!isRecord(column)) {
                        continue;
                    }

                    const alias = readIdentifier(column.as);

                    if (alias) {
                        scope.selectAliases.add(normalizeIdentifier(alias));
                    }
                }

                for (const column of node.columns) {
                    if (isRecord(column)) {
                        walkValue(column.expr, scope, SELECT_FIELD_CONTEXT);
                    }
                }
            }

            walkValue(node.where, scope, VALUE_CONTEXT);
            walkFromSource(node.from, scope, parentScope);
            walkValue(node.groupby, scope, ORDERING_FIELD_CONTEXT);
            walkValue(node.having, scope, ALIAS_CONTEXT);
            walkValue(node.orderby, scope, ORDERING_FIELD_CONTEXT);
            walkValue(node.window, scope, VALUE_CONTEXT);
            walkValue(node.qualify, scope, VALUE_CONTEXT);

            if (node._next !== undefined) {
                walkStatement(node._next, parentScope);
            }
        };

        const processUpdate = (node: AstRecord, parentScope?: SqlScope): void => {
            const scope = createScope(parentScope);
            const derivedNames = registerCtes(node, scope);

            registerSource(node.table, scope, derivedNames);
            registerSource(node.from, scope, derivedNames);
            walkFromSource(node.table, scope, parentScope);
            walkFromSource(node.from, scope, parentScope);

            if (Array.isArray(node.set)) {
                for (const assignment of node.set) {
                    if (!isRecord(assignment)) {
                        continue;
                    }

                    const columnName = readIdentifier(assignment.column);

                    if (columnName) {
                        addField(columnName, readIdentifier(assignment.table), scope);
                    }

                    walkValue(assignment.value, scope, VALUE_CONTEXT);
                }
            }

            walkValue(node.where, scope, VALUE_CONTEXT);
            walkValue(node.orderby, scope, VALUE_CONTEXT);
        };

        const processInsert = (node: AstRecord, parentScope?: SqlScope): void => {
            const targetScope = createScope(parentScope);
            const derivedNames = registerCtes(node, targetScope);

            registerSource(node.table, targetScope, derivedNames);

            if (Array.isArray(node.columns)) {
                for (const column of node.columns) {
                    const columnName = readIdentifier(column);

                    if (columnName) {
                        addField(columnName, null, targetScope);
                    }
                }
            }

            if (isRecord(node.values) && node.values.type === "select") {
                walkStatement(node.values, parentScope);
            } else {
                // Values contain data parameters, not dynamic field names.
                walkValue(node.values, targetScope, VALUE_CONTEXT);
            }

            if (Array.isArray(node.on_duplicate_update)) {
                for (const assignment of node.on_duplicate_update) {
                    if (!isRecord(assignment)) {
                        continue;
                    }

                    const columnName = readIdentifier(assignment.column);

                    if (columnName) {
                        addField(columnName, readIdentifier(assignment.table), targetScope);
                    }

                    walkValue(assignment.value, targetScope, VALUE_CONTEXT);
                }
            }
        };

        const processDelete = (node: AstRecord, parentScope?: SqlScope): void => {
            const scope = createScope(parentScope);
            const derivedNames = registerCtes(node, scope);
            const sources = node.from ?? node.table;

            registerSource(sources, scope, derivedNames);
            walkFromSource(sources, scope, parentScope);
            walkValue(node.where, scope, VALUE_CONTEXT);
            walkValue(node.orderby, scope, VALUE_CONTEXT);
        };

        walkStatement = (value: unknown, parentScope?: SqlScope): void => {
            if (Array.isArray(value)) {
                value.forEach((item) => walkStatement(item, parentScope));
                return;
            }

            if (!isRecord(value)) {
                return;
            }

            switch (value.type) {
                case "select":
                    processSelect(value, parentScope);
                    return;
                case "update":
                    processUpdate(value, parentScope);
                    return;
                case "insert":
                case "replace":
                    processInsert(value, parentScope);
                    return;
                case "delete":
                    processDelete(value, parentScope);
                    return;
                default: {
                    const scope = createScope(parentScope);
                    const derivedNames = registerCtes(value, scope);
                    registerSource(value.table, scope, derivedNames);
                    registerSource(value.from, scope, derivedNames);
                    walkValue(value, scope, VALUE_CONTEXT);
                }
            }
        };

        walkStatement(ast);

        return { fields, cteNames };
    }
}
