import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import jijiRoutes from './routes/jijiRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';


app.use(helmet());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests, please try again later',
    },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
    );
    next();
  });
}


app.use(`/api/${API_VERSION}`, jijiRoutes);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Learn with Jiji API is running',
    version: API_VERSION,
    endpoints: {
      health: `/api/${API_VERSION}/health`,
      askJiji: `/api/${API_VERSION}/ask-jiji`,
      history: `/api/${API_VERSION}/history`,
    },
  });
});


app.use(notFoundHandler);
app.use(errorHandler);


app.listen(PORT, () => {
  console.log(`
🚀 Learn with Jiji Backend
-----------------------------------------
Environment : ${process.env.NODE_ENV || 'development'}
URL         : http://localhost:${PORT}
API Version : ${API_VERSION}

Endpoints:
- GET  /api/${API_VERSION}/health
- POST /api/${API_VERSION}/ask-jiji
- GET  /api/${API_VERSION}/history
-----------------------------------------
`);
});


const shutdown = (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
