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