import { NextFunction, Request, Response } from "express"
import {userModel } from "../../DB/models/user.model"
import { ConflictException } from "../../common/exception"
import { Iuser } from "../../common/interface"
import { HydratedDocument } from "mongoose"
import { UserRepo } from "../../DB/repositories/user.repo.js"

class AuthService{
    private readonly userRepo=new UserRepo()
    constructor(){}

    signup =async(body:Iuser)=>{
        const{age,email,fName,gender,lName,password,phone}=body

        const user=await this.userRepo.findOne({filter:{email}})

        if(user){
            throw new ConflictException("user already exist",{"email":email})
        }
        const account=await this.userRepo.create(
            { data:{
                age,email,fName,lName,password,gender,phone
            }}
        )
        return account;
    }
    login(){
        return "done on login"
    }
}

export default new AuthService();
