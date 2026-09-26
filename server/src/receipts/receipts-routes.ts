import multer from "multer";
import { Router, type RequestHandler } from "express";
import { ApiError, ReceiptUploadError } from "../errors.js";
import { GeminiReceiptExtractor, MAX_RECEIPT_BYTES, ReceiptExtractionError, ReceiptProviderError, SUPPORTED_RECEIPT_MIME_TYPES, type ReceiptExtractor } from "./receipt-service.js";

type ReceiptRouterOptions = {
  authenticate: RequestHandler;
  extractor?: ReceiptExtractor;
  rateLimit?: RequestHandler;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 4 },
});

function uidFrom(request: import("express").Request): string {
  if (!request.auth?.uid) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
  return request.auth.uid;
}

function hasImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function imageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) return null;
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf;
      if (isStartOfFrame && offset + 9 < buffer.length) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + segmentLength;
    }
    return null;
  }

  if (mimeType === "image/webp" && buffer.length >= 25) {
    const chunk = buffer.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
        height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
      };
    }
    if (chunk === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L" && buffer[20] === 0x2f) {
      const bits = buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
  }

  return null;
}

function hasSafeImageDimensions(buffer: Buffer, mimeType: string): boolean {
  const dimensions = imageDimensions(buffer, mimeType);
  if (!dimensions) return false;
  return dimensions.width > 0
    && dimensions.height > 0
    && dimensions.width <= 10_000
    && dimensions.height <= 10_000
    && dimensions.width * dimensions.height <= 40_000_000;
}

export function createReceiptsRouter(options: ReceiptRouterOptions): Router {
  const router = Router();
  const extractor = options.extractor ?? new GeminiReceiptExtractor();
  router.use(options.authenticate);
  if (options.rateLimit) router.use(options.rateLimit);

  router.post("/receipts/scan", upload.single("receipt"), async (request, response, next) => {
    try {
      uidFrom(request);
      const file = request.file;
      if (!file) throw new ReceiptUploadError("Choose a receipt image before scanning.");
      if (!(SUPPORTED_RECEIPT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
        throw new ReceiptUploadError("Use a JPEG, PNG, or WebP receipt image.");
      }
       if (file.size === 0 || !hasImageSignature(file.buffer, file.mimetype) || !hasSafeImageDimensions(file.buffer, file.mimetype)) {
        throw new ReceiptUploadError("The receipt image is empty or malformed.");
      }
      response.json({ data: await extractor.extract(file.buffer, file.mimetype) });
    } catch (error) {
       if (error instanceof ReceiptUploadError || error instanceof ReceiptExtractionError || error instanceof ReceiptProviderError) {
         next(error);
       } else {
         next(new ReceiptProviderError());
       }
    }
  });

  return router;
}

export { ReceiptExtractionError, ReceiptProviderError };