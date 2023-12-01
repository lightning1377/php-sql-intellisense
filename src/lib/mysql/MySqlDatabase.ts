import { Connection, ConnectionOptions, QueryError, RowDataPacket, createConnection } from "mysql2";
import { CompletionItem, CompletionItemKind } from "vscode";

export class MySqlDatabase {
    private connection: Connection;
    constructor(config: ConnectionOptions) {
        this.connection = createConnection(config);
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

    public getTableNames = async () => {
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

    public getFieldNames = async (tableName: string) => {
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

    public getIsConnected = async () => {
        return await new Promise<QueryError | true>((resolve) => {
            this.connection.ping((err) => (err ? resolve(err) : resolve(true)));
        });
    };

    // Destructor method to disconnect from the database when the instance is destroyed
    public destroy = async () => {
        try {
            const connected = await this.getIsConnected();
            if (connected === true) {
                this.connection.end((err) => {
                    if (err) {
                        console.error("Error closing database connection:", err);
                    } else {
                        console.log("Database connection closed.");
                    }
                });
            }
        } catch (error) {}
    };
}
