
import {
    Model,
    QueryFilter,
    QueryOptions,
    PopulateOptions
} from "mongoose";

import { IFindOptions, Iuser } from "../../common/interface";
import { MainRepo } from "./main.repo.js";
import { userModel } from "../models/user.model.js";



export  class UserRepo extends MainRepo<Iuser> {
    constructor(public readonly model: Model<Iuser> = userModel) {
        super(model);
    }

    createUser = async (data: Partial<Iuser>) => {
        return await this.model.create([data]);
    };

}


