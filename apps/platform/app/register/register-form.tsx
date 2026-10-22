"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AuthShell } from "../_components/auth-shell";
import { authClient } from "../../lib/auth-client";
import type { Locale } from "../_components/landing-copy";
import { registerCopy, type RegistrationRole } from "./register-copy";
import "./register.css";

const companySizes = [
  "1–14",
  "15–49",
  "50–99",
  "100–499",
  "500–1,999",
  "2,000+",
] as const;
type Field =
  | "organization"
  | "organizationType"
  | "companySize"
  | "email"
  | "password"
  | "confirm";
type ErrorKey = keyof typeof registerCopy.en.errors;
type Errors = Partial<Record<Field, ErrorKey>>;

export function RegisterForm({
  initialLocale,
  role,
}: {
  initialLocale: Locale;
  role?: RegistrationRole;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [organization, setOrganization] = useState("");
  const [organizationType, setOrganizationType] = useState<"agency" | "studio">(
    "agency",
  );
  const [companySize, setCompanySize] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [submitError, setSubmitError] = useState<
    | "duplicate"
    | "failed"
    | "invalidRegistration"
    | "tooMany"
    | "signInFailed"
    | null
  >(null);
  const requestPending = useRef(false);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const t = registerCopy[locale];
  const isAgency = role === "agency";

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  useEffect(() => {
    if (review) reviewRef.current?.focus();
  }, [review]);

  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  function clearError(field: Field) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (!organization.trim()) nextErrors.organization = "organizationRequired";
    if (!isAgency && !companySize) nextErrors.companySize = "choiceRequired";
    if (!email.trim()) nextErrors.email = "emailRequired";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      nextErrors.email = "emailInvalid";
    if (password.length < 8 || password.length > 128)
      nextErrors.password = "passwordLength";
    if (!confirm) nextErrors.confirm = "confirmRequired";
    else if (password !== confirm) nextErrors.confirm = "passwordMismatch";
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      requestAnimationFrame(() =>
        document.getElementById(`register-${firstError}`)?.focus(),
      );
      return;
    }
    setSubmitError(null);
    setReview(true);
  }

  async function createAccount() {
    if (!role || requestPending.current || accountCreated) return;
    requestPending.current = true;
    setPending(true);
    setSubmitError(null);
    let created = false;
    try {
      const response = await fetch("/api/auth/sign-up/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          organizationName: organization.trim(),
          agencyType: isAgency ? organizationType : undefined,
          companySize: isAgency ? undefined : companySize,
          email: email.trim().toLowerCase(),
          password,
          locale,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        setSubmitError(
          response.status === 409 || result?.code === "USER_ALREADY_EXISTS"
            ? "duplicate"
            : response.status === 429
              ? "tooMany"
              : response.status === 400
                ? "invalidRegistration"
                : "failed",
        );
        return;
      }
      created = true;
      setAccountCreated(true);
      const signIn = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe: false,
      });
      if (signIn.error) {
        setSubmitError("signInFailed");
        setPassword("");
        setConfirm("");
        return;
      }
      window.location.assign(`/auth/continue?lang=${locale}`);
    } catch {
      setSubmitError(created ? "signInFailed" : "failed");
      if (created) {
        setPassword("");
        setConfirm("");
      }
    } finally {
      requestPending.current = false;
      setPending(false);
    }
  }

  function errorMessage(field: Field) {
    const error = errors[field];
    return error ? (
      <p id={`register-${field}-error`} className="fmr-error">
        {t.errors[error]}
      </p>
    ) : null;
  }

  return (
    <AuthShell
      locale={locale}
      onLocaleChange={changeLocale}
      headingId={review ? "register-review-title" : "register-title"}
      className={`fmr-page${role ? " fmr-details" : ""}`}
    >
      <div className="fmr-wrap">
        {role && (
          <a href={`/register?lang=${locale}`} className="fmr-back">
            <ArrowLeft size={18} aria-hidden="true" />
            {t.back}
          </a>
        )}

        {!role ? (
          <>
            <header className="fmr-header">
              <h1 id="register-title">{t.title}</h1>
              <p>{t.subtitle}</p>
            </header>
            <div className="fmr-roles">
              <a
                href={`/register/agency?lang=${locale}`}
                className="fmr-role-card"
              >
                <span className="fmr-role-icon">
                  <UsersRound size={28} aria-hidden="true" />
                </span>
                <span className="fmr-role-copy">
                  <strong>{t.agency}</strong>
                  <span>{t.agencyDescription}</span>
                </span>
                <ArrowRight size={20} aria-hidden="true" />
              </a>
              <a
                href={`/register/brand?lang=${locale}`}
                className="fmr-role-card"
              >
                <span className="fmr-role-icon">
                  <Building2 size={28} aria-hidden="true" />
                </span>
                <span className="fmr-role-copy">
                  <strong>{t.brand}</strong>
                  <span>{t.brandDescription}</span>
                </span>
                <ArrowRight size={20} aria-hidden="true" />
              </a>
            </div>
            <p className="fmr-approval-note">
              <ShieldCheck size={18} aria-hidden="true" />
              {t.approval}
            </p>
          </>
        ) : review ? (
          <section
            className="fmr-review"
            aria-labelledby="register-review-title"
            aria-busy={pending}
          >
            <h1 id="register-review-title" ref={reviewRef} tabIndex={-1}>
              {t.reviewTitle}
            </h1>
            <p>{t.reviewNote}</p>
            <dl className="fmr-review-details">
              <div>
                <dt>{t.role}</dt>
                <dd>{isAgency ? t.agency : t.brand}</dd>
              </div>
              <div>
                <dt>{isAgency ? t.organization : t.company}</dt>
                <dd>{organization.trim()}</dd>
              </div>
              <div>
                <dt>{isAgency ? t.organizationType : t.companySize}</dt>
                <dd>
                  {isAgency
                    ? organizationType === "agency"
                      ? t.agencyCompany
                      : t.studio
                    : companySize}
                </dd>
              </div>
              <div>
                <dt>{t.email}</dt>
                <dd>{email.trim()}</dd>
              </div>
            </dl>
            <div className="fmr-review-actions">
              <button
                type="button"
                className="fml-submit"
                onClick={createAccount}
                disabled={pending || accountCreated}
              >
                {pending
                  ? t.creatingAccount
                  : accountCreated
                    ? t.created
                    : t.createAccount}
              </button>
              <button
                type="button"
                className="fmr-secondary"
                disabled={pending || accountCreated}
                onClick={() => {
                  setReview(false);
                  setSubmitError(null);
                  requestAnimationFrame(() => titleRef.current?.focus());
                }}
              >
                {t.edit}
              </button>
            </div>
            <p role="alert" className="fmr-error">
              {submitError ? t[submitError] : ""}
            </p>
          </section>
        ) : (
          <>
            <header className="fmr-header">
              <h1 id="register-title" ref={titleRef} tabIndex={-1}>
                {isAgency ? t.agencyTitle : t.brandTitle}
              </h1>
              <p>{isAgency ? t.agencySubtitle : t.brandSubtitle}</p>
            </header>
            <form
              className="fmr-form"
              onSubmit={submit}
              noValidate
              aria-describedby="register-required"
            >
              <p id="register-required" className="fmr-field-hint">
                {t.required}
              </p>
              <div className="fml-field">
                <label
                  htmlFor="register-organization"
                  className="fml-field-label"
                >
                  {isAgency ? t.organization : t.company}
                </label>
                <input
                  id="register-organization"
                  autoComplete="organization"
                  value={organization}
                  onChange={(event) => {
                    setOrganization(event.target.value);
                    clearError("organization");
                  }}
                  placeholder={
                    isAgency ? t.organizationPlaceholder : t.companyPlaceholder
                  }
                  required
                  maxLength={120}
                  aria-invalid={!!errors.organization}
                  aria-describedby={
                    errors.organization
                      ? "register-organization-error"
                      : undefined
                  }
                />
                {errorMessage("organization")}
              </div>
              {isAgency ? (
                <fieldset className="fmr-choices">
                  <legend>{t.organizationType}</legend>
                  <div className="fmr-choice-grid">
                    {(["agency", "studio"] as const).map((type) => (
                      <label className="fmr-choice" key={type}>
                        <input
                          type="radio"
                          name="organization-type"
                          value={type}
                          checked={organizationType === type}
                          onChange={() => setOrganizationType(type)}
                          required
                        />
                        <span>
                          {type === "agency" ? t.agencyCompany : t.studio}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <fieldset
                  className="fmr-choices"
                  aria-describedby={
                    errors.companySize
                      ? "company-size-hint register-companySize-error"
                      : "company-size-hint"
                  }
                >
                  <legend>{t.companySize}</legend>
                  <p className="fmr-field-hint" id="company-size-hint">
                    {t.companySizeHint}
                  </p>
                  <div className="fmr-choice-grid fmr-size-grid">
                    {companySizes.map((size, index) => (
                      <label className="fmr-choice" key={size}>
                        <input
                          id={index === 0 ? "register-companySize" : undefined}
                          type="radio"
                          name="company-size"
                          value={size}
                          checked={companySize === size}
                          onChange={() => {
                            setCompanySize(size);
                            clearError("companySize");
                          }}
                          required
                          aria-invalid={!!errors.companySize}
                        />
                        <span>{size}</span>
                      </label>
                    ))}
                  </div>
                  {errorMessage("companySize")}
                </fieldset>
              )}
              <div className="fml-field">
                <label htmlFor="register-email" className="fml-field-label">
                  {t.email}
                </label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearError("email");
                  }}
                  placeholder="you@company.com"
                  required
                  maxLength={254}
                  aria-invalid={!!errors.email}
                  aria-describedby={
                    errors.email ? "register-email-error" : undefined
                  }
                />
                {errorMessage("email")}
              </div>
              <div className="fml-field">
                <label htmlFor="register-password" className="fml-field-label">
                  {t.password}
                </label>
                <div className="fml-password">
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearError("password");
                      clearError("confirm");
                    }}
                    placeholder={t.passwordPlaceholder}
                    required
                    minLength={8}
                    maxLength={128}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password
                        ? "register-password-error password-hint"
                        : "password-hint"
                    }
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} aria-hidden="true" />
                    ) : (
                      <Eye size={20} aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p className="fmr-field-hint" id="password-hint">
                  {t.passwordHint}
                </p>
                {errorMessage("password")}
              </div>
              <div className="fml-field">
                <label htmlFor="register-confirm" className="fml-field-label">
                  {t.confirm}
                </label>
                <div className="fml-password">
                  <input
                    id="register-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => {
                      setConfirm(event.target.value);
                      clearError("confirm");
                    }}
                    placeholder={t.confirmPlaceholder}
                    required
                    maxLength={128}
                    aria-invalid={!!errors.confirm}
                    aria-describedby={
                      errors.confirm ? "register-confirm-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? t.hideConfirm : t.showConfirm}
                    aria-pressed={showConfirm}
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? (
                      <EyeOff size={20} aria-hidden="true" />
                    ) : (
                      <Eye size={20} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errorMessage("confirm")}
              </div>
              <button type="submit" className="fml-submit">
                {t.continue}
              </button>
            </form>
          </>
        )}
        <p className="fmr-login-prompt">
          {t.existing} <a href={`/login?lang=${locale}`}>{t.login}</a>
        </p>
      </div>
    </AuthShell>
  );
}
