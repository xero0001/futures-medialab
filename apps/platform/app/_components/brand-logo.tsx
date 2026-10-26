import styles from "./brand-logo.module.css";
import { BrandSymbol } from "@futures-medialab/ui/brand-symbol";

export { BrandSymbol };

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
