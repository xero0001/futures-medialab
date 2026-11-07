/** Two-line lettering inspired by the Futures Entertainment wordmark. */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`fm-brand-wordmark ${className}`}>
      Futures
      <br />
      Medialab
    </span>
  );
}
