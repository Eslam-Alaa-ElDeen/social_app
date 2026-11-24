import { HydratedDocument } from "mongoose"
import { BadRequestException, ConflictException, NotFoundException, TooManyRequestsException } from "../../common/exception"
import { Iuser } from "../../common/interface"
import { Decrypt, Encrypt } from "../../common/security/encryption.security"
import { Compare, Hash } from "../../common/security/hash.security"
import { ACCESS_TOKEN_SIGNATURE, REFRESH_TOKEN_EXPIRES_IN, REFRESH_TOKEN_SIGNATURE, SALT, WEB_CLIENT_ID } from "../../config/config.service"
import { UserRepo } from "../../DB/repositories/user.repo"
import { createOTP, otp_key, otp_key_prefix, otp_key_trails } from "../../common/utils/email/otp"
import { RedisInstance } from "../../DB/redis.connection"
import { eventEmitterEmail } from "../../common/events/event.email.js"
import { ProviderEnum } from "../../common/utils/index.js"
import {randomUUID}from"node:crypto"
import { tokenService } from "../../common/service/token.service.js"
import { OAuth2Client, TokenPayload } from "google-auth-library"

class AuthService{
    private readonly userRepo=new UserRepo();
    private readonly cacheService=RedisInstance;
    private client: OAuth2Client= new OAuth2Client();

    constructor(){}

    async  verifyGoogleAccount(idToken:string): Promise<TokenPayload>{
        const ticket =await this.client.verifyIdToken({
            idToken,
            audience:WEB_CLIENT_ID
        })

        const payload=ticket.getPayload();
        if(!payload?.email_verified || !payload.email)
            throw new BadRequestException("email not verified")

        return payload
    }


    async signupWithGmail({idToken}:{idToken:string},issuer:string) {
        const {name,email,picture}=await this.verifyGoogleAccount(idToken)

        const existAccount=await this.userRepo.findOne({email:email!})

        if(existAccount){
            if(existAccount.provider!=ProviderEnum.GOOGLE)
            throw new ConflictException("Invalid account provider")

            return{
                status:200,
                tokens: await tokenService.createLoginCredentials({
                    user:existAccount as HydratedDocument<Iuser>,
                    issuer
                })
            };
        }
        const nameParts = name?.trim().split(/\s+/) ?? [];
        const fName = nameParts[0] ?? "";
        const lName = nameParts.slice(1).join(" ");
        const user=await this.userRepo.create({
            data:{
                fName,
                lName,
                email,
                confirmEmail:new Date(),
                provider:ProviderEnum.GOOGLE,
                image:picture
            }
        })

        return{
            status:201,
            tokens: await tokenService.createLoginCredentials({user,issuer})
        };
    }

    async sendEmailOTP (email:string, action:string):Promise<void>{

        const ttlExist=await this.cacheService.ttl(otp_key(email, action))
        if(ttlExist>1)
            throw new ConflictException(`the old OTP is active to use ,you can resend a new OTP after ${ttlExist}`)

        const trails=await this.cacheService.getValue(otp_key_trails(email, action))
        if(trails>=3)
            throw new TooManyRequestsException("You have made too many requests ,you blocked for 5 min")

        const otp=createOTP()
        await this.cacheService.setValue({
            key:otp_key(email, action),
            value:await Hash(otp,SALT),
            ttl:300
        })

        const currTrails=await this.cacheService.incr(otp_key_trails(email, action))
        if (currTrails === 1) {
            await this.cacheService.expire({
                key: otp_key_trails(email, action),
                ttl: 300
            });
        }

        if (currTrails === 3) {
            await this.cacheService.expire({
                key: otp_key_trails(email, action),
                ttl: 300
            });
        }

        eventEmitterEmail.emit("confirm_email", { email, otp });
        return
    }
    async signup(inputs: Iuser): Promise<Iuser> {
        const normalizedEmail = inputs.email.toLowerCase().trim();

        const existEmail = await this.userRepo.findOne({ email: normalizedEmail });
        if (existEmail) {
            throw new ConflictException("email already exist go to login");
        }

        const { fName, lName, password, phone, gender,age } = inputs;

        const user = await this.userRepo.create({
            data: {
                fName,
                lName,
                email: normalizedEmail,
                password,
                phone,
                gender,
                age
            }
        });

        await this.sendEmailOTP(normalizedEmail, "ConfirmEmail");

        return user;
    }

    async confirmEmail({ email, otp }: { email: string; otp: string }): Promise<void> {
        const normalizedEmail = email.toLowerCase().trim();

        const user = await this.userRepo.findOne({
            email: normalizedEmail,
            provider: ProviderEnum.SYSTEM,
            confirmEmail: { $exists: false }
        }) as HydratedDocument<Iuser>;

        if (!user) {
            throw new BadRequestException("the user not exists or already confirmed");
        }

        const cipherOTP = await this.cacheService.getValue(otp_key(normalizedEmail, "ConfirmEmail"));

        if (!cipherOTP || !(await Compare(otp, cipherOTP))) {
            throw new BadRequestException("OTP is wrong or expired");
        }

        const keysToDelete = await this.cacheService.keys(`${otp_key_prefix(normalizedEmail)}*`);
        if (keysToDelete?.length) {
            await this.cacheService.deleteKey(keysToDelete);
        }

        user.confirmEmail = new Date() as unknown as string;
        await user.save();
    }

    async resendOTP({email}:{email:string}){
        const user=await this.userRepo.findOne(
            {
                email,provider:ProviderEnum.SYSTEM,confirmEmail:{$exists:false}
            }
        )

        if(!user)
            throw new BadRequestException("the user not exists or already confirmed")

        await this.sendEmailOTP(email, "ConfirmEmail")
    }

    async login(
        inputs: { email: string; password: string },
        issuer = ""
    ): Promise<{ access_token: string; refresh_token: string }> {
        const user = await this.userRepo.findOne({ email: inputs.email }) as HydratedDocument<Iuser> | null;
        if (!user) {
            throw new NotFoundException("email or password not valid");
        }

        const matchPass = await Compare(inputs.password, user.password);
        if (!matchPass) {
            throw new NotFoundException("email or password not valid");
        }

        return tokenService.createLoginCredentials({
            user,
            issuer
        });
    }
}

export default new AuthService();
