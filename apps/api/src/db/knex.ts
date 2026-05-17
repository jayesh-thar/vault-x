import knexLib from 'knex';
// import { pool } from "./pool";
import dotenv from 'dotenv';

dotenv.config();

const knex = knexLib({
  client: 'pg',
  connection: process.env.DATABASE_URL, // reuse the same pool — don't create a second one
  migrations: {
    directory: './src/migrations', // where migration files live
    extension: 'ts',
  },
});

export default knex;
