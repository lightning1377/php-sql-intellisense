import { Range, TextDocument } from "vscode";

function isIdentifierCharacter(character: string | undefined): boolean {
    return character !== undefined && /[\p{L}\p{N}_$]/u.test(character);
}

/**
 * Finds the next whole-token occurrence inside one extracted SQL query.
 * Whole-token matching avoids highlighting `id` inside `user_id`.
 */
export function findQueryTokenRange(
    document: TextDocument,
    documentText: string,
    token: string,
    queryStartIndex: number,
    queryLength: number,
    cursors: Map<string, number>,
    cursorKey: string
): Range | undefined {
    const queryEndIndex = queryStartIndex + queryLength;
    let searchIndex = cursors.get(cursorKey) ?? queryStartIndex;

    while (searchIndex < queryEndIndex) {
        const tokenStartIndex = documentText.indexOf(token, searchIndex);

        if (tokenStartIndex < queryStartIndex || tokenStartIndex < 0 || tokenStartIndex >= queryEndIndex) {
            return undefined;
        }

        const tokenEndIndex = tokenStartIndex + token.length;

        if (tokenEndIndex > queryEndIndex) {
            return undefined;
        }

        const before = tokenStartIndex > queryStartIndex ? documentText[tokenStartIndex - 1] : undefined;
        const after = tokenEndIndex < queryEndIndex ? documentText[tokenEndIndex] : undefined;

        if (!isIdentifierCharacter(before) && !isIdentifierCharacter(after)) {
            cursors.set(cursorKey, tokenEndIndex);
            return new Range(document.positionAt(tokenStartIndex), document.positionAt(tokenEndIndex));
        }

        searchIndex = tokenStartIndex + 1;
    }

    return undefined;
}
