"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  FileText,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { AuthShell } from "../../_components/auth-shell";
import type { Locale } from "../../_components/landing-copy";
import { ProfileSelect } from "../brand/profile-select";
import { BRAND_COUNTRY_GROUPS } from "../../../lib/brand-profile";
import {
  validateAgencyProfile,
  type AgencyProfileValues,
} from "../../../lib/agency-profile";
import { authClient } from "../../../lib/auth-client";
import { agencyOnboardingCopy } from "./onboarding-copy";
import "../brand/brand-onboarding.css";
import "./agency-onboarding.css";

type ProfileField = keyof AgencyProfileValues;
type SaveAction = "saveDraft" | "submit";
type DocumentField = "businessDocumentId" | "contractDocumentId";
type DocumentKind = "BUSINESS_REGISTRATION" | "CONTRACT";
type AgencyDocument = {
  id: string;
  fileName: string;
  size: number;
  contentType: string;
  kind: DocumentKind;
  status: "PENDING" | "UPLOADED" | "REJECTED";
};
type Feedback =
  | "invalid"
  | "failed"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "rateLimited"
  | "tooLarge";
type UploadError =
  | Feedback
  | "invalidFile"
  | "uploadFailed"
  | "confirmationFailed"
  | "uploadConflict"
  | "dailyUploadLimit"
  | "fileRejected";

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const DOCUMENT_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
};
function isAgencyDocument(value: unknown): value is AgencyDocument {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.fileName === "string" &&
    typeof item.size === "number" &&
    Number.isFinite(item.size) &&
    typeof item.contentType === "string" &&
    (item.kind === "BUSINESS_REGISTRATION" || item.kind === "CONTRACT") &&
    (item.status === "PENDING" ||
      item.status === "UPLOADED" ||
      item.status === "REJECTED")
  );
}
function responseCode(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return;
  const code = (result as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
}
function requestError(status: number, code?: string): UploadError {
  if (code === "DAILY_UPLOAD_LIMIT") return "dailyUploadLimit";
  if (code === "FILE_REJECTED") return "fileRejected";
  if (code === "UPLOAD_NOT_READY") return "confirmationFailed";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 409) return "uploadConflict";
  if (status === 429) return "rateLimited";
  return "uploadFailed";
}

export function AgencyOnboarding({
  initialLocale,
  initialValues,
  initialStatus,
  organizationStatus,
  showWelcome = false,
  uploadEnabled = false,
  reviewReason,
}: {
  initialLocale: Locale;
  initialValues: AgencyProfileValues;
  initialStatus: "DRAFT" | "SUBMITTED";
  organizationStatus: "PENDING" | "ACTIVE";
  showWelcome?: boolean;
  uploadEnabled?: boolean;
  reviewReason?: string;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState(initialStatus);
  const [welcome, setWelcome] = useState(
    showWelcome && initialStatus === "DRAFT",
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<SaveAction | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(!uploadEnabled);
  const [uploading, setUploading] = useState<DocumentField | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<
    Partial<Record<DocumentField, UploadError>>
  >({});
  const [confirmationIds, setConfirmationIds] = useState<
    Partial<Record<DocumentField, string>>
  >({});
  const uploadAbort = useRef<AbortController | null>(null);
  const requestPending = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const t = agencyOnboardingCopy[locale];
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
  const submitted = status === "SUBMITTED";
  const busy = !!pending || loggingOut || !!uploading;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  useEffect(() => {
    if (!uploadEnabled) return;
    const controller = new AbortController();
    void fetch("/api/account/agency-documents", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result?.documents) && !controller.signal.aborted) {
          const loaded: AgencyDocument[] =
            result.documents.filter(isAgencyDocument);
          // Do not replace a document confirmed while this initial request was loading.
          setDocuments((current) => [
            ...current,
            ...loaded.filter(
              (item) => !current.some((existing) => existing.id === item.id),
            ),
          ]);
        }
      })
      .catch(() => {
        // Existing references remain visible if metadata cannot be loaded.
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocumentsLoaded(true);
      });
    return () => controller.abort();
  }, [uploadEnabled]);

  useEffect(() => () => uploadAbort.current?.abort(), []);

  function changeLocale(next: Locale) {
    setLocale(next);
    document.cookie = `fm-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }

  function update<K extends ProfileField>(
    field: K,
    value: AgencyProfileValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => current.filter((entry) => entry !== field));
    setSaved(false);
    setFeedback(null);
  }

  async function confirmDocument(
    field: DocumentField,
    id: string,
    signal: AbortSignal,
  ) {
    const response = await fetch(
      `/api/account/agency-documents/${encodeURIComponent(id)}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal,
      },
    );
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = responseCode(result);
      if (code === "FILE_REJECTED")
        setConfirmationIds((current) => ({ ...current, [field]: undefined }));
      setUploadErrors((current) => ({
        ...current,
        [field]:
          code === "FILE_REJECTED" ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 409 ||
          response.status === 429
            ? requestError(response.status, code)
            : "confirmationFailed",
      }));
      return false;
    }
    const expectedKind =
      field === "businessDocumentId" ? "BUSINESS_REGISTRATION" : "CONTRACT";
    if (
      !isAgencyDocument(result) ||
      result.id !== id ||
      result.status !== "UPLOADED" ||
      result.kind !== expectedKind
    ) {
      setUploadErrors((current) => ({
        ...current,
        [field]: "confirmationFailed",
      }));
      return false;
    }
    setDocuments((current) => [
      result,
      ...current.filter((item) => item.id !== result.id),
    ]);
    update(field, result.id);
    setConfirmationIds((current) => ({ ...current, [field]: undefined }));
    setUploadErrors((current) => ({ ...current, [field]: undefined }));
    return true;
  }

  async function uploadDocument(field: DocumentField, file: File) {
    if (!uploadEnabled || requestPending.current || submitted) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (
      !file.size ||
      file.size > MAX_DOCUMENT_SIZE ||
      !DOCUMENT_TYPES[file.type]?.includes(extension)
    ) {
      setUploadErrors((current) => ({ ...current, [field]: "invalidFile" }));
      return;
    }
    requestPending.current = true;
    setUploading(field);
    setUploadProgress(0);
    setUploadErrors((current) => ({ ...current, [field]: undefined }));
    setConfirmationIds((current) => ({ ...current, [field]: undefined }));
    const controller = new AbortController();
    uploadAbort.current = controller;
    let uploaded = false;
    try {
      const response = await fetch("/api/account/agency-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind:
            field === "businessDocumentId"
              ? "BUSINESS_REGISTRATION"
              : "CONTRACT",
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
        signal: controller.signal,
      });
      const intent = await response.json().catch(() => null);
      if (!response.ok) {
        setUploadErrors((current) => ({
          ...current,
          [field]: requestError(response.status, responseCode(intent)),
        }));
        return;
      }
      if (
        typeof intent?.id !== "string" ||
        typeof intent?.pathname !== "string"
      ) {
        setUploadErrors((current) => ({ ...current, [field]: "uploadFailed" }));
        return;
      }
      const { upload } = await import("@vercel/blob/client");
      await upload(intent.pathname, file, {
        access: "private",
        handleUploadUrl: "/api/account/agency-documents/upload",
        clientPayload: JSON.stringify({ documentId: intent.id }),
        contentType: file.type,
        multipart: file.size > 5 * 1024 * 1024,
        abortSignal: controller.signal,
        onUploadProgress: ({ percentage }) => {
          if (!controller.signal.aborted)
            setUploadProgress(
              Math.max(0, Math.min(100, Math.round(percentage))),
            );
        },
      });
      uploaded = true;
      setUploadProgress(100);
      setConfirmationIds((current) => ({ ...current, [field]: intent.id }));
      await confirmDocument(field, intent.id, controller.signal);
    } catch {
      if (!controller.signal.aborted)
        setUploadErrors((current) => ({
          ...current,
          [field]: uploaded ? "confirmationFailed" : "uploadFailed",
        }));
    } finally {
      requestPending.current = false;
      uploadAbort.current = null;
      setUploading(null);
    }
  }

  async function retryConfirmation(field: DocumentField) {
    const id = confirmationIds[field];
    if (!id || requestPending.current || submitted) return;
    requestPending.current = true;
    setUploading(field);
    setUploadProgress(100);
    setUploadErrors((current) => ({ ...current, [field]: undefined }));
    const controller = new AbortController();
    uploadAbort.current = controller;
    try {
      await confirmDocument(field, id, controller.signal);
    } catch {
      if (!controller.signal.aborted)
        setUploadErrors((current) => ({
          ...current,
          [field]: "confirmationFailed",
        }));
    } finally {
      requestPending.current = false;
      uploadAbort.current = null;
      setUploading(null);
    }
  }

  function fieldError(field: ProfileField) {
    if (!errors.includes(field)) return null;
    const message =
      field === "establishedOn"
        ? t.dateError
        : field === "contactValue"
          ? t.contactError
          : field === "businessDocumentId"
            ? t.documentError
            : t.requiredError;
    return (
      <p className="fmb-error" id={`agency-${field}-error`}>
        {message}
      </p>
    );
  }
  function fieldProps(field: ProfileField) {
    return {
      id: `agency-${field}`,
      "aria-invalid": errors.includes(field),
      "aria-describedby": errors.includes(field)
        ? `agency-${field}-error`
        : undefined,
    };
  }
  function focusFirst(fields: string[]) {
    const first = fields[0];
    if (first)
      requestAnimationFrame(() =>
        document.getElementById(`agency-${first}`)?.focus(),
      );
  }

  async function save(action: SaveAction) {
    if (requestPending.current) return;
    const invalid = validateAgencyProfile(values, action);
    setErrors(invalid);
    setSaved(false);
    if (invalid.length) {
      setFeedback("invalid");
      focusFirst(invalid);
      return;
    }
    requestPending.current = true;
    setPending(action);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/agency-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profile: values }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (Array.isArray(result?.fields)) {
          const invalidFields = result.fields.filter(
            (field: unknown): field is string => typeof field === "string",
          );
          setErrors(invalidFields);
          focusFirst(invalidFields);
        }
        setFeedback(
          response.status === 401
            ? "unauthorized"
            : response.status === 403
              ? "forbidden"
              : response.status === 409
                ? "conflict"
                : response.status === 429
                  ? "rateLimited"
                  : response.status === 413
                    ? "tooLarge"
                    : response.status === 400
                      ? "invalid"
                      : "failed",
        );
        return;
      }
      if (
        result?.success !== true ||
        (result.status !== "DRAFT" && result.status !== "SUBMITTED")
      ) {
        setFeedback("failed");
        return;
      }
      setStatus(result.status);
      setSaved(result.status === "DRAFT");
      if (result.status === "SUBMITTED")
        requestAnimationFrame(() => {
          headingRef.current?.focus({ preventScroll: true });
          window.scrollTo({ top: 0 });
        });
    } catch {
      setFeedback("failed");
    } finally {
      requestPending.current = false;
      setPending(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save("submit");
  }
  async function logout() {
    if (requestPending.current) return;
    requestPending.current = true;
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
      requestPending.current = false;
      setLoggingOut(false);
    }
  }

  const documentField = (field: DocumentField, required: boolean) => {
    const attached = documents.find((item) => item.id === values[field]);
    const kind =
      field === "businessDocumentId" ? "BUSINESS_REGISTRATION" : "CONTRACT";
    const available = documents.filter(
      (item) => item.kind === kind && item.status === "UPLOADED",
    );
    const error = uploadErrors[field];
    return (
      <div className="fmb-field fma-document-field">
        <span className="fmb-label" id={`agency-${field}-label`}>
          {t[field]}{" "}
          {required ? (
            <span aria-hidden="true">*</span>
          ) : (
            <span className="fma-optional">({t.optional})</span>
          )}
        </span>
        {values[field] && (
          <div className="fma-stored-document">
            <FileText size={23} aria-hidden="true" />
            <div>
              <strong>{attached?.fileName ?? t.storedDocument}</strong>
              <p>{t.documentStoredNote}</p>
              {attached?.status === "UPLOADED" && (
                <a
                  className="fma-document-download"
                  href={`/api/account/agency-documents/${encodeURIComponent(attached.id)}/download`}
                >
                  {t.downloadDocument}
                </a>
              )}
            </div>
          </div>
        )}
        {uploadEnabled ? (
          <label className="fma-upload" data-disabled={busy}>
            <input
              type="file"
              id={`agency-${field}`}
              className="fma-file-input"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              disabled={busy}
              aria-labelledby={`agency-${field}-label agency-${field}-upload-label`}
              aria-describedby={`agency-${field}-hint${error ? ` agency-${field}-upload-error` : ""}${errors.includes(field) ? ` agency-${field}-error` : ""}`}
              aria-invalid={!!error || errors.includes(field)}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void uploadDocument(field, file);
              }}
            />
            <UploadCloud size={27} aria-hidden="true" />
            <span id={`agency-${field}-upload-label`}>
              {values[field] ? t.replaceFile : t.chooseFile}
            </span>
          </label>
        ) : (
          <button
            type="button"
            id={`agency-${field}`}
            className="fma-upload"
            disabled
            aria-labelledby={`agency-${field}-label`}
            aria-describedby={`agency-${field}-hint${errors.includes(field) ? ` agency-${field}-error` : ""}`}
          >
            <UploadCloud size={27} aria-hidden="true" />
            <span>{t.uploadUnavailable}</span>
            <LockKeyhole size={17} aria-hidden="true" />
          </button>
        )}
        {uploading === field && (
          <div className="fma-upload-progress" role="status">
            <progress
              value={uploadProgress}
              max={100}
              aria-label={t.uploading}
            />
            <span>
              {uploadProgress === 100
                ? t.confirming
                : `${t.uploading} ${uploadProgress}%`}
            </span>
          </div>
        )}
        {error && (
          <div
            className="fma-upload-error"
            role="alert"
            id={`agency-${field}-upload-error`}
          >
            <p>{t[error]}</p>
            {confirmationIds[field] && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void retryConfirmation(field)}
              >
                {t.retryConfirmation}
              </button>
            )}
            {error === "unauthorized" && (
              <Link href={`/login?lang=${locale}`}>{t.login}</Link>
            )}
          </div>
        )}
        {uploadEnabled && available.length > 0 && (
          <div className="fma-reuse-document">
            <ProfileSelect
              id={`agency-${field}-existing`}
              label={t.useExisting}
              placeholder={t.selectDocument}
              value={values[field]}
              onChange={(value) => {
                if (requestPending.current) return;
                update(field, value);
                setUploadErrors((current) => ({
                  ...current,
                  [field]: undefined,
                }));
                setConfirmationIds((current) => ({
                  ...current,
                  [field]: undefined,
                }));
              }}
              options={available.map((item) => ({
                value: item.id,
                label: item.fileName,
              }))}
            />
          </div>
        )}
        <p className="fmb-hint" id={`agency-${field}-hint`}>
          {field === "businessDocumentId" ? t.documentHelp : t.contractHelp}
        </p>
        {fieldError(field)}
      </div>
    );
  };

  const submittedFields = [
    { field: "organizationName", value: values.organizationName },
    {
      field: "agencyType",
      value: values.agencyType === "studio" ? t.studio : t.agency,
    },
    { field: "address", value: values.address },
    {
      field: "countryCode",
      value: values.countryCode
        ? (countryNames.of(values.countryCode) ?? values.countryCode)
        : "",
    },
    { field: "establishedOn", value: values.establishedOn },
    { field: "contactName", value: values.contactName },
    { field: "contactMethod", value: t[values.contactMethod] },
    { field: "contactValue", value: values.contactValue },
    { field: "businessLicenseId", value: values.businessLicenseId },
    { field: "scopeOfBusiness", value: values.scopeOfBusiness },
    { field: "platformContact", value: values.platformContact },
  ] as const;

  return (
    <AuthShell
      locale={locale}
      onLocaleChange={changeLocale}
      headingId="agency-onboarding-title"
      className="fmb-page fma-page"
    >
      <div
        className="fma-wrap"
        data-agency-onboarding={
          submitted ? "submitted" : welcome ? "welcome" : "draft"
        }
      >
        {welcome ? (
          <section className="fma-welcome">
            <span className="fma-status-icon">
              <Check size={34} aria-hidden="true" />
            </span>
            <h1 id="agency-onboarding-title" ref={headingRef} tabIndex={-1}>
              {t.welcomeTitle}
            </h1>
            <p>{t.welcomeDescription}</p>
            <p className="fma-note">{t.welcomeNote}</p>
            <button
              type="button"
              className="fml-submit fma-primary"
              onClick={() => {
                setWelcome(false);
                requestAnimationFrame(() => {
                  headingRef.current?.focus({ preventScroll: true });
                  window.scrollTo({ top: 0 });
                });
              }}
            >
              {t.enterDetails}
              <ArrowRight size={19} aria-hidden="true" />
            </button>
          </section>
        ) : submitted ? (
          <section className="fma-review">
            <span className="fma-status-icon">
              {organizationStatus === "ACTIVE" ? (
                <ShieldCheck size={34} aria-hidden="true" />
              ) : (
                <Clock3 size={34} aria-hidden="true" />
              )}
            </span>
            <span className="fma-status">
              {organizationStatus === "ACTIVE" ? t.approved : t.pending}
            </span>
            <h1 id="agency-onboarding-title" ref={headingRef} tabIndex={-1}>
              {organizationStatus === "ACTIVE" ? t.approved : t.reviewTitle}
            </h1>
            <p>
              {organizationStatus === "ACTIVE"
                ? t.approvedDescription
                : t.reviewDescription}
            </p>
            <dl className="fma-summary">
              <div>
                <dt>{t.organizationName}</dt>
                <dd>{values.organizationName}</dd>
              </div>
              <div>
                <dt>{t.agencyType}</dt>
                <dd>{values.agencyType === "studio" ? t.studio : t.agency}</dd>
              </div>
              <div>
                <dt>{t.countryCode}</dt>
                <dd>
                  {values.countryCode
                    ? (countryNames.of(values.countryCode) ??
                      values.countryCode)
                    : "—"}
                </dd>
              </div>
            </dl>
            <Link
              className="fml-submit fma-primary"
              href={`/agency?lang=${locale}`}
            >
              {organizationStatus === "ACTIVE"
                ? t.workspace
                : t.workspacePreview}
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <details className="fma-submitted-details">
              <summary>{t.viewSubmittedInformation}</summary>
              <p className="fma-readonly-note">{t.submittedReadOnly}</p>
              <dl className="fma-submitted-fields">
                {submittedFields.map(({ field, value }) => (
                  <div key={field}>
                    <dt>{t[field]}</dt>
                    <dd>{value || t.notProvided}</dd>
                  </div>
                ))}
                {(["businessDocumentId", "contractDocumentId"] as const).map(
                  (field) => {
                    const kind =
                      field === "businessDocumentId"
                        ? "BUSINESS_REGISTRATION"
                        : "CONTRACT";
                    const attached = documents.find(
                      (item) =>
                        item.id === values[field] &&
                        item.kind === kind &&
                        item.status === "UPLOADED",
                    );
                    return (
                      <div key={field}>
                        <dt>{t[field]}</dt>
                        <dd>
                          {!values[field] ? (
                            t.notProvided
                          ) : attached ? (
                            <>
                              <span>{attached.fileName}</span>
                              <a
                                className="fma-document-download"
                                href={`/api/account/agency-documents/${encodeURIComponent(attached.id)}/download`}
                              >
                                {t.downloadDocument}
                              </a>
                            </>
                          ) : (
                            <span>
                              {documentsLoaded
                                ? t.documentDetailsUnavailable
                                : t.loadingDocumentDetails}
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  },
                )}
              </dl>
            </details>
          </section>
        ) : (
          <>
            <header className="fmb-header fma-header">
              <span className="fma-eyebrow">
                <Building2 size={18} aria-hidden="true" />
                {t.agency} / {t.studio}
              </span>
              <h1 id="agency-onboarding-title" ref={headingRef} tabIndex={-1}>
                {t.title}
              </h1>
              <p>{t.subtitle}</p>
              {reviewReason && <p role="status" className="fmb-hint">{locale === "ko" ? "운영팀 보완 요청: " : locale === "zh" ? "运营补充要求：" : "Changes requested: "}{reviewReason}</p>}
            </header>
            <form
              className="fmb-form fma-form"
              onSubmit={submit}
              noValidate
              aria-busy={busy}
            >
              <p className="fmb-hint">{t.required}</p>
              <fieldset className="fma-fields" disabled={busy}>
                <div className="fmb-field">
                  <label
                    className="fmb-label"
                    htmlFor="agency-organizationName"
                  >
                    {t.organizationName} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    {...fieldProps("organizationName")}
                    value={values.organizationName}
                    onChange={(event) =>
                      update("organizationName", event.target.value)
                    }
                    maxLength={120}
                    autoComplete="organization"
                    required
                  />
                  {fieldError("organizationName")}
                </div>
                <fieldset className="fma-type">
                  <legend className="fmb-label">
                    {t.agencyType} <span aria-hidden="true">*</span>
                  </legend>
                  <div>
                    {(["agency", "studio"] as const).map((type) => (
                      <label
                        key={type}
                        className={
                          values.agencyType === type ? "is-selected" : ""
                        }
                      >
                        <input
                          id={
                            type === "agency" ? "agency-agencyType" : undefined
                          }
                          type="radio"
                          name="agencyType"
                          value={type}
                          checked={values.agencyType === type}
                          onChange={() => update("agencyType", type)}
                          required
                        />
                        <span>{t[type]}</span>
                      </label>
                    ))}
                  </div>
                  {fieldError("agencyType")}
                </fieldset>
                <div className="fmb-field">
                  <label className="fmb-label" htmlFor="agency-address">
                    {t.address} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    {...fieldProps("address")}
                    value={values.address}
                    onChange={(event) => update("address", event.target.value)}
                    maxLength={500}
                    autoComplete="street-address"
                    required
                  />
                  {fieldError("address")}
                </div>
                <div className="fma-two-columns">
                  <div className="fmb-field">
                    <ProfileSelect
                      id="agency-countryCode"
                      label={t.countryCode}
                      placeholder={t.selectCountry}
                      value={values.countryCode}
                      onChange={(value) => update("countryCode", value)}
                      options={countryGroups.flatMap((group) => group.options)}
                      groups={countryGroups}
                      groupLabel={t.selectRegion}
                      invalid={errors.includes("countryCode")}
                      describedBy={
                        errors.includes("countryCode")
                          ? "agency-countryCode-error"
                          : undefined
                      }
                      required
                    />
                    {fieldError("countryCode")}
                  </div>
                  <div className="fmb-field">
                    <label className="fmb-label" htmlFor="agency-establishedOn">
                      {t.establishedOn} <span aria-hidden="true">*</span>
                    </label>
                    <input
                      {...fieldProps("establishedOn")}
                      type="date"
                      value={values.establishedOn}
                      onChange={(event) =>
                        update("establishedOn", event.target.value)
                      }
                      required
                    />
                    {fieldError("establishedOn")}
                  </div>
                </div>
                <div className="fmb-field">
                  <label className="fmb-label" htmlFor="agency-contactName">
                    {t.contactName}{" "}
                    <span className="fma-optional">({t.optional})</span>
                  </label>
                  <input
                    {...fieldProps("contactName")}
                    value={values.contactName}
                    onChange={(event) =>
                      update("contactName", event.target.value)
                    }
                    maxLength={100}
                    autoComplete="name"
                  />
                  {fieldError("contactName")}
                </div>
                <div className="fma-contact-row">
                  <div className="fmb-field">
                    <ProfileSelect
                      id="agency-contactMethod"
                      label={t.contactMethod}
                      placeholder={t.email}
                      value={values.contactMethod}
                      onChange={(value) =>
                        update(
                          "contactMethod",
                          value as AgencyProfileValues["contactMethod"],
                        )
                      }
                      options={[
                        { value: "email", label: t.email },
                        { value: "phone", label: t.phone },
                        { value: "wechat", label: t.wechat },
                      ]}
                      invalid={errors.includes("contactMethod")}
                      required
                    />
                    {fieldError("contactMethod")}
                  </div>
                  <div className="fmb-field">
                    <label className="fmb-label" htmlFor="agency-contactValue">
                      {t.contactValue} <span aria-hidden="true">*</span>
                    </label>
                    <input
                      {...fieldProps("contactValue")}
                      type={
                        values.contactMethod === "email"
                          ? "email"
                          : values.contactMethod === "phone"
                            ? "tel"
                            : "text"
                      }
                      value={values.contactValue}
                      onChange={(event) =>
                        update("contactValue", event.target.value)
                      }
                      maxLength={254}
                      autoComplete={
                        values.contactMethod === "email"
                          ? "email"
                          : values.contactMethod === "phone"
                            ? "tel"
                            : "off"
                      }
                      required
                    />
                    {fieldError("contactValue")}
                  </div>
                </div>
                <div className="fmb-field">
                  <label
                    className="fmb-label"
                    htmlFor="agency-businessLicenseId"
                  >
                    {t.businessLicenseId}{" "}
                    {values.agencyType === "agency" ? (
                      <span aria-hidden="true">*</span>
                    ) : (
                      <span className="fma-optional">({t.optional})</span>
                    )}
                  </label>
                  <input
                    {...fieldProps("businessLicenseId")}
                    value={values.businessLicenseId}
                    onChange={(event) =>
                      update("businessLicenseId", event.target.value)
                    }
                    maxLength={100}
                    required={values.agencyType === "agency"}
                  />
                  {fieldError("businessLicenseId")}
                </div>
                <div className="fmb-field">
                  <label className="fmb-label" htmlFor="agency-scopeOfBusiness">
                    {t.scopeOfBusiness} <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    {...fieldProps("scopeOfBusiness")}
                    value={values.scopeOfBusiness}
                    onChange={(event) =>
                      update("scopeOfBusiness", event.target.value)
                    }
                    rows={4}
                    maxLength={2000}
                    placeholder={t.scopePlaceholder}
                    required
                  />
                  {fieldError("scopeOfBusiness")}
                </div>
                <p className="fma-storage-note" id="agency-storage-note">
                  <LockKeyhole size={19} aria-hidden="true" />
                  {uploadEnabled ? t.privateStorage : t.storageUnavailable}
                </p>
                {documentField("businessDocumentId", true)}
                <div className="fmb-field">
                  <label className="fmb-label" htmlFor="agency-platformContact">
                    {t.platformContact} <span aria-hidden="true">*</span>
                  </label>
                  <input
                    {...fieldProps("platformContact")}
                    value={values.platformContact}
                    onChange={(event) =>
                      update("platformContact", event.target.value)
                    }
                    maxLength={254}
                    placeholder={t.platformContactPlaceholder}
                    required
                  />
                  {fieldError("platformContact")}
                </div>
                {documentField("contractDocumentId", false)}
              </fieldset>
              <div className="fma-feedback" aria-live="polite">
                {saved && (
                  <p className="fma-saved">
                    <Check size={18} aria-hidden="true" />
                    {t.draftSaved}
                  </p>
                )}
              </div>
              {feedback && (
                <div className="fma-error-box" role="alert">
                  <p>{t[feedback]}</p>
                  {feedback === "unauthorized" && (
                    <Link href={`/login?lang=${locale}`}>{t.login}</Link>
                  )}
                  {feedback === "conflict" && (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                    >
                      {t.reload}
                    </button>
                  )}
                </div>
              )}
              <div className="fma-actions">
                <button
                  type="button"
                  className="fma-secondary"
                  disabled={busy}
                  onClick={() => void save("saveDraft")}
                >
                  {pending === "saveDraft" ? t.saving : t.saveDraft}
                </button>
                <button
                  type="submit"
                  className="fml-submit fma-primary"
                  disabled={busy || !values.businessDocumentId}
                  aria-describedby={
                    !values.businessDocumentId
                      ? "agency-storage-note"
                      : undefined
                  }
                >
                  {pending === "submit" ? t.saving : t.submit}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
              <p className="fma-review-note">
                <ShieldCheck size={19} aria-hidden="true" />
                {t.reviewNote}
              </p>
            </form>
          </>
        )}
        <button
          type="button"
          className="fmb-logout fma-logout"
          disabled={busy}
          onClick={() => void logout()}
        >
          {loggingOut ? t.loggingOut : t.logout}
        </button>
        {logoutError && (
          <p className="fmb-error" role="alert">
            {t.logoutError}
          </p>
        )}
      </div>
    </AuthShell>
  );
}
