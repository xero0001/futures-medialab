"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Option,
  RadioGroup,
  RadioGroupItem,
  SectionMessage,
  Select,
  SelectMultiple,
  Stepper,
  StepperItem,
  TextArea,
  TextField,
  Typography,
} from "@montage-ui/core";
import type { Locale } from "../../_components/landing-copy";
import type {
  BrandCampaign,
  BrandCampaignCreateInput,
  BrandCampaignCreated,
  BrandCampaignDraftSaved,
  BrandCampaignRoute,
  BrandCompositionPreference,
} from "../../../lib/brand-workspace-types";
import {
  brandCampaignCreateSchema,
  brandCampaignDraftSchema,
  isFutureBrandDate,
} from "../../../lib/brand-workspace-validation";
import s from "./live-request-wizard.module.css";

type Props = {
  locale: Locale;
  initialRoute?: BrandCampaignRoute;
  initialCampaign?: BrandCampaign;
  onClose: () => void;
  onSaved: (result: BrandCampaignCreated | BrandCampaignDraftSaved) => void;
};

const platformOptions = [
  ["youtube", "YouTube"],
  ["chzzk", "치지직"],
  ["soop", "SOOP"],
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["twitch", "Twitch"],
  ["x", "X"],
  ["facebook", "Facebook"],
] as const;
const regionOptions = [
  ["KR", "대한민국", "South Korea", "韩国"],
  ["US", "미국", "United States", "美国"],
  ["JP", "일본", "Japan", "日本"],
  ["CN", "중국", "China", "中国"],
  ["TW", "대만", "Taiwan", "台湾"],
  ["GB", "영국", "United Kingdom", "英国"],
  ["DE", "독일", "Germany", "德国"],
  ["FR", "프랑스", "France", "法国"],
  ["TH", "태국", "Thailand", "泰国"],
  ["VN", "베트남", "Vietnam", "越南"],
  ["ID", "인도네시아", "Indonesia", "印度尼西亚"],
  ["BR", "브라질", "Brazil", "巴西"],
] as const;

function koreanDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function LiveRequestWizard({
  locale,
  initialRoute = "managed",
  initialCampaign,
  onClose,
  onSaved,
}: Props) {
  const t = (ko: string, en: string, zh: string) =>
    locale === "ko" ? ko : locale === "zh" ? zh : en;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    title: initialCampaign?.title ?? "",
    genre: initialCampaign?.brief?.genre ?? "",
    goal: initialCampaign?.brief?.goal ?? initialCampaign?.summary ?? "",
    budgetAmount: initialCampaign?.budgetAmount ?? "",
    currency: initialCampaign?.currency ?? "USD",
    platforms: initialCampaign?.platforms ?? [],
    regions: initialCampaign?.regions ?? [],
    contentFormat: initialCampaign?.brief?.contentFormat ?? "",
    creatorCount: initialCampaign?.brief?.creatorCount
      ? String(initialCampaign.brief.creatorCount)
      : "",
    desiredDate:
      initialCampaign?.brief?.desiredDate ??
      initialCampaign?.contentDeadline?.slice(0, 10) ??
      "",
    note: initialCampaign?.brief?.note ?? "",
    compositionPreference:
      initialCampaign?.brief?.compositionPreference ??
      ("balanced" as BrandCompositionPreference),
    route: initialCampaign
      ? initialCampaign.type === "OPEN_BIDDING"
        ? ("open" as const)
        : ("managed" as const)
      : initialRoute,
    applicationDate: initialCampaign?.applicationDeadline
      ? koreanDate(new Date(initialCampaign.applicationDeadline))
      : "",
  }));
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const submitId = useRef<string | null>(null);
  const draftVersion = useRef(
    initialCampaign
      ? { id: initialCampaign.id, updatedAt: initialCampaign.updatedAt }
      : null,
  );
  const preparedSubmission = useRef<{
    fingerprint: string;
    id: string;
    updatedAt: string;
  } | null>(null);
  const [minimumDate] = useState(() =>
    koreanDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );
  const steps = [
    t("브리프 작성", "Campaign brief", "填写需求"),
    t("구성 방향", "Composition direction", "组合方向"),
    t("요청 확인", "Review request", "确认请求"),
  ];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setInvalidField(null);
  }

  function selectPlatforms(value: string, checked: boolean) {
    update(
      "platforms",
      value === "recommend"
        ? checked
          ? ["recommend"]
          : []
        : checked
          ? [
              ...form.platforms.filter((platform) => platform !== "recommend"),
              value,
            ]
          : form.platforms.filter((platform) => platform !== value),
    );
  }

  function payload(): BrandCampaignCreateInput {
    if (!requestId.current) requestId.current = crypto.randomUUID();
    return {
      title: form.title.trim(),
      genre: form.genre.trim(),
      goal: form.goal.trim(),
      budgetAmount: form.budgetAmount.trim(),
      currency: form.currency,
      platforms: form.platforms,
      regions: form.regions,
      contentFormat: form.contentFormat.trim(),
      creatorCount: Number(form.creatorCount),
      desiredDate: form.desiredDate,
      note: form.note.trim(),
      compositionPreference: form.compositionPreference,
      route: form.route,
      clientRequestId: requestId.current,
      applicationDeadline:
        form.route === "open" && form.applicationDate
          ? `${form.applicationDate}T23:59:59+09:00`
          : null,
    };
  }

  function validate(includeRoute: boolean, draft = false) {
    const parsed = draft
      ? brandCampaignDraftSchema.safeParse({
          ...payload(),
          action: "saveDraft",
        })
      : brandCampaignCreateSchema.safeParse(payload());
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? "title");
      const messages: Record<string, string> = {
        title: draft
          ? t(
              "임시 저장할 캠페인 이름을 입력해 주세요.",
              "Enter a campaign name to save a draft.",
              "请输入活动名称以保存草稿。",
            )
          : t(
              "캠페인명은 2~160자로 입력해 주세요.",
              "Enter a campaign name of 2–160 characters.",
              "请输入 2–160 个字符的活动名称。",
            ),
        genre: t(
          "게임 장르 또는 제품 분야를 입력해 주세요.",
          "Enter a game genre or product category.",
          "请输入游戏类型或产品类别。",
        ),
        goal: t(
          "캠페인 목표를 1,000자 이내로 입력해 주세요.",
          "Enter a campaign goal, up to 1,000 characters.",
          "请输入活动目标，不超过 1,000 个字符。",
        ),
        budgetAmount: t(
          "예산은 0 초과 10,000,000 이하로 입력해 주세요. 소수점은 두 자리까지 가능합니다.",
          "Enter a budget above 0 and up to 10,000,000, with at most two decimal places.",
          "请输入大于 0 且不超过 10,000,000 的预算，最多两位小数。",
        ),
        platforms: t(
          "플랫폼을 하나 이상 선택하거나 추천에 맡기기를 선택해 주세요.",
          "Choose at least one platform or ask Futures to recommend one.",
          "请选择至少一个平台，或交由 Futures 推荐。",
        ),
        contentFormat: t(
          "희망 콘텐츠 형식을 입력해 주세요.",
          "Enter the content format you need.",
          "请输入所需内容形式。",
        ),
        creatorCount: t(
          "희망 인원은 1명부터 100명까지 입력해 주세요.",
          "Enter between 1 and 100 creators.",
          "请输入 1–100 位创作者。",
        ),
        desiredDate: t(
          "올바른 희망 게시일을 선택해 주세요.",
          "Choose a valid target publication date.",
          "请选择有效的期望发布日期。",
        ),
        note: t(
          "추가 요청사항은 2,000자 이내로 입력해 주세요.",
          "Keep additional notes within 2,000 characters.",
          "附加说明不能超过 2,000 个字符。",
        ),
      };
      setInvalidField(field);
      setError(
        messages[field] ??
          t(
            "입력 내용을 확인해 주세요.",
            "Check the form values.",
            "请检查输入内容。",
          ),
      );
      setStep(0);
      return false;
    }
    if ((!draft || form.desiredDate) && !isFutureBrandDate(form.desiredDate)) {
      setInvalidField("desiredDate");
      setError(
        t(
          "희망 게시일은 내일 이후로 선택해 주세요. 일정은 한국 시간 기준입니다.",
          "Choose a publication date from tomorrow onward, in Korean time.",
          "请选择韩国时间明天之后的发布日期。",
        ),
      );
      setStep(0);
      return false;
    }
    if (
      includeRoute &&
      form.route === "open" &&
      (!isFutureBrandDate(form.applicationDate) ||
        form.applicationDate >= form.desiredDate)
    ) {
      setInvalidField("applicationDate");
      setError(
        t(
          "모집 마감일은 내일 이후이면서 희망 게시일보다 앞선 날짜로 선택해 주세요.",
          "Choose a recruiting deadline from tomorrow onward and before the publication date.",
          "请选择明天起、发布日期之前的招募截止日期。",
        ),
      );
      setStep(2);
      return false;
    }
    setError("");
    setInvalidField(null);
    return true;
  }

  async function post<T>(body: unknown): Promise<T> {
    const response = await fetch("/api/brand/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401)
        throw new Error(
          t(
            "로그인이 만료되었습니다. 새로 로그인한 뒤 다시 시도해 주세요.",
            "Your session expired. Sign in again and retry.",
            "登录已过期，请重新登录后重试。",
          ),
        );
      if (response.status === 403)
        throw new Error(
          t(
            "캠페인을 요청할 권한이 없습니다. 조직 관리자에게 확인해 주세요.",
            "You do not have permission to request campaigns. Contact your organization administrator.",
            "您无权提交活动，请联系组织管理员。",
          ),
        );
      if (response.status === 409)
        throw new Error(
          t(
            "다른 곳에서 캠페인이 변경되었습니다. 캠페인 목록으로 돌아가 최신 내용을 확인해 주세요.",
            "This campaign changed elsewhere. Return to the campaign list to load the latest version.",
            "此活动已在其他位置更新，请返回活动列表查看最新内容。",
          ),
        );
      if (response.status === 429)
        throw new Error(
          t(
            "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
            "Too many requests. Please try again shortly.",
            "请求过多，请稍后重试。",
          ),
        );
      throw new Error(
        result?.message ||
          t(
            "저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.",
            "Could not save. Check the form and try again.",
            "保存失败，请检查输入后重试。",
          ),
      );
    }
    if (!result || typeof result.id !== "string")
      throw new Error(
        t(
          "저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.",
          "Could not confirm the save. Please try again.",
          "无法确认保存结果，请重试。",
        ),
      );
    return result as T;
  }

  async function save(mode: "save" | "submit") {
    if (inFlight.current || !validate(mode === "submit", mode === "save"))
      return;
    inFlight.current = true;
    setBusy(mode);
    setError("");
    try {
      const input = payload();
      if (mode === "save") {
        const saved = await post<BrandCampaignDraftSaved>({
          ...input,
          action: "saveDraft",
          ...(draftVersion.current && {
            id: draftVersion.current.id,
            expectedUpdatedAt: draftVersion.current.updatedAt,
          }),
        });
        draftVersion.current = { id: saved.id, updatedAt: saved.updatedAt };
        onSaved(saved);
      } else if (draftVersion.current) {
        const fingerprint = JSON.stringify(input);
        let draft = preparedSubmission.current;
        if (!draft || draft.fingerprint !== fingerprint) {
          const saved = await post<BrandCampaignDraftSaved>({
            ...input,
            action: "saveDraft",
            id: draftVersion.current.id,
            expectedUpdatedAt: draftVersion.current.updatedAt,
          });
          draftVersion.current = { id: saved.id, updatedAt: saved.updatedAt };
          draft = { ...draftVersion.current, fingerprint };
          preparedSubmission.current = draft;
        }
        if (!submitId.current) submitId.current = crypto.randomUUID();
        onSaved(
          await post<BrandCampaignCreated>({
            action: "submitDraft",
            id: draft.id,
            expectedUpdatedAt: draft.updatedAt,
            clientRequestId: submitId.current,
          }),
        );
      } else {
        onSaved(await post<BrandCampaignCreated>(input));
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message !== "Failed to fetch"
          ? cause.message
          : t(
              "연결을 확인한 뒤 다시 시도해 주세요. 작성한 내용은 유지됩니다.",
              "Check your connection and try again. Your form is still here.",
              "请检查网络连接后重试，填写内容仍保留。",
            ),
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  const strategyOptions: {
    value: BrandCompositionPreference;
    title: string;
    description: string;
    focus: string;
  }[] = [
    {
      value: "balanced",
      title: t("요청 조건 중심", "Balanced composition", "以需求为中心"),
      description: t(
        "희망 형식과 인원을 중심으로 균형 있게 구성합니다.",
        "Balance your requested formats and creator count.",
        "围绕期望形式和人数进行均衡组合。",
      ),
      focus: t(
        "핵심 메시지 전달 · 콘텐츠 완성도",
        "Clear messaging · Content quality",
        "核心信息传达 · 内容质量",
      ),
    },
    {
      value: "reach",
      title: t("도달 범위 확대", "Expand your reach", "扩大触达范围"),
      description: t(
        "다양한 시청자에게 도달하는 매체와 형식을 우선합니다.",
        "Prioritize platforms and formats that reach more audiences.",
        "优先选择覆盖更多受众的平台和形式。",
      ),
      focus: t(
        "신규 시청자 유입 · 매체 다양성",
        "New audiences · Platform diversity",
        "吸引新观众 · 平台多样性",
      ),
    },
    {
      value: "efficient",
      title: t("예산 효율 중심", "Budget efficiency", "预算效率优先"),
      description: t(
        "필수 제작물에 집중해 예산을 효율적으로 사용합니다.",
        "Focus your budget on the essential deliverables.",
        "聚焦必要交付内容，提高预算效率。",
      ),
      focus: t(
        "필수 제작물 집중 · 집행 효율",
        "Essential deliverables · Efficient delivery",
        "聚焦必要内容 · 执行效率",
      ),
    },
  ];
  const selectedStrategy = strategyOptions.find(
    (option) => option.value === form.compositionPreference,
  )!;
  const regionNames = form.regions.map((region) => {
    const item = regionOptions.find((option) => option[0] === region);
    return item ? t(item[1], item[2], item[3]) : region;
  });
  const platformNames = form.platforms.map((platform) =>
    platform === "recommend"
      ? t("퓨쳐스 추천", "Futures recommendation", "Futures 推荐")
      : (platformOptions.find((option) => option[0] === platform)?.[1] ??
        platform),
  );
  const money =
    Number(form.budgetAmount) > 0
      ? new Intl.NumberFormat(
          locale === "ko" ? "ko-KR" : locale === "zh" ? "zh-CN" : "en-US",
          { style: "currency", currency: form.currency },
        ).format(Number(form.budgetAmount))
      : "—";
  const fieldStatus = (field: string) =>
    invalidField === field ? ("negative" as const) : ("normal" as const);

  if (initialCampaign && initialCampaign.status !== "DRAFT")
    return (
      <div className={s.root}>
        <SectionMessage
          variant="info"
          description={t(
            "이미 접수된 캠페인의 변경은 요청함에서 담당자에게 전달해 주세요.",
            "For submitted campaigns, send changes to your manager through Requests.",
            "已提交的活动请通过请求中心联系负责人修改。",
          )}
        >
          {t(
            "작성 중인 캠페인만 수정할 수 있습니다.",
            "Only drafts can be edited here.",
            "此处仅能编辑草稿活动。",
          )}
        </SectionMessage>
        <Button variant="outlined" color="assistive" onClick={onClose}>
          {t("캠페인으로 돌아가기", "Back to campaigns", "返回活动")}
        </Button>
      </div>
    );

  return (
    <div className={s.root}>
      <header className={s.header}>
        <div>
          <Typography as="h1" variant="title2" weight="bold">
            {initialCampaign
              ? t("캠페인 요청 수정", "Edit campaign request", "编辑活动请求")
              : t("새 캠페인 요청", "New campaign request", "新建活动请求")}
          </Typography>
          <Typography
            as="p"
            variant="body2"
            color="semantic.foreground.neutral.tertiary"
          >
            {t(
              "브리프를 보내주시면 퓨쳐스가 소싱과 공식 제안을 준비합니다.",
              "Share your brief. Futures handles sourcing and prepares the official proposal.",
              "提交需求后，Futures 将负责资源对接与正式方案。",
            )}
          </Typography>
        </div>
        <Button
          variant="outlined"
          color="assistive"
          size="small"
          onClick={onClose}
          disabled={Boolean(busy)}
        >
          {t("나가기", "Close", "关闭")}
        </Button>
      </header>

      <Stepper
        value={String(step)}
        className={s.stepper}
        aria-label={t(
          "캠페인 요청 단계",
          "Campaign request steps",
          "活动请求步骤",
        )}
      >
        {steps.map((label, index) => (
          <StepperItem
            key={label}
            value={String(index)}
            label={label}
            completedLabel={label}
            aria-label={`${index + 1}. ${label}`}
          />
        ))}
      </Stepper>

      <form
        className={s.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 2) {
            if (validate(false)) setStep(step + 1);
          } else void save("submit");
        }}
      >
        <div className={s.panel}>
          <div className={s.intro}>
            <Typography
              as="h2"
              variant="heading1"
              weight="bold"
              ref={heading}
              tabIndex={-1}
            >
              {step === 0
                ? t(
                    "어떤 캠페인을 준비하고 계신가요?",
                    "What are you planning?",
                    "您计划开展什么活动？",
                  )
                : step === 1
                  ? t(
                      "가장 중요한 실행 방향을 선택해 주세요.",
                      "Choose your main priority.",
                      "请选择最重要的执行方向。",
                    )
                  : t(
                      "진행 방식과 요청 내용을 확인해 주세요.",
                      "Review your approach and request.",
                      "请确认执行方式与请求内容。",
                    )}
            </Typography>
            <Typography
              as="p"
              variant="body2"
              color="semantic.foreground.neutral.tertiary"
            >
              {step === 0
                ? t(
                    "별도 표시가 없는 항목은 필수입니다. 일정은 한국 시간 기준입니다.",
                    "All fields are required unless marked optional. Dates use Korean time.",
                    "除标记为选填的项目外均为必填，日期以韩国时间为准。",
                  )
                : step === 1
                  ? t(
                      "선택한 방향은 운영팀이 공식 제안을 구성할 때 참고합니다.",
                      "The team uses this preference when preparing your official proposal.",
                      "运营团队将在制定正式方案时参考您的选择。",
                    )
                  : t(
                      "접수된 요청은 캠페인과 요청함에서 이어서 확인할 수 있습니다.",
                      "After submitting, track your campaign and its request thread.",
                      "提交后，可在活动与请求中心继续查看进展。",
                    )}
            </Typography>
          </div>

          <fieldset disabled={Boolean(busy)} className={s.fieldset}>
            {step === 0 && (
              <div className={s.formGrid}>
                <div className={s.field}>
                  <label htmlFor="brand-title">
                    {t(
                      "게임·제품 / 캠페인명",
                      "Game / product / campaign name",
                      "游戏、产品或活动名称",
                    )}
                  </label>
                  <TextField
                    id="brand-title"
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                    maxLength={160}
                    status={fieldStatus("title")}
                    width="100%"
                    autoComplete="off"
                    placeholder={t(
                      "요청할 캠페인 이름을 입력해 주세요",
                      "Enter the campaign name",
                      "请输入活动名称",
                    )}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="brand-genre">
                    {t(
                      "장르·제품 분야",
                      "Genre / product category",
                      "类型、产品类别",
                    )}
                  </label>
                  <TextField
                    id="brand-genre"
                    value={form.genre}
                    onChange={(event) => update("genre", event.target.value)}
                    maxLength={120}
                    status={fieldStatus("genre")}
                    width="100%"
                    placeholder={t(
                      "게임 장르 또는 제품 분야",
                      "Game genre or product category",
                      "游戏类型或产品类别",
                    )}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="brand-budget">
                    {t("총 예산", "Total budget", "总预算")}
                  </label>
                  <div className={s.budgetRow}>
                    <Select
                      value={form.currency}
                      onChange={(value) =>
                        update("currency", value as typeof form.currency)
                      }
                      aria-label={t("예산 통화", "Budget currency", "预算币种")}
                      width="112px"
                    >
                      <Option value="USD">USD</Option>
                      <Option value="KRW">KRW</Option>
                      <Option value="CNY">CNY</Option>
                    </Select>
                    <TextField
                      id="brand-budget"
                      value={form.budgetAmount}
                      onChange={(event) =>
                        update("budgetAmount", event.target.value)
                      }
                      inputMode="decimal"
                      status={fieldStatus("budgetAmount")}
                      width="100%"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className={s.field}>
                  <label htmlFor="brand-format">
                    {t("콘텐츠 형식", "Content format", "内容形式")}
                  </label>
                  <TextField
                    id="brand-format"
                    value={form.contentFormat}
                    onChange={(event) =>
                      update("contentFormat", event.target.value)
                    }
                    maxLength={160}
                    status={fieldStatus("contentFormat")}
                    width="100%"
                    placeholder={t(
                      "라이브, VOD, 쇼츠 등",
                      "Live, VOD, short-form, etc.",
                      "直播、VOD、短视频等",
                    )}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="brand-count">
                    {t("희망 인원", "Requested creator count", "期望人数")}
                  </label>
                  <TextField
                    id="brand-count"
                    value={form.creatorCount}
                    onChange={(event) =>
                      update("creatorCount", event.target.value)
                    }
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    status={fieldStatus("creatorCount")}
                    width="100%"
                    placeholder={t("1–100명", "1–100", "1–100 人")}
                  />
                </div>
                <div className={s.field}>
                  <label htmlFor="brand-date">
                    {t(
                      "희망 게시일",
                      "Target publication date",
                      "期望发布日期",
                    )}
                  </label>
                  <TextField
                    id="brand-date"
                    value={form.desiredDate}
                    onChange={(event) =>
                      update("desiredDate", event.target.value)
                    }
                    type="date"
                    min={minimumDate}
                    status={fieldStatus("desiredDate")}
                    width="100%"
                  />
                </div>
                <fieldset className={`${s.platforms} ${s.full}`}>
                  <legend>{t("플랫폼", "Platforms", "平台")}</legend>
                  <div className={s.checkGrid}>
                    {[
                      ...platformOptions,
                      [
                        "recommend",
                        t(
                          "퓨쳐스 추천에 맡기기",
                          "Let Futures recommend",
                          "交由 Futures 推荐",
                        ),
                      ],
                    ].map(([value, label]) => (
                      <label className={s.checkLabel} key={value}>
                        <Checkbox
                          checked={form.platforms.includes(value!)}
                          onCheckedChange={(checked) =>
                            selectPlatforms(value!, checked)
                          }
                          aria-label={label}
                          disabled={Boolean(busy)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {invalidField === "platforms" && (
                    <small className={s.fieldError}>
                      {t(
                        "플랫폼을 선택해 주세요.",
                        "Choose a platform.",
                        "请选择平台。",
                      )}
                    </small>
                  )}
                </fieldset>
                <div className={`${s.field} ${s.full}`}>
                  <label htmlFor="brand-goal">
                    {t("캠페인 목표", "Campaign goal", "活动目标")}
                  </label>
                  <TextArea
                    id="brand-goal"
                    value={form.goal}
                    onChange={(event) => update("goal", event.target.value)}
                    maxLength={1000}
                    minRows={3}
                    status={fieldStatus("goal")}
                    width="100%"
                    placeholder={t(
                      "누구에게 어떤 메시지와 행동을 전달하고 싶으신가요?",
                      "Who should the campaign reach, and what should they do?",
                      "希望触达哪些受众，传达什么信息并促成什么行动？",
                    )}
                  />
                </div>
                <div className={`${s.field} ${s.full}`}>
                  <label id="brand-regions-label" htmlFor="brand-regions">
                    {t(
                      "타깃 국가 · 선택",
                      "Target countries · optional",
                      "目标国家 · 选填",
                    )}
                  </label>
                  <SelectMultiple
                    id="brand-regions"
                    aria-labelledby="brand-regions-label"
                    value={form.regions}
                    onChange={(value) => update("regions", value)}
                    width="100%"
                    placeholder={t(
                      "미정이면 비워두셔도 됩니다",
                      "Leave empty if undecided",
                      "尚未确定可留空",
                    )}
                  >
                    {regionOptions.map(([value, ko, en, zh]) => (
                      <Option value={value} key={value}>
                        {t(ko, en, zh)}
                      </Option>
                    ))}
                    {form.regions
                      .filter(
                        (value) =>
                          !regionOptions.some((option) => option[0] === value),
                      )
                      .map((value) => (
                        <Option value={value} key={value}>
                          {value}
                        </Option>
                      ))}
                  </SelectMultiple>
                </div>
                <div className={`${s.field} ${s.full}`}>
                  <label htmlFor="brand-note">
                    {t(
                      "추가 요청사항 · 선택",
                      "Additional notes · optional",
                      "附加说明 · 选填",
                    )}
                  </label>
                  <TextArea
                    id="brand-note"
                    value={form.note}
                    onChange={(event) => update("note", event.target.value)}
                    maxLength={2000}
                    minRows={3}
                    width="100%"
                    placeholder={t(
                      "꼭 전달할 메시지, 비공개 조건, 참고 링크 등을 알려주세요.",
                      "Share key messages, confidentiality requirements, or reference links.",
                      "请填写核心信息、保密要求或参考链接。",
                    )}
                  />
                </div>
                <Typography
                  as="p"
                  variant="label1"
                  color="semantic.foreground.neutral.tertiary"
                  className={s.full}
                >
                  {t(
                    "브리프 파일은 접수 후 해당 캠페인의 요청함에서 첨부할 수 있습니다.",
                    "Attach brief files in the campaign request thread after submitting.",
                    "提交后，可在该活动的请求中心上传需求文件。",
                  )}
                </Typography>
              </div>
            )}

            {step === 1 && (
              <div className={s.stack}>
                <SectionMessage
                  variant="info"
                  description={t(
                    "이 단계에서는 크리에이터의 이름과 채널을 공개하지 않습니다. 구성 인원·견적·예상 성과는 담당자 검토 후 공식 제안에서 확인합니다.",
                    "Creator names and channels are private at this stage. The team will confirm the lineup, pricing, and projections in the official proposal.",
                    "此阶段不公开创作者姓名和频道。人员组合、报价与预计效果将在正式方案中确认。",
                  )}
                >
                  {t(
                    "구성 방향을 선택하는 단계입니다.",
                    "Choose a preference for your proposal.",
                    "请选择方案方向。",
                  )}
                </SectionMessage>
                <RadioGroup
                  value={form.compositionPreference}
                  onValueChange={(value) =>
                    update(
                      "compositionPreference",
                      value as BrandCompositionPreference,
                    )
                  }
                  aria-label={t(
                    "구성 방향",
                    "Composition direction",
                    "组合方向",
                  )}
                  className={s.strategyGrid}
                >
                  {strategyOptions.map((option, index) => (
                    <label
                      htmlFor={`brand-strategy-${option.value}`}
                      key={option.value}
                      className={`${s.choiceCard} ${form.compositionPreference === option.value ? s.selected : ""}`}
                    >
                      <div className={s.choiceTop}>
                        <Typography
                          variant="label1"
                          weight="bold"
                          color="semantic.foreground.brand.primary"
                        >
                          {String.fromCharCode(65 + index)}
                        </Typography>
                        <RadioGroupItem
                          id={`brand-strategy-${option.value}`}
                          value={option.value}
                          aria-labelledby={`brand-strategy-title-${option.value}`}
                        />
                      </div>
                      <Typography
                        as="h3"
                        id={`brand-strategy-title-${option.value}`}
                        variant="headline1"
                        weight="bold"
                      >
                        {option.title}
                      </Typography>
                      <Typography
                        as="p"
                        variant="body2"
                        color="semantic.foreground.neutral.tertiary"
                      >
                        {option.description}
                      </Typography>
                      <Typography
                        as="p"
                        variant="label1"
                        className={s.choiceFocus}
                      >
                        {option.focus}
                      </Typography>
                    </label>
                  ))}
                </RadioGroup>
                <div className={s.preferenceSummary}>
                  <Typography variant="body2" weight="bold">
                    {form.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="semantic.foreground.neutral.tertiary"
                  >
                    {money} · {platformNames.join(" / ")} · {form.creatorCount}
                    {t("명 희망", " requested creators", " 位期望创作者")}
                  </Typography>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className={s.stack}>
                <RadioGroup
                  value={form.route}
                  onValueChange={(value) =>
                    update("route", value as typeof form.route)
                  }
                  aria-label={t("진행 방식", "Campaign approach", "执行方式")}
                  className={s.routeGrid}
                >
                  <label
                    htmlFor="brand-route-managed"
                    className={`${s.choiceCard} ${form.route === "managed" ? s.selected : ""}`}
                  >
                    <div className={s.choiceTop}>
                      <Typography
                        as="h3"
                        id="brand-route-managed-label"
                        variant="headline1"
                        weight="bold"
                      >
                        {t(
                          "48시간 맞춤 제안",
                          "48-hour tailored proposal",
                          "48 小时定制方案",
                        )}
                      </Typography>
                      <RadioGroupItem
                        id="brand-route-managed"
                        value="managed"
                        aria-labelledby="brand-route-managed-label"
                      />
                    </div>
                    <Typography
                      as="p"
                      variant="body2"
                      color="semantic.foreground.neutral.tertiary"
                    >
                      {t(
                        "퓨쳐스가 직접 소싱하고 요청 조건에 맞는 구성을 제안합니다.",
                        "Futures sources creators and prepares a proposal for your brief.",
                        "Futures 直接对接资源，根据需求制定方案。",
                      )}
                    </Typography>
                    <Typography
                      as="p"
                      variant="label1"
                      className={s.choiceFocus}
                    >
                      {t(
                        "접수 완료부터 주말 포함 48시간 기준",
                        "48 calendar hours from completed intake",
                        "需求受理完成后 48 小时，含周末",
                      )}
                    </Typography>
                  </label>
                  <label
                    htmlFor="brand-route-open"
                    className={`${s.choiceCard} ${form.route === "open" ? s.selected : ""}`}
                  >
                    <div className={s.choiceTop}>
                      <Typography
                        as="h3"
                        id="brand-route-open-label"
                        variant="headline1"
                        weight="bold"
                      >
                        {t("오픈 캠페인", "Open campaign", "公开招募活动")}
                      </Typography>
                      <RadioGroupItem
                        id="brand-route-open"
                        value="open"
                        aria-labelledby="brand-route-open-label"
                      />
                    </div>
                    <Typography
                      as="p"
                      variant="body2"
                      color="semantic.foreground.neutral.tertiary"
                    >
                      {t(
                        "파트너 모집 후 퓨쳐스가 후보를 검토하고 공식 제안을 준비합니다.",
                        "Futures reviews partner applications and prepares the official proposal.",
                        "招募合作伙伴后，由 Futures 筛选并准备正式方案。",
                      )}
                    </Typography>
                    <Typography
                      as="p"
                      variant="label1"
                      className={s.choiceFocus}
                    >
                      {t(
                        "모집 마감일 기준으로 진행 · 48시간 제안 대상 아님",
                        "Uses a recruiting deadline · No 48-hour proposal commitment",
                        "按招募截止日期推进 · 不适用 48 小时方案",
                      )}
                    </Typography>
                  </label>
                </RadioGroup>
                {form.route === "open" && (
                  <div className={s.field}>
                    <label htmlFor="brand-application-date">
                      {t(
                        "희망 모집 마감일",
                        "Requested recruiting deadline",
                        "期望招募截止日期",
                      )}
                    </label>
                    <TextField
                      id="brand-application-date"
                      value={form.applicationDate}
                      onChange={(event) =>
                        update("applicationDate", event.target.value)
                      }
                      type="date"
                      min={minimumDate}
                      max={form.desiredDate || undefined}
                      status={fieldStatus("applicationDate")}
                      width="100%"
                    />
                    <small>
                      {t(
                        "희망 게시일보다 앞선 날짜를 선택해 주세요. 담당자가 일정을 확인합니다.",
                        "Choose a date before publication. Your manager will confirm the schedule.",
                        "请选择发布日期之前的日期，负责人将确认排期。",
                      )}
                    </small>
                  </div>
                )}
                <section
                  className={s.summary}
                  aria-label={t(
                    "요청 내용 확인",
                    "Request summary",
                    "请求概要",
                  )}
                >
                  <Typography as="h3" variant="headline1" weight="bold">
                    {t("요청 내용", "Request details", "请求内容")}
                  </Typography>
                  <dl>
                    <div>
                      <dt>{t("캠페인", "Campaign", "活动")}</dt>
                      <dd>{form.title}</dd>
                    </div>
                    <div>
                      <dt>{t("장르·분야", "Category", "类别")}</dt>
                      <dd>{form.genre}</dd>
                    </div>
                    <div>
                      <dt>{t("목표", "Goal", "目标")}</dt>
                      <dd>{form.goal}</dd>
                    </div>
                    <div>
                      <dt>{t("총 예산", "Budget", "预算")}</dt>
                      <dd>{money}</dd>
                    </div>
                    <div>
                      <dt>{t("구성 방향", "Preference", "组合方向")}</dt>
                      <dd>{selectedStrategy.title}</dd>
                    </div>
                    <div>
                      <dt>
                        {t("매체·형식", "Platforms / format", "平台、形式")}
                      </dt>
                      <dd>
                        {platformNames.join(" / ")} · {form.contentFormat}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("희망 인원", "Creator count", "期望人数")}</dt>
                      <dd>{form.creatorCount}</dd>
                    </div>
                    <div>
                      <dt>
                        {t("희망 게시일", "Publication date", "期望发布日期")}
                      </dt>
                      <dd>{form.desiredDate}</dd>
                    </div>
                    {regionNames.length > 0 && (
                      <div>
                        <dt>{t("타깃 국가", "Countries", "目标国家")}</dt>
                        <dd>{regionNames.join(", ")}</dd>
                      </div>
                    )}
                    {form.note.trim() && (
                      <div>
                        <dt>{t("추가 요청", "Notes", "附加说明")}</dt>
                        <dd>{form.note}</dd>
                      </div>
                    )}
                  </dl>
                </section>
                <SectionMessage
                  variant="info"
                  description={t(
                    "크리에이터 소싱과 파트너 소통은 퓨쳐스가 맡습니다. 브랜드는 공식 제안의 구성과 조건을 확인합니다.",
                    "Futures handles sourcing and partner communication. Your team reviews the official proposal and its terms.",
                    "Futures 负责资源对接和合作伙伴沟通，品牌确认正式方案与条件。",
                  )}
                >
                  {t(
                    "요청을 보내면 담당자가 검토를 시작합니다.",
                    "Submitting starts the team's review.",
                    "提交后负责人将开始审核。",
                  )}
                </SectionMessage>
              </div>
            )}
          </fieldset>

          {error && (
            <div className={s.error} role="alert">
              <SectionMessage variant="negative">{error}</SectionMessage>
            </div>
          )}
        </div>
        <footer className={s.footer}>
          <Button
            type="button"
            size="large"
            variant="outlined"
            color="assistive"
            disabled={Boolean(busy)}
            onClick={() => {
              if (step === 0) onClose();
              else {
                setError("");
                setStep(step - 1);
              }
            }}
          >
            {step === 0
              ? t("취소", "Cancel", "取消")
              : t("이전 단계", "Back", "上一步")}
          </Button>
          <div className={s.footerActions}>
            <Button
              type="button"
              size="large"
              variant="outlined"
              color="assistive"
              loading={busy === "save"}
              disabled={Boolean(busy)}
              onClick={() => void save("save")}
            >
              {t("임시 저장", "Save draft", "保存草稿")}
            </Button>
            <Button
              type="submit"
              size="large"
              variant="solid"
              color="primary"
              loading={busy === "submit"}
              disabled={Boolean(busy)}
            >
              {step === 0
                ? t("구성 방향 선택", "Choose a direction", "选择组合方向")
                : step === 1
                  ? t("요청 확인", "Review request", "确认请求")
                  : t(
                      "캠페인 요청 보내기",
                      "Submit campaign request",
                      "提交活动请求",
                    )}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
