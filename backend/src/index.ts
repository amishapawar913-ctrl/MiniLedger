import 'dotenv/config';
import { app } from './app';
import { initDb } from './db';

const port = Number(process.env.PORT) || 4000;

initDb()
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`MiniLedger API on :${port}`)))
  .catch((e) => {
    console.error('Failed to start (is Postgres running?)', e);
    process.exit(1);
  });
