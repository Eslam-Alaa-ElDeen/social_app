
import {
    Model,
    QueryFilter,
    QueryOptions,
    PopulateOptions,
    AnyKeys,
    CreateOptions,
    FlattenMaps,
    UpdateQuery,
    MongooseUpdateQueryOptions,
    UpdateWriteOpResult
} from "mongoose";

import { IFindOptions, IPaginatedResult } from "../../common/interface";
import { HydratedDocument } from "mongoose";
import { DeleteResult } from "mongoose";



export abstract class MainRepo<T> {
    constructor(public readonly model: Model<T>) {}

    create(
        { data }: { data: AnyKeys<T> }
    ): Promise<HydratedDocument<T>>;

    create(
        { data, options }: {
            data: AnyKeys<T>[];
            options?: CreateOptions;
        }
    ): Promise<HydratedDocument<T>[]>;

    async create(
        { data, options }: {
            data: AnyKeys<T> | AnyKeys<T>[];
            options?: CreateOptions;
        }
    ): Promise<HydratedDocument<T> | HydratedDocument<T>[]> {

        if (Array.isArray(data)) {
            return await this.model.create(data as any, options);
        }
        return await this.model.create(data as any);
    }

    async createOne(
        { data, options={} }: {
            data: AnyKeys<T>;
            options?: CreateOptions;
        }
    ): Promise<HydratedDocument<T>> {
        const [doc] = await this.create({
            data: [data],
            options
        });

        return doc!;
    }

    findOne = async (
        filter: QueryFilter<T> = {},
        options: QueryOptions<T> = {}
    ):Promise<HydratedDocument<T>|FlattenMaps<T> |undefined|null> => {
        return await this.model.findOne(filter).setOptions(options);
    };

    findById = async (
        ID: string,
        options: QueryOptions<T> = {}
    ):Promise<HydratedDocument<T> |FlattenMaps<T> |undefined|null> => {
        return await this.model.findById(ID).setOptions(options);
    };

    findByIdAndUpdate = async (
        ID: string,
        data: Partial<T>,
        options: QueryOptions<T> = {}
    ):Promise<HydratedDocument<T> | FlattenMaps<T> | undefined | null> => {
        return await this.model.findByIdAndUpdate(
            ID,
            data,
            { new: true, ...options }
        );
    };

    findByIdAndDelete = async (ID: string):Promise<HydratedDocument<T> |undefined|null> => {
        return await this.model.findByIdAndDelete(ID);
    };
    findOneAndDelete = async (filter:  QueryFilter<T> = {}):Promise<HydratedDocument<T> |undefined|null> => {
        return await this.model.findOneAndDelete(filter);
    };

    find = async (
        filter: QueryFilter<T> = {},
        options: IFindOptions = {}
    ):Promise<IPaginatedResult<T>>=> {
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

    updateOne=async({
        filter={},
        update={},
        options
    }:{
        filter:QueryFilter<T>,
        update:UpdateQuery<T>,
        options?:MongooseUpdateQueryOptions<T>|null
    }):Promise<UpdateWriteOpResult>=>{
        return await this.model.updateOne(filter,update,options)
    }
    updateMany=async({
        filter={},
        update={},
        options
    }:{
        filter:QueryFilter<T>,
        update:UpdateQuery<T>,
        options?:MongooseUpdateQueryOptions<T>|null
    }):Promise<UpdateWriteOpResult>=>{
        return await this.model.updateMany(filter,update,options)
    }

    deleteOne=async({
        filter={}
    }:{
        filter:QueryFilter<T>,
    }):Promise<DeleteResult>=>{
        return await this.model.deleteOne(filter)
    }

    deleteMany=async({
        filter={}
    }:{
        filter:QueryFilter<T>,
    }):Promise<DeleteResult>=>{
        return await this.model.deleteMany(filter)
    }
}
