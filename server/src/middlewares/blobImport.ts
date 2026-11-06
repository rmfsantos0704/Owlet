import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { issueSignedToken, presignUrl } from "@vercel/blob";

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

// Must match the Blob store's access mode (Vercel dashboard > Storage > your store).
// Set BLOB_ACCESS=private on the backend if the store is private; anything else means public.
const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "private" ? "private" : "public";

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

// Vercel won't accept request bodies over ~4.5 MB, so PDFs go from the browser straight to Vercel Blob.
//
// Step 1 (POST /research/import/token): the server picks a path inside this user's own folder and hands back
// a one-time upload link for exactly that path, PDF only, 15 MB max.
export async function startImportUpload(_req: Request, res: Response) {
  const pathname = `imports/${res.locals.userId}/${randomUUID()}.pdf`;
  const validUntil = Date.now() + UPLOAD_WINDOW_MS;
  try {
    const token = await issueSignedToken({
      pathname,
      operations: ["put"],
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: MAX_IMPORT_BYTES,
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      operation: "put",
      pathname,
      access: BLOB_ACCESS,
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: MAX_IMPORT_BYTES,
      addRandomSuffix: false,
      allowOverwrite: false,
      validUntil,
    });
    res.json({ pathname, uploadUrl: presignedUrl });
  } catch (err) {
    console.error("Creating the upload link failed:", err);
    res.status(500).json({ error: "Couldn't start the upload. Try again." });
  }
}

// Step 2 (POST /research/import): the browser sends only { collectionId, pathname, fileName }. This middleware
// downloads the uploaded PDF and puts it on req.file in the same shape multer used, so importPdf works unchanged.
export async function fetchImportBlob(req: Request, res: Response, next: NextFunction) {
  const { pathname, fileName } = req.body ?? {};

  // only files that this user's own upload link could have created
  if (
    typeof pathname !== "string" ||
    !pathname.startsWith(`imports/${res.locals.userId}/`) ||
    pathname.includes("..") ||
    !pathname.endsWith(".pdf")
  ) {
    return res.status(400).json({ error: "Invalid file" });
  }

  let signed;
  try {
    signed = await issueSignedToken({
      pathname,
      operations: ["get", "delete"],
      validUntil: Date.now() + UPLOAD_WINDOW_MS,
    });
  } catch (err) {
    console.error("Reading the uploaded file failed:", err);
    return res.status(500).json({ error: "Couldn't read the uploaded file." });
  }

  // the stored PDF is only a hand-off: delete it once we've answered, whether the import worked or not
  res.on("finish", () => {
    presignUrl(signed, { operation: "delete", pathname, access: BLOB_ACCESS })
      .then(({ presignedUrl }) => fetch(presignedUrl, { method: "DELETE" }))
      .catch(() => {});
  });

  try {
    const { presignedUrl } = await presignUrl(signed, {
      operation: "get",
      pathname,
      access: BLOB_ACCESS,
      useCache: false, // we read it right after it was written
    });
    const r = await fetch(presignedUrl);
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
  } catch (err) {
    console.error("Downloading the uploaded file failed:", err);
    res.status(400).json({ error: "Couldn't read the uploaded file." });
  }
}