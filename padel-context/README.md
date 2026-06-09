# Padel Context

Architecture multi-services avec Docker Compose :

- **API** : Serveur Node.js/Express/Prisma (port 3000)
- **PostgreSQL** : Base de données PostgreSQL (port 5432)
- **MCP Server** : Serveur Node du serveur MCP (port 3001)
- **MCP Client Web** : Serveur Web Next.js avec chatbot (port 3002)

## Démarrage rapide

### Tous les services (API + DB + MCP Server + MCP Client Web)

```bash
docker compose up --build
```

### Arrêter tous les services

```bash
docker compose down
```

## Configuration (.env)

Les variables d'environnement sont centralisées dans le fichier `.env` à la racine :

| Variable                       | Défaut                    | Description                                            |
| ------------------------------ | ------------------------- | ------------------------------------------------------ |
| `API_HTTP_PORT`                | 3000                      | Port d'accès à l'API                                   |
| `DATABASE_HOST_PORT`           | 5433                      | Port d'accès à PostgreSQL (hôte)                       |
| `DATABASE_NAME`                | padel-context-db          | Nom de la base de données                              |
| `DATABASE_USER`                | padel-context-db_user     | Utilisateur PostgreSQL                                 |
| `DATABASE_PASSWORD`            | padel-context-db_password | Mot de passe PostgreSQL                                |
| `AUTH_JWT_SECRET`              | change-me                 | Secret JWT                                             |
| `MAX_UPCOMING_MATCHES`         | 5                         | Limite maximum de match rejoins par utilisateur        |
| `MCP_SERVER_HTTP_PORT`         | 3001                      | Port du serveur MCP (conteneur)                        |
| `MCP_CLIENT_WEB_PORT`          | 3002                      | Port d'accès au client web (hôte)                      |
| `GOOGLE_GENERATIVE_AI_API_KEY` | (vide)                    | Clé API Google Gemini (obligatoire)                    |
| `GEMINI_MODEL`                 | gemini-3.1-flash-lite     | Modèle Gemini à utiliser                               |
| `LANGFUSE_SECRET_KEY`          | (vide)                    | Clé secrète Langfuse (optionnel)                       |
| `LANGFUSE_PUBLIC_KEY`          | (vide)                    | Clé publique Langfuse (optionnel)                      |
| `LANGFUSE_BASE_URL`            | (vide)                    | URL Langfuse (optionnel)                               |
| `UPSTASH_REDIS_REST_URL`       | (vide)                    | URL REST Upstash Redis (obligatoire pour rate limit)   |
| `UPSTASH_REDIS_REST_TOKEN`     | (vide)                    | Token REST Upstash Redis (obligatoire pour rate limit) |

## Services

### API

- **Image** : `node:24.14.0-alpine3.23`
- **Port Docker** : 3000
- **Chemin** : `./api/`
- **Documentation** : Swagger disponible à `http://localhost:{API_HTTP_PORT}/api-docs/`
- **Spécifications** : [api/README.md](./api/README.md)

### PostgreSQL

- **Image** : `postgres:18.3-alpine3.23`
- **Port Docker** : 5432

### MCP Server

- **Image** : `node:24.14.0-alpine3.23`
- **Chemin** : `./mcp-server/`
- **Port Docker** : 3001
- **Spécifications** : [mcp-server/README.md](./mcp-server/README.md)

### MCP Client Web

- **Image** : `node:24.14.0-alpine3.23`
- **Chemin** : `./mcp-client-web/`
- **Port Docker** : 3002
- **Spécifications** : [mcp-client-web/README.md](./mcp-client-web/README.md)

## Commandes Docker utiles

```bash
# Afficher les logs d'un service
docker compose logs api
docker compose logs mcp-server
docker compose logs mcp-client-web
docker compose logs postgres

# Suivre les logs en temps réel
docker compose logs -f mcp-client-web

# Exécuter une commande dans un conteneur
docker compose exec api npm run test
docker compose exec api npx prisma migrate status

# Reconstruire un service spécifique
docker compose build mcp-client-web

# Redémarrer un service
docker compose restart mcp-client-web
```
