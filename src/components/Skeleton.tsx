export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden
    className={`animate-pulse rounded-md bg-border ${className}`}
  />
);
