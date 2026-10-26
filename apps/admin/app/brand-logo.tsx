import Link from "next/link";
import { BrandSymbol } from "@futures-medialab/ui/brand-symbol";

export function BrandLogo({ href = "/" }: { href?: string }) {
  return (
    <Link className="admin-brand" href={href} aria-label="Futures Medialab 홈">
      <BrandSymbol />
      <span>
        futures<span className="admin-brand-sub">MEDIALAB</span>
      </span>
    </Link>
  );
}
