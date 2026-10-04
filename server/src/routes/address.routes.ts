import { Router, Request, Response } from 'express';
import { addressService } from '../services/address.service.js';
import { asyncHandler } from '../middleware/error.middleware.js';

const router = Router();

// GET /api/address/suggest?query=... — подсказки адресов РФ (DaData)
router.get(
  '/suggest',
  asyncHandler(async (req: Request, res: Response) => {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!query) {
      res.status(400).json({ success: false, error: { message: 'query обязателен' } });
      return;
    }

    const suggestions = await addressService.suggest(query);
    res.json({ success: true, data: suggestions });
  }),
);

export default router;
