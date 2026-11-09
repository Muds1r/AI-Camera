import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cameraRoutes from './routes/cameras';
import detectionRoutes from './routes/detections';
import alertRoutes from './routes/alerts';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import attendanceRoutes from './routes/attendance';
import medicalRoutes from './routes/medical';
import uploadRoutes from './routes/uploads';
import companyRoutes from './routes/company';
import workforceRoutes from './routes/workforce';
import { errorHandler } from './middleware/error';
import { assertAuthConfig } from './lib/auth/tokens';

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

app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api', workforceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/medical-requests', medicalRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/alerts', alertRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  assertAuthConfig();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;
