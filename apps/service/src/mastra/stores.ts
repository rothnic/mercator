import { LibSQLStore } from '@mastra/libsql';

export const storage = new LibSQLStore({
  url: process.env.DATABASE_URL ?? 'file:./mastra.db',
  authToken: process.env.DATABASE_AUTH_TOKEN
});
