"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import type { Locale } from "./landing-copy";
import "./language-switcher.css";

const languages = [
  { value: "en", label: "English", shortLabel: "EN", lang: "en" },
  { value: "ko", label: "한국어", shortLabel: "한국어", lang: "ko" },
  { value: "zh", label: "中文", shortLabel: "中文", lang: "zh-CN" },
] as const;

export function LanguageSwitcher({
  locale,
  label,
  onChange,
  className = "",
}: {
  locale: Locale;
  label: string;
  onChange: (locale: Locale) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selectedIndex = languages.findIndex(
    (language) => language.value === locale,
  );
  const selected = languages[selectedIndex]!;

  useEffect(() => {
    if (open) optionRefs.current[focusedIndex]?.focus();
  }, [open, focusedIndex]);

  useEffect(() => {
    if (!open) return;

    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function openMenu(index: number) {
    setFocusedIndex(index);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={rootRef}
      className={`fm-language-switcher ${className}`}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) ||
          event.relatedTarget === triggerRef.current
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        className="fm-language-trigger"
        type="button"
        aria-label={`${label}: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu(selectedIndex))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowDown" ? 0 : languages.length - 1);
          }
        }}
      >
        <Globe2 className="fm-language-globe" size={18} aria-hidden="true" />
        <span lang={selected.lang}>{selected.shortLabel}</span>
        <ChevronDown
          className="fm-language-chevron"
          size={16}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={`${id}-menu`}
          className="fm-language-menu"
          role="menu"
          aria-labelledby={`${id}-trigger`}
          onKeyDown={(event) => {
            const { key } = event;
            if (key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
            } else if (key === "ArrowDown" || key === "ArrowUp") {
              event.preventDefault();
              const direction = key === "ArrowDown" ? 1 : -1;
              setFocusedIndex(
                (index) =>
                  (index + direction + languages.length) % languages.length,
              );
            } else if (key === "Home" || key === "End") {
              event.preventDefault();
              setFocusedIndex(key === "Home" ? 0 : languages.length - 1);
            } else if (
              key.length === 1 &&
              key !== " " &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              const match = languages.findIndex((language) =>
                language.label.toLowerCase().startsWith(key.toLowerCase()),
              );
              if (match !== -1) {
                event.preventDefault();
                setFocusedIndex(match);
              }
            }
          }}
        >
          {languages.map((language, index) => (
            <button
              key={language.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              className="fm-language-option"
              type="button"
              role="menuitemradio"
              lang={language.lang}
              aria-checked={locale === language.value}
              tabIndex={focusedIndex === index ? 0 : -1}
              onFocus={() => setFocusedIndex(index)}
              onClick={() => {
                onChange(language.value);
                closeMenu();
              }}
            >
              <span>{language.label}</span>
              {locale === language.value && (
                <Check size={18} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
