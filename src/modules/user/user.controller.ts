import express from "express"
import { authentication } from "../../middleware/authentication.middleware.js";
import { responseFormatter } from "../../middleware/response.middleware.js";
import UserService from "./user.service"
import { authorization } from "../../middleware/authorization.middleware.js";
import { getIssuer, ProfileStatus, RoleEnum, TOKEN_TYPE } from "../../common/utils/index.js";
import { HydratedDocument } from "mongoose";
import { Iuser } from "../../common/interface/user.interfasce.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { fileTypeValidation, localFileUpload } from "../../common/utils/multer/local.multer.js";
import { cloudInstance } from "../../common/service/cloud.service.js";
import {pipeline}from"node:stream/promises"
import { IFindOptions } from "../../common/interface/DBRepo.interface.js";
import { Validation } from "../../middleware/validation.middleware.js";
import {
    followerParamsSchema,
    getProfileByIdSchema,
    logoutSchema,
    privacySchema,
    profileImageSchema,
    searchUsersSchema,
    suggestionsSchema,
    updateProfileSchema,
} from "./user.validation.js";

const Router=express.Router;

const router=Router({
    strict:true,
    mergeParams:true,
    caseSensitive:true
});

router.get(
    "/profile",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.profile(req.user!);
            return {
                status: 200,
                message: true,
                data,
                extra: "done on search",
            };
        }
    )
);

router.get(
    "/profile/:id",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(getProfileByIdSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.getProfileById(req.params as {id:string},req.user!);
            return {
                status: 200,
                message: true,
                data,
                extra: "done on search",
            };
        }
    )
);

router.post(
    "/rotate-token",
    authentication(TOKEN_TYPE.refresh),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const issuer = getIssuer(req);
            const data = await UserService.rotate(
                req.payload!,
                req.user! as HydratedDocument<Iuser>,
                issuer
            );
            return {
                status: 200,
                message: true,
                data,
                extra: "token rotated successfully",
            };
        }
    )
);

router.patch(
    "/profile",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(updateProfileSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.updateProfile(
                req.user! as HydratedDocument<Iuser>,
                req.body
            );
            return {
                status: 200,
                message: true,
                data,
                extra: "Profile updated successfully",
            };
        }
    )
);

router.post(
    "/logout",
    authentication(TOKEN_TYPE.access),
    Validation(logoutSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const result = await UserService.logout(
                req.user! as HydratedDocument<Iuser>,
                req.payload!,
                req.body
            );
            return {
                status: 200,
                message: true,
                extra: typeof result === "string" ? result : "user logout successfully",
            };
        }
    )
);

router.patch(
    "/profile-image",
    uploadMiddleware({
        multerMiddleware:localFileUpload({}).single("attachment"),
        validation:fileTypeValidation.image,
        customPath:"User"
    }),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const key=await UserService.uploadProfileImage(req.user! as HydratedDocument<Iuser>,req.file!)
            return {
                status: 200,
                message: true,
                data: key
            };
        }
    )
);

router.get(
    "/profile-image/*path",
    Validation(profileImageSchema),
    async(req:express.Request,res:express.Response,next:express.NextFunction)=>{
    const key=(req.params.path as string[]).join("/")
    const {download="false",filename=(req.params.path as string[]).pop()}=req.query as {download?:"true"|"false",filename?:string}
    const data=await cloudInstance.getAsset({Key:key})
    res.set("Cross-Origin-Resource-Policy","cross-origin")
    if(download=="true")
        res.setHeader("Content-Disposition",'attachment; filename="'+(filename || key.split("/").pop())+'"')

    return await pipeline(data.Body as NodeJS.ReadableStream, res);
    }
);

router.get(
    "/users/search",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(searchUsersSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.search(
            req.query as {
                page?: string;
                limit?: string;
                search?: string;
                populate?: any;
                sort?: string;
            },
            req.user!
            );
            return {
                status: 200,
                message: true,
                data,
                extra: "done on search",
            };
        }
    )
);
router.get(
    "/suggestions",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(suggestionsSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.getSuggestions(
            req.query as {
                page?: string;
                limit?: string;
            },
            req.user!
            );
            return {
                status: 200,
                message: true,
                data,
                extra: "done on search",
            };
        }
    )
);

router.patch(
    "/privacy",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(privacySchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.updatePrivacy(req.body, req.user!);

            return {
                status: 200,
                message: data==ProfileStatus.private
                    ? "Account set to private"
                    : "Account set to public",
                data,
            };
    })
);
router.patch(
    "/follows/requests",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await UserService.requestFollow(req.user!);

            return {
                status: 200,
                message:true,
                data,
                extra:data.data.length === 0 ? "No Requests For You" : "Follow requests fetched successfully"
            };
    })
);

router.patch(
    "/follows/requests/:followerId/accept",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(followerParamsSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            await UserService.acceptRequest(req.params as {followerId:string},req.user!);
            return {
                status: 200,
                message:true,
                data:"Request Accepted successfully",
            };
    })
);

router.patch(
    "/follows/requests/:followerId/reject",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(followerParamsSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            await UserService.rejectRequest(req.params as {followerId:string},req.user!);
            return {
                status: 200,
                message:true,
                data:"Request rejected successfully",
            };
    })
);


export default router