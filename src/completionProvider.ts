import { CompletionItemProvider, TextDocument, Position, CancellationToken, CompletionItem, CompletionItemKind } from "vscode";
import { processLine, processQueryString } from "./lib/helpers";
import { MySqlDatabase } from "./lib/database";

export class MySQLCompletionProvider implements CompletionItemProvider {
    private database;
    constructor() {
        this.database = new MySqlDatabase({
            host: "localhost",
            user: "root",
            password: "mylocal1234",
            database: "LocalTest"
        });
    }
    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken) {
        const line = document.lineAt(position).text;
        const res = processLine(line, position.character);

        if (!res || !res.context) {
            return [];
        }

        const { context, tableName } = res;
        if (context === "table") {
            return await this.database.getTableNames();
        }

        if (context === "field" && tableName) {
            return await this.database.getFieldNames(tableName);
        }
    }
}
