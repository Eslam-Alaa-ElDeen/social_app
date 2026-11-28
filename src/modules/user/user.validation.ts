import * as zod from "zod";
import { generalRules } from "../../common/utils/generelRules.js";
import { LogoutTypeEnum } from "../../common/utils/enum/security.emum.js";
import { ProfileStatus } from "../../common/utils/enum/user.enum.js";

export const logoutSchema = {
    body: zod.object({
        actions: zod.enum(LogoutTypeEnum).optional().default(LogoutTypeEnum.ONE),
    }).strict(),
};

export const searchUsersSchema = {
    query: zod.object({
        page: zod
            .string()
            .regex(/^\d+$/, "Page must be a positive integer.")
            .transform(Number)
            .refine((value) => value >= 1, "Page must be at least 1.")
            .optional(),
        limit: zod
            .string()
            .regex(/^\d+$/, "Limit must be a positive integer.")
            .transform(Number)
            .refine((value) => value >= 1 && value <= 100, "Limit must be between 1 and 100.")
            .optional(),
        search: zod.string().trim().max(100, "Search cannot exceed 100 characters.").optional(),
        sort: zod
            .string()
            .trim()
            .regex(/^[-]?[A-Za-z][A-Za-z0-9_.]*$/, "Enter a valid sort field.")
            .max(50, "Sort field cannot exceed 50 characters.")
            .optional(),
    }).strict(),
};

export const suggestionsSchema = {
    query: zod.object({
        page: zod
            .string()
            .regex(/^\d+$/, "Page must be a positive integer.")
            .transform(Number)
            .refine((value) => value >= 1, "Page must be at least 1.")
            .optional(),
        limit: zod
            .string()
            .regex(/^\d+$/, "Limit must be a positive integer.")
            .transform(Number)
            .refine((value) => value >= 1 && value <= 100, "Limit must be between 1 and 100.")
            .optional(),
    }).strict(),
};

export const profileImageSchema = {
    params: zod.object({
        path: zod.union([
            zod.string().min(1, "Profile image path is required."),
            zod.array(zod.string().min(1)).min(1, "Profile image path is required."),
        ]),
    }),
    query: zod.object({
        download: zod.enum(["true", "false"]).optional(),
        filename: zod.string().trim().min(1).max(255).optional(),
    }) ,
};

export const updateProfileSchema = {
    body: zod.object({
        fName: generalRules.fName.optional(),
        lName: generalRules.lName.optional(),
        age: generalRules.age.optional(),
        phone: generalRules.phone.optional(),
    }).refine(
        (value) => Object.values(value).some((item) => item !== undefined),
        "At least one profile field is required."
    ),
};

export const getProfileByIdSchema = {
    params: zod.object({
        id: generalRules.id,
    }),
};

export const followerParamsSchema = {
    params: zod.object({
        followerId: generalRules.id,
    }),
};

export const privacySchema = {
    body: zod.object({
        status: zod.enum(ProfileStatus),
    }).strict(),
};