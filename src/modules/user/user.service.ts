import { RedisInstance } from "../../DB/redis.connection.js";
import { UserRepo } from "../../DB/repositories/user.repo.js";
import { HydratedDocument } from "mongoose";
import { Iuser } from "../../common/interface/user.interfasce.js";
import {
    JwtPayloadType,
    tokenService,
    TokenService,
} from "../../common/service/token.service.js";
import { ACCESS_TOKEN_EXPIRES_IN } from "../../config/config.service.js";
import { ConflictException } from "../../common/exception/app.exception.js";
import { LogoutTypeEnum } from "../../common/utils/index.js";
import { cloudInstance, CloudService } from "../../common/service/cloud.service.js";

const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;

class UserService {
    private readonly userRepo = new UserRepo();
    private readonly cacheService = RedisInstance;
    private readonly tokenService: TokenService = tokenService;
    private readonly cloudService: CloudService = cloudInstance;

    constructor() {}

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

    // async deleteAsset(key: string) {
    //     await this.cloudService.deleteAsset({ Key: key });
    // }
}

export default new UserService();