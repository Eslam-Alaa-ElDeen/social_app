import express from "express";
import  AuthService  from "./auth.service";
const Router=express.Router;

const router=Router({
    strict:true,
    mergeParams:true,
    caseSensitive:true
});


router.post("/signup",async(req:express.Request,res:express.Response,next:express.NextFunction)=>{
    const data=await AuthService.signup(req.body)
    res.status(201).json({data})
})

export default router;