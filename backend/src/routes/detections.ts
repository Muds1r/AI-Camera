import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { camera_id, limit = '50' } = req.query;
    let query = supabase
      .from('detections')
      .select('*, cameras(id, name, location)')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (camera_id) {
      query = query.eq('camera_id', String(camera_id));
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ detections: data || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { camera_id, label, confidence, bounding_box, snapshot_url } = req.body;

    if (!camera_id || !label || confidence === undefined) {
      res.status(400).json({ error: 'camera_id, label, and confidence are required' });
      return;
    }

    const { data: detection, error: detectionError } = await supabase
      .from('detections')
      .insert([
        {
          camera_id,
          label,
          confidence: Number(confidence),
          bounding_box: bounding_box || null,
          snapshot_url: snapshot_url || null,
        },
      ])
      .select()
      .single();

    if (detectionError) {
      res.status(500).json({ error: detectionError.message });
      return;
    }

    res.status(201).json({ detection });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
