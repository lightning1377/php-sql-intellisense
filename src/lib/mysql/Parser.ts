import { ALL_KEYWORDS, FIELD_NAME_KEYWORDS, JOIN_KEYWORDS } from "../constants";

// Define types and interfaces
type QueryContext = "table" | "field" | false;

enum QueryKeyword {
    SELECT = "SELECT",
    FROM = "FROM",
    INSERT_INTO = "INSERT INTO",
    UPDATE = "UPDATE",
    VALUES = "VALUES",
    SET = "SET"
}

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

// Main parser function
export function parser(queryString: string, pointerIndex: number): ParsedQuery {
    // If the pointer is at the backtick, the backtick is not included as part of the query; otherwise, retain the original query string
    const query = queryString[pointerIndex] === "`" ? queryString.substring(0, pointerIndex) + queryString.substring(pointerIndex) : queryString;
    const fields: Field[] = [];
    const tables: Table[] = [];
    let context: QueryContext = false;
    let fromTable: string = "";

    // Retrieve the character before the pointer index
    const indexOfCharacterBeforePointer = pointerIndex - 1;
    const characterBeforePointer = queryString[indexOfCharacterBeforePointer];

    // Check the type of SQL query and parse accordingly
    if (query.startsWith(QueryKeyword.SELECT)) {
        parseSelectQuery(query, pointerIndex);
    } else if (query.startsWith(QueryKeyword.INSERT_INTO)) {
        parseInsertQuery(query, pointerIndex);
    } else if (query.startsWith(QueryKeyword.UPDATE)) {
        parseUpdateQuery(query, pointerIndex);
    }

    // Return the parsed query object
    return { fields, tables, context, fromTable };

    // Function to parse SELECT queries
    function parseSelectQuery(query: string, _pointerIndex: number) {
        const fromIndex = query.indexOf(QueryKeyword.FROM);
        if (fromIndex !== -1) {
            const selectPart = query.substring(QueryKeyword.SELECT.length, fromIndex).trim();
            const selectItems = selectPart.split(",").map((item) => item.trim());
            selectItems.forEach(parseSelectItem);

            const tablePart = query.substring(fromIndex + QueryKeyword.FROM.length).trim();
            parseJoinClauses(tablePart);
            parseContext(query, fromIndex);
        }

        // Function to determine the context (table or field) based on the pointer index
        function parseContext(query: string, fromIndex: number) {
            const firstKeyword = getFirstKeywordBeforePointer(query, _pointerIndex);
            const isFieldContext = FIELD_NAME_KEYWORDS.includes(firstKeyword);

            if (!isFieldContext && fromIndex + QueryKeyword.FROM.length < _pointerIndex) {
                if ([",", " "].includes(characterBeforePointer)) {
                    context = "table";
                }
            } else if (isFieldContext || fromIndex > _pointerIndex) {
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
    }

    // Function to parse INSERT queries
    function parseInsertQuery(query: string, _pointerIndex: number) {
        if (_pointerIndex > QueryKeyword.INSERT_INTO.length) {
            const valuesIndex = query.indexOf(QueryKeyword.VALUES);
            const selectIndex = query.indexOf(QueryKeyword.SELECT);
            parseContext(query, valuesIndex, selectIndex);
        }

        function parseContext(query: string, valuesIndex: number, selectIndex: number) {
            const tablePart = query.substring(QueryKeyword.INSERT_INTO.length, valuesIndex > -1 ? valuesIndex : undefined).trim();
            const regex = /\(([^)]+)\)/;
            const match = tablePart.match(regex);
            const specificColumnsPart = match ? `(${match[1]})` : null;
            const indexOfSpecificColumnsPart = query.indexOf(specificColumnsPart ?? "");
            const isFieldContext = indexOfSpecificColumnsPart > 0 && specificColumnsPart ? _pointerIndex > indexOfSpecificColumnsPart && _pointerIndex < indexOfSpecificColumnsPart + specificColumnsPart.length : false;
            if (!isFieldContext && ((valuesIndex === -1 && selectIndex === -1) || _pointerIndex < valuesIndex || _pointerIndex < selectIndex)) {
                if ([",", " "].includes(characterBeforePointer)) {
                    context = "table";
                }
            } else if (isFieldContext || (valuesIndex !== -1 && _pointerIndex > valuesIndex + QueryKeyword.VALUES.length) || (selectIndex !== -1 && _pointerIndex > selectIndex + QueryKeyword.SELECT.length)) {
                if (selectIndex === -1 || _pointerIndex < selectIndex) {
                    if ([",", " ", "("].includes(characterBeforePointer)) {
                        context = "field";
                        fromTable = tablePart.replace(specificColumnsPart ?? "", "");
                    }
                } else if (_pointerIndex > selectIndex + QueryKeyword.SELECT.length) {
                    const selectQuery = query.substring(selectIndex);
                    parseSelectQuery(selectQuery, pointerIndex - selectIndex);
                }
            }
        }
    }

    // Function to parse UPDATE queries
    function parseUpdateQuery(query: string, _pointerIndex: number) {
        if (_pointerIndex > QueryKeyword.UPDATE.length) {
            const setIndex = query.indexOf(QueryKeyword.SET);
            parseContext(query, setIndex);
        }
        function parseContext(query: string, setIndex: number) {
            const indexOfCharacterBeforePointer = _pointerIndex - 1;
            const characterBeforePointer = queryString[indexOfCharacterBeforePointer];
            const tablePart = query.substring(QueryKeyword.UPDATE.length, setIndex).trim();
            if ([",", " "].includes(characterBeforePointer)) {
                if (setIndex === -1 || _pointerIndex < setIndex) {
                    context = "table";
                } else {
                    context = "field";
                    fromTable = tablePart;
                }
            }
        }
    }

    // Function to parse SELECT item
    function parseSelectItem(item: string) {
        const parts = item.split(".");
        const name = parts.pop() || "";
        const alias = "";
        const sourceTable = parts.join(".");
        fields.push({ sourceTable, name, alias });
    }

    // Function to parse JOIN clauses
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

        // Function to get the first JOIN clause
        function getFirstJoinClause(input: string): string | undefined {
            return JOIN_KEYWORDS.find((keyword) => input.includes(keyword));
        }
    }

    // Function to get the first keyword before the pointer index
    function getFirstKeywordBeforePointer(input: string, index: number): string {
        let word = "";
        let nextIndex = index;

        while (nextIndex > 0 && !ALL_KEYWORDS.includes(word)) {
            word = getWordBeforePointer(input, nextIndex, false);
            nextIndex -= word.length;
            word = word.trim();
        }

        return word.trim();

        // Function to get the word before the pointer index
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
}
