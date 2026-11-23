import mongoose from "mongoose";
import { RedisInstance } from "../../DB/redis.connection.js";
import { UserRepo } from "../../DB/repositories/user.repo.js";


class UserService{
    private readonly userRepo=new UserRepo();
    private readonly cacheServise=RedisInstance;
    constructor(){}
    async profile(id:string){
        const account =await this.userRepo.findById(id)
        return account
    }
}

export default new UserService();