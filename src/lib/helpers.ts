import { allKeyWords, fieldNameKeywords, tableNameKeywords } from "./constants";
import { MySQLCompletionProvider } from "./mysql/MySQLCompletionProvider";
import { parser } from "./mysql/Parser";
import { QueryContext, TableName } from "./types";
import * as vscode from "vscode";

function processQueryString(query: string, pointerIndex: number): { context: QueryContext; tableName: TableName } {
    let context: QueryContext = false,
        tableName: string | false = false;

    // const wordBeforePointer = getFirstKeywordBeforePointer(query, pointerIndex);
    // if (allKeyWords.includes(wordBeforePointer)) {
    //     if (fieldNameKeywords.includes(wordBeforePointer)) {
    //         context = "field";
    //     } else if (tableNameKeywords.includes(wordBeforePointer)) {
    //         context = "table";
    //     }
    // }
    // const FROM_INDEX = query.indexOf("FROM");
    // if (FROM_INDEX !== -1) {
    //     tableName = query.substring(FROM_INDEX).replace("FROM", "").trim().split(" ")[0];
    //     tableName = tableName.split("`").join("");
    // }
    return { context, tableName };
}
export function processLine(line: string, pointerIndex: number) {
    const query = getContainedQuery(line);
    if (query) {
        const index = line.indexOf(query);
        return parser(query, pointerIndex - (index + 1));
    }
    return false;
}
function getContainedQuery(input: string) {
    const regex = /\bDatabase::(prepare|getResults|getValue|getRow)\("([^"]*)"\)/;
    const match = input.match(regex);
    return match?.[2];
}
export const onConnectCommand = async (completionProvider: MySQLCompletionProvider, context: vscode.ExtensionContext) => {
    // get extension db config
    const dbConfig = vscode.workspace.getConfiguration("SQL-PHP.Intellisense").get("database") as { host: string; name: string };
    const connectionOptions = {
        host: dbConfig.host,
        database: dbConfig.name,
        user: "",
        password: ""
    };
    // get credentials for connecting to db
    const credentials = await getDbCredentials(context);
    if (credentials) {
        connectionOptions.user = credentials.user;
        connectionOptions.password = credentials.password;
        const status = await completionProvider.connect(connectionOptions);
        if (status) {
            vscode.window.showInformationMessage("Successfully connected to database");
        } else {
            vscode.window.showInformationMessage("Could not connect to database");
            await context.secrets.delete("SQL-PHP.Intellisense.user");
            await context.secrets.delete("SQL-PHP.Intellisense.password");
        }
    }
};

async function getDbCredentials(context: vscode.ExtensionContext) {
    const user = await context.secrets.get("SQL-PHP.Intellisense.user");
    if (!user) {
        const inputUser = await vscode.window.showInputBox({ title: "Database user", ignoreFocusOut: true });
        if (inputUser) {
            await context.secrets.store("SQL-PHP.Intellisense.user", inputUser);
            return getDbCredentials(context);
        }
    }
    const password = await context.secrets.get("SQL-PHP.Intellisense.password");
    if (!password) {
        const inputPassword = await vscode.window.showInputBox({ title: "Database password", ignoreFocusOut: true });
        if (inputPassword) {
            await context.secrets.store("SQL-PHP.Intellisense.password", inputPassword);
            return getDbCredentials(context);
        }
    }

    if (user && password) {
        return { user, password };
    }
}
