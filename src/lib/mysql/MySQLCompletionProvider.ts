import { CompletionItemProvider, TextDocument, Position, CancellationToken, OutputChannel, CompletionItem, CompletionItemKind, Range } from "vscode";
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
        const queryData = extractSQLQueries(document.getText()).find(({ query, startIndex }) => pointerIndex >= startIndex && pointerIndex <= startIndex + query.length);
        if (!queryData) {
            return [];
        }
        const { query, startIndex } = queryData;
        const cleanedQuery = query.replace(/\s+/g, " ");
        const queryPointerIndex = pointerIndex - startIndex;

        // Adjust the pointer index for the cleaned query by cleaning the prefix up to the cursor
        const cleanedQueryBeforeCursor = query.substring(0, queryPointerIndex).replace(/\s+/g, " ");
        const cleanedQueryPointerIndex = cleanedQueryBeforeCursor.length;

        // Parse the SQL query to determine context (table or field)
        const res = parser(cleanedQuery, cleanedQueryPointerIndex);

        if (!res || !res.context) {
            return [];
        }

        // Provide completion items based on the context
        const { context, fromTable } = res;
        if (context === "table") {
            const items = await this.database.getTableNames();
            const textBeforeCursor = document.getText(new Range(new Position(0, 0), position));
            const hasOpeningBacktick = textBeforeCursor.endsWith("`");
            return items.map((item) => {
                const newItem = new CompletionItem(item.label, item.kind);
                newItem.detail = item.detail;
                const baseText = typeof item.insertText === "string" ? item.insertText : (typeof item.label === "string" ? item.label : item.label.label);
                if (hasOpeningBacktick) {
                    newItem.insertText = baseText + "`";
                } else {
                    newItem.insertText = item.insertText;
                }
                return newItem;
            });
        }

        if (context === "field" && fromTable) {
            return await this.database.getFieldNames(fromTable);
        }

        return [];
    }
}
