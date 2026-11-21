import { PopulateOptions } from "mongoose";

export interface IFindOptions {
    page?: number;
    limit?: number;
    search?: string;
    searchField?: string;
    sort?: string | Record<string, 1 | -1 | "asc" | "desc">;
    populate?: string | PopulateOptions | (string | PopulateOptions)[];
}

export interface IDataInfo {
    count: number;
    totalPages: number;
    page: number;
    limit: number;
}