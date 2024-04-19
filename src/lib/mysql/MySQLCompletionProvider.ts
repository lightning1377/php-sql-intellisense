import { CompletionItemProvider, TextDocument, Position, CancellationToken, OutputChannel, CompletionItem } from "vscode";
import { extractSQLQueries } from "../helpers";
import { MySqlDatabase } from "./MySqlDatabase";
import { parser } from "./Parser";

export class MySQLCompletionProvider implements CompletionItemProvider {
    private database: MySqlDatabase | null = null;
    private outputChannel: OutputChannel;

    // Constructor initializes the output channel
    constructor(outputChannel: OutputChannel) {
        this.outputChannel = outputChannel;
    }

    // Method to set the database connection
    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    // Method to provide completion items
    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionItem[]> {
        if (!this.database) {
            return [];
        }

        // Get the index of the cursor in the document
        const pointerIndex = document.offsetAt(position);

        // Find the SQL query at the cursor position
        const queryData = extractSQLQueries(document.getText()).find(({ query, startIndex }) => pointerIndex > startIndex && pointerIndex < startIndex + query.length);
        if (!queryData) {
            return [];
        }
        const { query, startIndex } = queryData;
        const cleanedQuery = query.replace(/\s+/g, " ");
        const queryPointerIndex = pointerIndex - (startIndex + 1);
        const restOfQuery = query.substring(queryPointerIndex).replace(/\s+/g, " ");

        // Adjust the pointer index for the cleaned query
        const cleanedQueryPointerIndex = cleanedQuery.indexOf(restOfQuery);

        // Parse the SQL query to determine context (table or field)
        const res = parser(cleanedQuery, cleanedQueryPointerIndex);

        if (!res || !res.context) {
            return [];
        }

        // Provide completion items based on the context
        const { context, fromTable } = res;
        if (context === "table") {
            return await this.database.getTableNames();
        }

        if (context === "field" && fromTable) {
            return await this.database.getFieldNames(fromTable);
        }

        return [];
    }
}
