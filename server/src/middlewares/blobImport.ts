import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { issueSignedToken, presignUrl } from "@vercel/blob";

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

// Must match the Blob store's access mode (Vercel dashboard > Storage > your store).
// Set BLOB_ACCESS=private on the backend if the store is private; anything else means public.
const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "private" ? "private" : "public";

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const VIEW_LINK_MS = 15 * 60 * 1000; // how long a PDF view link stays valid

// A short-lived link the browser can use to download a stored PDF for the viewer. It works whether the store is
// public or private, so the file never needs a permanent public address.
export async function signedFileUrl(pathname: string): Promise<string | undefined> {
  try {
    const signed = await issueSignedToken({
      pathname,
      operations: ["get"],
      validUntil: Date.now() + VIEW_LINK_MS,
    });
    const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname, access: BLOB_ACCESS });
    return presignedUrl;
  } catch (err) {
    console.error("Creating the PDF view link failed:", err);
    return undefined;
  }
}

// Removes a stored PDF (when its clip is deleted). Best effort: a failure only leaves an orphan file.
export async function deleteBlob(pathname: string) {
  try {
    const signed = await issueSignedToken({
      pathname,
      operations: ["delete"],
      validUntil: Date.now() + 60_000,
    });
    const { presignedUrl } = await presignUrl(signed, { operation: "delete", pathname, access: BLOB_ACCESS });
    await fetch(presignedUrl, { method: "DELETE" });
  } catch (err) {
    console.error("Deleting a stored PDF failed:", err);
  }
}

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
// It also records the path in res.locals.importPathname so importPdf can keep the file for the PDF viewer.
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
  res.locals.importPathname = pathname;

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

  // The PDF is kept when the import succeeds (the viewer opens it later, and deleting the clip deletes it).
  // If the import fails for any reason, delete it so nothing is left behind.
  res.on("finish", () => {
    if (res.statusCode === 201) return;
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