import { Router } from 'express';
import { register, login, refresh, logout } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
} from '../../middleware/rateLimiter';
import { hibpCheck } from '../../middleware/hibp';

const router = Router();

router.post('/register', registerLimiter, hibpCheck, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', authenticate, logout);

export default router;
