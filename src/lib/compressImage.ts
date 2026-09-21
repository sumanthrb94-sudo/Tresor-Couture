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
export const PHOTO_MAX_DIM = 1800;
/** JPEG quality for a stored photograph. */
export const PHOTO_QUALITY = 0.86;

/**
 * Byte budgets, measured on the DATA URI (the string actually stored), because
 * that is what counts against Firestore's 1,048,576-byte document limit.
 *
 * A product document holds the main photo plus up to three gallery shots, so
 * the budgets have to sum to less than that limit with room to spare for the
 * product's own fields:  520 + 3x140 = 940KB.  Exceeding it does not degrade
 * gracefully — Firestore rejects the whole write, and the operator loses the
 * edit they just made.
 */
export const MAIN_PHOTO_BUDGET = 520_000;
export const GALLERY_PHOTO_BUDGET = 140_000;

/** Ladder tried from the top down: the first rung that fits the budget wins. */
const LADDER: { dim: number; quality: number }[] = [
  { dim: 1800, quality: 0.86 },
  { dim: 1600, quality: 0.84 },
  { dim: 1400, quality: 0.82 },
  { dim: 1200, quality: 0.8 },
  { dim: 1000, quality: 0.78 },
  { dim: 800, quality: 0.75 },
  { dim: 640, quality: 0.7 },
  { dim: 480, quality: 0.6 },
];

/**
 * Does this browser's canvas actually ENCODE WebP?
 *
 * It has to be asked, not assumed. `toDataURL` does not reject a format it
 * cannot write — the HTML spec says it silently falls back to PNG, and a PNG
 * of a photograph is several times larger than the JPEG it replaced. Believing
 * the request succeeded is therefore worse than never asking: it would push
 * every upload on an older Safari straight through the budget.
 *
 * Measured on this consignment, WebP saves 9-14% over JPEG at matched quality.
 * That is a real gain — it is the difference between 1000px and 1200px on a
 * beaded macro — but it is not a different order of magnitude, and no encoder
 * is, because the photographs arriving here are already JPEGs.
 */
let webpSupport: boolean | null = null;
function canEncodeWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

/** Render `img` at a given longest edge and return the data URI. */
function render(img: HTMLImageElement, maxDim: number, quality: number): string {
  const canvas = document.createElement('canvas');
  let { width, height } = img;
  // Only ever scale DOWN. Blowing a small photo up to the ladder's top rung
  // would cost bytes and add nothing — there is no detail to recover.
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width);
    width = maxDim;
  } else if (height > width && height > maxDim) {
    width = Math.round((width * maxDim) / height);
    height = maxDim;
  } else if (width === height && width > maxDim) {
    width = maxDim;
    height = maxDim;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  // A white ground, because JPEG has no alpha: a PNG cut-out would otherwise
  // composite onto black and arrive as a silhouette.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  if (canEncodeWebp()) {
    // Slightly lower number, comparable picture: WebP's quality scale is not
    // JPEG's, and matching them by eye rather than by digit is what turns the
    // format change into an actual byte saving.
    const webp = canvas.toDataURL('image/webp', Math.max(0.5, quality - 0.04));
    if (webp.startsWith('data:image/webp')) return webp;
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Store a photograph at the highest resolution that still fits `budget`.
 *
 * A fixed dimension cannot do this: how many bytes 1800px costs depends
 * entirely on the picture. A flat studio shot of a lace on white compresses to
 * a fraction of what a beaded macro does, so a single setting either wastes
 * resolution on the easy photograph or blows the budget on the hard one. This
 * walks a ladder from the top and keeps the first rung that fits, so every
 * photograph arrives as large as it can be rather than as large as the worst
 * case allows.
 *
 * Going over is not a soft failure — Firestore rejects the entire write, and
 * the operator loses the edit they just made — so the last rung is returned
 * even if it overshoots, and callers should check `fits()`.
 */
export function compressImage(
  file: File | Blob,
  budget: number = MAIN_PHOTO_BUDGET,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          let last = '';
          for (const rung of LADDER) {
            last = render(img, rung.dim, rung.quality);
            if (last.length <= budget) {
              resolve(last);
              return;
            }
          }
          resolve(last);
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Could not process that image.'));
        }
      };
      img.onerror = () => reject(new Error('That file is not an image we can read.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/** Firestore's hard per-document ceiling. Not a setting — no plan raises it. */
export const FIRESTORE_DOC_LIMIT = 1_048_576;

/** Total data-URI bytes a product's photographs may occupy, leaving headroom
 *  for the rest of the document (name, description, tags, prices...). */
export const PHOTO_TOTAL_BUDGET = 940_000;

/** Would these photographs fit in one product document? */
export function photosFit(photos: (string | undefined)[]): boolean {
  return photos.reduce((n, p) => n + (p?.length ?? 0), 0) <= PHOTO_TOTAL_BUDGET;
}
