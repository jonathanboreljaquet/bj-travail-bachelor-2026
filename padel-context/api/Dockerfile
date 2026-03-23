# https://hub.docker.com/_/node
FROM node:24.14.0-alpine3.23

WORKDIR /app

# Copie les fichiers de dépendances package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste du code source de l'application dans le conteneur
COPY . .

# Port sur lequel l'application va tourner
EXPOSE 3000

# Recharge le serveur à chaque modification d'un fichier
CMD ["sh", "-c", "npx prisma db push --force-reset && npx prisma generate && npm run test && npx prisma db seed && npm run dev"]