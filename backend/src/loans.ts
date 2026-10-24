import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from './db';
import { wrap } from './auth';
import { computeSummary } from './summary';

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

export const loanBodySchema = z.object({
  friend_name: z.string().trim().min(1, 'Friend name is required').max(100),
  amount: z.coerce.number().positive('Amount must be greater than 0').max(100000000),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
    .refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date'),
});

const today = () => new Date().toISOString().slice(0, 10);

export const loansRouter = Router();

loansRouter.get('/', wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, friend_name, amount, due_date, repaid_at, receipt_url
     FROM loans WHERE user_id = $1 ORDER BY (repaid_at IS NOT NULL), due_date ASC`,
    [res.locals.userId]
  );
  res.json(rows);
}));

loansRouter.post('/', upload.single('receipt'), wrap(async (req, res) => {
  const parsed = loanBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { friend_name, amount, due_date } = parsed.data;
  const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const { rows } = await pool.query(
    `INSERT INTO loans (user_id, friend_name, amount, due_date, receipt_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, friend_name, amount, due_date, repaid_at, receipt_url`,
    [res.locals.userId, friend_name, amount, due_date, receiptUrl]
  );
  res.status(201).json(rows[0]);
}));

loansRouter.patch('/:id/repaid', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await pool.query(
    `UPDATE loans SET repaid_at = COALESCE(repaid_at, now())
     WHERE id = $1 AND user_id = $2
     RETURNING id, friend_name, amount, due_date, repaid_at, receipt_url`,
    [id, res.locals.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Loan not found' });
  res.json(rows[0]);
}));

export const summaryHandler = wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT amount, due_date, repaid_at FROM loans WHERE user_id = $1`,
    [res.locals.userId]
  );
  res.json(computeSummary(rows, today()));
});
