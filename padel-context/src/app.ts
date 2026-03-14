import express, { Request, Response } from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: "Ca fonctionne ! ",
  });
});

app.listen(PORT, () => {
  console.log("Serveur démarré avec succès!");
});