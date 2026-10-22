import {
  ArrowUpRight,
  Check,
  FileText,
  Gamepad2,
  LockKeyhole,
  Play,
  Radio,
  ShieldCheck,
} from "lucide-react";
import type { LandingCopy } from "./landing-copy";

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

export function Wordmark({ footer = false }: { footer?: boolean }) {
  return (
    <a
      href="#top"
      className={`fm-wordmark${footer ? " fm-wordmark-footer" : ""}`}
      aria-label="Futures Medialab home"
    >
      <BrandSymbol />
      <span>
        futures<span className="fm-wordmark-sub">MEDIALAB</span>
      </span>
    </a>
  );
}

export function ConnectionVisual({ copy }: { copy: LandingCopy["hero"] }) {
  return (
    <div className="fm-connection" aria-hidden="true">
      <div className="fm-connection-orbit fm-connection-orbit-one" />
      <div className="fm-connection-orbit fm-connection-orbit-two" />
      <div className="fm-connection-dots" />
      <svg className="fm-ribbons" viewBox="0 0 560 520" fill="none">
        <defs>
          <linearGradient
            id="ribbon-back"
            x1="120"
            y1="80"
            x2="370"
            y2="370"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#d9e2ff" />
            <stop offset=".42" stopColor="#7f8df6" />
            <stop offset="1" stopColor="#3449cc" />
          </linearGradient>
          <linearGradient
            id="ribbon-front"
            x1="230"
            y1="170"
            x2="420"
            y2="420"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#273ac9" />
            <stop offset=".55" stopColor="#566df0" />
            <stop offset="1" stopColor="#a8bcff" />
          </linearGradient>
          <linearGradient
            id="ribbon-edge"
            x1="120"
            y1="80"
            x2="430"
            y2="440"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" stopOpacity=".9" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter
            id="ribbon-shadow"
            x="-50%"
            y="-50%"
            width="200%"
            height="220%"
          >
            <feDropShadow
              dx="2"
              dy="23"
              stdDeviation="18"
              floodColor="#2438a6"
              floodOpacity=".16"
            />
          </filter>
        </defs>
        <g filter="url(#ribbon-shadow)" transform="rotate(-34 280 260)">
          <rect
            x="105"
            y="80"
            width="213"
            height="290"
            rx="106.5"
            stroke="url(#ribbon-back)"
            strokeWidth="56"
          />
          <rect
            x="239"
            y="175"
            width="213"
            height="290"
            rx="106.5"
            stroke="url(#ribbon-front)"
            strokeWidth="56"
          />
          <path
            d="M211.5 370C270.3 370 318 322.3 318 263.5V211"
            stroke="url(#ribbon-back)"
            strokeWidth="56"
          />
          <path
            d="M211.5 108C168.2 108 133 143.2 133 186.5V263.5"
            stroke="url(#ribbon-edge)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M345.5 203C388.8 203 424 238.2 424 281.5V358.5"
            stroke="url(#ribbon-edge)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="fm-route-label fm-route-from">
        <span className="fm-route-dot" />
        <span>{copy.routeFrom}</span>
        <ArrowUpRight size={15} />
      </div>
      <div className="fm-route-label fm-route-to">
        <span className="fm-route-dot" />
        <span>{copy.routeTo}</span>
        <ArrowUpRight size={15} />
      </div>
      <div className="fm-connection-caption">
        <span />
        {copy.routeMiddle}
        <span />
      </div>
    </div>
  );
}

export function CampaignPreview({
  copy,
  active,
}: {
  copy: LandingCopy["paths"];
  active: number;
}) {
  return (
    <div className={`fm-product-preview fm-product-preview-${active}`}>
      <span className="fm-preview-caption">
        <span />
        {copy.preview}
      </span>
      <div className="fm-preview-window">
        <div className="fm-preview-top">
          <BrandSymbol />
          <span>
            futures / {active === 0 ? copy.managed : copy.marketplace}
          </span>
          <span className="fm-window-dots">•••</span>
        </div>
        {active === 0 ? (
          <div className="fm-brief-preview">
            <div className="fm-preview-heading">
              <span className="fm-preview-icon">
                <FileText size={23} />
              </span>
              <div>
                <small>01</small>
                <h3>{copy.briefLabel}</h3>
              </div>
            </div>
            <dl>
              {[
                [copy.gameLabel, copy.gameValue],
                [copy.marketLabel, copy.marketValue],
                [copy.platformLabel, copy.platformValue],
                [copy.goalLabel, copy.goalValue],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="fm-private-note">
              <LockKeyhole size={14} />
              {copy.privateLabel}
              <Check size={14} />
            </div>
          </div>
        ) : (
          <div className="fm-offers-preview">
            <div className="fm-approval-note">
              <ShieldCheck size={15} />
              {copy.partnerLabel}
            </div>
            {[
              {
                title: copy.offerOne,
                subtitle: copy.offerOneFormat,
                Icon: Gamepad2,
              },
              {
                title: copy.offerTwo,
                subtitle: copy.offerTwoFormat,
                Icon: Play,
              },
              {
                title: copy.offerThree,
                subtitle: copy.offerThreeFormat,
                Icon: Radio,
              },
            ].map(({ title, subtitle, Icon }, index) => (
              <div className="fm-mini-offer" key={title}>
                <span className={`fm-offer-art fm-offer-art-${index}`}>
                  <Icon size={22} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{subtitle}</p>
                </div>
                <ArrowUpRight size={17} />
              </div>
            ))}
            <p className="fm-preview-bottom">
              <Check size={14} />
              {copy.termsLabel}
            </p>
          </div>
        )}
      </div>
      <div className="fm-preview-paper fm-preview-paper-one" />
      <div className="fm-preview-paper fm-preview-paper-two" />
    </div>
  );
}
