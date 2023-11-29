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
        const linePrefix = line.substring(0, position.character);

        if (linePrefix.includes('Database::prepare("SELECT * FROM')) {
            return await this.getTableNames();
        } else if (linePrefix.includes('Database::prepare("SELECT ')) {
            const restOfLine = line.substring(position.character)?.trim();
            const beforeC = restOfLine.substring(0, restOfLine.indexOf('"'));
            const tableName = beforeC.replace("FROM", "")?.trim().split(" ")[0];
            console.log({ tableName });
            if (tableName) {
                return await this.getFieldNames(tableName);
            } else {
                return [];
            }
        }

        return [];
    }
    async processQueryString(query: string, pointerIndex: number) {
        const tableNameKeywords = ["FROM", "JOIN"];
        const fieldNameKeywords = ["SELECT"];
        const allKeyWords = [...tableNameKeywords, ...fieldNameKeywords];

        const wordBeforePointer = getWordBeforePointer(query, pointerIndex);
        if (allKeyWords.includes(wordBeforePointer)) {
            if (fieldNameKeywords.includes(wordBeforePointer)) {
                return "field";
            } else if (tableNameKeywords.includes(wordBeforePointer)) {
                return "table";
            }
        }
        return null;
    }
}

function getWordBeforePointer(input: string, pointerIndex: number) {
    if (pointerIndex < 0 || pointerIndex >= input.length) {
        // Invalid pointer index
        return "";
    }

    // Find the start of the word before the pointer
    let startIndex = pointerIndex - 1;
    while (startIndex >= 0 && input[startIndex] !== " ") {
        startIndex--;
    }

    // Extract the word
    const wordBeforePointer = input.slice(startIndex + 1, pointerIndex);

    return wordBeforePointer;
}
