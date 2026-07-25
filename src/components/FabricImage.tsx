import React, { useEffect, useState } from 'react';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  /** Real photograph URL. */
  photo: string;
  /** SVG swatch data-URI used if the photo fails to load. */
  fallback: string;
  alt: string;
}

/** Last-resort neutral swatch, inlined so it can never itself fail to load.
 *  Used when both `photo` and `fallback` are missing or broken — otherwise the
 *  browser renders its broken-image icon, which looks like a bug to a customer. */
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 72">
       <rect width="60" height="72" fill="#F2EBDD"/>
       <path d="M0 52l18-16 13 11 11-9 18 15v19H0z" fill="#E4D9C3"/>
       <circle cx="42" cy="20" r="7" fill="#E4D9C3"/>
     </svg>`,
  );

const FabricImage: React.FC<Props> = ({ photo, fallback, alt, loading = 'lazy', ...rest }) => {
  // Resolve through photo -> fallback -> placeholder, skipping empties so an
  // absent photo goes straight to the next usable source instead of flashing
  // a broken image first.
  const firstSrc = photo || fallback || PLACEHOLDER;
  const [src, setSrc] = useState(firstSrc);

  useEffect(() => {
    setSrc(firstSrc);
  }, [firstSrc]);

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        if (fallback && src !== fallback && src !== PLACEHOLDER) setSrc(fallback);
        else if (src !== PLACEHOLDER) setSrc(PLACEHOLDER);
      }}
      {...rest}
    />
  );
};

export default FabricImage;
