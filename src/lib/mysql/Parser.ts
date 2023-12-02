import { QueryContext } from "../types";

export function parser(queryString: string, pointerIndex: number) {
    const query = queryString[pointerIndex] === "`" ? queryString.substring(0, pointerIndex) + queryString.substring(pointerIndex) : queryString;
    const fields: { sourceTable: string; name: string; alias: string }[] = [];
    const tables: { name: string; alias: string }[] = [];
    let context: QueryContext = false;
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

    return { fields, tables };
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
