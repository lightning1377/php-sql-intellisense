import type { OutputChannel } from "vscode";
import type { MySqlDatabase } from "../MySqlDatabase";

export async function loadDatabaseFields(
    database: MySqlDatabase,
    tableNames: Iterable<string>,
    outputChannel: OutputChannel
): Promise<Map<string, Set<string>>> {
    const entries = await Promise.all(
        Array.from(tableNames).map(async (tableName): Promise<readonly [string, Set<string>] | null> => {
            try {
                const fieldItems = await database.getFieldNames(tableName);
                const fields = fieldItems
                    .map((item) => item.insertText)
                    .filter((insertText): insertText is string => typeof insertText === "string" && insertText.length > 0);

                return [tableName, new Set(fields)] as const;
            } catch (error) {
                outputChannel.appendLine(
                    `Could not retrieve fields for table '${tableName}': ${error instanceof Error ? error.message : String(error)}`
                );

                // Do not return an empty schema: that would mark every field as invalid.
                return null;
            }
        })
    );

    return new Map(entries.filter((entry): entry is readonly [string, Set<string>] => entry !== null));
}
