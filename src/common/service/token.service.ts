import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { RedisInstance, RedisService } from "../../DB/redis.connection.js";
import { UserRepo } from "../../DB/repositories/user.repo.js";
import {
    ACCESS_TOKEN_SIGNATURE,
    REFRESH_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_SIGNATURE
} from "../../config/config.service.js";
import { randomUUID } from "node:crypto";
import { HydratedDocument } from "mongoose";
import { Iuser } from "../interface/user.interfasce.js";

export interface JwtPayloadType extends JwtPayload {
    sub: string;
    jti?: string;
    iat?: number;
    user?: {
        sub: string;
    };
}

export class TokenService {
    private readonly userRepo: UserRepo;
    private readonly cacheService: RedisService;

    constructor() {
        this.userRepo = new UserRepo();
        this.cacheService = RedisInstance;
    }

    async createToken({
        payload = {},
        options = {},
        secret = ACCESS_TOKEN_SIGNATURE
    }: {
        payload: string | Buffer | object;
        secret?: Secret;
        options?: SignOptions;
    }): Promise<string> {
        return jwt.sign(payload, secret, options);
    }

    async verifyToken({
        payload,
        secret = ACCESS_TOKEN_SIGNATURE
    }: {
        payload: string;
        secret?: Secret;
    }): Promise<JwtPayloadType> {
        return jwt.verify(payload, secret) as JwtPayloadType;
    }

    async decodeToken({
        payload
    }: {
        payload: string;
    }): Promise<JwtPayloadType | null> {
        return jwt.decode(payload) as JwtPayloadType | null;
    }

    async createLoginCredentials({
        user,
        issuer = "",
        options
    }: {
        user: HydratedDocument<Iuser>;
        issuer?: string;
        options?: SignOptions;
    }): Promise<{ access_token: string; refresh_token: string }> {
        const jwtid = randomUUID();
        const userId = user._id.toString();

        const access_token = await this.createToken({
            payload: {
                sub: userId,
                user: { sub: userId }
            },
            secret: ACCESS_TOKEN_SIGNATURE,
            options: {
                ...options,
                noTimestamp: false,
                expiresIn: 60 * 60,
                issuer,
                jwtid
            }
        });

        const refresh_token = await this.createToken({
            payload: {
                sub: userId,
                user: { sub: userId }
            },
            secret: REFRESH_TOKEN_SIGNATURE,
            options: {
                ...options,
                noTimestamp: false,
                expiresIn: Number(REFRESH_TOKEN_EXPIRES_IN),
                issuer,
                jwtid
            }
        });

        return { access_token, refresh_token };
    }

    revokeTokenKey = (payload: JwtPayloadType): string => {
        const sub = payload.user?.sub ?? payload.sub;
        return `User::${sub}::Revoke_Token::${payload.jti}`;
    };

    userBaseRevokeTokenKey = (payload: JwtPayloadType): string => {
        const sub = payload.user?.sub ?? payload.sub;
        return `User::${sub}::Revoke_Token`;
    };

    createRevokeToken = async (payload: JwtPayloadType): Promise<void> => {
        const iat = payload.iat ?? Math.floor(Date.now() / 1000);
        const refreshExpires = iat + Number(REFRESH_TOKEN_EXPIRES_IN);
        const ttl = Math.max(0, refreshExpires - Math.ceil(Date.now() / 1000));

        await this.cacheService.setValue({
            key: this.revokeTokenKey(payload),
            value: String(payload.jti),
            ttl
        });
    };
}

export const tokenService = new TokenService();