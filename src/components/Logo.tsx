import React from 'react';

interface Props {
  variant?: 'horizontal' | 'mark' | 'wordmark';
  className?: string;
  onClick?: () => void;
}

const Logo: React.FC<Props> = ({ variant = 'horizontal', className = '', onClick }) => {
  if (variant === 'mark') {
    return (
      <button onClick={onClick} className={`flex items-center ${className}`} aria-label="Trésor Couture">
        <img src="/logo.jpg" alt="Trésor Couture" className="h-12 w-12 object-contain" loading="eager" />
      </button>
    );
  }

  if (variant === 'wordmark') {
    return (
      <button onClick={onClick} className={`brand-logotype text-2xl uppercase ${className}`}>
        Trésor <span className="italic font-light text-brand-gold">Couture</span>
      </button>
    );
  }

  return (
    <button onClick={onClick} className={`flex items-center gap-3 ${className}`} aria-label="Trésor Couture home">
      <img src="/logo.jpg" alt="" className="h-11 w-11 object-contain" loading="eager" />
      <span className="brand-logotype text-lg md:text-xl uppercase whitespace-nowrap">
        Trésor <span className="italic font-light text-brand-gold">Couture</span>
      </span>
    </button>
  );
};

export default Logo;
