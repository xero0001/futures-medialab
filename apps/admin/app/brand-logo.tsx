import Link from "next/link";
import { BrandSymbol } from "@futures-medialab/ui/brand-symbol";
import { BrandWordmark } from "@futures-medialab/ui/brand-wordmark";

export function BrandLogo({ href = "/" }: { href?: string }) {
  return (
    <Link className="admin-brand" href={href} aria-label="Futures Medialab 홈">
      <BrandSymbol />
      <BrandWordmark />
    </Link>
  );
}
