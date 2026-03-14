import express, { Request, Response } from 'express';
import prisma from './db';
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', async(req: Request, res: Response) => {
    try {
    const users = await prisma.user.findMany({});
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving users" });
  }
});

app.listen(PORT, () => {
  console.log("Serveur démarré avec succès!");
});