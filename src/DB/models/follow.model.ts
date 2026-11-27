import mongoose from "mongoose";
import { Ifollow } from "../../common/interface/follow.interface.js";


const followSchema = new mongoose.Schema<Ifollow>(
    {
        followerId:{
            type:mongoose.Types.ObjectId,
            required:true,
            index:true,
            ref:"User"
        },
        followingId:{
            type:mongoose.Types.ObjectId,
            required:true,
            index:true,
            ref:"User"
        }
    },
    {
        timestamps: true,
        strict: true,
        strictQuery: true,
    }
);

followSchema.index({
    followerId:1,
    followingId:1
},{
    unique:true
})

export const followModel =
    mongoose.models.Follow || mongoose.model<Ifollow>("Follow", followSchema);
