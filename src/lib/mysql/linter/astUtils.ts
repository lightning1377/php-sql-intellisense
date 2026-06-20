import type { AstRecord } from "./types";

export function isRecord(value: unknown): value is AstRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readIdentifier(value: unknown): string | null {
    if (typeof value === "string") {
        return value;
    }

    if (!isRecord(value)) {
        return null;
    }

    if (typeof value.value === "string") {
        return value.value;
    }

    if (typeof value.name === "string") {
        return value.name;
    }

    return null;
}

/** SQL identifiers should not depend on the host machine's locale. */
export function normalizeIdentifier(identifier: string): string {
    return identifier.toLowerCase();
}

export function getNestedAst(value: unknown): unknown {
    if (!isRecord(value)) {
        return undefined;
    }

    if (value.ast !== undefined) {
        return value.ast;
    }

    if (value.type === "select") {
        return value;
    }

    const expr = value.expr;

    if (isRecord(expr)) {
        if (expr.ast !== undefined) {
            return expr.ast;
        }

        if (expr.type === "select") {
            return expr;
        }
    }

    const statement = value.stmt;

    if (isRecord(statement)) {
        if (statement.ast !== undefined) {
            return statement.ast;
        }

        if (statement.type === "select") {
            return statement;
        }
    }

    return undefined;
}
