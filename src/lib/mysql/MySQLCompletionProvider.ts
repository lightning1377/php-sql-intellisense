import { CompletionItemProvider, TextDocument, Position, CancellationToken } from "vscode";
import { processLine } from "../helpers";
import { MySqlDatabase } from "./MySqlDatabase";
import { ConnectionOptions } from "mysql2";

export class MySQLCompletionProvider implements CompletionItemProvider {
    private database: MySqlDatabase | null = null;
    public connected = false;
    constructor() {}
    async connect(options: ConnectionOptions) {
        this.database = new MySqlDatabase(options);
        // test connection
        const connected = await this.database.getIsConnected();
        if (connected === true) {
            this.connected = true;
            return true;
        }
        this.database.destroy();
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
