/** The Futures symbol shared by the public site and the operations console. */
export function BrandSymbol({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 8h28l-6 9H0L6 8Zm8 15h16l-6 9H8l6-9Z" fill="currentColor" />
    </svg>
  );
}
