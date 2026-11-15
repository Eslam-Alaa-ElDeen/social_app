import { Response } from "express";

export class SuccessResponse{
    constructor(public res:Response,public message:string,public data:string,public status:number){
        res.status(status).json({message,status,data})
    }
}