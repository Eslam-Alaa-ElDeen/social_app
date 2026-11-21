import { GenderEnum, RoleEnum } from "../utils/index.js";

export interface Iuser{
    fName:string,
    lName:string,
    age:number,
    email:string,
    password:string,
    role:RoleEnum,
    gender:GenderEnum,
    phone:string
}