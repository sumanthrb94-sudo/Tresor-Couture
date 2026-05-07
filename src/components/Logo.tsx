import React from 'react';

interface Props {
  variant?: 'horizontal' | 'mark' | 'wordmark' | 'monogram';
  className?: string;
  onClick?: () => void;
  /** Use the founder's illustrated artwork rather than the vector marks. */
  illustrated?: boolean;
}

const Logo: React.FC<Props> = ({ variant = 'horizontal', className = '', onClick, illustrated = false }) => {
  if (illustrated) {
    return (
      <button onClick={onClick} className={`flex items-center ${className}`} aria-label="Trésor Couture">
        <img
          src="/logo.jpg"
          alt="Trésor Couture"
          loading="eager"
          style={{ mixBlendMode: 'multiply' }}
          className="h-full w-auto object-contain"
        />
      </button>
    );
  }

  if (variant === 'mark') {
    return (
      <button onClick={onClick} className={`flex items-center ${className}`} aria-label="Trésor Couture">
        <img src="/branding/mark.svg" alt="" className="h-12 w-12 object-contain" />
      </button>
    );
  }

  if (variant === 'wordmark') {
    return (
      <button onClick={onClick} className={`flex items-center ${className}`} aria-label="Trésor Couture">
        <img src="/branding/wordmark.svg" alt="Trésor Couture" className="h-10 w-auto" />
      </button>
    );
  }

  if (variant === 'monogram') {
    return (
      <button onClick={onClick} className={`flex items-center ${className}`} aria-label="Trésor Couture">
        <img src="/branding/monogram.svg" alt="Trésor Couture" className="h-32 w-32 md:h-40 md:w-40 object-contain" />
      </button>
    );
  }

  // horizontal lockup — mark + wordmark
  return (
    <button onClick={onClick} className={`flex items-center ${className}`} aria-label="Trésor Couture home">
      <img
        src="/branding/horizontal.svg"
        alt="Trésor Couture"
        className="h-9 md:h-11 w-auto"
      />
    </button>
  );
};

export default Logo;
