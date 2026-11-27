import mongoose from "mongoose";

export interface Ifollow{
    followerId:mongoose.Types.ObjectId,
    followingId:mongoose.Types.ObjectId,
}