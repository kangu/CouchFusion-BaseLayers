const splitWords = (value: string): string[] =>
    value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_\-\s]+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean);

export const pascalCase = (value: string): string => {
    const words = splitWords(value);
    return words
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join("");
};

export const kebabCase = (value: string): string => {
    const words = splitWords(value);
    return words.map((word) => word.toLowerCase()).join("-");
};
