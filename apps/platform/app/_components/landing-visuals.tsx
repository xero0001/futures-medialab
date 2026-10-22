import { ArrowUpRight } from "lucide-react";
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
    </div>
  );
}

export function CampaignArtwork() {
  return (
    <svg
      className="fm-campaign-illustration"
      viewBox="0 0 560 460"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="campaign-surface"
          x1="110"
          y1="95"
          x2="460"
          y2="370"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7185FF" />
          <stop offset="1" stopColor="#3446CF" />
        </linearGradient>
      </defs>
      <circle cx="280" cy="230" r="204" fill="#E9EDFF" />
      <rect
        x="92"
        y="126"
        width="368"
        height="246"
        rx="24"
        transform="rotate(-9 92 126)"
        fill="#CCD5FF"
      />
      <rect
        x="92"
        y="100"
        width="376"
        height="250"
        rx="24"
        fill="url(#campaign-surface)"
      />
      <circle
        cx="280"
        cy="225"
        r="62"
        stroke="white"
        strokeOpacity=".4"
        strokeWidth="2"
      />
      <path d="m264 193 48 32-48 32v-64Z" fill="white" />
      <path
        d="M127 320h145"
        stroke="white"
        strokeOpacity=".65"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M127 320h65"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="435" cy="104" r="44" fill="#192444" />
      <path
        d="m417 105 12 12 24-26"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
