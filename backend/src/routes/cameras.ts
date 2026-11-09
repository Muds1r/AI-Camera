import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { Permission } from '../lib/auth/permissions';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requirePermission(Permission.CamerasView));

router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('cameras')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ cameras: data || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('cameras').select('*').eq('id', id).single();

    if (error) {
      res.status(404).json({ error: 'Camera not found' });
      return;
    }

    res.json({ camera: data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, location, stream_url, status } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Camera name is required' });
      return;
    }

    const { data, error } = await supabase
      .from('cameras')
      .insert([
        {
          name,
          location: location || null,
          stream_url: stream_url || null,
          status: status || 'offline',
        },
      ])
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ camera: data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['online', 'offline', 'error'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value' });
      return;
    }

    const { data, error } = await supabase
      .from('cameras')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ camera: data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('cameras').delete().eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Camera deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
