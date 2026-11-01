"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Tab, TabList, TabListItem, TabPanel } from "@montage-ui/core";
import type { Locale } from "../_components/landing-copy";
import { productionText } from "../_components/workspace/production-shared";
import { AgencyProductionWorkspace } from "./agency-production-workspace";
import { AgencyReportingWorkspace } from "./agency-reporting-workspace";
import { AgencyOperations } from "./agency-operations";

export function AgencyProjectWorkspace({ locale, onExplore, onApplications }: { locale: Locale; onExplore: () => void; onApplications: () => void }) {
  const t = productionText(locale), params = useSearchParams();
  const [stage, setStage] = useState(["records", "reporting"].includes(params.get("stage") ?? "") ? params.get("stage")! : "production");
  function changeStage(value: string) {
    setStage(value);
    const url = new URL(window.location.href);
    url.searchParams.set("stage", value);
    window.history.replaceState(null, "", url);
  }
  return <Tab value={stage} onValueChange={changeStage} disableScrollMoveOnChange>
    <TabList aria-label={t("프로젝트 업무", "Project tasks", "项目任务")} size="medium">
      <TabListItem value="production">{t("제작·검수", "Production & review", "制作与审核")}</TabListItem>
      <TabListItem value="reporting">{t("게시·성과", "Publication & performance", "发布与成效")}</TabListItem>
      <TabListItem value="records">{t("프로젝트 내역", "Project records", "项目记录")}</TabListItem>
    </TabList>
    <TabPanel value={stage} mountMode="always" sx={{ paddingTop: "24px" }}>
      {stage === "production" ? <AgencyProductionWorkspace locale={locale} /> : stage === "reporting" ? <AgencyReportingWorkspace locale={locale} /> : <AgencyOperations locale={locale} section="projects" onExplore={onExplore} onApplications={onApplications} />}
    </TabPanel>
  </Tab>;
}
