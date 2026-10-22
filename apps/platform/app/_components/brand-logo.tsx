import styles from "./brand-logo.module.css";

export function BrandSymbol({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M6 8h28l-6 9H0L6 8Zm8 15h16l-6 9H8l6-9Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  footer = false,
  href = "#top",
}: {
  footer?: boolean;
  href?: string;
}) {
  return (
    <a
      href={href}
      className={`${styles.wordmark} fm-wordmark${footer ? " fm-wordmark-footer" : ""}`}
      aria-label="Futures Medialab home"
    >
      <BrandSymbol />
      <span>
        futures<span className={styles.subtitle}>MEDIALAB</span>
      </span>
    </a>
  );
}
