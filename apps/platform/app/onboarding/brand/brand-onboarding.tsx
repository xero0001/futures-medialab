"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Globe2,
  Handshake,
  Lightbulb,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { AuthShell } from "../../_components/auth-shell";
import type { Locale } from "../../_components/landing-copy";
import {
  BRAND_COMPANY_SIZES,
  BRAND_COUNTRY_GROUPS,
  BRAND_INDUSTRIES,
  BRAND_INTERESTS,
  BRAND_PHONE_DIAL_CODES,
} from "../../../lib/brand-profile";
import { ProfileSelect } from "./profile-select";
import { onboardingCopy } from "./onboarding-copy";
import { authClient } from "../../../lib/auth-client";
import "./brand-onboarding.css";

type Interest = (typeof BRAND_INTERESTS)[number];
type Field =
  | "organizationName"
  | "industry"
  | "countryCode"
  | "companySize"
  | "contactName"
  | "phone";
type SubmitError =
  | "interestRequired"
  | "invalid"
  | "failed"
  | "unauthorized"
  | "forbidden"
  | "conflict";
const interestIcons = {
  "creator-discovery": Search,
  "performance-tracking": BarChart3,
  "market-analysis": Globe2,
  "campaign-management": ClipboardList,
  "creative-strategy": Lightbulb,
  "managed-marketing": Handshake,
};

export function BrandOnboarding({
  initialLocale,
  initialCompanyName,
  initialCompanySize,
}: {
  initialLocale: Locale;
  initialCompanyName: string;
  initialCompanySize: string;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [organizationName, setOrganizationName] = useState(initialCompanyName);
  const [industry, setIndustry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [companySize, setCompanySize] = useState(initialCompanySize);
  const [contactName, setContactName] = useState("");
  const [phoneDialCode, setPhoneDialCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, boolean>>>({});
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [pending, setPending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const logoutPending = useRef(false);
  const requestPending = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modalTitleRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const firstInterestRef = useRef<HTMLButtonElement>(null);
  const t = onboardingCopy[locale];
  const countryNames = new Intl.DisplayNames(
    [locale === "zh" ? "zh-CN" : locale],
    { type: "region" },
  );
  const countryGroups = BRAND_COUNTRY_GROUPS.map((group) => ({
    id: group.id,
    label: t.groups[group.id],
    options: group.codes.map((value) => ({
      value,
      label: countryNames.of(value) ?? value,
    })),
  }));
  const countryOptions = countryGroups.flatMap((group) => group.options);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  function clearError(field: Field) {
    setErrors((current) => ({ ...current, [field]: false }));
  }
  function error(field: Field) {
    return errors[field] ? (
      <p className="fmb-error" id={`brand-${field}-error`}>
        {field === "phone" ? t.phoneError : t.requiredError}
      </p>
    ) : null;
  }

  function continueToInterests(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Partial<Record<Field, boolean>> = {};
    Object.entries({
      organizationName,
      industry,
      countryCode,
      companySize,
      contactName,
    }).forEach(([field, value]) => {
      if (!value.trim()) nextErrors[field as Field] = true;
    });
    const phone = phoneNumber.trim();
    const digits = phone.replace(/[ ()-]/g, "");
    if (
      Boolean(phoneDialCode) !== Boolean(phone) ||
      (phone &&
        (!/^[0-9 ()-]+$/.test(phone) ||
          !/^\d{4,15}$/.test(digits) ||
          phoneDialCode.replace("+", "").length + digits.length > 15))
    )
      nextErrors.phone = true;
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      requestAnimationFrame(() =>
        document
          .getElementById(
            first === "phone" ? "brand-phoneNumber" : `brand-${first}`,
          )
          ?.focus(),
      );
      return;
    }
    setSubmitError(null);
    dialogRef.current?.showModal();
    modalTitleRef.current?.focus();
  }

  function closeDialog() {
    if (!requestPending.current) dialogRef.current?.close();
  }

  async function logout() {
    if (logoutPending.current || requestPending.current) return;
    logoutPending.current = true;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setLogoutError(true);
        return;
      }
      window.location.assign(`/login?lang=${locale}`);
    } catch {
      setLogoutError(true);
    } finally {
      logoutPending.current = false;
      setLoggingOut(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current) return;
    if (!interests.length) {
      setSubmitError("interestRequired");
      firstInterestRef.current?.focus();
      return;
    }
    requestPending.current = true;
    setPending(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/account/brand-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: organizationName.trim(),
          industry,
          countryCode,
          companySize,
          contactName: contactName.trim(),
          phoneDialCode,
          phoneNumber: phoneNumber.trim(),
          interests,
          note: note.trim(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        setSubmitError(
          response.status === 401
            ? "unauthorized"
            : response.status === 403
              ? "forbidden"
              : response.status === 409
                ? "conflict"
                : response.status === 400
                  ? "invalid"
                  : "failed",
        );
        return;
      }
      window.location.assign(`/account?lang=${locale}`);
    } catch {
      setSubmitError("failed");
    } finally {
      requestPending.current = false;
      setPending(false);
    }
  }

  return (
    <AuthShell
      locale={locale}
      onLocaleChange={changeLocale}
      headingId="brand-title"
      className="fmb-page"
    >
      <div className="fmb-wrap">
        <header className="fmb-header">
          <h1 id="brand-title">{t.title}</h1>
          <p>{t.subtitle}</p>
        </header>
        <form
          className="fmb-form"
          onSubmit={continueToInterests}
          noValidate
          aria-describedby="brand-required"
        >
          <p className="fmb-hint" id="brand-required">
            {t.required}
          </p>
          <div className="fmb-field">
            <label className="fmb-label" htmlFor="brand-organizationName">
              {t.organizationName} <span aria-hidden="true">*</span>
            </label>
            <input
              id="brand-organizationName"
              value={organizationName}
              onChange={(event) => {
                setOrganizationName(event.target.value);
                clearError("organizationName");
              }}
              autoComplete="organization"
              maxLength={120}
              required
              aria-invalid={!!errors.organizationName}
              aria-describedby={
                errors.organizationName
                  ? "brand-organizationName-error"
                  : undefined
              }
            />
            {error("organizationName")}
          </div>
          <div className="fmb-field">
            <ProfileSelect
              id="brand-industry"
              label={t.industry}
              placeholder={t.select}
              value={industry}
              onChange={(value) => {
                setIndustry(value);
                clearError("industry");
              }}
              options={BRAND_INDUSTRIES.map((value) => ({
                value,
                label: t.industries[value],
              }))}
              invalid={!!errors.industry}
              describedBy={errors.industry ? "brand-industry-error" : undefined}
              required
            />
            {error("industry")}
          </div>
          <div className="fmb-field">
            <ProfileSelect
              id="brand-countryCode"
              label={t.countryCode}
              placeholder={t.selectCountry}
              value={countryCode}
              onChange={(value) => {
                setCountryCode(value);
                clearError("countryCode");
              }}
              options={countryOptions}
              groups={countryGroups}
              groupLabel={t.selectRegion}
              invalid={!!errors.countryCode}
              describedBy={
                errors.countryCode ? "brand-countryCode-error" : undefined
              }
              required
            />
            {error("countryCode")}
          </div>
          <div className="fmb-field">
            <ProfileSelect
              id="brand-companySize"
              label={t.companySize}
              placeholder={t.select}
              value={companySize}
              onChange={(value) => {
                setCompanySize(value);
                clearError("companySize");
              }}
              options={BRAND_COMPANY_SIZES.map((value) => ({
                value,
                label: value,
              }))}
              invalid={!!errors.companySize}
              describedBy={
                errors.companySize
                  ? "brand-companySize-error brand-size-hint"
                  : "brand-size-hint"
              }
              required
            />
            <p id="brand-size-hint" className="fmb-hint">
              {t.companySizeHint}
            </p>
            {error("companySize")}
          </div>
          <div className="fmb-field">
            <label className="fmb-label" htmlFor="brand-contactName">
              {t.contactName} <span aria-hidden="true">*</span>
            </label>
            <input
              id="brand-contactName"
              value={contactName}
              onChange={(event) => {
                setContactName(event.target.value);
                clearError("contactName");
              }}
              autoComplete="name"
              maxLength={100}
              required
              aria-invalid={!!errors.contactName}
              aria-describedby={
                errors.contactName ? "brand-contactName-error" : undefined
              }
            />
            {error("contactName")}
          </div>
          <fieldset className="fmb-phone">
            <legend>
              {t.phone} <span>({t.optional})</span>
            </legend>
            <div className="fmb-phone-grid">
              <ProfileSelect
                id="brand-phoneDialCode"
                label={t.phoneDialCode}
                placeholder="—"
                value={phoneDialCode}
                onChange={(value) => {
                  setPhoneDialCode(value);
                  clearError("phone");
                }}
                options={[
                  { value: "", label: "—" },
                  ...BRAND_PHONE_DIAL_CODES.map((value) => ({
                    value,
                    label: value,
                  })),
                ]}
                invalid={!!errors.phone}
                describedBy={errors.phone ? "brand-phone-error" : undefined}
              />
              <div className="fmb-field">
                <label className="fmb-label" htmlFor="brand-phoneNumber">
                  {t.phoneNumber}
                </label>
                <input
                  id="brand-phoneNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    clearError("phone");
                  }}
                  maxLength={24}
                  aria-invalid={!!errors.phone}
                  aria-describedby={
                    errors.phone ? "brand-phone-error" : undefined
                  }
                />
              </div>
            </div>
            {error("phone")}
          </fieldset>
          <button
            ref={continueRef}
            type="submit"
            className="fml-submit fmb-continue"
            disabled={loggingOut}
          >
            {t.continue}
            <ArrowRight size={19} aria-hidden="true" />
          </button>
          <p className="fmb-approval-note">
            <ShieldCheck size={18} aria-hidden="true" />
            {t.pendingNote}
          </p>
        </form>
        <button
          className="fmb-logout"
          type="button"
          onClick={logout}
          disabled={loggingOut || pending}
        >
          {loggingOut ? t.loggingOut : t.logout}
        </button>
        {logoutError && (
          <p className="fmb-error" role="alert">
            {t.logoutError}
          </p>
        )}
      </div>
      <dialog
        ref={dialogRef}
        className="fmb-interest-dialog"
        aria-labelledby="interest-title"
        aria-describedby="interest-description"
        onCancel={(event) => {
          if (requestPending.current) event.preventDefault();
        }}
        onClose={() => continueRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              closeDialog();
          }
        }}
      >
        <button
          className="fmb-dialog-close"
          type="button"
          onClick={closeDialog}
          disabled={pending}
          aria-label={t.close}
        >
          <X size={23} aria-hidden="true" />
        </button>
        <h2 id="interest-title" ref={modalTitleRef} tabIndex={-1}>
          {t.interestTitle}
        </h2>
        <p id="interest-description">{t.interestSubtitle}</p>
        <form onSubmit={saveProfile} aria-busy={pending}>
          <div
            className="fmb-interest-grid"
            role="group"
            aria-labelledby="interest-title"
            aria-describedby={
              submitError === "interestRequired"
                ? "brand-save-error"
                : undefined
            }
          >
            {BRAND_INTERESTS.map((interest, index) => {
              const Icon = interestIcons[interest];
              const selected = interests.includes(interest);
              return (
                <button
                  ref={index === 0 ? firstInterestRef : undefined}
                  key={interest}
                  className="fmb-interest-card"
                  type="button"
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => {
                    setInterests((current) =>
                      current.includes(interest)
                        ? current.filter((value) => value !== interest)
                        : [...current, interest],
                    );
                    if (submitError === "interestRequired")
                      setSubmitError(null);
                  }}
                >
                  <span className="fmb-interest-check" aria-hidden="true">
                    {selected && <Check size={15} />}
                  </span>
                  <Icon size={29} aria-hidden="true" />
                  <span>{t.interests[interest]}</span>
                </button>
              );
            })}
          </div>
          <label className="fmb-note" htmlFor="brand-note">
            {t.note} <span>({t.optional})</span>
          </label>
          <textarea
            id="brand-note"
            rows={3}
            maxLength={1000}
            placeholder={t.notePlaceholder}
            value={note}
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
          />
          <p id="brand-save-error" className="fmb-error" role="alert">
            {submitError ? t[submitError] : ""}
          </p>
          {submitError === "unauthorized" && (
            <a className="fmb-recovery" href={`/login?lang=${locale}`}>
              {t.login}
            </a>
          )}
          {submitError === "conflict" && (
            <button
              className="fmb-recovery"
              type="button"
              onClick={() => window.location.reload()}
            >
              {t.reload}
            </button>
          )}
          <button
            className="fml-submit fmb-save"
            type="submit"
            disabled={pending}
          >
            {pending ? t.saving : t.submit}
          </button>
        </form>
      </dialog>
    </AuthShell>
  );
}
