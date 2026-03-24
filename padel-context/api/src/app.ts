import express, { Request, Response } from "express";
import prisma from "./db";
import userRoutes from "./routes/user.routes";

const app = express();
const PORT = 3000;

app.use(express.json());

// Routes
app.use("/users", userRoutes);

app.listen(PORT, () => {
  console.log("Serveur démarré avec succès!");
});

export default app;
