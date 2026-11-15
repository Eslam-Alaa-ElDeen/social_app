import mongoose from "mongoose";

export const connectionDB=async()=>{
    try {
        await mongoose.connect("mongodb://localhost:27017/socialApp")
        console.log("connected successfully");
    } catch (error) {
        console.log("connected failed",error);
    }
}