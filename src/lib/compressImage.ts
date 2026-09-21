/**
 * Downscale an image in the browser before it is stored.
 *
 * There is no Cloud Storage bucket in this project's free-tier model, so a
 * photograph is kept as a data URI inside its Firestore document — and a
 * Firestore document is capped at 1MB. A phone camera file is ten times that,
 * so resizing is not an optimisation here, it is what makes the save possible
 * at all.
 *
 * Shared by the admin product editor and the supplier intake form so a
 * photograph looks the same wherever it was uploaded from. A second copy of
 * this with a different `maxDim` would mean the same lace photographed once
 * arrives at two different sharpnesses depending on who sent it.
 */

/** Longest edge, in pixels, for a stored photograph. */
export const PHOTO_MAX_DIM = 800;
/** JPEG quality for a stored photograph. */
export const PHOTO_QUALITY = 0.8;

export function compressImage(
  file: File | Blob,
  maxDim: number = PHOTO_MAX_DIM,
  quality: number = PHOTO_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        // A white ground, because JPEG has no alpha: a PNG cut-out would
        // otherwise composite onto black and arrive as a silhouette.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('That file is not an image we can read.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
