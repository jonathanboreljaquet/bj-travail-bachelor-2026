import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || "padel-context-db_user"}:${process.env.POSTGRES_PASSWORD || "padel-context-db_password"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.DB_PORT || "5433"}/${process.env.POSTGRES_DB || "padel-context-db"}?schema=public`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
