"use client";

import { FormSelect } from "@futures-medialab/ui/form-select";

import { BrandInvoiceLines } from "./brand-invoice-lines";
import { useState } from "react";
import { Typography } from "@montage-ui/core";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import type { Locale } from "../../_components/landing-copy";
import { productionText } from "../../_components/workspace/production-shared";
import { SettlementList, SettlementStatement } from "../../_components/workspace/settlement-shared";
import styles from "../../_components/workspace/settlement-workspace.module.css";

export function BrandBillingPanel({
  invoices,
  locale,
  scope,
}: {
  invoices: BrandInvoice[];
  locale: Locale;
  scope: "campaign" | "organization";
}) {
  const t = productionText(locale);
  const inCampaign = scope === "campaign";
  const singleInvoice = invoices.length === 1 ? invoices[0] : undefined;
  const renderInvoice = (invoice: BrandInvoice) => (
    <InvoiceStatement key={invoice.id} current={invoice} locale={locale} inCampaign={inCampaign} />
  );
  return (
    <section className={styles.workspace}>
      {inCampaign && (
        <Typography as="h2" variant="title3" weight="bold">
          {t("청구 내역", "Invoices", "账单")}
        </Typography>
      )}
      {singleInvoice ? (
        renderInvoice(singleInvoice)
      ) : (
        <SettlementList documents={invoices} viewer="brand" locale={locale} renderDocument={renderInvoice} />
      )}
    </section>
  );
}

function InvoiceStatement({
  current,
  locale,
  inCampaign,
}: {
  current: BrandInvoice;
  locale: Locale;
  inCampaign: boolean;
}) {
  const t = productionText(locale);
  const [selected, setSelected] = useState<number | null>(null);
  const version = current.versions.find((v) => v.version === selected) ?? current.versions[0];
  const historical = version && version.version !== current.documentVersion;
  const invoice = version ? { ...current, ...version } : current;
  return (
    <div className={styles.workspace}>
      {current.versions.length > 1 && (
        <label className={styles.invoiceVersion}>
          {t("청구서 발행본", "Invoice version", "账单版本")}{" "}
          <FormSelect
            aria-label={t("청구서 버전", "Invoice version", "账单版本")}
            value={version?.version ?? 1}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {current.versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version} ·{" "}
                {v.version === current.documentVersion
                  ? t("현재 발행본", "Current", "当前版本")
                  : t("이전 발행본", "Earlier issue", "历史版本")}
              </option>
            ))}
          </FormSelect>
        </label>
      )}
      {historical && (
        <p className={styles.note}>
          {t(
            "이전 발행본입니다. 납부 시 현재 발행본을 확인해 주세요.",
            "Earlier issue. Refer to the current invoice for payment.",
            "此为历史版本，请按当前账单付款。",
          )}
        </p>
      )}
      {version?.reason && (
        <p className={styles.correctionNote}>
          <strong>{t("정정 사유", "Reason for correction", "更正原因")}</strong> · {version.reason}
        </p>
      )}
      <SettlementStatement
        document={invoice}
        viewer="brand"
        locale={locale}
        earlierIssue={historical}
        inCampaign={inCampaign}
      >
        <div className={styles.tableWrap}>
          <BrandInvoiceLines invoice={invoice} locale={locale} />
        </div>
      </SettlementStatement>
    </div>
  );
}
