import { Router, type IRouter } from "express";
import healthRouter from "./health";
import animationsRouter from "./animations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(animationsRouter);

export default router;
