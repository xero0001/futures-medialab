"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  Divider,
  RadioGroup,
  RadioGroupItem,
  TextButton,
  Typography,
} from "@montage-ui/core";
import {
  IconArrowLeft,
  IconChevronRight,
  IconCompany,
  IconPersons,
} from "@montage-ui/icon";
import { AuthLayout } from "../_components/auth/auth-layout";
import authStyles from "../_components/auth/auth-layout.module.css";
import { RegisterField } from "./register-field";
import styles from "./register.module.css";
import { authClient } from "../../lib/auth-client";
import type { Locale } from "../_components/landing-copy";
import { registerCopy, type RegistrationRole } from "./register-copy";

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
  audience,
}: {
  initialLocale: Locale;
  role?: RegistrationRole;
  audience?: "buyer";
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
  const isClientAgency = role === "client-agency";
  const roleLabel = isAgency
    ? t.agency
    : isClientAgency
      ? t.clientAgency
      : t.brand;
  const roleOptions = [
    {
      role: "brand",
      label: t.brand,
      description: t.brandDescription,
      icon: IconCompany,
    },
    {
      role: "client-agency",
      label: t.clientAgency,
      description: t.clientAgencyDescription,
      icon: IconCompany,
    },
    ...(audience === "buyer"
      ? []
      : [
          {
            role: "agency",
            label: t.agency,
            description: t.agencyDescription,
            icon: IconPersons,
          },
        ]),
  ];

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
      window.location.assign(`/auth/continue?lang=${locale}&registered=1`);
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

  function fieldError(field: Field) {
    const error = errors[field];
    return error ? t.errors[error] : undefined;
  }

  return (
    <AuthLayout
      locale={locale}
      onLocaleChange={changeLocale}
      headingId={review ? "register-review-title" : "register-title"}
      supportingText={t.approval}
      wide
    >
      {role && (
        <div className={styles.back}>
          <TextButton
            as="a"
            href={`/register?${!isAgency ? "audience=buyer&" : ""}lang=${locale}`}
            color="assistive"
            size="small"
            leadingContent={<IconArrowLeft />}
          >
            {t.back}
          </TextButton>
        </div>
      )}

      {!role ? (
        <>
          <div className={authStyles.intro}>
            <Typography
              as="h1"
              id="register-title"
              variant="title1"
              weight="bold"
            >
              {audience === "buyer" ? t.buyerTitle : t.title}
            </Typography>
            <Typography
              as="p"
              variant="body2"
              color="semantic.foreground.neutral.secondary"
            >
              {audience === "buyer" ? t.buyerSubtitle : t.subtitle}
            </Typography>
          </div>
          <div className={styles.roles}>
            {roleOptions.map(
              ({ role: option, label, description, icon: Icon }) => (
                <a
                  key={option}
                  href={`/register/${option}?lang=${locale}`}
                  className={styles.roleCard}
                >
                  <span className={styles.roleIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <span className={styles.roleCopy}>
                    <Typography as="strong" variant="headline1" weight="bold">
                      {label}
                    </Typography>
                    <Typography
                      as="span"
                      variant="label1"
                      color="semantic.foreground.neutral.secondary"
                    >
                      {description}
                    </Typography>
                  </span>
                  <IconChevronRight aria-hidden="true" />
                </a>
              ),
            )}
          </div>
        </>
      ) : review ? (
        <div aria-busy={pending}>
          <div className={authStyles.intro}>
            <Typography
              as="h1"
              id="register-review-title"
              ref={reviewRef}
              tabIndex={-1}
              variant="title2"
              weight="bold"
            >
              {t.reviewTitle}
            </Typography>
            <Typography
              as="p"
              variant="body2"
              color="semantic.foreground.neutral.secondary"
            >
              {t.reviewNote}
            </Typography>
          </div>
          <dl className={styles.reviewDetails}>
            <div>
              <dt>{t.role}</dt>
              <dd>{roleLabel}</dd>
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
          <div className={styles.reviewActions}>
            <Button
              type="button"
              className={styles.button}
              size="large"
              fullWidth
              onClick={createAccount}
              loading={pending}
              disabled={pending || accountCreated}
              aria-label={
                pending
                  ? t.creatingAccount
                  : accountCreated
                    ? t.created
                    : t.createAccount
              }
            >
              {pending
                ? t.creatingAccount
                : accountCreated
                  ? t.created
                  : t.createAccount}
            </Button>
            <Button
              type="button"
              className={styles.button}
              size="large"
              fullWidth
              variant="outlined"
              color="assistive"
              disabled={pending || accountCreated}
              onClick={() => {
                setReview(false);
                setSubmitError(null);
                requestAnimationFrame(() => titleRef.current?.focus());
              }}
            >
              {t.edit}
            </Button>
          </div>
          <div
            role="alert"
            className={`${authStyles.error} ${styles.reviewError}`}
          >
            {submitError ? (
              <Typography as="p" variant="label1">
                {t[submitError]}
              </Typography>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className={authStyles.intro}>
            <Typography
              as="h1"
              id="register-title"
              ref={titleRef}
              tabIndex={-1}
              variant="title2"
              weight="bold"
            >
              {isAgency
                ? t.agencyTitle
                : isClientAgency
                  ? t.clientAgencyTitle
                  : t.brandTitle}
            </Typography>
            <Typography
              as="p"
              variant="body2"
              color="semantic.foreground.neutral.secondary"
            >
              {isAgency
                ? t.agencySubtitle
                : isClientAgency
                  ? t.clientAgencySubtitle
                  : t.brandSubtitle}
            </Typography>
          </div>
          <form
            className={authStyles.form}
            onSubmit={submit}
            noValidate
            aria-describedby="register-required"
          >
            <Typography
              as="p"
              id="register-required"
              variant="label2"
              color="semantic.foreground.neutral.tertiary"
            >
              {t.required}
            </Typography>
            <RegisterField
              id="register-organization"
              name="organization"
              label={isAgency ? t.organization : t.company}
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
              error={fieldError("organization")}
            />
            {isAgency ? (
              <fieldset className={styles.choices}>
                <legend id="organization-type-label">
                  {t.organizationType}
                </legend>
                <RadioGroup
                  className={styles.choiceGrid}
                  name="organization-type"
                  value={organizationType}
                  onValueChange={(value) => {
                    if (value === "agency" || value === "studio")
                      setOrganizationType(value);
                  }}
                  aria-labelledby="organization-type-label"
                  required
                >
                  {(["agency", "studio"] as const).map((type) => (
                    <label
                      className={styles.choice}
                      key={type}
                      htmlFor={`register-type-${type}`}
                    >
                      <RadioGroupItem
                        id={`register-type-${type}`}
                        value={type}
                        size="small"
                        tight
                        aria-label={
                          type === "agency" ? t.agencyCompany : t.studio
                        }
                      />
                      <span>
                        {type === "agency" ? t.agencyCompany : t.studio}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>
            ) : (
              <fieldset className={styles.choices}>
                <legend id="company-size-label">{t.companySize}</legend>
                <Typography
                  as="p"
                  variant="label2"
                  id="company-size-hint"
                  className={styles.hint}
                  color="semantic.foreground.neutral.tertiary"
                >
                  {t.companySizeHint}
                </Typography>
                <RadioGroup
                  className={`${styles.choiceGrid} ${styles.sizeGrid}`}
                  name="company-size"
                  value={companySize}
                  onValueChange={(value) => {
                    setCompanySize(value);
                    clearError("companySize");
                  }}
                  aria-labelledby="company-size-label"
                  aria-invalid={!!errors.companySize}
                  aria-describedby={
                    errors.companySize
                      ? "company-size-hint register-companySize-error"
                      : "company-size-hint"
                  }
                  required
                >
                  {companySizes.map((size, index) => (
                    <label
                      className={styles.choice}
                      key={size}
                      htmlFor={
                        index === 0
                          ? "register-companySize"
                          : `register-companySize-${index}`
                      }
                    >
                      <RadioGroupItem
                        id={
                          index === 0
                            ? "register-companySize"
                            : `register-companySize-${index}`
                        }
                        value={size}
                        size="small"
                        tight
                        aria-label={size}
                      />
                      <span>{size}</span>
                    </label>
                  ))}
                </RadioGroup>
                {errors.companySize && (
                  <Typography
                    as="p"
                    variant="label2"
                    color="semantic.foreground.negative.strong"
                    id="register-companySize-error"
                    className={styles.fieldError}
                  >
                    {fieldError("companySize")}
                  </Typography>
                )}
              </fieldset>
            )}
            <RegisterField
              id="register-email"
              name="email"
              label={t.email}
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
              error={fieldError("email")}
            />
            <RegisterField
              id="register-password"
              name="password"
              label={t.password}
              type="password"
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
              hint={t.passwordHint}
              error={fieldError("password")}
              visibilityLabels={{ show: t.showPassword, hide: t.hidePassword }}
            />
            <RegisterField
              id="register-confirm"
              name="confirm"
              label={t.confirm}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                clearError("confirm");
              }}
              placeholder={t.confirmPlaceholder}
              required
              maxLength={128}
              error={fieldError("confirm")}
              visibilityLabels={{ show: t.showConfirm, hide: t.hideConfirm }}
            />
            <Button
              type="submit"
              className={authStyles.submit}
              size="large"
              fullWidth
            >
              {t.continue}
            </Button>
          </form>
        </>
      )}
      <Divider className={authStyles.divider} />
      <div className={authStyles.alternate}>
        <Typography
          as="p"
          variant="label1"
          color="semantic.foreground.neutral.secondary"
        >
          {t.existing}
        </Typography>
        <TextButton
          as="a"
          href={`/login?lang=${locale}`}
          size="small"
          trailingContent={<IconChevronRight />}
        >
          {t.login}
        </TextButton>
      </div>
    </AuthLayout>
  );
}
