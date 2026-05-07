import React, { useEffect, useState } from 'react';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  /** Real photograph URL. */
  photo: string;
  /** SVG swatch data-URI used if the photo fails to load. */
  fallback: string;
  alt: string;
}

const FabricImage: React.FC<Props> = ({ photo, fallback, alt, loading = 'eager', ...rest }) => {
  const [src, setSrc] = useState(photo);

  useEffect(() => {
    setSrc(photo);
  }, [photo]);

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
      {...rest}
    />
  );
};

export default FabricImage;
