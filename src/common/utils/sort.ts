export type SortOption = string | Record<string, 1 | -1 | "asc" | "desc">;

export function parseSort(sort?: string): SortOption {
    if (!sort) return { createdAt: -1 };
    if (sort.startsWith("-")) {
        return { [sort.slice(1)]: -1 };
    }
    return { [sort]: 1 };
}