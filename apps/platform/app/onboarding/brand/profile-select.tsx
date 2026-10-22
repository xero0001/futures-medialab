"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

export type ProfileOption = { value: string; label: string };
export type ProfileOptionGroup = {
  id: string;
  label: string;
  options: ProfileOption[];
};

export function ProfileSelect({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
  groups,
  groupLabel,
  invalid = false,
  describedBy,
  required = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: ProfileOption[];
  groups?: ProfileOptionGroup[];
  groupLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const shown = groups ? (groups[groupIndex]?.options ?? []) : options;
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open)
      document
        .getElementById(`${generatedId}-option-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, groupIndex, generatedId]);

  function openMenu() {
    const nextGroup = groups
      ? Math.max(
          0,
          groups.findIndex((group) =>
            group.options.some((option) => option.value === value),
          ),
        )
      : 0;
    const nextOptions = groups ? groups[nextGroup]!.options : options;
    setGroupIndex(nextGroup);
    setActiveIndex(
      Math.max(
        0,
        nextOptions.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  }

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      className="fmb-select"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${generatedId}-label`} className="fmb-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="fmb-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${generatedId}-list` : undefined}
        aria-activedescendant={
          open && shown.length
            ? `${generatedId}-option-${activeIndex}`
            : undefined
        }
        aria-labelledby={`${generatedId}-label`}
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          const key = event.key;
          if (key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (key === "ArrowDown" || key === "ArrowUp") {
            event.preventDefault();
            if (!open) openMenu();
            else
              setActiveIndex(
                (index) =>
                  (index + (key === "ArrowDown" ? 1 : -1) + shown.length) %
                  shown.length,
              );
          } else if (
            (key === "ArrowRight" || key === "ArrowLeft") &&
            open &&
            groups
          ) {
            event.preventDefault();
            setGroupIndex(
              (index) =>
                (index + (key === "ArrowRight" ? 1 : -1) + groups.length) %
                groups.length,
            );
            setActiveIndex(0);
          } else if ((key === "Home" || key === "End") && open) {
            event.preventDefault();
            setActiveIndex(key === "Home" ? 0 : shown.length - 1);
          } else if ((key === "Enter" || key === " ") && open) {
            event.preventDefault();
            const option = shown[activeIndex];
            if (option) choose(option.value);
          } else if (
            open &&
            key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const match = shown.findIndex((option) =>
              option.label.toLowerCase().startsWith(key.toLowerCase()),
            );
            if (match !== -1) {
              event.preventDefault();
              setActiveIndex(match);
            }
          }
        }}
      >
        <span className={selected ? undefined : "fmb-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className={`fmb-select-popup${groups ? " fmb-cascader" : ""}`}>
          {groups && (
            <div
              className="fmb-region-list"
              role="group"
              aria-label={groupLabel}
            >
              {groups.map((group, index) => (
                <button
                  key={group.id}
                  type="button"
                  tabIndex={-1}
                  aria-pressed={groupIndex === index}
                  onClick={() => {
                    setGroupIndex(index);
                    setActiveIndex(0);
                    triggerRef.current?.focus();
                  }}
                >
                  {group.label}
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          <div
            id={`${generatedId}-list`}
            className="fmb-option-list"
            role="listbox"
            aria-labelledby={`${generatedId}-label`}
          >
            {shown.map((option, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={value === option.value}
                id={`${generatedId}-option-${index}`}
                data-active={activeIndex === index}
                key={option.value}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
              >
                {option.label}
                {value === option.value && (
                  <Check size={17} aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
