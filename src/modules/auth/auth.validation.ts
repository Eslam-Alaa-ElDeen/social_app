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
        phone:generalRules.phone.optional()
    })
}