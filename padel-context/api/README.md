# API REST padel-context

API REST de l'application padel-context.

## Stack conteneurisée

- Service API: image construite depuis `Dockerfile`
- Base image API: `node:24.14.0-alpine3.23`
- Service base de données: `postgres:18.3-alpine3.23`
- Nom du stack Docker: `padel-context-api`
- Nom du conteneur Docker API: `padel-context-node`
- Nom du conteneur Docker base de données: `padel-context-db`

## Prérequis

- Docker Desktop installé
- Docker Compose disponible (`docker compose version`)

## Variables d'environnement (.env)

- `APP_PORT` (défaut: `3000`)
- `DB_PORT` (défaut: `5433`)
- `POSTGRES_DB` (défaut: `padel-context-db`))
- `POSTGRES_USER` (défaut: `padel-context-db_user`)
- `POSTGRES_PASSWORD` (défaut: `padel-context-db_password`)

### Démarrer l'API

1. Build les conteneurs Docker
```bash
docker compose up --build
```

2. Lancer les tests d'intégration
```bash
docker compose exec api npm run test:integration
```
