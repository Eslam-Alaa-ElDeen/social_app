import mongoose from "mongoose";
import { GenderEnum, RoleEnum, ProviderEnum} from "../../common/utils/enum";
import { Iuser } from "../../common/interface/index";

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
    confirmEmail:String
    },
    {
        timestamps: true,
        strict: true,
        strictQuery: true,
    },
);

export const userModel =
    mongoose.models.User || mongoose.model<Iuser>("User", userSchema);
