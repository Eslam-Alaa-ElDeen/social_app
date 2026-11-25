import express from "express"
import { authentication } from "../../middleware/authentication.middleware.js";
import { responseFormatter } from "../../middleware/response.middleware.js";
import UserService from "./user.service"
import { authorization } from "../../middleware/authorization.middleware.js";
import { getIssuer, RoleEnum, TOKEN_TYPE } from "../../common/utils/index.js";
import { HydratedDocument } from "mongoose";
import { Iuser } from "../../common/interface/user.interfasce.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { fileTypeValidation, localFileUpload } from "../../common/utils/multer/local.multer.js";
import { cloudInstance } from "../../common/service/cloud.service.js";
import {pipeline}from"node:stream/promises"

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

router.post(
    "/logout",
    authentication(TOKEN_TYPE.access),
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

router.get("/profile-image/*path",async(req:express.Request,res:express.Response,next:express.NextFunction)=>{
    const key=(req.params.path as string[]).join("/")
    const {download="false",filename=(req.params.path as string[]).pop()}=req.query as {download?:"true"|"false",filename?:string}
    const data=await cloudInstance.getAsset({Key:key})
    res.set("Cross-Origin-Resource-Policy","cross-origin")
    if(download=="true")
        res.setHeader("Content-Disposition",'attachment; filename="'+(filename || key.split("/").pop())+'"')

    return await pipeline(data.Body as NodeJS.ReadableStream, res);
})




export default router