import mongoose, { HydratedDocument } from "mongoose";
import { GenderEnum, RoleEnum, ProviderEnum} from "../../common/utils/enum";
import { Iuser } from "../../common/interface/index";
import { SALT } from "../../config/config.service";
import { Hash } from "../../common/security/hash.security";
import { Encrypt } from "../../common/security/encryption.security";

const userSchema = new mongoose.Schema<Iuser>(
    {
    fName: {
        type: String,
        min: 2,
        max: 44,
        trim: true,
        required: true,
    },
    lName: {
        type: String,
        min: 2,
        max: 44,
        trim: true,
        required: true,
    },
    email: {
        type: String,
        unique: true,
        required: true,
    },
    age: {
        type: Number,
        required: true,
    },
    phone: {
        type: String,
        required: false,
    },
    password: {
        type: String,
        required: true,
        trim: true,
    },
    role: {
        type: String,
        enum: [RoleEnum.admin, RoleEnum.user],
        default: RoleEnum.user,
    },
    gender: {
        type: String,
        enum: [GenderEnum.female, GenderEnum.male],
        default: GenderEnum.male,
    },
    provider: {
        type: String,
        enum: ProviderEnum,
        default: ProviderEnum.SYSTEM,
    },
    confirmEmail:String,
    changeCredentialTime:Date
    },
    {
        timestamps: true,
        strict: true,
        strictQuery: true,
    },
);

userSchema.pre("save",async function(this:HydratedDocument< Iuser & {is_new:boolean}>){
    this.is_new=this.isNew
    if(this.modifiedPaths().includes("password"))
        this.password=await Hash(this.password, SALT)
    if(this.modifiedPaths().includes("phone"))
        this.phone= await Encrypt(this.phone)
})

userSchema.pre(["find","findOne"],async function(){
    const query:any=this.getQuery
    const {paranoid,...rest}=query;
    if(paranoid){
        this.setQuery({...rest})
    }else{
        this.setQuery({...rest,isDeleted:{$exists:false}})  //paranoid :false or we don't send it
    }
})

userSchema.post("save",async function(){
    const that=this as HydratedDocument< Iuser & {is_new:boolean}>;
    // authService.sendEmailOTP()
    console.log({post:that.is_new});
    console.log("email sent successfully");
})

export const userModel =
    mongoose.models.User || mongoose.model<Iuser>("User", userSchema);
