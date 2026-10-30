import { Request, Response, NextFunction } from "express";

type HttpError = Error & { status?: number; statusCode?: number; type?: string };

export function errorHandler(err: HttpError, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  // client mistakes (bad JSON, body too large) are not server errors
  const status = err.status ?? err.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    const message =
      status === 413
        ? "That request is too large."
        : err.type === "entity.parse.failed"
          ? "The request wasn't valid JSON."
          : "Bad request";
    return res.status(status).json({ error: message });
  }

  console.error(err);
  res.status(500).json({ error: "Server error" });
}