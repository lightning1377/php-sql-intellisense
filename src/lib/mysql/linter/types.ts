export interface ParsedField {
    tableName: string | null;
    fieldName: string;
}

export interface ParsedQuery {
    tables: string[];
    fields: ParsedField[];
}

export interface SqlScope {
    /**
     * Maps table names and aliases to physical database tables.
     * A null value means the source is derived, such as a CTE or subquery.
     */
    sources: Map<string, string | null>;

    /** Physical tables declared directly in this query scope. */
    physicalTables: Set<string>;

    /** Aliases declared in the SELECT list. */
    selectAliases: Set<string>;

    /**
     * Whether the current statement's FROM sources include a CTE or subquery.
     * This does not include derived sources merely inherited from a parent scope.
     */
    hasLocalDerivedSource: boolean;
}

export type AstRecord = Record<string, unknown>;
