import { RedisInstance } from "../../DB/redis.connection.js";
import { UserRepo } from "../../DB/repositories/user.repo.js";
import mongoose, { HydratedDocument, PopulateOption } from "mongoose";
import { Iuser } from "../../common/interface/user.interfasce.js";
import {
    JwtPayloadType,
    tokenService,
    TokenService,
} from "../../common/service/token.service.js";
import { ACCESS_TOKEN_EXPIRES_IN } from "../../config/config.service.js";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception/app.exception.js";
import { LogoutTypeEnum, ProfileStatus } from "../../common/utils/index.js";
import { cloudInstance, CloudService } from "../../common/service/cloud.service.js";
import { IFindOptions } from "../../common/interface/DBRepo.interface.js";
import { parseSort } from "../../common/utils/sort.js";
import { FollowRepo } from "../../DB/repositories/follow.repo.js";
import { FollowStatus } from "../../common/utils/enum/follow.enum.js";
import { email } from "zod";
import { Decrypt } from "../../common/security/encryption.security.js";
const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;

class UserService {
    private readonly userRepo = new UserRepo();
    private readonly cacheService = RedisInstance;
    private readonly tokenService: TokenService = tokenService;
    private readonly cloudService: CloudService = cloudInstance;
    private readonly followRepo =new FollowRepo()
    
    constructor() {}
    private formatUserPreview(u: any) {
        return {
            _id: u._id,
            fName: u.fName,
            lName: u.lName,
            fullName: u.fullName ?? `${u.fName ?? ""} ${u.lName ?? ""}`.trim(),
            profilePicture: u.image ?? u.profilePicture ?? null,
            profileStatus: u.profileStatus ?? ProfileStatus.public,
            isPrivate: (u.profileStatus ?? ProfileStatus.public) === ProfileStatus.private,
        };
    }
    async profile(user: Iuser) {
        return {
            name: `${user.fName} ${user.lName}`,
            email: user.email,
            gender: user.gender,
            image: user.image ?? null,
        };
    }

    async rotate(
        payload: JwtPayloadType,
        user: HydratedDocument<Iuser>,
        issuer: string
    ) {
        if (!payload.iat) {
            throw new ConflictException("Invalid token payload");
        }

        const expiresInSeconds = Number(ACCESS_TOKEN_EXPIRES_IN);
        const accessExpiresIn = (payload.iat + expiresInSeconds) * 1000;
        const currentTimeWithBuffer = Date.now() + FIVE_MINUTES_IN_MS;

        if (currentTimeWithBuffer < accessExpiresIn) {
            throw new ConflictException(
                "sorry we cannot create new login credentials while current access token still within valid time range"
            );
        }

        const data = await this.tokenService.createLoginCredentials({
            user,
            issuer,
        });
        await this.tokenService.createRevokeToken(payload);
        return data;
    }

    async logout(
        user: HydratedDocument<Iuser>,
        payload: JwtPayloadType,
        { actions = LogoutTypeEnum.ONE }: { actions: LogoutTypeEnum }
    ) {
        switch (actions) {
            case LogoutTypeEnum.ALL: {
                user.changeCredentialTime = new Date();
                await user.save();

                const keys = await this.cacheService.keys(
                    this.tokenService.userBaseRevokeTokenKey(payload)
                );
                if (keys.length > 0) {
                    await this.cacheService.deleteKey(keys);
                }

                return "users logged out successfully";
            }
            case LogoutTypeEnum.ONE:
            default: {
                await this.tokenService.createRevokeToken(payload);
                return "user logged out successfully";
            }
        }
    }

    async uploadProfileImage(
        user: HydratedDocument<Iuser>,
        file: Express.Multer.File
    ): Promise<string> {
        const oldImage=user.image
        const imageUrl = await this.cloudService.uploadAsset({ file, path: "profile-images" });
        user.image = imageUrl;
        await user.save();
        if(oldImage?.length)
            await this.cloudService.deleteAssets({Keys:[oldImage]})
        return imageUrl;
    }

    async updateProfile(user: HydratedDocument<Iuser>,body:Partial<Iuser>) {
        user.fName=body.fName??user.fName
        user.lName=body.lName??user.lName
        user.phone=body.phone??user.phone
        user.age=body.age??user.age

        await user.save()
        return{
            fName:user.fName,
            lName:user.lName,
            phone:user.phone,
            age:user.age
        }
    }

    async getProfileById(
        { id }: { id: string },
        user: HydratedDocument<Iuser>
    ) {
        if (!mongoose.isValidObjectId(id)) {
            throw new BadRequestException("Invalid user id");
        }

        const targetUser = await this.userRepo.findById(id)as HydratedDocument<Iuser>;
        if (!targetUser) {
            throw new NotFoundException("User not found");
        }

        const [followersCount, followingCount] = await Promise.all([
            this.followRepo.countDocuments({
                followingId: targetUser._id,
                status: FollowStatus.accepted,
            }),
            this.followRepo.countDocuments({
                followerId: targetUser._id,
                status: FollowStatus.accepted,
            }),
        ]);

        const isMe = id === user._id.toString();

        if (!isMe && targetUser.profileStatus === ProfileStatus.private) {
            const followDoc = await this.followRepo.findOne({
                followerId: user._id,
                followingId: targetUser._id,
                status: FollowStatus.accepted,
            });

            if (!followDoc) {
                return {
                    fName: targetUser.fName,
                    lName: targetUser.lName,
                    profilePicture: targetUser.image,
                    profileStatus: targetUser.profileStatus,
                    followersCount,
                    followingCount
                };
            }
        }

        return {
            fName: targetUser.fName,
            lName: targetUser.lName,
            profilePicture: targetUser.image,
            age: targetUser.age,
            profileStatus: targetUser.profileStatus,
            phone:targetUser.phone ? await Decrypt(targetUser.phone) : undefined,
            gender:targetUser.gender,
            followersCount,
            followingCount
        };
    }

    async search(
        {page,limit,search,populate,sort}:
        {page?:string,limit?:string,search?:string,populate?:any,sort?:string},
        user:HydratedDocument<Iuser>
    ){
        const filter={_id: { $ne: user._id },};
        const { dataInfo, data } = await this.userRepo.find(
            filter,
            {
                page:Number(page) || 1,
                limit:Number(limit) || 10,
                search:search?.trim() || "",
                searchField:"fullName",
                sort:parseSort(sort),
                populate
            }
        )
        return { dataInfo, data: data.map((item) => this.formatUserPreview(item)), };
    }

    async getSuggestions({page,limit}:{page?:string,limit?:string},user:HydratedDocument<Iuser>){
        const followingDocs=await this.followRepo.find(
            {followerId:user._id}
        )

        const excludeIds=[
            user._id,
            ...followingDocs.data.map((doc)=>doc.followingId)
        ]

        const {dataInfo,data}=await this.userRepo.find(
            {_id:{$nin:excludeIds}},
            {
                page:Number(page),
                limit:Number(limit),
                sort: { createdAt: -1 },
            }
        )
        
        return{dataInfo,data: data.map((item) => this.formatUserPreview(item)),}
    }

    async updatePrivacy({status}:{status:string},user:HydratedDocument<Iuser>){
        if(status!=ProfileStatus.private && status!=ProfileStatus.public)
            throw new BadRequestException("status only valid on private and public")
        
        if (status==user.profileStatus) {
            throw new ConflictException("The status is the same on DB")
        }

        user.profileStatus=status == ProfileStatus.private?ProfileStatus.private:ProfileStatus.public
        await user.save()
        return user.profileStatus
    }
    
    async requestFollow(user:HydratedDocument<Iuser>){
        const requests=await this.followRepo.find({
            followingId:user._id,
            status:FollowStatus.pending
        },{
            populate:{path:"followerId",select:"fName lName image profileStatus"}
        })
        
        return requests;
    }
    async acceptRequest({followerId}:{followerId:string},user:HydratedDocument<Iuser>){
        const request=await this.followRepo.findOneAndUpdate({
            followingId:user._id,
            status:FollowStatus.pending,
            followerId
        },{
            status:FollowStatus.accepted
        })

        if (!request) {
            throw new NotFoundException("Follow request not found or already handled");
        }
    }
    async rejectRequest({followerId}:{followerId:string},user:HydratedDocument<Iuser>){
        const request=await this.followRepo.findOneAndDelete({
            followingId:user._id,
            status:FollowStatus.pending,
            followerId
        })

        if (!request) {
            throw new NotFoundException("Follow request not found or already handled");
        }
    }
}

export default new UserService();