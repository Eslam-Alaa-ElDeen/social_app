import * as zod from "zod";
import { generalRules } from "../../common/utils/generelRules.js";
import mongoose from "mongoose";

const followBodySchema = zod.object({
    followerId: generalRules.id,
    followingId: generalRules.id,
}).refine(
    (value) => value.followerId !== value.followingId,
    {
        message: "You can't follow or unfollow yourself.",
        path: ["followingId"],
    }
);

export const followSchema = {
    body: followBodySchema,
};

export const unFollowSchema = {
    body: followBodySchema,
};


const createPost = zod.object({
    userId: zod
            .string()
            .min(1, "ID is required.")
            .refine((value) => mongoose.Types.ObjectId.isValid(value), {
                message: "Enter a valid ID.",
            }),
    content: zod.string().min(5,"content to short"),
    image:zod.string().optional(),
    comment:zod.string().optional()
})
