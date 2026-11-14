import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  deleteEntityInSql,
  getAllRestaurantData,
  upsertEntityInSql,
} from './src/db/repository.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'royal-india-pos' });
  });

  app.get('/api/sql/state', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getAllRestaurantData(req.user!.uid);
      res.json({ ok: true, data });
    } catch (error: any) {
      console.error('Failed to fetch Cloud SQL state:', error);
      res.status(500).json({ error: error?.message || 'Failed to fetch database state' });
    }
  });

  app.post('/api/sql/entity', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { entity, id, payload } = req.body || {};
      if (!entity || !id || !payload) {
        return res.status(400).json({ error: 'Missing entity, id, or payload' });
      }
      await upsertEntityInSql(String(entity), String(id), payload, req.user!.uid);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Failed to upsert Cloud SQL entity:', error);
      res.status(500).json({ error: error?.message || 'Failed to save record' });
    }
  });

  app.delete('/api/sql/entity/:entity/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { entity, id } = req.params;
      await deleteEntityInSql(String(entity), String(id));
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Failed to delete Cloud SQL entity:', error);
      res.status(500).json({ error: error?.message || 'Failed to delete record' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
