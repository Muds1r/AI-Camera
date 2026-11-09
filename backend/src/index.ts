import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cameraRoutes from './routes/cameras';
import detectionRoutes from './routes/detections';
import alertRoutes from './routes/alerts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/cameras', cameraRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/alerts', alertRoutes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;
