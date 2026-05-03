import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight Express request logger.
 * Logs: <method> <path> <status> <duration>ms
 * Skips static asset requests to keep logs readable on a Pi console.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    // Skip noisy static asset hits
    if (!originalUrl.startsWith('/api')) return;

    const duration = Date.now() - start;
    const status = res.statusCode;
    const tag = status >= 500 ? 'ERR' : status >= 400 ? 'WRN' : 'OK ';
    console.log(`[${tag}] ${method} ${originalUrl} ${status} ${duration}ms`);
  });

  next();
}
