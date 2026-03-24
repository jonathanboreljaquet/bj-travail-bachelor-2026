process.env.NODE_ENV = 'test';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://padel-context-db_user:padel-context-db_password@localhost:5433/padel-context-db?schema=public';
}
