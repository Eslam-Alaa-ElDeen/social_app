import mongoose from "mongoose";
import { Ifollow } from "../../common/interface/follow.interface.js";
import { FollowStatus } from "../../common/utils/enum/follow.enum.js";


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
        },
        status:{
            type:String,
            enum:FollowStatus,
            default:FollowStatus.accepted
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
