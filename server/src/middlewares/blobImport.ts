import type { Request, Response, NextFunction } from "express";
import { del } from "@vercel/blob";

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

// Vercel won't accept request bodies over ~4.5 MB, so PDFs go from the browser straight to Vercel Blob.
// The browser then sends only { collectionId, blobUrl, fileName } here. This middleware downloads the
// file and puts it on req.file in the same shape multer used, so importPdf works unchanged.
export async function fetchImportBlob(req: Request, res: Response, next: NextFunction) {
  const { blobUrl, fileName } = req.body ?? {};

  let url: URL;
  try {
    url = new URL(String(blobUrl));
    // only our own Blob store, and only files this user's token route handed out
    const ownPrefix = `/imports/${res.locals.userId}/`;
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".blob.vercel-storage.com") ||
      !decodeURIComponent(url.pathname).startsWith(ownPrefix)
    ) {
      return res.status(400).json({ error: "Invalid file URL" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid file URL" });
  }

  // the stored PDF is only a hand-off: delete it once we've answered, whether the import worked or not
  res.on("finish", () => {
    del(url.href).catch(() => {});
  });

  try {
    const r = await fetch(url, { redirect: "error" });
    if (!r.ok) return res.status(400).json({ error: "Couldn't read the uploaded file." });

    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length > MAX_IMPORT_BYTES) {
      return res.status(413).json({ error: "PDF is too large (15 MB max)." });
    }

    req.file = {
      fieldname: "file",
      originalname: String(fileName ?? "import.pdf").slice(0, 200),
      encoding: "7bit",
      mimetype: "application/pdf",
      size: buffer.length,
      buffer,
    } as Express.Multer.File;
    next();
  } catch {
    res.status(400).json({ error: "Couldn't read the uploaded file." });
  }
}