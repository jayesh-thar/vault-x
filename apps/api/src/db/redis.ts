import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: 3, // retry 3 times before giving up
  enableReadyCheck: true, // wait until Redis is actually ready
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
  process.exit(1); // fail secure
});
