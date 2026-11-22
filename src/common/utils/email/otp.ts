import {randomInt}from "node:crypto"

export const otp_key=(email:string, action:string = "ConfirmEmail")=>{
    return `User::${email}::${action}::OTP`
}

export const otp_key_trails=(email:string, action:string)=>{
    return action
        ? `User::${email}::${action}::trails::OTP`
        : `User::${email}::trails::OTP`
}

export const otp_key_prefix=(email:string)=>{
    return `User::${email}`
}
export const otp_key_prefix_action=(email:string,action:string)=>{
    return `User::${email}::${action}`
}

export const createOTP=()=>{
    return randomInt(100000,1000000).toString()
}
