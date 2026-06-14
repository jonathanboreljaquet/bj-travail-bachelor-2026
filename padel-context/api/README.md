# API REST

Serveur REST Express de l'application **Padel Context** : authentification,
gestion des matchs, créneaux et données météo. Documentation Swagger intégrée.

## Stack technique

- Node.js + Express 5 (TypeScript)
- Prisma 7 (ORM) + PostgreSQL
- Authentification JWT (`jsonwebtoken`) + `bcryptjs`
- Tâches planifiées (`node-cron`)
- Documentation API (`swagger-jsdoc` / `swagger-ui-express`)
- Tests : Jest + Supertest

## Arborescence du projet

```text
api/
├── src/                       # Code source de l'API
│   ├── app.ts                 # Point d'entrée de l'application Express
│   ├── db.ts                  # Connexion à la base de données (Prisma)
│   ├── controllers/           # Logique métier des endpoints
│   ├── routes/                # Définition des routes + documentation Swagger
│   ├── services/              # Services (ex. : météo MeteoSwiss)
│   ├── scheduler/             # Tâches planifiées (cron)
│   ├── middlewares/           # Middlewares (authentification JWT…)
│   └── utils/                 # Fonctions utilitaires
├── prisma/                    # Schéma, seeding et jeux de données
│   ├── schema.prisma          # Modèle de données
│   ├── seed.ts                # Orchestrateur de seeding
│   └── seeds/                 # Données de démo (clubs, courts, matchs…)
├── tests/                     # Tests unitaires et d'intégration (Jest)
├── data/                      # Cache des données météo (MeteoSwiss)
├── Dockerfile                 # Image Docker de l'API
├── package.json               # Dépendances et scripts
├── prisma.config.ts           # Configuration Prisma
├── tsconfig.json              # Configuration TypeScript
├── jest.config.cjs            # Configuration Jest
├── eslint.config.mjs          # Règles de lint
└── README.md                  # Documentation du dossier api
```

## Configuration et lancement avec Docker

Le lancement complet (tous les services) et les variables d'environnement sont
décrits dans le [README principal](../README.md#variables-denvironnement).

Au démarrage du conteneur, l'API exécute automatiquement
`prisma db push --force-reset`, `prisma generate` puis `prisma db seed` : le
schéma est (re)créé et les données de démo insérées à chaque lancement.

## Base de données

```bash
npx prisma studio    # Permet d'explorer la bdd dans le navigateur
```

## Tests

```bash
docker compose exec api npm run test
```

## Documentation

- **Swagger** : http://localhost:{API_HTTP_PORT}/api-docs/
- **Variables d'environnement** : voir le [README principal](../README.md#variables-denvironnement)
