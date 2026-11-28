import mongoose from "mongoose";
import { FollowStatus } from "../utils/enum/follow.enum.js";

export interface Ifollow{
    followerId:mongoose.Types.ObjectId,
    followingId:mongoose.Types.ObjectId,
    status:FollowStatus
}