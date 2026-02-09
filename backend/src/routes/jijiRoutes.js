import express from 'express';
import jijiService from '../services/jijiService.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { optionalAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.post(
  '/ask-jiji',
  optionalAuth,
  validateRequest(schemas.askJiji),
  async (req, res, next) => {
    try {
      const { query } = req.body;
      const userId = req.user?.id || null;

      // Process the query
      const response = await jijiService.processQuery(query, userId);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/history', optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const limit = parseInt(req.query.limit) || 10;
    const history = await jijiService.getQueryHistory(req.user.id, limit);

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Jiji backend is running',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1'
  });
});

export default router;