import { CompletionItemProvider, TextDocument, Position, CancellationToken, OutputChannel } from "vscode";
import { extractSQLQueries } from "../helpers";
import { MySqlDatabase } from "./MySqlDatabase";
import { parser } from "./Parser";

export class MySQLCompletionProvider implements CompletionItemProvider {
    private database: MySqlDatabase | null = null;
    public connected = false;
    private outputChannel: OutputChannel;

    constructor(outputChannel: OutputChannel) {
        this.outputChannel = outputChannel;
    }

    public setDb(database: MySqlDatabase) {
        this.database = database;
    }
    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken) {
        if (!this.database) {
            return;
        }
        const pointerIndex = document.offsetAt(position); // index of pointer in document
        const queryData = extractSQLQueries(document.getText()).find(({ query, startIndex }) => pointerIndex > startIndex && pointerIndex < startIndex + query.length);
        if (!queryData) {
            return;
        }
        const { query, startIndex } = queryData;
        const cleanedQuery = query.replace(/\s+/g, " ");
        const queryPointerIndex = pointerIndex - (startIndex + 1);
        const restOfQuery = query.substring(queryPointerIndex).replace(/\s+/g, " ");

        // Adjust the pointer index for the cleaned query
        const cleanedQueryPointerIndex = cleanedQuery.indexOf(restOfQuery);

        const res = parser(cleanedQuery, cleanedQueryPointerIndex);

        // const line = document.lineAt(position).text;
        // const res = processLine(line, position.character);

        if (!res || !res.context) {
            return [];
        }

        const { context, fromTable, tables, fields } = res;
        if (context === "table") {
            return await this.database.getTableNames();
        }

        if (context === "field" && fromTable) {
            return await this.database.getFieldNames(fromTable);
        }
    }
}
