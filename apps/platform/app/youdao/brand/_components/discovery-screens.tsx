"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileChartColumn,
  Filter,
  Folder,
  Gamepad2,
  Globe2,
  Instagram,
  LockKeyhole,
  Music2,
  Play,
  Search,
  Star,
  Twitch,
  X,
  Youtube,
} from "lucide-react";
import styles from "./discovery.module.css";

export type DiscoveryPage =
  | "search"
  | "similar-search"
  | "similar-brands"
  | "similar-brands-example"
  | "collect";
const BASE = "/youdao/brand";
const COUNTRIES = [
  "대한민국",
  "미국",
  "일본",
  "영국",
  "캐나다",
  "호주",
  "인도네시아",
  "태국",
  "베트남",
];
const LANGUAGES = [
  "한국어",
  "영어",
  "일본어",
  "중국어",
  "스페인어",
  "인도네시아어",
];
const PLATFORMS = [
  "YouTube",
  "TikTok",
  "Instagram",
  "Twitch",
  "Twitter",
  "Facebook",
];

function PlatformIcon({
  platform,
  size = 17,
}: {
  platform: string;
  size?: number;
}) {
  if (platform === "YouTube") return <Youtube size={size} strokeWidth={2.5} />;
  if (platform === "TikTok") return <Music2 size={size} strokeWidth={2.8} />;
  if (platform === "Instagram")
    return <Instagram size={size} strokeWidth={2.1} />;
  if (platform === "Twitch") return <Twitch size={size} strokeWidth={2.1} />;
  if (platform === "Twitter") return <span className={styles.xMark}>𝕏</span>;
  return <span className={styles.facebookMark}>f</span>;
}

function Platforms({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={styles.platforms} role="tablist" aria-label="소셜 플랫폼">
      {(compact ? PLATFORMS.slice(0, 2) : PLATFORMS).map((platform) => (
        <button
          key={platform}
          type="button"
          role="tab"
          aria-label={platform}
          aria-selected={value === platform}
          className={value === platform ? styles.platformActive : ""}
          onClick={() => onChange(platform)}
        >
          <span className={styles.platformCircle}>
            <PlatformIcon platform={platform} size={20} />
          </span>
        </button>
      ))}
    </div>
  );
}

function Select({
  label,
  options,
  placeholder = "선택해 주세요",
  disabled = false,
  defaultValue = "",
  className = "",
}: {
  label: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <span className={`${styles.selectWrap} ${className}`}>
      <select
        aria-label={label}
        defaultValue={defaultValue}
        disabled={disabled}
        className={styles.select}
      >
        {!defaultValue && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  );
}

function Range({
  label,
  exposure = false,
  disabled = false,
}: {
  label: string;
  exposure?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={styles.range}>
      {exposure && (
        <Select
          label={`${label} 집계 기간`}
          options={["최근 10개", "최근 30일", "최근 90일"]}
          defaultValue="최근 10개"
          disabled={disabled}
          className={styles.rangeSelect}
        />
      )}
      <input
        type="number"
        min="0"
        step="1"
        aria-label={`${label} 최솟값`}
        placeholder="최솟값"
        disabled={disabled}
      />
      <span>K</span>
      <i>~</i>
      <input
        type="number"
        min="0"
        step="1"
        aria-label={`${label} 최댓값`}
        placeholder="최댓값"
        disabled={disabled}
      />
      <span>K</span>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.field} ${className}`}>
      <div className={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function TagFilter({
  label,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
}) {
  const [operator, setOperator] = useState("또는");
  return (
    <Field
      label={
        <>
          <span>{label}</span>
          <span
            className={styles.operator}
            role="group"
            aria-label={`${label} 조건`}
          >
            {["또는", "그리고"].map((value) => (
              <button
                type="button"
                disabled={disabled}
                key={value}
                aria-pressed={operator === value}
                className={operator === value ? styles.operatorActive : ""}
                onClick={() => setOperator(value)}
              >
                {value}
              </button>
            ))}
          </span>
        </>
      }
    >
      <div className={styles.twoControls}>
        <Select
          label={`${label} 포함`}
          placeholder="포함"
          options={[
            "게임",
            "라이프스타일",
            "테크",
            "엔터테인먼트",
            "애니메이션",
          ]}
          disabled={disabled}
        />
        <Select
          label={`${label} 제외`}
          placeholder="제외"
          options={[
            "게임",
            "라이프스타일",
            "테크",
            "엔터테인먼트",
            "애니메이션",
          ]}
          disabled={disabled}
        />
      </div>
    </Field>
  );
}

function ChannelFilters({
  full = false,
  disabled = false,
}: {
  full?: boolean;
  disabled?: boolean;
}) {
  return (
    <>
      {full && <h3 className={styles.filterHeading}>채널 속성</h3>}
      <div className={styles.filterGrid}>
        <Field label="국가 / 지역">
          <Select
            label="채널 국가 또는 지역"
            options={COUNTRIES}
            disabled={disabled}
          />
        </Field>
        <Field label="팔로워 수">
          <Range label="팔로워 수" disabled={disabled} />
        </Field>
        <Field label="평균 노출 수">
          <Range label="평균 노출 수" exposure disabled={disabled} />
        </Field>
        {full && (
          <>
            <Field label="노출 수 변동률">
              <Select
                label="노출 수 변동률"
                options={["10% 이하", "10~30%", "30~50%", "50% 이상"]}
                disabled={disabled}
              />
            </Field>
            <Field label="최근 게시일">
              <Select
                label="최근 게시일"
                options={["최근 7일", "최근 30일", "최근 90일", "최근 1년"]}
                disabled={disabled}
              />
            </Field>
          </>
        )}
        {!full && (
          <Field label="언어">
            <Select
              label="언어"
              placeholder="검색하거나 선택해 주세요"
              options={LANGUAGES}
              disabled={disabled}
            />
          </Field>
        )}
      </div>
    </>
  );
}

function Trial({ count, onUpgrade }: { count: string; onUpgrade: () => void }) {
  return (
    <div className={styles.trial}>
      <div className={styles.trialArt} aria-hidden="true">
        <span className={styles.socialTile}>
          <Music2 size={21} />
        </span>
        <span className={styles.reachTile}>
          크리에이터
          <br />
          <b>도달 인사이트</b>
          <span>↗ 48h</span>
        </span>
        <span className={styles.chartTile}>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className={styles.trialCenter}>
        무료 체험 잔여 <strong>{count}</strong> 회{" "}
        <button type="button" onClick={onUpgrade}>
          <span className={styles.vipSymbol}>V</span>멤버십 업그레이드
        </button>
      </div>
      <div className={styles.trialArtRight} aria-hidden="true">
        <span className={styles.dataTile}>
          데이터 인사이트
          <br />
          <b>205M</b>
          <small>↗43%</small>
        </span>
        <span className={styles.creativeTile}>
          창의성 ↑<span>✦</span>
        </span>
      </div>
    </div>
  );
}

function BoxIllustration({ plain = false }: { plain?: boolean }) {
  if (plain)
    return (
      <div className={styles.plainBox} aria-hidden="true">
        <Folder size={46} strokeWidth={1} />
      </div>
    );
  return (
    <div className={styles.boxIllustration} aria-hidden="true">
      <span className={styles.boxBack} />
      <span className={styles.boxLeft} />
      <span className={styles.boxRight} />
      <span className={styles.boxFlapLeft} />
      <span className={styles.boxFlapRight} />
      <span className={styles.boxBarOne} />
      <span className={styles.boxBarTwo} />
      <span className={styles.boxBarThree} />
      <span className={styles.paperPlane}>➤</span>
    </div>
  );
}

function Empty({ text, plain = false }: { text: string; plain?: boolean }) {
  return (
    <div className={plain ? styles.emptyPlain : styles.empty}>
      <BoxIllustration plain={plain} />
      <p>{text}</p>
    </div>
  );
}

function Upgrade({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.dialogInner}>
        <button
          className={styles.dialogClose}
          type="button"
          aria-label="닫기"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className={styles.membershipArt} aria-hidden="true">
          <span>V</span>
          <Star size={27} />
          <Star size={16} />
        </div>
        <h2>더 많은 기능을 이용해 보세요</h2>
        <p>
          멤버십을 업그레이드하면
          <br />더 다양한 인플루언서 리소스를 이용할 수 있어요.
        </p>
        <div className={styles.dialogNote}>
          한국어 화면 참고용 미리보기입니다.
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onClose}
        >
          확인
        </button>
      </div>
    </dialog>
  );
}

type Creator = {
  name: string;
  country: string;
  followers: string;
  views: string;
  views30: string;
  growth: string;
  engagement: string;
  ratio: string;
  tags: string[];
  color: string;
  letter: string;
};
const creators: Creator[] = [
  {
    name: "모아 플레이",
    country: "대한민국",
    followers: "2.98M",
    views: "1.21M",
    views30: "1.13M",
    growth: "125%",
    engagement: "1.17%",
    ratio: "40.55%",
    tags: ["PC 게임 42%", "콘솔 게임 28%"],
    color: "#e6bd73",
    letter: "M",
  },
  {
    name: "픽셀 노트",
    country: "일본",
    followers: "3.46M",
    views: "97.41K",
    views30: "70.97K",
    growth: "127%",
    engagement: "0.89%",
    ratio: "2.82%",
    tags: ["서바이벌 36%", "PC 게임 24%"],
    color: "#a9d3c9",
    letter: "P",
  },
  {
    name: "루미 스튜디오",
    country: "미국",
    followers: "9.93M",
    views: "1.91M",
    views30: "1.42M",
    growth: "104%",
    engagement: "1.29%",
    ratio: "19.19%",
    tags: ["엔터테인먼트 82%", "애니메이션 18%"],
    color: "#bec5ec",
    letter: "L",
  },
  {
    name: "온더 게임",
    country: "대한민국",
    followers: "1.06M",
    views: "703.20K",
    views30: "744.55K",
    growth: "177%",
    engagement: "2.10%",
    ratio: "66.34%",
    tags: ["게임 리뷰 63%", "테크 17%"],
    color: "#eabac0",
    letter: "O",
  },
  {
    name: "하루 어드벤처",
    country: "호주",
    followers: "568.20K",
    views: "188.40K",
    views30: "164.12K",
    growth: "116%",
    engagement: "3.24%",
    ratio: "33.15%",
    tags: ["어드벤처 58%", "라이프스타일 24%"],
    color: "#b7d6ef",
    letter: "H",
  },
  {
    name: "네온 아케이드",
    country: "영국",
    followers: "812.60K",
    views: "240.70K",
    views30: "196.31K",
    growth: "138%",
    engagement: "2.62%",
    ratio: "29.62%",
    tags: ["콘솔 게임 64%", "게임 리뷰 22%"],
    color: "#d2c0e9",
    letter: "N",
  },
];

function CreatorAvatar({ creator }: { creator: Creator }) {
  return (
    <span
      className={styles.avatar}
      style={{ "--avatar-color": creator.color } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.avatarFace}>
        <span />
        <span />
      </span>
      <b>{creator.letter}</b>
    </span>
  );
}

function CreatorTable({
  empty = false,
  favorites = false,
  related = false,
  onUpgrade,
  emptyText = "표준 채널 홈페이지 링크를 입력해 주세요",
}: {
  empty?: boolean;
  favorites?: boolean;
  related?: boolean;
  onUpgrade?: () => void;
  emptyText?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [stars, setStars] = useState<string[]>([]);
  const heads = [
    "기본 정보",
    "팔로워 수",
    "평균 노출 수",
    "태그",
    "참여율",
    related ? "관련 브랜드" : "조회 수 / 팔로워 수",
    "최근 게시 영상",
    ...(favorites ? ["평가", "작업"] : related ? [] : ["작업"]),
  ];
  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableScroll}>
        <table className={styles.creatorTable}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  aria-label="모든 인플루언서 선택"
                  checked={!empty && selected.length === creators.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? creators.map((c) => c.name) : [],
                    )
                  }
                />
              </th>
              {heads.map((head) => (
                <th key={head}>
                  {head}
                  {head === "평균 노출 수" && <ArrowDownUp size={12} />}
                </th>
              ))}
            </tr>
          </thead>
          {!empty && (
            <tbody>
              {creators.map((creator, index) => (
                <tr key={creator.name}>
                  <td className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      aria-label={`${creator.name} 선택`}
                      checked={selected.includes(creator.name)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, creator.name]
                            : selected.filter((name) => name !== creator.name),
                        )
                      }
                    />
                  </td>
                  <td>
                    <div className={styles.creatorInfo}>
                      <CreatorAvatar creator={creator} />
                      <div>
                        <strong>{creator.name}</strong>
                        <span>
                          <Youtube size={14} className={styles.youtube} />
                          <Globe2 size={12} />
                          {creator.country}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{creator.followers}</td>
                  <td>
                    <div className={styles.viewsLine}>
                      <span>최근 10개 영상</span>
                      <b>{creator.views}</b>
                    </div>
                    <em className={styles.growth}>{creator.growth}</em>
                    <div className={styles.viewsLine}>
                      <span>최근 30일 영상</span>
                      <b>{creator.views30}</b>
                    </div>
                    <em className={styles.growth}>108%</em>
                  </td>
                  <td>
                    <div className={styles.tags}>
                      {creator.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                      <button
                        type="button"
                        onClick={onUpgrade}
                        aria-label={`${creator.name} 태그 더 보기`}
                      >
                        ···
                      </button>
                    </div>
                  </td>
                  <td>{creator.engagement}</td>
                  <td>
                    {related ? (
                      <span className={styles.relatedGame}>
                        <Gamepad2 size={15} />
                        스타라이트 월드
                      </span>
                    ) : (
                      creator.ratio
                    )}
                  </td>
                  <td>
                    <div className={styles.videoList}>
                      {[0, 1, 2].map((video) => (
                        <span key={video}>
                          <i
                            className={styles.videoThumb}
                            style={
                              {
                                "--thumb-hue": `${index * 43 + video * 24}deg`,
                              } as CSSProperties
                            }
                          >
                            <Gamepad2 size={19} />
                            <Play size={9} fill="currentColor" />
                          </i>
                          <b>{["166.75K", "1.12M", "368.41K"][video]}</b>
                          <small>{["11-02", "10-31", "10-26"][video]}</small>
                        </span>
                      ))}
                    </div>
                  </td>
                  {!related && (
                    <td>
                      <button
                        className={`${styles.starButton} ${stars.includes(creator.name) ? styles.starred : ""}`}
                        type="button"
                        aria-label={`${creator.name} 즐겨찾기 표시`}
                        aria-pressed={stars.includes(creator.name)}
                        onClick={() =>
                          setStars(
                            stars.includes(creator.name)
                              ? stars.filter((name) => name !== creator.name)
                              : [...stars, creator.name],
                          )
                        }
                      >
                        <Star
                          size={18}
                          fill={
                            stars.includes(creator.name)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {empty ? (
        <Empty text={emptyText} plain={favorites} />
      ) : (
        <div className={styles.pagination}>
          <span>화면 예시 · 총 {creators.length}명</span>
          <button type="button" aria-label="이전 페이지" disabled>
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className={styles.currentPage}
            aria-current="page"
          >
            1
          </button>
          <button type="button" aria-label="다음 페이지" disabled>
            <ChevronRight size={15} />
          </button>
          <Select
            label="페이지당 표시 수"
            options={["10개씩 보기", "20개씩 보기", "50개씩 보기"]}
            defaultValue="10개씩 보기"
          />
        </div>
      )}
    </div>
  );
}

function SearchScreen({
  similar,
  onUpgrade,
}: {
  similar: boolean;
  onUpgrade: () => void;
}) {
  const [platform, setPlatform] = useState("YouTube");
  const [queryType, setQueryType] = useState("인플루언서 이름");
  const [query, setQuery] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState("");
  function reset() {
    setQuery("");
    setFormKey(formKey + 1);
    setNotice("");
  }
  function previewSearch() {
    setNotice(
      similar && !query.trim()
        ? "기준이 되는 채널 홈페이지 링크를 입력해 주세요."
        : "화면 참고용 예시입니다. 실제 검색은 실행하지 않습니다.",
    );
  }
  return (
    <>
      <h1 className={styles.pageTitle}>
        {similar ? "유사 인플루언서 검색" : "인플루언서 검색"}
        {similar && <CircleHelp size={15} />}
      </h1>
      <div className={styles.searchPanel}>
        <div className={styles.queryBlock}>
          <Platforms
            value={platform}
            onChange={setPlatform}
            compact={similar}
          />
          {!similar && (
            <div
              className={styles.searchTabs}
              role="tablist"
              aria-label="검색 기준"
            >
              {[
                "인플루언서 이름",
                "미디어 콘텐츠",
                "프로필 소개",
                "브랜드 이름",
              ].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  role="tab"
                  aria-selected={queryType === tab}
                  className={queryType === tab ? styles.searchTabActive : ""}
                  onClick={() => setQueryType(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
          <div className={similar ? styles.similarQueryRow : styles.queryRow}>
            <input
              aria-label={similar ? "기준 채널 홈페이지 링크" : queryType}
              placeholder={
                similar
                  ? "표준 채널 홈페이지 링크를 입력해 주세요"
                  : queryType === "인플루언서 이름"
                    ? "인플루언서 이름 또는 채널 홈페이지 링크를 입력해 주세요"
                    : `${queryType}에 포함된 키워드를 입력해 주세요`
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {similar && (
              <>
                <button
                  className={styles.textButton}
                  type="button"
                  onClick={reset}
                >
                  초기화
                </button>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={previewSearch}
                >
                  <Search size={17} />
                  검색
                </button>
              </>
            )}
          </div>
        </div>
        <div className={styles.filterBody} key={formKey}>
          {!similar && (
            <section className={styles.filterSection}>
              <h3 className={styles.filterHeading}>콘텐츠 속성</h3>
              <div className={styles.filterGrid}>
                <Field label="영상 유형">
                  <Select
                    label="영상 유형"
                    options={["전체", "일반 영상", "쇼츠", "라이브"]}
                    defaultValue="전체"
                  />
                </Field>
                <TagFilter label="콘텐츠 태그" />
                <TagFilter label="채널 키워드" />
              </div>
            </section>
          )}
          <section className={styles.filterSection}>
            <ChannelFilters full={!similar} />
          </section>
          {!similar && (
            <section className={styles.filterSection}>
              <h3 className={styles.filterHeading}>시청자 속성</h3>
              <div className={styles.filterGrid}>
                <Field label="언어">
                  <Select
                    label="시청자 언어"
                    options={LANGUAGES}
                    placeholder="검색하거나 선택해 주세요"
                  />
                </Field>
                <Field label="시청자 국가">
                  <Select label="시청자 국가" options={COUNTRIES} />
                </Field>
                <Field label="시청자 연령">
                  <Select
                    label="시청자 연령"
                    options={[
                      "13~17세",
                      "18~24세",
                      "25~34세",
                      "35~44세",
                      "45세 이상",
                    ]}
                  />
                </Field>
                <Field label="시청자 성별">
                  <Select
                    label="시청자 성별"
                    options={["전체", "여성", "남성"]}
                  />
                </Field>
              </div>
            </section>
          )}
          {!similar && (
            <div className={styles.filterActions}>
              <button
                type="button"
                className={styles.textButton}
                onClick={reset}
              >
                초기화
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={previewSearch}
              >
                <Search size={17} />
                검색
              </button>
            </div>
          )}
        </div>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.listHeader}>
        <h2>인플루언서 목록</h2>
        <Select
          label="결과 정렬"
          options={
            similar
              ? ["관련성순", "팔로워 많은 순", "평균 노출 높은 순"]
              : ["종합 정렬 (신규)", "팔로워 많은 순", "평균 노출 높은 순"]
          }
          defaultValue={similar ? "관련성순" : "종합 정렬 (신규)"}
        />
      </div>
      <Trial count="3/3" onUpgrade={onUpgrade} />
      <CreatorTable empty={similar} onUpgrade={onUpgrade} />
    </>
  );
}

function MiniReport() {
  return (
    <div className={styles.miniReport} aria-hidden="true">
      <div>
        <b>인플루언서 추천</b>
        {[60, 82, 40, 69].map((width, index) => (
          <span key={index}>
            <i style={{ width: `${width}%` }} />
          </span>
        ))}
      </div>
      <div>
        <b>관련 인플루언서 목록</b>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function RelatedBrands({ onUpgrade }: { onUpgrade: () => void }) {
  const [filters, setFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <>
      <section className={styles.insightHero}>
        <div>
          <h1 className={styles.pageTitle}>동종 브랜드 인플루언서 추천</h1>
          <h2>경쟁 브랜드 정보를 활용해 보세요</h2>
          <div className={styles.heroPoints}>
            <span>
              <Check size={13} />
              관련 브랜드 찾기
            </span>
            <span>
              <Check size={13} />
              연관 인플루언서 목록을 빠르게 확장하기
            </span>
          </div>
        </div>
        <div className={styles.examplePreview}>
          <MiniReport />
          <Link
            href={`${BASE}/storage/similar-brands/example`}
            className={styles.exampleLink}
          >
            예시 보기
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
      <section className={styles.brandQueryPanel}>
        <div className={styles.brandQueryRow}>
          <span className={styles.platformSquare}>
            <Youtube size={19} />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="게임 또는 제품명"
            placeholder="국가에 맞는 언어로 게임 또는 제품 이름을 입력해 주세요"
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <Filter size={16} />
            필터
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() =>
              setNotice(
                query.trim()
                  ? "화면 참고용 예시입니다. 실제 분석은 실행하지 않습니다."
                  : "분석할 브랜드 또는 제품 이름을 입력해 주세요.",
              )
            }
          >
            <FileChartColumn size={17} />
            분석
          </button>
        </div>
        {filters && (
          <div className={styles.brandFilters}>
            <ChannelFilters />
            <Field label="출시 플랫폼">
              <Select
                label="출시 플랫폼"
                options={["모바일 게임", "PC 게임", "콘솔 게임", "전체"]}
                defaultValue="모바일 게임"
              />
            </Field>
          </div>
        )}
      </section>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <Trial count="1/1" onUpgrade={onUpgrade} />
      <h2 className={styles.historyTitle}>이전 추천 목록</h2>
      <Empty text="아직 데이터가 없습니다. 새 분석 보고서를 만들어 보세요." />
    </>
  );
}

function RelatedExample({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href={`${BASE}/storage/similar-brands`}>
          동종 브랜드 인플루언서 추천
        </Link>
        <span>/</span>
        <span>추천 인플루언서 목록</span>
      </nav>
      <h1 className={styles.pageTitle}>동종 브랜드 인플루언서 목록</h1>
      <section className={styles.brandSummary}>
        <div>
          <span>기준 브랜드</span>
          <strong>
            <i className={styles.gameBadge}>
              <Gamepad2 size={19} />
            </i>
            스타라이트 월드 · 새로운 모험
          </strong>
        </div>
        <div>
          <span>동종 브랜드</span>
          <strong>
            <i className={`${styles.gameBadge} ${styles.secondGame}`}>
              <Gamepad2 size={19} />
            </i>
            오로라 오디세이
          </strong>
          <span className={styles.blurredBrands} aria-hidden="true">
            픽셀 어드벤처 · 미스틱 아일랜드 · 아케이드 월드
          </span>
        </div>
      </section>
      <section className={styles.exampleFilters}>
        <div className={styles.filterGrid}>
          <Field label="영상 유형">
            <Select
              label="예시 영상 유형"
              options={["전체"]}
              defaultValue="전체"
              disabled
            />
          </Field>
          <Field label="협업 유형">
            <Select
              label="예시 협업 유형"
              options={["협찬", "자발적 언급"]}
              disabled
            />
          </Field>
          <Field label="최근 게시일">
            <Select label="예시 최근 게시일" options={["최근 30일"]} disabled />
          </Field>
        </div>
        <div className={styles.exampleBottom}>
          <TagFilter label="콘텐츠 태그" disabled />
          <div>
            <button type="button" className={styles.secondaryButton} disabled>
              초기화
            </button>
            <button type="button" className={styles.secondaryButton} disabled>
              검색
            </button>
          </div>
        </div>
      </section>
      <div className={styles.exampleList}>
        <div className={styles.exampleToolbar}>
          <Select
            label="예시 결과 정렬"
            options={["관련성순"]}
            defaultValue="관련성순"
            disabled
          />
          <small>화면 구성을 위한 가상 데이터</small>
        </div>
        <CreatorTable related onUpgrade={onUpgrade} />
      </div>
    </>
  );
}

function Collections({ onUpgrade }: { onUpgrade: () => void }) {
  const searchParams = useSearchParams();
  const detail = searchParams.has("favoriteId");
  const [query, setQuery] = useState("");
  if (detail)
    return (
      <>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href={`${BASE}/storage/collect`}>즐겨찾기</Link>
          <span>/</span>
          <span>기본 즐겨찾기</span>
        </nav>
        <h1 className={styles.pageTitle}>기본 즐겨찾기</h1>
        <div className={styles.collectionDetailToolbar}>
          <h2>
            총 <strong>0</strong>명의 인플루언서 <CircleHelp size={14} />
          </h2>
          <div>
            <Select
              label="즐겨찾기 정렬"
              options={["기본 정렬", "팔로워 많은 순", "평균 노출 높은 순"]}
              defaultValue="기본 정렬"
            />
            <div className={styles.searchInput}>
              <input
                aria-label="즐겨찾기 인플루언서 검색"
                placeholder="인플루언서 이름 또는 링크를 입력해 주세요"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" aria-label="즐겨찾기 검색">
                <Search size={17} />
              </button>
            </div>
          </div>
        </div>
        <CreatorTable
          empty
          favorites
          emptyText="조건에 맞는 인플루언서가 없습니다."
        />
      </>
    );
  return (
    <>
      <h1 className={styles.pageTitle}>즐겨찾기</h1>
      <div className={styles.collectionToolbar}>
        <div className={styles.searchInput}>
          <input
            aria-label="즐겨찾기 폴더 검색"
            placeholder="즐겨찾기 폴더 이름을 입력해 주세요"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" aria-label="즐겨찾기 폴더 검색">
            <Search size={17} />
          </button>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onUpgrade}
        >
          새 폴더
        </button>
      </div>
      {!query || "기본 즐겨찾기".includes(query) ? (
        <Link
          className={styles.collectionCard}
          href={`${BASE}/storage/collect?favoriteId=0`}
        >
          <div className={styles.lockArt} aria-hidden="true">
            <LockKeyhole size={45} strokeWidth={1.5} />
            <span />
          </div>
          <div>
            기본 즐겨찾기
            <ChevronRight size={17} />
          </div>
        </Link>
      ) : (
        <Empty text="검색한 이름의 폴더가 없습니다." plain />
      )}
    </>
  );
}

export function DiscoveryScreen({ page }: { page: DiscoveryPage }) {
  const [upgrade, setUpgrade] = useState(false);
  return (
    <div className={styles.screen}>
      {page === "search" && (
        <SearchScreen
          key="search"
          similar={false}
          onUpgrade={() => setUpgrade(true)}
        />
      )}
      {page === "similar-search" && (
        <SearchScreen
          key="similar-search"
          similar
          onUpgrade={() => setUpgrade(true)}
        />
      )}
      {page === "similar-brands" && (
        <RelatedBrands onUpgrade={() => setUpgrade(true)} />
      )}
      {page === "similar-brands-example" && (
        <RelatedExample onUpgrade={() => setUpgrade(true)} />
      )}
      {page === "collect" && <Collections onUpgrade={() => setUpgrade(true)} />}
      <Upgrade open={upgrade} onClose={() => setUpgrade(false)} />
    </div>
  );
}
