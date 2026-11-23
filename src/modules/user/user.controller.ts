import express from "express"
import { authentication } from "../../middleware/authentication.middleware.js";
import { responseFormatter } from "../../middleware/response.middleware.js";
import UserService from "./user.service"

const Router=express.Router;

const router=Router({
    strict:true,
    mergeParams:true,
    caseSensitive:true
});

router.get("/account/:id",authentication(),responseFormatter(
        async(
            req:express.Request,
            res:express.Response,
            next:express.NextFunction
    )=>{
        const data=await UserService.profile(req.params.id as string)
        return {status:201,message:true,data,extra:"user signup successfully"}
    }
))

export default router