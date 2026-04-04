import express, { Request, Response } from "express";
import matchRoutes from "./routes/match.route";
import availableSlotRoutes from "./routes/available_slot.route";
import authRoutes from "./routes/auth.route";

const app = express();
const PORT = 3000;

app.use(express.json());

// Routes
app.use("/api/matches", matchRoutes);
app.use("/api/available-slots", availableSlotRoutes);
app.use("/api/auth", authRoutes);

if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log("Serveur démarré avec succès!");
    });
}

export default app;
