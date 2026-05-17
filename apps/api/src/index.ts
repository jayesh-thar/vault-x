import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db/pool';
import { redis } from './db/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check — tests both connections live
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1'); // PostgreSQL alive?
    await redis.ping(); // Redis alive?
    res.json({ status: 'ok', db: 'connected', redis: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Service unavailable' });
  }
});

// Startup — verify connections before accepting traffic
async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');

    await redis.ping();
    console.log('Redis connected');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to DB or Redis:', err);
    process.exit(1);
  }
}

start();
