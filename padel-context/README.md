# Padel Context

Architecture multi-services avec Docker Compose :

- **API** : serveur REST Express (port 3000)
- **PostgreSQL** : base de données (port 5432)
- **MCP Server** : serveur Model Context Protocol (port 3001)
- **MCP Client** : client Gemini interagissant avec le serveur MCP

## Démarrage rapide

### Tous les services (API + DB + MCP Server)

```bash
docker compose up --build
```

### Avec le client MCP inclus

```bash
docker compose --profile client up --build
```

### Arrêter tous les services

```bash
docker compose down
```

## Configuration (.env)

Les variables d'environnement sont centralisées dans le fichier `.env` à la racine :

| Variable                    | Défaut                    | Description                      |
| --------------------------- | ------------------------- | -------------------------------- |
| `API_HTTP_PORT`             | 3000                      | Port d'accès à l'API             |
| `DATABASE_HOST_PORT`        | 5433                      | Port d'accès à PostgreSQL (hôte) |
| `DATABASE_NAME`             | padel-context-db          | Nom de la base de données        |
| `DATABASE_USER`             | padel-context-db_user     | Utilisateur PostgreSQL           |
| `DATABASE_PASSWORD`         | padel-context-db_password | Mot de passe PostgreSQL          |
| `AUTH_JWT_SECRET`           | change-me                 | Secret JWT                       |
| `MCP_SERVER_HTTP_PORT`      | 3001                      | Port du serveur MCP              |
| `MCP_CLIENT_GEMINI_API_KEY` | (vide)                    | Clé API Google Gemini            |
| `MCP_CLIENT_GEMINI_MODEL`   | models/gemma-4-26b-a4b-it | Modèle Gemini à utiliser         |

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

### MCP Client

- **Image** : `node:24.14.0-alpine3.23`
- **Chemin** : `./mcp-client/`
- **Profil** : optionnel (lancé uniquement avec `--profile client`)
- **Spécifications** : [mcp-client/README.md](./mcp-client/README.md)

## Commandes Docker utiles

```bash
# Afficher les logs d'un service
docker compose logs api
docker compose logs mcp-server
docker compose logs postgres

# Suivre les logs en temps réel
docker compose logs -f api

# Exécuter une commande dans un conteneur
docker compose exec api npm run test
docker compose exec api npx prisma migrate status

# Reconstruire un service spécifique
docker compose build api

# Redémarrer un service
docker compose restart api
```

**Erreur "port already in use"**

- Vérifier les ports occupés avec `netstat -tuln` (Linux/Mac) ou `netstat -ano` (Windows)
- Modifier les ports dans `.env` ou arrêter les services en conflit

**Connexion PostgreSQL échouée**

- Vérifier les identifiants dans `.env`
- Supprimer les volumes existants : `docker compose down -v` puis relancer
- Consulter les logs : `docker compose logs postgres`

**API ne peut pas se connecter à PostgreSQL**

- S'assurer que le service `postgres` est en cours d'exécution
- Vérifier `DATABASE_URL` ou les variables de connexion dans les logs API

**Fichiers modifiés non rechargés en développement**

- Vérifier que les bind mounts sont activés dans `docker compose up --build`
- Sur Docker Desktop (Windows), laisser 1-2 secondes pour les changements
