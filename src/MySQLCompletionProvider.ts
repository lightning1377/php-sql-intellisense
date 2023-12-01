import { CompletionItemProvider, TextDocument, Position, CancellationToken } from "vscode";
import { processLine } from "./lib/helpers";
import { MySqlDatabase } from "./lib/database";
import { ConnectionOptions } from "mysql2";

export class MySQLCompletionProvider implements CompletionItemProvider {
    private database: MySqlDatabase | null = null;
    public connected = false;
    constructor() {}
    async connect(options: ConnectionOptions) {
        this.database = new MySqlDatabase(options);
        // test connection
        const res = await this.database.getTableNames();
        if (res.length) {
            this.connected = true;
            return true;
        }
        this.database = null;
        this.connected = false;
        return false;
    }
    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken) {
        if (!this.database) {
            return;
        }
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
