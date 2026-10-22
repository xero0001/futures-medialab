"use client";

import { useState } from "react";
import type { FormEvent, RefObject } from "react";
import { ArrowDownToLine, X } from "lucide-react";
import type { LandingCopy, Locale } from "./landing-copy";
import { BrandSymbol } from "./landing-visuals";

export function BriefDialog({
  copy,
  locale,
  dialogRef,
}: {
  copy: LandingCopy["brief"];
  locale: Locale;
  dialogRef: RefObject<HTMLDialogElement | null>;
}) {
  const [downloaded, setDownloaded] = useState(false);

  function downloadBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) =>
      String(data.get(key) ?? "").trim() || copy.notSpecified;
    const content = [
      copy.documentTitle,
      "",
      `${copy.company}: ${value("company")}`,
      `${copy.game}: ${value("game")}`,
      `${copy.budget}: ${value("budget")}`,
      `${copy.timeline}: ${value("timeline")}`,
      `${copy.confidential}: ${data.get("confidential") ? copy.yes : copy.no}`,
      "",
      copy.goals,
      value("goals"),
      "",
      copy.note,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `futures-campaign-brief-${locale}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }

  return (
    <dialog
      ref={dialogRef}
      className="fm-dialog"
      aria-labelledby="brief-title"
      onClose={() => setDownloaded(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            event.currentTarget.close();
        }
      }}
    >
      <div className="fm-dialog-inner">
        <div className="fm-dialog-brand">
          <BrandSymbol />
          <span>FUTURES MEDIALAB</span>
          <button
            type="button"
            className="fm-icon-button"
            aria-label={copy.close}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <h2 id="brief-title">{copy.title}</h2>
        <p className="fm-dialog-description">{copy.description}</p>
        <form onSubmit={downloadBrief} onChange={() => setDownloaded(false)}>
          <div className="fm-form-grid">
            <label>
              {copy.company}
              <input
                name="company"
                required
                maxLength={160}
                placeholder={copy.companyPlaceholder}
                autoComplete="organization"
              />
            </label>
            <label>
              {copy.game}
              <input
                name="game"
                maxLength={160}
                placeholder={copy.gamePlaceholder}
              />
            </label>
            <label>
              {copy.budget}
              <input
                name="budget"
                maxLength={100}
                placeholder={copy.budgetPlaceholder}
              />
            </label>
            <label>
              {copy.timeline}
              <input
                name="timeline"
                maxLength={100}
                placeholder={copy.timelinePlaceholder}
              />
            </label>
          </div>
          <label className="fm-full-field">
            {copy.goals}
            <textarea
              name="goals"
              rows={4}
              required
              maxLength={4000}
              placeholder={copy.goalsPlaceholder}
            />
          </label>
          <label className="fm-checkbox">
            <input type="checkbox" name="confidential" />
            {copy.confidential}
          </label>
          <button
            type="submit"
            className="fm-button fm-button-primary fm-download-button"
          >
            {copy.download}
            <ArrowDownToLine size={17} />
          </button>
          <p className="fm-form-note">{copy.note}</p>
          <p role="status" className="fm-form-status">
            {downloaded ? copy.success : ""}
          </p>
        </form>
      </div>
    </dialog>
  );
}
