import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionItemKind } from "vscode";
import { Connection, RowDataPacket, createConnection } from "mysql2";

export class MySQLCompletionProvider implements CompletionItemProvider {
    private connection: Connection;
    constructor() {
        this.connection = createConnection({
            host: "localhost",
            user: "root",
            password: "mylocal1234",
            database: "LocalTest"
        });
    }
    private queryPromise = (sql: string) => {
        return new Promise<RowDataPacket[]>((resolve, reject) => {
            this.connection.query(sql, (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results as RowDataPacket[]);
                }
            });
        });
    };
    private getTableNames = async () => {
        try {
            // Fetch table names from the database
            const results = await this.queryPromise("SHOW TABLES");
            const tableNames = results.map((row) => row[`Tables_in_${this.connection.config.database?.toLowerCase()}`]);
            return tableNames.map((tableName: string) => {
                const item = new CompletionItem(tableName, CompletionItemKind.Field);
                item.insertText = tableName;
                item.detail = "Table name";
                return item;
            });
        } catch (error) {
            return [];
        }
    };
    private getFieldNames = async (tableName: string) => {
        try {
            const results = await this.queryPromise(`SHOW COLUMNS FROM ${tableName};`);
            const fieldNames = results.map((row) => row["Field"]);
            return fieldNames.map((fieldName) => {
                const item = new CompletionItem(fieldName, CompletionItemKind.Field);
                item.insertText = fieldName;
                item.detail = "Field name";
                return item;
            });
        } catch (error) {
            return [];
        }
    };
    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken) {
        const line = document.lineAt(position).text;
        if (line.includes(`Database::prepare("`)) {
            const startIndex = line.indexOf('"');
            const endIndex = line.indexOf('"', startIndex + 1);
            if (position.character <= endIndex && position.character > startIndex) {
                const sqlString = line.substring(startIndex + 1, endIndex);
                const { context, tableName } = processQueryString(sqlString, position.character - (startIndex + 1) - 1);
                if (context) {
                    switch (context) {
                        case "table":
                            return await this.getTableNames();
                        case "field":
                            if (tableName) {
                                return await this.getFieldNames(tableName);
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
        }

        return [];
    }
}

type QueryContext = "table" | "field" | false;
type TableName = string | false;
function processQueryString(query: string, pointerIndex: number): { context: QueryContext; tableName: TableName } {
    let context: QueryContext = false,
        tableName: string | false = false;

    const wordBeforePointer = getFirstKeywordBeforePointer(query, pointerIndex);
    if (allKeyWords.includes(wordBeforePointer)) {
        if (fieldNameKeywords.includes(wordBeforePointer)) {
            context = "field";
        } else if (tableNameKeywords.includes(wordBeforePointer)) {
            context = "table";
        }
    }
    const FROM_INDEX = query.indexOf("FROM");
    if (FROM_INDEX !== -1) {
        tableName = query.substring(FROM_INDEX).replace("FROM", "").trim().split(" ")[0];
        tableName = tableName.split("`").join("");
    }
    return { context, tableName };
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
}
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

const tableNameKeywords = ["FROM", "JOIN"];
const fieldNameKeywords = ["SELECT"];
const allKeyWords = [...tableNameKeywords, ...fieldNameKeywords];
