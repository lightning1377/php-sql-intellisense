export const tableNameKeywords = ["FROM", "JOIN"];
export const fieldNameKeywords = ["SELECT"];
export const allKeyWords = [...tableNameKeywords, ...fieldNameKeywords];
export const knownInitiators = ["Database::prepare(", "Database::getResults(", "Database::getValue(", "Database::getRow("];
export const getContainedQuery = (input: string) => {
    const regex = `/\bDatabase::prepare\(\s*"([^"]*)"\s*\)/`;
    const match = input.match(regex);
    return match ? { contains: true, query: match[1] } : { contains: false };
};
