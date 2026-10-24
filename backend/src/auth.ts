import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,13}$/, 'Enter a valid phone number (10-13 digits)');

export const authRouter = Router();

authRouter.post('/request-otp', wrap(async (req, res) => {
  const parsed = z.object({ phone: phoneSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { phone } = parsed.data;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await pool.query(
    `INSERT INTO otps (phone, code, expires_at)
     VALUES ($1, $2, now() + interval '5 minutes')
     ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = now() + interval '5 minutes'`,
    [phone, code]
  );
  console.log(`[MOCK OTP] ${phone} -> ${code}`); // mock SMS: just log it
  res.json({ message: 'OTP sent. Check the server log.' });
}));

authRouter.post('/verify-otp', wrap(async (req, res) => {
  const parsed = z
    .object({ phone: phoneSchema, otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits') })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { phone, otp } = parsed.data;

  const { rowCount } = await pool.query(
    `DELETE FROM otps WHERE phone = $1 AND code = $2 AND expires_at > now()`,
    [phone, otp]
  );
  if (!rowCount) return res.status(401).json({ error: 'Invalid or expired OTP' });

  const { rows } = await pool.query(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [phone]
  );
  const token = jwt.sign({ userId: rows[0].id }, SECRET, { expiresIn: '7d' });
  res.json({ token });
}));

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, SECRET) as { userId: number };
    res.locals.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
