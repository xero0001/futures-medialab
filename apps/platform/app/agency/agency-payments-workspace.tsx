"use client";

import { useState } from "react";
import { Tab, TabList, TabListItem, TabPanel } from "@montage-ui/core";
import type { Locale } from "../_components/landing-copy";
import { productionText } from "../_components/workspace/production-shared";
import { AgencyOperations } from "./agency-operations";
import { AgencySettlementWorkspace } from "./agency-settlement-workspace";

export function AgencyPaymentsWorkspace({ locale, onExplore, onApplications }: { locale: Locale; onExplore: () => void; onApplications: () => void }) {
  const t = productionText(locale), [tab, setTab] = useState("official");
  return <Tab value={tab} onValueChange={setTab} disableScrollMoveOnChange><TabList size="medium" aria-label={t("정산 내역 구분", "Settlement records", "结算记录类别")}><TabListItem value="official">{t("발행된 정산", "Issued statements", "已出具结算单")}</TabListItem><TabListItem value="legacy">{t("이전 운영 내역", "Earlier records", "历史运营记录")}</TabListItem></TabList><TabPanel value={tab} mountMode="always" sx={{ paddingTop: "24px" }}>{tab === "official" ? <AgencySettlementWorkspace locale={locale} /> : <AgencyOperations locale={locale} section="payments" onExplore={onExplore} onApplications={onApplications} />}</TabPanel></Tab>;
}
