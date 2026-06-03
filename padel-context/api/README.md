# API REST

Serveur REST Express pour l'application padel-context.

## Arborescence du projet

Le dossier `api/` est organisé de la manière suivante :

```text
api/
├── src/                    # Code source principal de l'API
│   ├── app.ts              # Point d'entrée de l'application Express
│   ├── db.ts               # Connexion a la base de donnees avec Prisma
│   ├── controllers/        # Contrôleurs de l'API
│   ├── routes/             # Definition des routes de l'API
│   ├── services/           # Services de l'API
│   ├── middlewares/        # Middlewares de l'API
│   ├── scheduler/          # Cron jobs de l'API
│   └── utils/              # Fonctions utilitaires
├── tests/                  # Tests unitaires et tests d'integration
├── prisma/                 # Schema Prisma et seeding
├── data/                   # Fichiers de données utilisés par l'application
├── package.json            # Dependances de l'API
├── tsconfig.json           # Configuration TypeScript
├── eslint.config.mjs       # Regles de lint
├── Dockerfile              # Image Docker de l'API
└── README.md               # Documentation du dossier api
```

## Configuration et lancement avec Docker

Voir [README principal](../README.md)

## Développement local

```bash
npm install
npx prisma generate

```

## Visualiser la base de données

```bash
npx prisma studio
```

## Documentation

- **Swagger** : http://localhost:{API_HTTP_PORT}/api-docs/
- **Variables d'environnement** : voir [README principal - Configuration](../README.md#configuration-env)
