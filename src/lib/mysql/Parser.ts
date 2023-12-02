import { allKeyWords, fieldNameKeywords } from "../constants";

type QueryContext = "table" | "field" | false;

enum QueryKeyword {
    SELECT = "SELECT",
    FROM = "FROM",
    INSERT_INTO = "INSERT INTO",
    UPDATE = "UPDATE",
    VALUES = "VALUES"
}

const JOIN_KEYWORDS = ["JOIN", "LEFT JOIN", "RIGHT JOIN"];

interface Field {
    sourceTable: string;
    name: string;
    alias: string;
}

interface Table {
    name: string;
    alias: string;
}

interface ParsedQuery {
    fields: Field[];
    tables: Table[];
    context: QueryContext;
    fromTable: string;
}

export function parser(queryString: string, pointerIndex: number): ParsedQuery {
    const query = queryString[pointerIndex] === "`" ? queryString.substring(0, pointerIndex) + queryString.substring(pointerIndex) : queryString;
    const fields: Field[] = [];
    const tables: Table[] = [];
    let context: QueryContext = false;
    let fromTable: string = "";

    if (query.startsWith(QueryKeyword.SELECT)) {
        parseSelectQuery(query);
    } else if (query.startsWith(QueryKeyword.INSERT_INTO)) {
        parseInsertQuery(query);
    } else if (query.startsWith(QueryKeyword.UPDATE)) {
        // parse update query
    }

    return { fields, tables, context, fromTable };

    function parseSelectQuery(query: string) {
        const fromIndex = query.indexOf(QueryKeyword.FROM);
        if (fromIndex !== -1) {
            const selectPart = query.substring(QueryKeyword.SELECT.length, fromIndex).trim();
            const selectItems = selectPart.split(",").map((item) => item.trim());
            selectItems.forEach(parseSelectItem);

            const tablePart = query.substring(fromIndex + QueryKeyword.FROM.length).trim();
            parseJoinClauses(tablePart);
            parseContext(query, fromIndex);
        }
    }

    function parseInsertQuery(query: string) {
        if (pointerIndex > QueryKeyword.INSERT_INTO.length) {
            const valuesIndex = query.indexOf(QueryKeyword.VALUES);
            if (pointerIndex < valuesIndex) {
                context = "table";
            } else if (pointerIndex > valuesIndex + QueryKeyword.VALUES.length) {
                context = "field";
            }
        }
    }

    function parseSelectItem(item: string) {
        const parts = item.split(".");
        const name = parts.pop() || "";
        const alias = "";
        const sourceTable = parts.join(".");
        fields.push({ sourceTable, name, alias });
    }

    function parseJoinClauses(tablePart: string) {
        let index = 0;
        do {
            const remainingPart = tablePart.substring(index);
            const nextJoinClause = getFirstJoinClause(remainingPart);
            const endIndex = nextJoinClause ? remainingPart.indexOf(nextJoinClause) : remainingPart.length;
            const part = remainingPart.substring(0, endIndex).trim();
            index += endIndex + (nextJoinClause ? nextJoinClause.length : 0);
            const joinParts = part.split(/\s+/);
            const name = joinParts[0];
            const alias = joinParts[2] || "";
            tables.push({ name, alias });
        } while (index < tablePart.length);
    }

    function parseContext(query: string, fromIndex: number) {
        const indexOfCharacterBeforePointer = pointerIndex - 1;
        const characterBeforePointer = queryString[indexOfCharacterBeforePointer];
        const firstKeyword = getFirstKeywordBeforePointer(query, pointerIndex);
        const isFieldContext = fieldNameKeywords.includes(firstKeyword);

        if (!isFieldContext && fromIndex + QueryKeyword.FROM.length < pointerIndex) {
            if ([",", " "].includes(characterBeforePointer)) {
                context = "table";
            }
        } else if (isFieldContext || fromIndex > pointerIndex) {
            context = "field";
            if (characterBeforePointer === ".") {
                let tableNameAliasStartIndex = indexOfCharacterBeforePointer;
                while (queryString[tableNameAliasStartIndex] !== " " && tableNameAliasStartIndex > 0) {
                    tableNameAliasStartIndex--;
                }
                const tableNameAlias = queryString.substring(tableNameAliasStartIndex + 1, indexOfCharacterBeforePointer);
                const tableObj = tables.find((tb) => tb.name === tableNameAlias || tb.alias === tableNameAlias);
                if (tableObj) {
                    fromTable = tableObj.name;
                }
            } else if ([",", " "].includes(characterBeforePointer) && tables.length === 1) {
                fromTable = tables[0].name;
            }
        }
    }

    function getFirstJoinClause(input: string): string | undefined {
        return JOIN_KEYWORDS.find((keyword) => input.includes(keyword));
    }

    function getFirstKeywordBeforePointer(input: string, index: number): string {
        let word = "";
        let nextIndex = index;

        while (nextIndex > 0 && !allKeyWords.includes(word)) {
            word = getWordBeforePointer(input, nextIndex, false);
            nextIndex -= word.length;
            word = word.trim();
        }

        return word.trim();
    }

    function getWordBeforePointer(input: string, pointerIndex: number, trim = true) {
        if (pointerIndex < 0 || pointerIndex >= input.length) {
            return "";
        }

        let startIndex = pointerIndex - 1;
        while (startIndex >= 0 && input[startIndex] === " ") {
            startIndex--;
        }

        while (startIndex >= 0 && input[startIndex] !== " ") {
            startIndex--;
        }

        const wordBeforePointer = input.slice(startIndex + 1, pointerIndex);

        return trim ? wordBeforePointer.trim() : wordBeforePointer;
    }
}
