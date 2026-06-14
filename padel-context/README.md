# Padel Context

Architecture multi-services avec Docker Compose :

- **API** : Serveur Node.js/Express/Prisma (port 3000)
- **PostgreSQL** : Base de données PostgreSQL (port 5432)
- **MCP Server** : Serveur Node du serveur MCP (port 3001)
- **MCP Client Web** : Serveur Web Next.js avec chatbot (port 3002)

## Prérequis

- **Docker** et **Docker Compose v2**. - https://docs.docker.com/get-started/get-docker/
- Une **clé API Google Gemini** - https://aistudio.google.com/apikey
- Une **base de données Upstash Redis** - https://console.upstash.com

## Démarrage en local

Toutes les commandes se lancent depuis le dossier `padel-context/`.

### 1. Créer le fichier `.env`

```bash
cp .env.example .env
```

### 2. Renseigner les variables obligatoires

Éditer le `.env` et renseigner **au minimum** les variables suivantes :

| Variable                       | Description              |
| ------------------------------ | ------------------------ |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Clé API Google AI Studio |
| `UPSTASH_REDIS_REST_URL`       | URL Upstash Redis REST   |
| `UPSTASH_REDIS_REST_TOKEN`     | TOKEN Upstach Redis REST |

Fortement recommandé (sinon valeurs par défaut **non sécurisées**) :

- `AUTH_JWT_SECRET` : secret de signature des JWT (ex : `openssl rand -base64 32`).
- `MCP_INTERNAL_SECRET` : secret partagé entre `mcp-server` et `mcp-client-web`

Toutes les autres variables ont une valeur par défaut fonctionnelle.

### 3. Lancer tous les services

```bash
docker compose up --build
```

Au démarrage, le conteneur `api` crée le schéma de base de données et insère les
données de seeding automatiquement.

### 4. Accéder aux services

- Client web (chatbot) : http://localhost:3002
- API : http://localhost:3000
- Documentation Swagger de l'API : http://localhost:3000/api-docs/

> Les ports affichés correspondent aux valeurs par défaut.

### Compte de démonstration

Le seed crée un compte de test sans match (utilisable directement pour se connecter) :

- **Email** : `jonathan.borel@padelcontext.com`
- **Mot de passe** : `pomme123`

### Arrêter tous les services

```bash
docker compose down
```

## Variables d'environnement

Les variables d'environnement sont centralisées dans le fichier `.env` à la racine de `padel-context/`

### db - Base de données PostgreSQL

| Variable             |  Requis   | Défaut                      | Description                       |
| -------------------- | :-------: | --------------------------- | --------------------------------- |
| `DATABASE_NAME`      | Optionnel | `padel-context-db`          | Nom de la base de données         |
| `DATABASE_USER`      | Optionnel | `padel-context-db_user`     | Utilisateur PostgreSQL            |
| `DATABASE_PASSWORD`  | Optionnel | `padel-context-db_password` | Mot de passe PostgreSQL           |
| `DATABASE_HOST_PORT` | Optionnel | `5433`                      | Port PostgreSQL exposé sur l'hôte |

### api - API REST Node.js / Express / Prisma

| Variable               |  Requis   | Défaut      | Description                                        |
| ---------------------- | :-------: | ----------- | -------------------------------------------------- |
| `API_HTTP_PORT`        | Optionnel | `3000`      | Port de l'API exposé sur l'hôte                    |
| `AUTH_JWT_SECRET`      | Sécurité  | `change-me` | Secret de signature des JWT                        |
| `MAX_UPCOMING_MATCHES` | Optionnel | `5`         | Limite de matchs futurs simultanés par utilisateur |

### mcp-server - Serveur MCP

| Variable               |  Requis   | Défaut | Description                           |
| ---------------------- | :-------: | ------ | ------------------------------------- |
| `MCP_SERVER_HTTP_PORT` | Optionnel | `3001` | Port du serveur MCP exposé sur l'hôte |
| `MCP_INTERNAL_SECRET`  | Sécurité  | (vide) | Secret partagé avec `mcp-client-web`  |

### mcp-client-web - Client MCP web Next.js

| Variable                       |   Requis    | Défaut                  | Description                              |
| ------------------------------ | :---------: | ----------------------- | ---------------------------------------- |
| `MCP_CLIENT_WEB_HTTP_PORT`     |  Optionnel  | `3002`                  | Port du client MCP web exposé sur l'hôte |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Obligatoire | (vide)                  | Clé API Google AI Studio                 |
| `GEMINI_MODEL`                 |  Optionnel  | `gemini-3.1-flash-lite` | Modèle Gemini à utiliser                 |
| `UPSTASH_REDIS_REST_URL`       | Obligatoire | (vide)                  | URL REST Upstash Redis                   |
| `UPSTASH_REDIS_REST_TOKEN`     | Obligatoire | (vide)                  | Token REST Upstash Redis                 |
| `LANGFUSE_SECRET_KEY`          |  Optionnel  | (vide)                  | Clé secrète Langfuse                     |
| `LANGFUSE_PUBLIC_KEY`          |  Optionnel  | (vide)                  | Clé publique Langfuse                    |
| `LANGFUSE_BASE_URL`            |  Optionnel  | (vide)                  | URL Langfuse                             |

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
docker compose logs db

# Suivre les logs en temps réel
docker compose logs -f mcp-client-web

# Exécuter une commande dans un conteneur
docker compose exec api npm run test
docker compose exec api npx prisma db seed   # ré-insérer des données de seeding

# Reconstruire un service spécifique
docker compose build mcp-client-web

# Redémarrer un service
docker compose restart mcp-client-web
```
