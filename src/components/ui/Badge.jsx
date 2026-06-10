export const Badge = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    neutral: 'badge-default',
    success: 'badge-low',
    warning: 'badge-medium',
    danger: 'badge-critical',
    primary: 'badge-high',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[var(--fs-label)] font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
