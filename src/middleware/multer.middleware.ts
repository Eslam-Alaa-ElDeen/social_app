import type { NextFunction, Request, RequestHandler, Response } from "express";
import { processMulterUpload } from "../common/utils/multer/local.multer.js";
import { UploadOptions } from "../common/interface";

export const uploadMiddleware = ({
        isRequired = true,
        multerMiddleware,
        validation = [],
        customPath = "general",
    }: UploadOptions): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        multerMiddleware(req, res, async (error: any) => {
            try {
                if (error) {
                    return next(new Error(error.message, { cause: { status: 400 } }));
                }

                const hasFiles =
                req.file ||
                (Array.isArray(req.files) && req.files.length > 0) ||
                (req.files && Object.keys(req.files).length > 0);

                if (isRequired && !hasFiles) {
                    return next(new Error("file is required", { cause: { status: 400 } }));
                }

                await processMulterUpload({ req, validation, customPath });
                next();
            } catch (err) {
                next(err);
            }
        });
    };
};