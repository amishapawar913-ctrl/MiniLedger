import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter, requireAuth } from './auth';
import { loansRouter, summaryHandler } from './loans';

export const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.get('/summary', requireAuth, summaryHandler);
app.use('/loans', requireAuth, loansRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});
