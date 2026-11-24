import * as zod from "zod";
import { generalRules } from "../../common/utils/generelRules.js";


export const signupSchema={
    body:zod.object({
        fName:generalRules.fName,
        lName:generalRules.lName,
        email:generalRules.email,
        age:generalRules.age.optional(),
        gender:generalRules.gender.optional(),
        password:generalRules.password,
        cPassword:generalRules.cPassword,
        phone:generalRules.phone.optional()
    }).refine((v)=>{
        return v.password === v.cPassword
    },{
        message:"password and confirm password must be the same",
        path:["cPassword"]
    })
}

export const confirmOtpSchema={
    body:zod.object({
        email:generalRules.email,
        otp:generalRules.otp,
    })
}
export const loginSchema={
    body:zod.object({
        email:generalRules.email,
        password:generalRules.password,
    })
}
export const resendOtpSchema={
    body:zod.object({
        email:generalRules.email,
    })
}
export const forgetPasswordSendOtpSchema={
    body:zod.object({
        email:generalRules.email,
    })
}
export const updatePasswordVerifyOtpSchema={
    body:zod.object({
        email:generalRules.email,
        otp:generalRules.otp,
        newPassword:generalRules.password
    })
}
