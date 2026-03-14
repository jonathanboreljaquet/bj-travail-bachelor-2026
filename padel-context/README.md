# API REST padel-context

API REST de l'application padel-context.

## Stack conteneurisée

- Service API: image construite depuis `Dockerfile`
- Base image API: `node:24.14.0-alpine3.23`
- Service base de données: `postgres:18.3-alpine3.23`
- Nom du conteneur API: `padel-context-api`
- Nom du conteneur DB: `padel-context-db`
- Réseau Docker: `padel-context-network`

## Prérequis

- Docker Desktop installé
- Docker Compose disponible (`docker compose version`)

## Variables d'environnement (.env)

- `APP_PORT` (défaut: `3000`)
- `DB_PORT` (défaut: `5433`)
- `POSTGRES_DB` (défaut: `padel-context-db`))
- `POSTGRES_USER` (défaut: `padel-context-db_user`)
- `POSTGRES_PASSWORD` (défaut: `padel-context-db_password`)

## Commandes essentielles

### Construire et lancer

```bash
docker compose up --build
```

### Construire et lancer en background

```bash
docker compose up -d --build
```

### Voir l'état des services

```bash
docker compose ps
```

### Suivre les logs en direct

```bash
docker compose logs -f
```

### Suivre uniquement les logs API

```bash
docker compose logs -f api
```

### Arrêter les services

```bash
docker compose down
```

### Arrêter et supprimer aussi les volumes

```bash
docker compose down -v
```



