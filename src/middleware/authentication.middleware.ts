import type { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_SIGNATURE, REFRESH_TOKEN_SIGNATURE } from "../config/config.service.js";
import { TOKEN_TYPE } from "../common/utils/index.js";
import { AppException, BadRequestException, NotFoundException, UnauthorizedException } from "../common/exception/app.exception.js";
import { UserRepo } from "../DB/repositories/user.repo.js";
import { tokenService } from "../common/service/token.service.js";
import { RedisInstance } from "../DB/redis.connection.js";
import { HydratedDocument } from "mongoose";
import { Iuser } from "../common/interface/user.interfasce.js";

const getTokenSignature = (tokenType: TOKEN_TYPE): string => {
    if (tokenType === TOKEN_TYPE.access) {
        return ACCESS_TOKEN_SIGNATURE;
    }
    return REFRESH_TOKEN_SIGNATURE;
};

export const authentication = (tokenType: TOKEN_TYPE = TOKEN_TYPE.access) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userRepo=new UserRepo()
            const signature = getTokenSignature(tokenType);
            const { authorization } = req.headers;

            if (!authorization) {
                throw new UnauthorizedException("UnAuthorized account");
            }

            const [key, credential] = authorization.split(" ");

            if (!key || !credential || key.toLowerCase() !== "bearer") {
                throw new UnauthorizedException("UnAuthorized account");
            }

            const payload = await tokenService.verifyToken({
                payload: credential,
                secret: signature
            });

            const userId = payload?.user?.sub ?? payload?.sub;
            if (!userId) {
                throw new BadRequestException("missing token payload");
            }

            const user = await userRepo.findById(userId);

            if (!user) {
                throw new NotFoundException("invalid account");
            }

            if (await RedisInstance.getValue(tokenService.revokeTokenKey(payload))) {
                throw new UnauthorizedException("you are logged out pls login again");
            }

            if (
                user.changeCredentialTime &&
                payload.iat &&
                user.changeCredentialTime.getTime() > payload.iat * 1000
            ) {
                throw new UnauthorizedException("you are logged out pls login again");
            }

            req.user = user as HydratedDocument<Iuser>;
            req.payload = payload;
            next();
        } catch (error) {
            next(error)
        }
    };
};