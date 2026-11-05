"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  CircleHelp,
  Crown,
  FolderHeart,
  Link2,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  SquareChartGantt,
  UserRound,
  X,
} from "lucide-react";
import styles from "./reference-shell.module.css";

const base = "/youdao/brand";
const discovery = [
  { href: "/storage/search", label: "인플루언서 검색" },
  { href: "/storage/similar-search", label: "유사 인플루언서 검색" },
  { href: "/storage/similar-brands", label: "동종 브랜드 인플루언서 추천" },
];
const navigation = [
  { href: "/agent", label: "Agent 스마트 도구", icon: Sparkles },
  { href: "/storage/collect", label: "즐겨찾기", icon: FolderHeart },
  { href: "/shortLinks", label: "단축 링크", icon: Link2 },
  {
    href: "/advertiser/campaign",
    label: "캠페인 관리",
    icon: SquareChartGantt,
  },
  {
    href: "/advertiser/accountManagement",
    label: "계정 관리",
    icon: UserRound,
  },
];

export default function ReferenceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [notice, setNotice] = useState<
    "reference" | "upgrade" | "feedback" | null
  >(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  function closeMobileMenu() {
    setMobileOpen(false);
    menuButton.current?.focus();
  }

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (notice && !dialog.current?.open) dialog.current?.showModal();
    if (!notice && dialog.current?.open) dialog.current.close();
  }, [notice]);

  function active(href: string) {
    if (href === "/agent") {
      return (
        pathname.startsWith(`${base}/agent`) ||
        pathname === `${base}/mention` ||
        pathname.startsWith(`${base}/comment/`)
      );
    }
    if (href === "/storage/similar-brands")
      return pathname.startsWith(`${base}${href}`);
    return pathname === `${base}${href}`;
  }

  return (
    <div
      lang="ko"
      className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}
    >
      <a className={styles.skipLink} href="#youdao-content">
        본문 바로가기
      </a>
      <header className={styles.header}>
        <button
          ref={menuButton}
          className={styles.mobileMenu}
          type="button"
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          aria-controls="youdao-navigation"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu size={22} />
        </button>
        <Link
          href={`${base}/storage/search`}
          className={styles.logo}
          aria-label="Youdao Ads 한국어 참고 화면 홈"
        >
          <span className={styles.logoMark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className={styles.wordmark}>
            youdao <b>Ads</b>
          </span>
        </Link>
        <span className={styles.referenceLabel}>한국어 참고</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.disclaimer}
            onClick={() => setNotice("reference")}
          >
            <CircleHelp size={14} />
            이용 안내
          </button>
          <span className={styles.divider} />
          <button
            type="button"
            className={styles.membership}
            onClick={() => setNotice("upgrade")}
          >
            <span>
              <Crown size={18} fill="currentColor" />
              회원 업그레이드
            </span>
            <em>더 많은 인플루언서와 만나보세요</em>
          </button>
          <Link
            className={styles.avatar}
            href={`${base}/advertiser/accountManagement`}
            aria-label="계정 관리"
          >
            브
          </Link>
        </div>
      </header>

      {mobileOpen && (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="메뉴 닫기"
          onClick={closeMobileMenu}
        />
      )}
      <aside
        id="youdao-navigation"
        className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ""}`}
      >
        <nav aria-label="Youdao 브랜드 참고 메뉴">
          <button
            type="button"
            className={styles.groupHeading}
            aria-expanded={expanded}
            onClick={() => {
              if (collapsed) setCollapsed(false);
              setExpanded(!expanded);
            }}
            title="인플루언서 리소스 검색"
          >
            <Search size={18} />
            <span>인플루언서 리소스 검색</span>
            <ChevronDown
              size={15}
              className={!expanded ? styles.chevronClosed : ""}
            />
          </button>
          {expanded && (
            <div className={styles.subnav}>
              {discovery.map((item, index) => (
                <Link
                  key={item.href}
                  href={`${base}${item.href}`}
                  className={`${styles.navItem} ${styles.subnavItem} ${active(item.href) ? styles.active : ""}`}
                  aria-current={active(item.href) ? "page" : undefined}
                  title={item.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className={styles.shortLabel}>{index + 1}</span>
                  <span className={styles.navText}>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={`${base}${href}`}
              className={`${styles.navItem} ${active(href) ? styles.active : ""}`}
              aria-current={active(href) ? "page" : undefined}
              title={label}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              <span className={styles.navText}>{label}</span>
            </Link>
          ))}
        </nav>
        <button
          className={styles.collapseButton}
          type="button"
          aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </aside>

      <main id="youdao-content" className={styles.main}>
        {children}
      </main>
      <button
        type="button"
        className={styles.feedback}
        onClick={() => setNotice("feedback")}
      >
        <MessageSquareText size={17} />
        <span>의견</span>
      </button>

      <dialog
        ref={dialog}
        className={styles.dialog}
        onCancel={() => setNotice(null)}
        onClose={() => setNotice(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const r = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              setNotice(null);
          }
        }}
        aria-labelledby="youdao-notice-title"
      >
        <button
          type="button"
          className={styles.closeDialog}
          aria-label="닫기"
          onClick={() => setNotice(null)}
        >
          <X size={20} />
        </button>
        <div className={styles.dialogIcon}>
          {notice === "upgrade" ? (
            <Crown size={28} />
          ) : (
            <CircleHelp size={28} />
          )}
        </div>
        <h2 id="youdao-notice-title">
          {notice === "upgrade"
            ? "회원 업그레이드 안내"
            : notice === "feedback"
              ? "화면에 대한 의견"
              : "한국어 화면 참고"}
        </h2>
        <p>
          {notice === "upgrade"
            ? "원본의 회원 안내 화면입니다. 이 참고 화면에서는 구독이나 결제를 진행하지 않습니다."
            : notice === "feedback"
              ? "검토할 화면과 바꾸고 싶은 부분을 프로젝트 대화에 남겨 주세요."
              : "Youdao Ads의 화면 구성을 한국어로 옮긴 참고 화면입니다. 표시된 계정과 인물은 예시이며 실제 서비스 신청은 진행되지 않습니다."}
        </p>
        <button
          type="button"
          className={styles.confirmButton}
          onClick={() => setNotice(null)}
        >
          확인
        </button>
      </dialog>
    </div>
  );
}
