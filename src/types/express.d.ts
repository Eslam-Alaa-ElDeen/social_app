import { HydratedDocument } from "mongoose";
import { Iuser } from "../common/interface/user.interfasce.js";
import { JwtPayloadType } from "../common/service/token.service.js";

declare global {
    namespace Express {
        interface Request {
            user?: HydratedDocument<Iuser>;
            payload?: JwtPayloadType;
            filePath?: string | undefined;
            filesPaths?: unknown;
        }
    }
}