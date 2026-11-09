import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { is_read, severity, limit = '50' } = req.query;
    let query = supabase
      .from('alerts')
      .select('*, cameras(id, name, location), detections(id, label, confidence, snapshot_url)')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    if (severity) {
      query = query.eq('severity', String(severity));
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ alerts: data || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { camera_id, detection_id, severity, message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Alert message is required' });
      return;
    }

    const { data, error } = await supabase
      .from('alerts')
      .insert([
        {
          camera_id: camera_id || null,
          detection_id: detection_id || null,
          severity: severity || 'info',
          message,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ alert: data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ alert: data });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
