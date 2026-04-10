import { Router } from "express";
import { getMatches, joinMatch } from "../controllers/match.controller";
import { createMatchFromSlot } from "../controllers/available_slot.controller";
import { authenticateJwt } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", getMatches);
router.post("/from-slot", authenticateJwt, createMatchFromSlot);
router.post("/:matchId/join", authenticateJwt, joinMatch);

export default router;
