
import {
    Model,
    QueryFilter,
    QueryOptions,
    PopulateOptions
} from "mongoose";

import { IFindOptions } from "../../common/interface";
import { HydratedDocument } from "mongoose";



export abstract class MainRepo<T> {
    constructor(public readonly model: Model<T>) {}

    create = async (data: Partial<T>) => {
        return await this.model.create([data]);
    };

    findOne = async (
        filter: QueryFilter<T> = {},
        options: QueryOptions<T> = {}
    ) => {
        return await this.model.findOne(filter).setOptions(options);
    };

    findById = async (
        ID: string,
        options: QueryOptions<T> = {}
    ) => {
        return await this.model.findById(ID).setOptions(options);
    };

    findByIdAndUpdate = async (
        ID: string,
        data: Partial<T>,
        options: QueryOptions<T> = {}
    ) => {
        return await this.model.findByIdAndUpdate(
            ID,
            data,
            { new: true, ...options }
        );
    };

    findByIdAndDelete = async (ID: string) => {
        return await this.model.findByIdAndDelete(ID);
    };

    find = async (
        filter: QueryFilter<T> = {},
        options: IFindOptions = {}
    ) => {
        const {
            page = 1,
            limit = 10,
            search,
            searchField,
            sort,
            populate
        } = options;

        if (search && searchField) {
            filter = {
                ...filter,
                [searchField]: { $regex: search, $options: "i" }
            };
        }

        const count = await this.model.countDocuments(filter);

        const totalPages = Math.ceil(count / limit);
        const skip = (page - 1) * limit;

        let query = this.model.find(filter)
            .skip(skip)
            .limit(limit);

        if (sort) query = query.sort(sort);
        if (populate) query = query.populate(populate as PopulateOptions);

        const data = await query;

        return {
            dataInfo: {
                count,
                totalPages,
                page,
                limit
            },
            data
        };
    };
}
