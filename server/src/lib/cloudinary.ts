import { v2 as cloudinary } from "cloudinary";
import { features } from "../config/env.js";
import { FeatureUnavailableError } from "./errors.js";

/**
 * Cloudinary reads its own credentials from CLOUDINARY_URL in the process
 * environment on import — there is nothing to configure here beyond checking
 * it exists before a route tries to use it.
 */
export function assertUploadsConfigured(): void {
  if (!features.uploads) {
    throw new FeatureUnavailableError("Image uploads", "CLOUDINARY_URL");
  }
}

export interface UploadResult {
  url: string;
  width: number;
  height: number;
}

/**
 * Uploads a buffer straight from memory — multer holds the file in RAM rather
 * than writing it to disk first, and Cloudinary's SDK takes a stream, so the
 * two are bridged with a small in-memory readable.
 *
 * Product photography is portrait 3:4 throughout the catalogue (see the
 * client's own image pipeline in client/scripts/build-images.py), so uploads
 * are cropped and resized to match on the way in — a crooked aspect ratio
 * here would break the grid's masonry math on every page that renders it.
 */
export async function uploadProductImage(
  buffer: Buffer,
  originalName: string,
): Promise<UploadResult> {
  assertUploadsConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "fashify/products",
        // A stable-ish public id from the filename, deduplicated by Cloudinary
        // itself if it collides.
        public_id: originalName.replace(/\.[^/.]+$/, "").slice(0, 80),
        resource_type: "image",
        transformation: [{ width: 1400, height: 1867, crop: "fill", gravity: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary returned no result"));
          return;
        }
        resolve({ url: result.secure_url, width: result.width, height: result.height });
      },
    );
    stream.end(buffer);
  });
}
