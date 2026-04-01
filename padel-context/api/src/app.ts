import express, { Request, Response } from "express";
import userRoutes from "./routes/user.routes";
import matchRoutes from "./routes/match.route";

const app = express();
const PORT = 3000;

app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);

if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log("Serveur démarré avec succès!");
    });
}

export default app;
