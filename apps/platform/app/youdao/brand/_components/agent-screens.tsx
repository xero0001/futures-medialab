"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CloudUpload,
  FileBarChart,
  FileSpreadsheet,
  Music2,
  PackageOpen,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import styles from "./agent.module.css";

type AgentPage = "agent" | "social-media-data" | "mention" | "comment-analyze";
type DialogState = "reference" | "upgrade" | "template" | null;

const base = "/youdao/brand";

const agentCards = [
  {
    title: "소셜 데이터 수집",
    description:
      "인플루언서의 핵심 플랫폼 데이터를 한 번에 내보내고, AI로 추천 이유를 생성합니다. 입찰 및 사전 제안 명단을 준비할 때 활용하세요.",
    href: `${base}/agent/social-media-data`,
  },
  {
    title: "브랜드 홍보 분석",
    description:
      "브랜드 또는 제품의 YouTube 마케팅 활동을 AI로 분석하고 보고서를 생성합니다.",
    href: `${base}/mention`,
  },
  {
    title: "영상 댓글 분석",
    description:
      "영상 데이터를 통합해 댓글의 감성, 전환 의도, 경쟁 제품 언급을 분석하고 보고서를 생성합니다.",
    href: `${base}/comment/analyze`,
  },
];

function AgentHub() {
  return (
    <section className={styles.hub}>
      <h1 className={styles.title}>Agent 스마트 도구</h1>
      <div className={styles.hubGroup}>
        <h2>데이터 조회</h2>
        <div className={styles.cardGrid}>
          <Link href={agentCards[0].href} className={styles.toolCard}>
            <h3>{agentCards[0].title}</h3>
            <p>{agentCards[0].description}</p>
          </Link>
        </div>
      </div>
      <div className={styles.hubGroup}>
        <h2>인사이트 · 의사결정</h2>
        <div className={styles.cardGrid}>
          {agentCards.slice(1).map((card) => (
            <Link href={card.href} className={styles.toolCard} key={card.href}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoPlatformIcon({
  platform = "youtube",
}: {
  platform?: "youtube" | "tiktok";
}) {
  if (platform === "tiktok")
    return <Music2 size={20} strokeWidth={2.8} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#ff2027" />
      <rect x="5" y="7" width="14" height="10" rx="3" fill="white" />
      <path d="m10.5 9 4.5 3-4.5 3Z" fill="#ff2027" />
    </svg>
  );
}

function ReportIllustration({
  variant,
}: {
  variant: "social" | "brand" | "comments";
}) {
  return (
    <div
      className={`${styles.reportIllustration} ${styles[variant]}`}
      aria-hidden="true"
    >
      <div className={styles.reportBack}>
        <span>
          {variant === "brand" ? "브랜드 홍보 분석" : "데이터 인사이트"}
        </span>
        <div className={styles.miniChart}>
          {[30, 48, 41, 72, 57, 91, 76].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
      <div className={styles.reportFront}>
        <span>
          {variant === "comments" ? "댓글 분석 결과" : "소셜 데이터 보고서"}
        </span>
        <div className={styles.reportStat}>
          {variant === "brand" ? "$3.6M – 6.8M" : "데이터 인사이트"}
        </div>
        <div className={styles.reportRows}>
          {[83, 58, 72, 44].map((width, index) => (
            <div key={index}>
              <b />
              <i style={{ width: `${width}%` }} />
              <em />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailHeader({
  title,
  description,
  benefits,
  variant,
  children,
}: {
  title: string;
  description: string;
  benefits: string[];
  variant: "social" | "brand" | "comments";
  children?: ReactNode;
}) {
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href={`${base}/agent`}>Agent 스마트 도구</Link>
        <span>/</span>
        <span aria-current="page">{title}</span>
      </nav>
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>{title}</h1>
          <h2>{description}</h2>
          <ul className={styles.benefits}>
            {benefits.map((benefit) => (
              <li key={benefit}>
                <span>
                  <Check size={10} strokeWidth={4} />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
          {children}
        </div>
        <ReportIllustration variant={variant} />
      </div>
    </>
  );
}

function TrialBanner({
  count,
  onUpgrade,
}: {
  count: number;
  onUpgrade: () => void;
}) {
  return (
    <div className={styles.trialBanner}>
      <div className={styles.bannerArtLeft} aria-hidden="true">
        <div className={styles.socialTile}>
          <Music2 size={24} />
          <span>짧은 영상</span>
        </div>
        <div className={styles.photoTile}>
          <span>콘텐츠</span>
          <i />
        </div>
        <div className={styles.metricTile}>
          <small>콘텐츠 도달</small>
          <strong>48h</strong>
          <i />
        </div>
      </div>
      <div className={styles.trialContent}>
        <strong>
          무료 체험 잔여{" "}
          <em>
            {count}/{count}
          </em>{" "}
          회
        </strong>
        <button
          type="button"
          className={styles.upgradeButton}
          onClick={onUpgrade}
        >
          <span className={styles.upgradeMark}>V</span> 회원 업그레이드
        </button>
      </div>
      <div className={styles.bannerArtRight} aria-hidden="true">
        <div className={styles.dataTile}>
          <small>데이터 인사이트</small>
          <strong>
            205M <span>↗ 43%</span>
          </strong>
        </div>
        <div className={styles.creatorTile}>
          <i />
          <i />
          <i />
          <span>새로운 인사이트</span>
        </div>
      </div>
    </div>
  );
}

function AnalysisButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.analyzeButton}
      onClick={onClick}
      disabled={disabled}
    >
      <FileBarChart size={18} />
      분석
    </button>
  );
}

function EmptyHistory({
  kind,
  title,
  subtitle,
}: {
  kind: "table" | "simple" | "illustrated";
  title: string;
  subtitle?: string;
}) {
  return (
    <section className={styles.history}>
      <div className={styles.historyTitle}>
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {kind === "table" ? (
        <div className={styles.historyTableWrap}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                {[
                  "보고서명",
                  "제품 유형",
                  "제품명",
                  "상태",
                  "업로드 시각",
                  "작업",
                ].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6}>
                  <div className={styles.tableEmpty}>
                    <PackageOpen size={42} strokeWidth={1} />
                    <span>데이터가 없습니다</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={`${styles.emptyHistory} ${kind === "illustrated" ? styles.illustratedEmpty : ""}`}
        >
          {kind === "illustrated" && (
            <div className={styles.emptyIllustration} aria-hidden="true">
              <span className={styles.floatingCard} />
              <div className={styles.emptyBars}>
                <i />
                <i />
                <i />
              </div>
              <PackageOpen size={82} strokeWidth={0.8} />
              <span className={styles.floatingDot} />
            </div>
          )}
          <p>
            {kind === "simple"
              ? "분석 보고서가 없습니다. 브랜드 또는 제품을 선택해 주세요."
              : "데이터가 없습니다. 새 분석 보고서를 만들어 보세요."}
          </p>
        </div>
      )}
    </section>
  );
}

function ReferenceDialog({
  kind,
  onClose,
}: {
  kind: Exclude<DialogState, null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onCancel={onClose}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.dialogBody}>
        <button
          type="button"
          className={styles.dialogClose}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={18} />
        </button>
        {kind === "template" ? (
          <FileSpreadsheet size={34} className={styles.dialogIcon} />
        ) : (
          <Sparkles size={34} className={styles.dialogIcon} />
        )}
        <h2 id={titleId}>
          {kind === "upgrade"
            ? "회원 업그레이드"
            : kind === "template"
              ? "인플루언서 정보 첨부 양식"
              : "분석 화면 미리보기"}
        </h2>
        {kind === "template" ? (
          <>
            <p>원본 화면의 Excel 입력 양식을 참고한 예시입니다.</p>
            <table className={styles.templateTable}>
              <thead>
                <tr>
                  <th>인플루언서 이름 *</th>
                  <th>채널 URL *</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>인플루언서 이름</td>
                  <td>채널 홈페이지 주소</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.dialogNote}>
              이 참고 화면에서는 파일 다운로드와 데이터 수집을 실행하지
              않습니다.
            </p>
          </>
        ) : (
          <p>
            {kind === "upgrade"
              ? "원본 서비스의 회원 안내 팝업을 한국어로 옮긴 참고 화면입니다. 결제나 구독은 진행되지 않습니다."
              : "입력 화면을 확인하기 위한 한국어 참고 화면입니다. 실제 데이터 수집이나 AI 분석은 실행되지 않습니다."}
          </p>
        )}
        <button
          type="button"
          className={styles.analyzeButton}
          onClick={onClose}
        >
          확인
        </button>
      </div>
    </dialog>
  );
}

function SocialDataScreen() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  function chooseFile(file?: File) {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setFileError("Excel 형식(.xlsx, .xls)의 파일을 선택해 주세요.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("2MB 이하의 파일을 선택해 주세요.");
      return;
    }
    setFileError("");
    setFileName(file.name);
  }
  return (
    <section className={styles.detailPage}>
      <DetailHeader
        title="소셜 데이터 수집"
        description="인플루언서의 핵심 데이터를 한 번에 모으고, AI로 추천 이유를 생성하세요"
        benefits={[
          "YouTube · Instagram · TikTok 플랫폼 지원",
          "팔로워·평균 조회·참여율·시청자 정보 내보내기",
          "AI 인플루언서 추천 이유 생성",
        ]}
        variant="social"
      />
      <div className={styles.socialForm}>
        <div className={styles.productFields}>
          <label className={styles.inlineField}>
            <span>제품 유형</span>
            <input placeholder="제품의 구체적인 유형을 입력하세요. 예: 전자제품, 생활가전, 게임" />
          </label>
          <label className={styles.inlineField}>
            <span>제품명</span>
            <input placeholder="정확한 제품명을 입력하면 브랜드에 맞는 추천 이유를 확인할 수 있습니다" />
          </label>
        </div>
        <div className={styles.uploadColumn}>
          <div
            className={styles.fileDrop}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <CloudUpload size={29} strokeWidth={1.8} aria-hidden="true" />
            <div>
              <button
                type="button"
                className={styles.chooseFile}
                onClick={() => fileRef.current?.click()}
              >
                {fileName || "끌어 놓거나 클릭해 인플루언서 정보 첨부"}{" "}
                <em>(필수)</em>
              </button>
              <p>
                <button
                  type="button"
                  className={styles.textLink}
                  onClick={() => setDialog("template")}
                >
                  첨부 양식
                </button>
                에 맞춰 작성한 2MB 이하의 Excel 파일
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx"
              hidden
              aria-label="인플루언서 정보 Excel 선택"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>
          {fileError && (
            <p className={styles.fieldError} role="alert">
              {fileError}
            </p>
          )}
        </div>
        <AnalysisButton
          onClick={() => {
            if (!fileName) {
              setFileError("인플루언서 정보 파일을 선택해 주세요.");
              fileRef.current?.focus();
              return;
            }
            setDialog("reference");
          }}
        />
      </div>
      <TrialBanner count={1} onUpgrade={() => setDialog("upgrade")} />
      <EmptyHistory kind="table" title="이전 분석 보고서" />
      {dialog && (
        <ReferenceDialog kind={dialog} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}

function BrandInsightScreen() {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [brand, setBrand] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionId = useId();
  return (
    <section className={styles.detailPage}>
      <DetailHeader
        title="브랜드 홍보 분석"
        description="브랜드 또는 제품의 YouTube 마케팅 활동을 AI로 분석하고 보고서를 생성합니다"
        benefits={[
          "브랜드·제품의 홍보 시기와 지역 요약",
          "소셜 미디어에서의 홍보 효과 확인",
          "브랜드와 협업한 인플루언서 확인",
          "인플루언서 마케팅 비용 참고",
        ]}
        variant="brand"
      />
      <div className={styles.brandForm}>
        <span className={styles.platformPill}>
          <VideoPlatformIcon />
        </span>
        <div
          className={`${styles.brandSearch} ${error ? styles.fieldInvalid : ""}`}
        >
          <div className={styles.periodSelect}>
            <select aria-label="분석 기간" defaultValue="year">
              <option value="year">최근 1년</option>
              <option value="half">최근 6개월</option>
              <option value="90">최근 90일</option>
              <option value="30">최근 30일</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
          <input
            ref={inputRef}
            aria-label="브랜드 또는 제품명"
            aria-invalid={error}
            value={brand}
            onChange={(event) => {
              setBrand(event.target.value);
              setError(false);
            }}
            list={suggestionId}
            placeholder="대상 국가의 언어로 게임 또는 제품명을 입력해 주세요"
          />
          <datalist id={suggestionId}>
            <option value="이환" />
            <option value="원신" />
            <option value="붕괴: 스타레일" />
            <option value="명조: 워더링 웨이브" />
          </datalist>
        </div>
        <AnalysisButton
          onClick={() => {
            if (!brand.trim()) {
              setError(true);
              inputRef.current?.focus();
              return;
            }
            setDialog("reference");
          }}
        />
        {error && (
          <p
            className={`${styles.fieldError} ${styles.brandError}`}
            role="alert"
          >
            브랜드 또는 제품명을 입력해 주세요.
          </p>
        )}
      </div>
      <TrialBanner count={2} onUpgrade={() => setDialog("upgrade")} />
      <EmptyHistory kind="simple" title="이전 분석 보고서" />
      {dialog && (
        <ReferenceDialog kind={dialog} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}

function CommentsScreen() {
  const [platform, setPlatform] = useState<"youtube" | "tiktok">("youtube");
  const [keyword, setKeyword] = useState("");
  const [urls, setUrls] = useState([{ id: 1, value: "" }]);
  const nextId = useRef(2);
  const [validated, setValidated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const keywordRef = useRef<HTMLInputElement>(null);
  const visibleUrls = collapsed ? urls.slice(0, 3) : urls;
  const isValidUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return (
        parsed.protocol === "https:" &&
        (platform === "youtube"
          ? ["youtube.com", "m.youtube.com", "youtu.be"].includes(host)
          : host === "tiktok.com" || host.endsWith(".tiktok.com"))
      );
    } catch {
      return false;
    }
  };
  function analyze() {
    setValidated(true);
    if (!keyword.trim()) {
      keywordRef.current?.focus();
      return;
    }
    if (urls.some((row) => !isValidUrl(row.value))) {
      setCollapsed(false);
      return;
    }
    setDialog("reference");
  }
  return (
    <section className={styles.detailPage}>
      <DetailHeader
        title="영상 댓글 분석"
        description="영상 데이터를 통합해 댓글의 감성, 전환 의도, 경쟁 제품 언급을 분석합니다"
        benefits={[
          "영상 성과 평가",
          "댓글의 의미와 반응 분석",
          "전환 의도 파악",
        ]}
        variant="comments"
      >
        <p className={styles.newFeature}>
          <Sparkles size={14} />
          <span>
            AI 심층 의미 분석으로 댓글의 감성, 전환 의도와 경쟁 제품 언급을
            한눈에 확인하세요.
          </span>
          <b>신규</b>
        </p>
      </DetailHeader>
      <div className={styles.commentsForm}>
        <div
          className={styles.commentPlatforms}
          role="group"
          aria-label="영상 플랫폼"
        >
          <button
            type="button"
            aria-label="YouTube"
            aria-pressed={platform === "youtube"}
            className={platform === "youtube" ? styles.selectedPlatform : ""}
            onClick={() => {
              setPlatform("youtube");
              setValidated(false);
            }}
          >
            <VideoPlatformIcon />
          </button>
          <button
            type="button"
            aria-label="TikTok"
            aria-pressed={platform === "tiktok"}
            className={platform === "tiktok" ? styles.selectedPlatform : ""}
            onClick={() => {
              setPlatform("tiktok");
              setValidated(false);
            }}
          >
            <VideoPlatformIcon platform="tiktok" />
          </button>
        </div>
        <div className={styles.commentFields}>
          <div>
            <label
              className={`${styles.inlineField} ${validated && !keyword.trim() ? styles.fieldInvalid : ""}`}
            >
              <span>키워드</span>
              <input
                ref={keywordRef}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                aria-invalid={validated && !keyword.trim()}
                placeholder="분석할 제품 또는 브랜드 키워드를 입력하세요. 예: Once Human"
              />
            </label>
            {validated && !keyword.trim() && (
              <p className={styles.fieldError} role="alert">
                키워드를 입력해 주세요.
              </p>
            )}
          </div>
          {visibleUrls.map((row, index) => (
            <div key={row.id}>
              <div className={styles.videoRow}>
                <label
                  className={`${styles.inlineField} ${validated && !isValidUrl(row.value) ? styles.fieldInvalid : ""}`}
                >
                  <span>영상 링크</span>
                  <input
                    aria-label={`영상 링크 ${index + 1}`}
                    aria-invalid={validated && !isValidUrl(row.value)}
                    value={row.value}
                    onChange={(event) =>
                      setUrls((current) =>
                        current.map((item) =>
                          item.id === row.id
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder={
                      platform === "youtube"
                        ? "표준 영상 링크를 한 줄에 하나씩 입력하세요. 예: https://www.youtube.com/watch?v=xxx (최대 20개)"
                        : "TikTok 영상 링크를 한 줄에 하나씩 입력하세요. 한 번에 최대 20개까지 분석할 수 있습니다."
                    }
                  />
                </label>
                {urls.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeRow}
                    aria-label={`영상 링크 ${index + 1} 삭제`}
                    onClick={() =>
                      setUrls((current) =>
                        current.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {validated && !isValidUrl(row.value) && (
                <p className={styles.fieldError} role="alert">
                  {row.value.trim()
                    ? `올바른 ${platform === "youtube" ? "YouTube" : "TikTok"} 영상 링크를 입력해 주세요.`
                    : "영상 링크를 입력해 주세요."}
                </p>
              )}
            </div>
          ))}
          <div className={styles.urlActions}>
            <button
              type="button"
              className={styles.addUrl}
              disabled={urls.length >= 20}
              onClick={() => {
                const id = nextId.current++;
                setUrls((current) => [...current, { id, value: "" }]);
                setCollapsed(false);
              }}
            >
              <Plus size={15} />
              {urls.length >= 20
                ? "영상 링크는 최대 20개까지 입력할 수 있습니다"
                : "영상 링크 더 추가"}
            </button>
            {urls.length > 3 && (
              <button
                type="button"
                className={styles.textLink}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? `전체 ${urls.length}개 펼치기` : "접기"}
                <ChevronDown
                  size={13}
                  className={collapsed ? "" : styles.rotated}
                />
              </button>
            )}
          </div>
        </div>
        <div className={styles.commentAnalyze}>
          <AnalysisButton onClick={analyze} />
        </div>
      </div>
      <TrialBanner count={1} onUpgrade={() => setDialog("upgrade")} />
      <EmptyHistory
        kind="illustrated"
        title="이전 분석 결과"
        subtitle="Excel 다운로드 또는 심층 의미 분석 보고서 생성 지원"
      />
      {dialog && (
        <ReferenceDialog kind={dialog} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}

export function AgentScreen({ page }: { page: AgentPage }) {
  if (page === "social-media-data") return <SocialDataScreen />;
  if (page === "mention") return <BrandInsightScreen />;
  if (page === "comment-analyze") return <CommentsScreen />;
  return <AgentHub />;
}
