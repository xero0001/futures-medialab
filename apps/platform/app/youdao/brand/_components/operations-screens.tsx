"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Inbox,
  Instagram,
  Mail,
  Plus,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import styles from "./operations.module.css";

type OperationsPage = "short-links" | "campaign" | "account";
type Message = { title: string; body: string } | null;

function ActionButton({
  children,
  secondary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      type="button"
      className={secondary ? styles.secondaryButton : styles.primaryButton}
      {...props}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
  upgrade = false,
}: {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  upgrade?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={upgrade ? styles.upgradeDialog : styles.dialog}
      aria-labelledby={headingId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={upgrade ? styles.upgradeContent : styles.dialogContent}>
        <button
          type="button"
          className={styles.modalClose}
          aria-label="닫기"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        {upgrade ? (
          <>
            <div className={styles.miniLogo}>
              <i />
              youdao Ads
            </div>
            <h2 id={headingId}>{title}</h2>
            <p>더 많은 인플루언서 리소스를 만나보세요.</p>
            <div className={styles.upgradePlans}>
              <div>
                <small>맞춤 플랜</small>
                <span>
                  브랜드에 맞춘
                  <br />
                  서비스 구성
                </span>
                <strong>상담 후 안내</strong>
              </div>
              <div>
                <small>스탠다드 플랜</small>
                <span>
                  인플루언서 마케팅을
                  <br />
                  위한 다양한 도구
                </span>
                <strong>멤버십 안내</strong>
              </div>
            </div>
            <button
              type="button"
              className={styles.upgradeCta}
              onClick={onClose}
            >
              확인
            </button>
            <span className={styles.referenceNote}>
              한국어 화면 참고용 안내
            </span>
          </>
        ) : (
          <>
            <h2 id={headingId}>{title}</h2>
            <div className={styles.dialogBody}>{children}</div>
            <ActionButton onClick={onClose}>확인</ActionButton>
          </>
        )}
      </div>
    </dialog>
  );
}

function EmptyLinks() {
  return (
    <div className={styles.emptyLinks}>
      <div className={styles.emptyGlyph}>
        <Inbox size={48} strokeWidth={0.8} />
      </div>
      <p>데이터가 없습니다</p>
    </div>
  );
}

function ShortLinksScreen() {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const [queried, setQueried] = useState(false);
  function reset() {
    setUrl("");
    setName("");
    setStart("");
    setEnd("");
    setQueried(false);
  }
  return (
    <section className={styles.root}>
      <h1 className={styles.pageTitle}>단축 링크 서비스</h1>
      <form
        className={styles.linkFilters}
        onSubmit={(event) => {
          event.preventDefault();
          setQueried(true);
        }}
      >
        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <span>단축 링크 :</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="입력해 주세요"
            />
          </label>
          <label className={styles.filterField}>
            <span>링크 이름 :</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="입력해 주세요"
            />
          </label>
          <div className={styles.filterField}>
            <span>생성일 :</span>
            <div className={styles.dateRange}>
              <input
                type="date"
                aria-label="생성일 시작"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span>~</span>
              <input
                type="date"
                aria-label="생성일 종료"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
              />
              <CalendarDays size={15} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className={styles.filterActions}>
          <ActionButton secondary onClick={reset}>
            초기화
          </ActionButton>
          <button type="submit" className={styles.primaryButton}>
            검색
          </button>
        </div>
      </form>
      <div className={styles.listHeader}>
        <h2>단축 링크 목록</h2>
        <div className={styles.listActions}>
          <div className={styles.selectWrap}>
            <select aria-label="단축 링크 정렬">
              <option>최신순</option>
              <option>생성일 오래된순</option>
              <option>조회수 높은순</option>
            </select>
            <ChevronDown size={14} />
          </div>
          <ActionButton onClick={() => setUpgrade(true)}>
            새 단축 링크
          </ActionButton>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.linkTable}>
          <thead>
            <tr>
              <th>링크 이름</th>
              <th>단축 링크</th>
              <th>총 PV</th>
              <th>총 UV</th>
              <th>성과 추적</th>
              <th>원본 링크</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8}>
                <EmptyLinks />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {queried && (
        <span className={styles.srOnly} role="status">
          검색 결과가 없습니다.
        </span>
      )}
      {upgrade && (
        <Modal
          title="멤버십으로 더 많은 기능을 이용하세요"
          onClose={() => setUpgrade(false)}
          upgrade
        />
      )}
    </section>
  );
}

function CampaignIllustration() {
  return (
    <div
      className={styles.campaignIllustration}
      role="img"
      aria-label="인플루언서와 소셜 채널, 성과 그래프를 표현한 일러스트"
    >
      <div className={styles.illustrationShape} />
      <span className={styles.illustrationChip} />
      <svg
        className={styles.creatorDrawing}
        viewBox="0 0 240 290"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M88 77c-8-27 8-50 36-49 30 1 44 29 35 56l16 86-90 12 3-105Z"
          fill="#7E3929"
        />
        <path
          d="M97 67c-1-17 6-32 23-32 19 0 28 11 27 32l-3 33-44-1-3-32Z"
          fill="#EFB69C"
        />
        <path
          d="M96 69c5-7 4-17 3-24 9 0 31-2 43-12l10 18 2 28 12-24c-8-31-43-41-65-20L89 58l7 11Z"
          fill="#6B3027"
        />
        <path
          d="M91 49c-4-13 4-26 17-29 15-4 36-3 43 8l-2 11-58 10Z"
          fill="#B9482C"
        />
        <path d="m89 48 63-14 3 8c-21 11-41 15-67 16l1-10Z" fill="#D85F3B" />
        <path
          d="m105 88-5 22-23 12-6 66 61 23 34-34-20-57-15-14-1-20-25 2Z"
          fill="#F9E7DF"
        />
        <path d="m100 108 18 13 16-15 9 14-22 28-27-28 6-12Z" fill="#FFF4EE" />
        <path d="m80 119-15 39-3 65 14 1 13-62-9-43Z" fill="#F1D6CA" />
        <path d="m142 119 20 23 25 49-10 9-35-40v-41Z" fill="#FFF2EA" />
        <path d="m175 192 13-3 12 13 13 5 3 9-23-2-18-22Z" fill="#EFB69C" />
        <path d="m74 185 63 19 17 54-88 13 8-86Z" fill="#BB563B" />
        <path d="m79 196-4 67 37-4 7-60-40-7Z" fill="#CF6B4D" />
        <path d="m62 221 15 1-2 14-4 10-9-5v-20Z" fill="#EFB69C" />
        <path
          d="m108 72 5 1m16-4 5 1"
          stroke="#693A31"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m117 86 11-2"
          stroke="#B36D5B"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m94 132-5 43 27 8"
          stroke="#E7C8BB"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className={styles.likesCard}>
        <span>
          <span>♥</span> 좋아요
        </span>
        <strong>15.9k</strong>
        <small>↑ 2.1%</small>
      </div>
      <div className={styles.graphCard}>
        <div>
          <span>참여율</span>
          <strong>노출</strong>
        </div>
        <svg viewBox="0 0 120 100" aria-hidden="true">
          <defs>
            <linearGradient
              id="youdao-operations-chart-fill"
              x1="60"
              y1="10"
              x2="60"
              y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFD7DA" />
              <stop offset="1" stopColor="#FFF" />
            </linearGradient>
          </defs>
          <path
            d="M0 83C20 84 39 77 55 58S82 18 120 6V100H0Z"
            fill="url(#youdao-operations-chart-fill)"
          />
          <path
            d="M0 83C20 84 39 77 55 58S82 18 120 6"
            stroke="#FF7D86"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="64" cy="45" r="3" fill="white" stroke="#FF7D86" />
        </svg>
        <span className={styles.graphAxis}>10:00　12:00　14:00</span>
      </div>
      <div className={styles.socialTiles}>
        <span className={styles.twitter}>♥</span>
        <span className={styles.instagram}>
          <Instagram size={20} />
        </span>
        <span className={styles.tiktok}>♪</span>
        <span className={styles.facebook}>f</span>
        <span className={styles.youtube}>
          <Youtube size={22} fill="currentColor" />
        </span>
      </div>
    </div>
  );
}

function CampaignScreen() {
  const [contact, setContact] = useState(false);
  const points = [
    "프로젝트에 가장 적합한 인플루언서를 연결하고, 독점 리소스와 특별한 협업 기회를 제공합니다.",
    "인플루언서 정보와 제안 견적을 언제 어디서나 확인하세요.",
    "최신 프로젝트 진행 상황과 인플루언서 협업 상태를 확인하세요.",
    "데이터를 실시간으로 살펴보고 캠페인 성과를 평가하세요.",
    "캠페인의 기여도와 결과를 담은 회고 보고서를 확인하세요.",
  ];
  return (
    <section className={styles.root}>
      <h1 className={styles.pageTitle}>캠페인 관리</h1>
      <div className={styles.campaignGrid}>
        <div className={styles.campaignCopy}>
          <h2>
            Youdao Ads 인플루언서 마케팅 팀과 함께
            <br className={styles.desktopBreak} /> 글로벌 마케팅을 한곳에서
            해결하세요.
          </h2>
          <ul>
            {points.map((point) => (
              <li key={point}>
                <CircleCheck size={14} fill="#FF784E" stroke="white" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <ActionButton onClick={() => setContact(true)}>
            <Mail size={15} />
            문의하기
          </ActionButton>
        </div>
        <CampaignIllustration />
      </div>
      {contact && (
        <Modal title="캠페인 문의" onClose={() => setContact(false)}>
          <p>브랜드의 목표에 맞는 인플루언서 캠페인을 준비해 보세요.</p>
          <p className={styles.dialogHint}>
            현재는 화면 참고용 페이지이며 문의가 전송되지 않습니다.
          </p>
        </Modal>
      )}
    </section>
  );
}

type Profile = {
  name: string;
  position: string;
  email: string;
  countryCode: string;
  phone: string;
  company: string;
  industry: string;
  website: string;
  country: string;
  size: string;
  products: string[];
};
const initialProfile: Profile = {
  name: "브랜드 담당자",
  position: "",
  email: "brand@example.com",
  countryCode: "+82",
  phone: "",
  company: "예시 브랜드",
  industry: "게임",
  website: "",
  country: "대한민국",
  size: "15명 미만",
  products: [""],
};
type AccountTab = "personal" | "company" | "security";

function FormRow({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.accountRow}>
      <div className={styles.fieldLabel}>
        {required && <span>*</span>}
        {label}
        <span className={styles.colon}>:</span>
      </div>
      <div className={styles.fieldControl}>{children}</div>
    </div>
  );
}

function AccountScreen() {
  const [tab, setTab] = useState<AccountTab>("personal");
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [draft, setDraft] = useState<Profile>(initialProfile);
  const [editing, setEditing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [saved, setSaved] = useState(false);
  function field<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function changeTab(next: AccountTab) {
    setTab(next);
    setEditing(false);
    setDraft(profile);
    setSaved(false);
  }
  function cancel() {
    setDraft(profile);
    setEditing(false);
    setSaved(false);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    setProfile(draft);
    setEditing(false);
    setSaved(true);
  }
  return (
    <section className={styles.root}>
      <h1 className={styles.pageTitle}>계정 관리</h1>
      <div className={styles.accountTabs} role="tablist" aria-label="계정 정보">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "personal"}
          className={tab === "personal" ? styles.selectedTab : undefined}
          onClick={() => changeTab("personal")}
        >
          개인 정보
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "company"}
          className={tab === "company" ? styles.selectedTab : undefined}
          onClick={() => changeTab("company")}
        >
          회사 정보
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "security"}
          className={tab === "security" ? styles.selectedTab : undefined}
          onClick={() => changeTab("security")}
        >
          보안 설정
        </button>
      </div>
      {tab !== "security" ? (
        <form className={styles.accountForm} onSubmit={save}>
          {tab === "personal" ? (
            <>
              <FormRow label="이름" required>
                <input
                  aria-label="이름"
                  value={draft.name}
                  disabled={!editing}
                  onChange={(e) => field("name", e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label="직위" required>
                <div className={styles.selectWrap}>
                  <select
                    aria-label="직위"
                    value={draft.position}
                    disabled={!editing}
                    onChange={(e) => field("position", e.target.value)}
                    required
                  >
                    <option value="">선택해 주세요</option>
                    <option>대표</option>
                    <option>마케팅 담당자</option>
                    <option>브랜드 매니저</option>
                    <option>기타</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </FormRow>
              <FormRow label="이메일" required>
                <input
                  type="email"
                  aria-label="이메일"
                  value={draft.email}
                  disabled={!editing}
                  onChange={(e) => field("email", e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label="전화번호">
                <div className={styles.phoneField}>
                  <select
                    aria-label="국가 전화번호"
                    value={draft.countryCode}
                    disabled={!editing}
                    onChange={(e) => field("countryCode", e.target.value)}
                  >
                    <option value="+82">대한민국 +82</option>
                    <option value="+86">중국 +86</option>
                    <option value="+1">미국 +1</option>
                    <option value="+81">일본 +81</option>
                  </select>
                  <input
                    type="tel"
                    aria-label="전화번호"
                    value={draft.phone}
                    disabled={!editing}
                    placeholder="전화번호를 입력해 주세요"
                    onChange={(e) => field("phone", e.target.value)}
                  />
                </div>
              </FormRow>
            </>
          ) : (
            <>
              <FormRow label="회사명" required>
                <input
                  aria-label="회사명"
                  value={draft.company}
                  disabled={!editing}
                  onChange={(e) => field("company", e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label="업종" required>
                <div className={styles.selectWrap}>
                  <select
                    aria-label="업종"
                    value={draft.industry}
                    disabled={!editing}
                    onChange={(e) => field("industry", e.target.value)}
                  >
                    <option>게임</option>
                    <option>이커머스</option>
                    <option>뷰티</option>
                    <option>전자제품</option>
                    <option>기타</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </FormRow>
              <FormRow label="웹사이트">
                <textarea
                  aria-label="웹사이트"
                  rows={3}
                  disabled={!editing}
                  value={draft.website}
                  placeholder="웹사이트 주소를 입력해 주세요"
                  onChange={(e) => field("website", e.target.value)}
                />
              </FormRow>
              <FormRow label="국가 / 지역" required>
                <div className={styles.selectWrap}>
                  <select
                    aria-label="국가 또는 지역"
                    value={draft.country}
                    disabled={!editing}
                    onChange={(e) => field("country", e.target.value)}
                  >
                    <option>대한민국</option>
                    <option>중국</option>
                    <option>미국</option>
                    <option>일본</option>
                    <option>기타</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </FormRow>
              <FormRow label="회사 규모" required>
                <div className={styles.selectWrap}>
                  <select
                    aria-label="회사 규모"
                    value={draft.size}
                    disabled={!editing}
                    onChange={(e) => field("size", e.target.value)}
                  >
                    <option>15명 미만</option>
                    <option>15–50명</option>
                    <option>51–100명</option>
                    <option>101–500명</option>
                    <option>500명 이상</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </FormRow>
              <FormRow label="홍보 제품">
                <div className={styles.productFields}>
                  {draft.products.map((product, index) => (
                    <div key={index}>
                      <input
                        aria-label={`홍보 제품 ${index + 1}`}
                        value={product}
                        disabled={!editing}
                        placeholder="제품명을 입력해 주세요"
                        onChange={(e) =>
                          field(
                            "products",
                            draft.products.map((value, currentIndex) =>
                              currentIndex === index ? e.target.value : value,
                            ),
                          )
                        }
                      />
                      {editing && draft.products.length > 1 && (
                        <button
                          type="button"
                          aria-label={`제품 ${index + 1} 삭제`}
                          onClick={() =>
                            field(
                              "products",
                              draft.products.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button
                      type="button"
                      className={styles.addProduct}
                      onClick={() => field("products", [...draft.products, ""])}
                    >
                      <Plus size={14} />
                      제품 추가
                    </button>
                  )}
                </div>
              </FormRow>
            </>
          )}
          <div className={styles.accountActions}>
            {editing ? (
              <>
                <ActionButton secondary onClick={cancel}>
                  취소
                </ActionButton>
                <button type="submit" className={styles.primaryButton}>
                  저장
                </button>
              </>
            ) : (
              <ActionButton
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                }}
              >
                편집
              </ActionButton>
            )}
          </div>
          {saved && (
            <p className={styles.savedNotice} role="status">
              <Check size={14} />
              변경 사항을 이 참고 화면에 반영했습니다.
            </p>
          )}
        </form>
      ) : (
        <div className={styles.securityForm}>
          <h2>계정 정보</h2>
          <FormRow label="이메일">
            <input
              aria-label="계정 이메일"
              value={profile.email}
              disabled
              readOnly
            />
          </FormRow>
          <FormRow label="비밀번호">
            <div className={styles.passwordField}>
              <input aria-label="비밀번호" value="••••••" disabled readOnly />
              <button
                type="button"
                onClick={() =>
                  setMessage({
                    title: "비밀번호 재설정",
                    body: "한국어 참고 화면입니다. 실제 비밀번호 변경이나 재설정 메일 발송은 이루어지지 않습니다.",
                  })
                }
              >
                비밀번호 재설정
              </button>
            </div>
          </FormRow>
          <h2 className={styles.privacyTitle}>개인정보 설정</h2>
          <label className={styles.marketingConsent}>
            <input
              type="checkbox"
              checked={subscribed}
              onChange={(e) => setSubscribed(e.target.checked)}
            />
            <span>Youdao Ads가 보내는 협업 정보와 알림 수신에 동의합니다.</span>
          </label>
        </div>
      )}
      {message && (
        <Modal title={message.title} onClose={() => setMessage(null)}>
          <p>{message.body}</p>
        </Modal>
      )}
    </section>
  );
}

export function OperationsScreen({ page }: { page: OperationsPage }) {
  if (page === "short-links") return <ShortLinksScreen />;
  if (page === "campaign") return <CampaignScreen />;
  return <AccountScreen />;
}
