import { allKeyWords, fieldNameKeywords } from "../constants";
import { QueryContext } from "../types";

export function parser(queryString: string, pointerIndex: number) {
    const query = queryString[pointerIndex] === "`" ? queryString.substring(0, pointerIndex) + queryString.substring(pointerIndex) : queryString;
    const fields: { sourceTable: string; name: string; alias: string }[] = [];
    const tables: { name: string; alias: string }[] = [];
    let context: QueryContext = false;
    let fromTable: string = "";
    if (query.startsWith("SELECT")) {
        // parse select query
        if (query.includes("FROM")) {
            const selectPart = query.substring("SELECT".length, query.indexOf("FROM")).trim();
            const selectItems = selectPart.split(",").map((item) => item.trim());

            selectItems.forEach((item) => {
                const parts = item.split(".");
                const name = parts.pop() || ""; // Extract the last part as the field name
                const alias = ""; // Default to empty string, as the alias is not provided in this context
                const sourceTable = parts.join("."); // Join the remaining parts as the source table

                fields.push({ sourceTable, name, alias });
            });

            const partAfterFrom = query.substring(query.indexOf("FROM"));
            const tablePart = partAfterFrom.substring("FROM".length).trim();

            let index = 0;
            do {
                const remainingPart = tablePart.substring(index);
                const nextJoinClause = getFirstJoinClause(remainingPart);
                let endIndex: number;
                if (!nextJoinClause) {
                    endIndex = remainingPart.length;
                } else {
                    endIndex = remainingPart.indexOf(nextJoinClause);
                }
                const part = remainingPart.substring(0, endIndex).trim();
                index += endIndex + (nextJoinClause ? nextJoinClause.length : 0);
                const joinParts = part.split(/\s+/);
                const name = joinParts[0];
                const alias = joinParts[2] || ""; // Assuming alias is optional

                tables.push({ name, alias });
            } while (index < tablePart.length);

            const indexOfCharacterBeforePointer = pointerIndex - 1;
            const characterBeforePointer = queryString[indexOfCharacterBeforePointer];
            const FROM_INDEX = queryString.indexOf("FROM");
            const firstKeyword = getFirstKeywordBeforePointer(queryString, pointerIndex);
            const isFieldContext = fieldNameKeywords.includes(firstKeyword);
            if (!isFieldContext && FROM_INDEX + "FROM".length < pointerIndex) {
                // pointer is after FROM
                if ([",", " "].includes(characterBeforePointer)) {
                    context = "table";
                }
            } else if (isFieldContext || FROM_INDEX > pointerIndex) {
                // pointer is before FROM
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
    } else if (query.startsWith("INSERT INTO")) {
        if (query.includes("SELECT")) {
            // parse insert into select query
        } else {
            // parse insert query
        }
    } else if (query.startsWith("UPDATE")) {
        // parse update query
    }

    return { fields, tables, context, fromTable };
}

function getFirstJoinClause(input: string) {
    const joinIndex = input.indexOf("JOIN");
    if (joinIndex !== -1) {
        const leftJoinIndex = input.indexOf("LEFT JOIN");
        if (leftJoinIndex !== -1 && leftJoinIndex < joinIndex) {
            return "LEFT JOIN";
        }
        const rightJoinIndex = input.indexOf("RIGHT JOIN");
        if (rightJoinIndex !== -1 && rightJoinIndex < joinIndex) {
            return "RIGHT JOIN";
        }
        return "JOIN";
    }
}

function getFirstKeywordBeforePointer(input: string, index: number) {
    let word = "",
        nextIndex = index;
    while (nextIndex > 0 && !allKeyWords.includes(word)) {
        word = getWordBeforePointer(input, nextIndex, false);
        nextIndex -= word.length;
        word = word.trim();
    }
    return word.trim();

    function getWordBeforePointer(input: string, pointerIndex: number, trim = true) {
        if (pointerIndex < 0 || pointerIndex >= input.length) {
            // Invalid pointer index
            return "";
        }

        // Find the start of the word before the pointer
        let startIndex = pointerIndex - 1;
        while (startIndex >= 0 && input[startIndex] === " ") {
            startIndex--;
        }
        while (startIndex >= 0 && input[startIndex] !== " ") {
            startIndex--;
        }

        // Extract the word
        const wordBeforePointer = input.slice(startIndex + 1, pointerIndex);

        return trim ? wordBeforePointer.trim() : wordBeforePointer;
    }
}
