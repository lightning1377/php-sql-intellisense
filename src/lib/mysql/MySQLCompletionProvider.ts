import { CompletionItemProvider, TextDocument, Position, CancellationToken, OutputChannel } from "vscode";
import { processLine } from "../helpers";
import { MySqlDatabase } from "./MySqlDatabase";

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
        const line = document.lineAt(position).text;
        const res = processLine(line, position.character);

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
