import express, { NextFunction, Request, Response } from 'express'
import { connectionDB } from './DB/connection.db';
import cors from "cors"
import{rateLimit}from "express-rate-limit"
import { globalError } from './middleware/error.middleware';
import { authRouter, userRouter } from './modules/index';
import { AppException } from './common/exception';
import {PORT } from './config/config.service';
import { RedisInstance } from './DB/redis.connection';
import { sendEmail } from './common/utils/email/sendEmail.js';
import { emailTemplate } from './common/utils/email/email.template.js';
import { eventEmitterEmail } from './common/events/event.email.js';
const app:express.Application=express()
const port:number=PORT||9000;

const limiter=rateLimit({
    windowMs:60*10*1000,
    limit:40,
    handler:(req:Request,res:Response)=>{
        res.status(427).json({
            message:"too many requests"
        })
    }
})
export const bootstrap=async()=>{
    app.use(express.json(),cors(),limiter)
    await connectionDB()
    await RedisInstance.connect()

    app.use("/auth",authRouter)
    app.use("/user",userRouter)

    app.listen(port,()=>{
        console.log("app is listen on port ",port);
    })

    app.get("/",(req:Request,res:Response,next:NextFunction)=>{
        res.status(200).json({
            message:"welcome to eslam alaa server"
        })
    })

    app.use('{/*dumm}',(req:Request,res:Response,next:NextFunction)=>{
        throw new AppException("the url is wrong",404,"not found")
    })

    app.use(globalError)
}