import { UserRepo } from "../../DB/repositories/user.repo.js";
import mongoose, { HydratedDocument, mongo } from "mongoose";

import { FollowRepo } from "../../DB/repositories/follow.repo.js";
import { BadRequestException, ConflictException, UnauthorizedException } from "../../common/exception/app.exception.js";
import { Iuser } from "../../common/interface/user.interfasce.js";
import { ProfileStatus } from "../../common/utils/index.js";
import { FollowStatus } from "../../common/utils/enum/follow.enum.js";


class FollowService {
    private readonly userRepo = new UserRepo();
    private readonly followRepo =new FollowRepo()

    constructor() {}

    async follow(user:HydratedDocument<Iuser>,{followerId,followingId}:{followerId:string,followingId:string}) {
        if (user._id.toString()!=followerId) {
            throw new UnauthorizedException("You are not authorized to perform this action")
        }
        
        if (!mongoose.isValidObjectId(followingId)) {
            throw new BadRequestException("Invalid following user id");
        }

        if(followerId==followingId)
            throw new ConflictException("You can't make follow for Yourself")

        const follower=new mongoose.Types.ObjectId(followerId)
        const following=new mongoose.Types.ObjectId(followingId)

        const existUser=await this.userRepo.findById(followingId)

        if(!existUser)
            throw new BadRequestException("following not found")

        const existingFollow=await this.followRepo.findOne({
            followerId:follower,followingId:following
        })

        if (existingFollow) {
            throw new BadRequestException("you already following this user")
        }

        const createFollow=await this.followRepo.create({
            data:{
                followerId:follower,
                followingId:following
            }
        })

        if(existUser.profileStatus==ProfileStatus.private){
            createFollow.status=FollowStatus.pending
            return "Follow request sent"
        }

        return createFollow
    }

    async unFollow(user:HydratedDocument<Iuser>,{followerId,followingId}:{followerId:string,followingId:string}){
        if (user._id.toString() !== followerId) {
            throw new UnauthorizedException("You are not authorized to perform this action");
        }

        if (!mongoose.isValidObjectId(followingId)) {
            throw new BadRequestException("Invalid following user id");
        }

        if (followerId === followingId) {
            throw new BadRequestException("You can't unfollow yourself");
        }

        const follower = new mongoose.Types.ObjectId(followerId);
        const following = new mongoose.Types.ObjectId(followingId);

        const deletedFollow = await this.followRepo.findOneAndDelete({
            followerId: follower,
            followingId: following,
        });

        if (!deletedFollow) {
            throw new BadRequestException("You are not following this user");
        }

        return deletedFollow;
    }

}

export default new FollowService();