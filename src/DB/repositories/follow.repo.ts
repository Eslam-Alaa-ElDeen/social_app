
import {
    Model,
    QueryFilter,
    QueryOptions,
    PopulateOptions
} from "mongoose";

import { IFindOptions, Iuser } from "../../common/interface";
import { MainRepo } from "./main.repo.js";
import { Ifollow } from "../../common/interface/follow.interface.js";
import { followModel } from "../models/follow.model.js";



export  class FollowRepo extends MainRepo<Ifollow> {
    constructor(public readonly model: Model<Ifollow> = followModel) {
        super(model);
    }
}


