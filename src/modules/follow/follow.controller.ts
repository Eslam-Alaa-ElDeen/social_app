import express from "express"
import { authentication, authorization} from "../../middleware";
import { responseFormatter } from "../../middleware/response.middleware.js";
import FollowService from "./follow.service.js"
import { RoleEnum, TOKEN_TYPE } from "../../common/utils/index.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { followSchema, unFollowSchema } from "./follow.validation.js";

const Router=express.Router;

const router=Router({
    strict:true,
    mergeParams:true,
    caseSensitive:true
});

router.post(
    "/",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(followSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            let data = await FollowService.follow(req.user!,req.body);
            let extraFollow=undefined
            if (data=="Follow request sent") {
                extraFollow="Follow request sent"
                data=""
            }
            return {
                status: 200,
                message: true,
                data,
                extra:extraFollow?? "Followed successfully",
            };
        }
    )
);

router.delete(
    "/unFollow",
    authentication(TOKEN_TYPE.access),
    authorization([RoleEnum.admin, RoleEnum.user]),
    Validation(unFollowSchema),
    responseFormatter(
        async (
            req: express.Request,
            res: express.Response,
            next: express.NextFunction
        ) => {
            const data = await FollowService.unFollow(req.user!,req.body);
            return {
                status: 200,
                message: true,
                data,
                extra: "Unfollowed successfully"
            };
        }
    )
);

export default router