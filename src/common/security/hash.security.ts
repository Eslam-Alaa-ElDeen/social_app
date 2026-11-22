import bcrypt from "bcrypt"


export const Hash=async(plainText:string,salt:number):Promise<string>=>{
    const cipherText=await bcrypt.hash(plainText,salt)
    return cipherText;
}
export const Compare=async(plainText:any,cipherText:any):Promise<boolean>=>{
    const match=await bcrypt.compare(plainText,cipherText)
    return match;
}

