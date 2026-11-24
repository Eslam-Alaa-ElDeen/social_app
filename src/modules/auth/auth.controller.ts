import express, { NextFunction, Response ,Request} from "express";
import  AuthService  from "./auth.service";
import { responseFormatter } from "../../middleware/response.middleware.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { confirmOtpSchema, loginSchema, resendOtpSchema, signupSchema } from "./auth.validation.js";
import { authentication } from "../../middleware/authentication.middleware.js";
import { getIssuer, TOKEN_TYPE } from "../../common/utils/index.js";
const Router=express.Router;

const router=Router({
    strict:true,
    mergeParams:true,
    caseSensitive:true
});


router.post("/signup",
    Validation(signupSchema),
    responseFormatter(
        async(
            req:express.Request,
            res:express.Response,
            next:express.NextFunction
    )=>{
        const data=await AuthService.signup(req.body)
        return {status:201,message:true,data,extra:"user signup successfully"}
    }
))

router.patch("/confirm_otp",
    Validation(confirmOtpSchema),
    responseFormatter(
        async (req:Request, res:Response, next:NextFunction) => {
            await AuthService.confirmEmail(req.body)
    })
)

router.post("/resend_otp",
    Validation(resendOtpSchema),
    responseFormatter(
        async (req:Request, res:Response, next:NextFunction) => {
            await AuthService.resendOTP(req.body)
    })
)


router.post("/login",
    Validation(loginSchema),
    responseFormatter(
        async(
            req:express.Request,
            res:express.Response,
            next:express.NextFunction
    )=>{
        const data=await AuthService.login(req.body,getIssuer(req))
        return {status:201,message:true,data,extra:"user signup successfully"}
    }
))

router.post(
    "/login-gmail",
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const issuer = getIssuer(req);
            const result = await AuthService.signupWithGmail(req.body, issuer);

            return {
                status: result.status,
                message: true,
                data: result.tokens,
                extra: result.status === 201
                    ? "user registered and logged in via gmail successfully"
                    : "user logged in via gmail successfully"
            };
        }
    )
);


export default router;