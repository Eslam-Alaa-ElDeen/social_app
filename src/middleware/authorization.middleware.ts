import { ForbiddenException } from "../common/exception/app.exception.js";
import type { NextFunction, Request, Response } from "express";


export const authorization = <TRole = string>(accessRole: TRole[] = []) => {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const userRole = req.user?.role as TRole | undefined;

            if (!userRole || !accessRole.includes(userRole)) {
                throw new ForbiddenException("forbidden account");
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};