# MCP server padel-context

MCP serveur de l'application padel-context.

## Variables d'environnement (.env)

- `MCP_SERVER_HTTP_PORT` (défaut: `3001`) pour le mapping du port hôte Docker
- `MCP_SERVER_PORT` (défaut: `3001`) pour le port interne du serveur MCP
- `MCP_SERVER_API_BASE_URL` (défaut: `http://api:3000/api` en Docker)

### Installer les dépendances

```bash
npm install
```

### Démarrer le serveur MCP

```bash
npm start
```

### Démarrer l'inspecteur MCP

```bash
npx @modelcontextprotocol/inspector
```
