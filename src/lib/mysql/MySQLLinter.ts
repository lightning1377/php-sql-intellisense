import { Parser } from "node-sql-parser";
import { MySqlDatabase } from "./MySqlDatabase";

export class MySQLLinter {
    private database: MySqlDatabase | undefined;
    private parser = new Parser();

    public setDb(database: MySqlDatabase) {
        this.database = database;
    }

    public async parseDocument() {
        if (!this.database) {
            return;
        }
        const tcAst = this.parser.parse("SELECT * FROM logs AS l LEFT JOIN players AS p ON p.player_id = l.player_id");

        console.log(tcAst);
        // Database::prepare("SELECT gbc.`apply_filter` FROM `game_config` AS gc LEFT JOIN `game_board_config` AS gbc ON gc.`game_board` = gbc.`row_id`")

        const tables = tcAst.tableList.map((tableAst) => {
            const [queryType, _, tableName] = tableAst.split("::");
            return tableName;
        });

        const fields = tcAst.columnList.map((fieldAst) => {
            const [queryType, tableName, fieldName] = fieldAst.split("::");
            return { tableName, fieldName };
        });

        const dbTables = (await this.database.getTableNames()).map((item) => item.insertText);

        if (tables.find((table) => !dbTables.includes(table))) {
            console.log("a table was not found");
        } else {
            console.log("tables were found");
        }

        const dbFields: Record<string, string[]> = {};
        for (const tableName of fields.map((fieldData) => fieldData.tableName)) {
            if (!tableName) {
                continue;
            }
            if (!(tableName in dbFields)) {
                dbFields[tableName] = (await this.database.getFieldNames(tableName)).map((item) => item.insertText as string);
            }
        }

        for (const { tableName, fieldName } of fields) {
            if (fieldName !== "(.*)" && !dbFields[tableName].includes(fieldName)) {
                console.log("field name not found", fieldName);
            } else {
                console.log("field name found", fieldName);
            }
        }
    }
}
