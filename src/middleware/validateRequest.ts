import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const app = express();

// Enforce body size limit to prevent memory exhaustion DoS
app.use(express.json({ limit: '100kb' })); 

/**
 * Express middleware to validate and sanitize incoming JSON bodies.
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize prototype keys if parsed by standard body-parser
    const sanitizedBody = JSON.parse(JSON.stringify(req.body), (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });

    const result = schema.safeParse(sanitizedBody);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid payload structure',
        details: result.error.flatten(),
      });
    }

    // Assign sanitized and validated data back to req.body
    req.body = result.data;
    next();
  };
}
