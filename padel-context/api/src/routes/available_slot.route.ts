import { Router } from "express";
import { getAvailableSlots } from "../controllers/available_slot.controller";

const router = Router();

router.get("/", getAvailableSlots);
export default router;
