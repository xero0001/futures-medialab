import styles from "./brand-logo.module.css";
import { BrandSymbol } from "@futures-medialab/ui/brand-symbol";
import { BrandWordmark } from "@futures-medialab/ui/brand-wordmark";

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
      <BrandWordmark />
    </a>
  );
}
