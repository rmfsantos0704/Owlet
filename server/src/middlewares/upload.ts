import multer from "multer";
import type { Request, Response, NextFunction } from "express";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    cb(null, ok); // a rejected file simply leaves req.file empty
  },
}).single("file");

export function uploadPdf(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: unknown) => {
    if (!err) {
      // multer decodes filenames as latin1; re-read the bytes as UTF-8 so "Peña" stays "Peña"
      const f = req.file;
      if (f && /^[\u0000-\u00ff]*$/.test(f.originalname)) {
        f.originalname = Buffer.from(f.originalname, "latin1").toString("utf8");
      }
      return next();
    }
    if (err instanceof multer.MulterError) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "PDF is too large (15 MB max)" : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    res.status(400).json({ error: "Upload failed" });
  });
}