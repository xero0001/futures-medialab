"use client";

import { useEffect, useState } from "react";
import { Tab, TabList, TabListItem, TabPanel } from "@montage-ui/core";
import { FormSelect } from "@futures-medialab/ui/form-select";
import { CheckCircle2, ChevronRight, Download, Search, X } from "lucide-react";
import { AdminButton } from "./_components/admin-button";
import {
  accountTypes,
  filterAccounts,
  filterReviews,
  type AccountType,
} from "../lib/account-management";
import type { AdminAction, Bootstrap, OrganizationDetail } from "../lib/types";

const labels: Record<string, string> = {
  BRAND: "브랜드",
  AGENCY: "에이전시",
  PLATFORM: "운영 조직",
  ACTIVE: "승인",
  PENDING: "승인 대기",
  SUSPENDED: "이용 정지",
  OWNER: "소유자",
  ADMIN: "관리자",
  MEMBER: "멤버",
  BUSINESS_REGISTRATION: "사업자 증빙",
  CONTRACT: "계약서",
  UPLOADED: "검증 완료",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
const badge = (status: string) => (
  <span className={`admin-badge state-${status.toLowerCase()}`}>
    {labels[status] ?? status}
  </span>
);

export function AdminAccountWorkspace({
  mode,
  data,
  userId,
  busy,
  accountType,
  status,
  selected,
  onFilter,
  onSelect,
  onReview,
  onOperation,
}: {
  mode: "accounts" | "reviews";
  data: Bootstrap;
  userId: string;
  busy: boolean;
  accountType: AccountType;
  status: string;
  selected: string;
  onFilter: (type: AccountType, status: string) => void;
  onSelect: (id: string) => void;
  onReview: (id: string, type: AccountType) => void;
  onOperation: (operation: {
    action: AdminAction;
    id: string;
    title: string;
    message: string;
  }) => void;
}) {
  const reviewing = mode === "reviews";
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setDetail(null);
      setDetailLoading(true);
      setError("");
      fetch(`/api/admin/organizations/${selected}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) {
            if (response.status === 401) window.location.assign("/login");
            throw new Error(body.message || "회사 정보를 불러오지 못했습니다.");
          }
          if (!controller.signal.aborted) setDetail(body);
        })
        .catch((caught) => {
          if (!controller.signal.aborted) setError(caught.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setDetailLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selected, data]);

  const users = filterAccounts(data.users, accountType, status, query);
  const reviews = filterReviews(data.organizations, accountType, query);
  const org = detail?.id === selected ? detail : null;
  const act = (action: AdminAction, title: string, message: string) => {
    if (org) onOperation({ action, id: org.id, title, message });
  };

  return (
    <section className="admin-account-workspace">
      <Tab
        value={accountType}
        onValueChange={(value) => onFilter(value as AccountType, status)}
        disableScrollMoveOnChange
      >
        <TabList
          size="medium"
          horizontalPadding={false}
          aria-label={reviewing ? "심사 대상 유형" : "계정 유형"}
        >
          {accountTypes.map(([value, label]) => (
            <TabListItem
              key={value}
              value={value}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFilter(value, status);
                }
              }}
            >
              {label}
            </TabListItem>
          ))}
        </TabList>
        <TabPanel
          value={accountType}
          mountMode="always"
          className="admin-list-tab-panel"
        >
          <div className="admin-toolbar">
            <label className="admin-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  reviewing ? "회사명 검색" : "이름, 이메일 또는 회사명 검색"
                }
                aria-label={reviewing ? "심사 대상 검색" : "계정 검색"}
              />
            </label>
            {!reviewing && (
              <label className="admin-filter">
                이용 상태
                <FormSelect
                  aria-label="계정 이용 상태"
                  value={status}
                  onChange={(event) =>
                    onFilter(accountType, event.target.value)
                  }
                >
                  <option value="all">전체 상태</option>
                  <option value="ACTIVE">승인</option>
                  <option value="PENDING">승인 대기</option>
                  <option value="SUSPENDED">이용 정지</option>
                </FormSelect>
              </label>
            )}
          </div>
          <div className="admin-list-caption">
            <span>
              {reviewing ? "심사 대기" : "검색 결과"}{" "}
              {reviewing ? reviews.length : users.length}건
            </span>
            <span>
              {reviewing
                ? `최근 변경된 ${data.limit}개 조직 중 승인 대기 대상 · 최근 변경순`
                : `최근 가입한 ${data.limit}개 계정 내 검색 · 가입순`}
            </span>
          </div>
          <div className="admin-table-wrap admin-flat-table">
            {reviewing ? (
              <table>
                <thead>
                  <tr>
                    <th>회사</th>
                    <th>유형</th>
                    <th>제출 상태</th>
                    <th>최근 심사 사유</th>
                    <th>심사</th>
                  </tr>
                </thead>
                <tbody>
                  {!reviews.length && <EmptyRow reviewing />}
                  {reviews.map((organization) => (
                    <tr
                      key={organization.id}
                      className={selected === organization.id ? "selected" : ""}
                    >
                      <td>
                        <strong>{organization.name}</strong>
                        <span className="admin-sub">
                          {organization.countryCode || "국가 미입력"}
                        </span>
                      </td>
                      <td>{labels[organization.type]}</td>
                      <td>
                        {organization.testAccess
                          ? "테스트 계정 예외"
                          : organization.submitted
                            ? "제출 완료"
                            : "미제출 / 보완 중"}
                      </td>
                      <td>{organization.reviewReason || "—"}</td>
                      <td>
                        <AdminButton onClick={() => onSelect(organization.id)}>
                          심사 보기
                          <ChevronRight size={16} />
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>계정</th>
                    <th>소속 회사 / 권한</th>
                    <th>이메일 인증</th>
                    <th>가입일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {!users.length && <EmptyRow />}
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name || "이름 없음"}</strong>
                        <span className="admin-sub">{user.email}</span>
                      </td>
                      <td>
                        {!user.organizations.length && (
                          <span className="admin-sub">소속 없음</span>
                        )}
                        {user.organizations.map((organization) => (
                          <div
                            key={organization.id}
                            className="admin-account-membership"
                          >
                            {organization.type === "PLATFORM" ? (
                              <strong>{organization.name}</strong>
                            ) : (
                              <AdminButton
                                className="admin-text-button"
                                onClick={() => onSelect(organization.id)}
                                aria-label={`${organization.name} 계정 관리`}
                              >
                                {organization.name}
                                <ChevronRight size={14} />
                              </AdminButton>
                            )}
                            <span className="admin-sub">
                              {labels[organization.type]} ·{" "}
                              {labels[organization.role]} ·{" "}
                              {labels[organization.status]}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td>{user.emailVerified ? "인증됨" : "미인증"}</td>
                      <td>{date(user.createdAt)}</td>
                      <td>
                        <AdminButton
                          disabled={
                            busy ||
                            user.id === userId ||
                            user.organizations.some(
                              (organization) =>
                                organization.type === "PLATFORM",
                            )
                          }
                          onClick={() =>
                            onOperation({
                              action: "revokeUserSessions",
                              id: user.id,
                              title: "계정 세션 종료",
                              message: `${user.email}의 로그인 세션을 모두 종료합니다. 계정은 삭제되지 않으며 비밀번호로 다시 로그인할 수 있습니다.`,
                            })
                          }
                        >
                          세션 종료
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {selected && (
            <section
              className="admin-account-detail"
              aria-label={reviewing ? "심사 상세" : "소속 회사 관리"}
            >
              <div className="admin-row">
                <h2>
                  {org?.name ?? (reviewing ? "심사 상세" : "소속 회사 관리")}
                </h2>
                <AdminButton
                  className="icon"
                  aria-label="상세 닫기"
                  onClick={() => onSelect("")}
                >
                  <X size={22} />
                </AdminButton>
              </div>
              {error ? (
                <p role="alert" className="admin-alert error">
                  {error}
                </p>
              ) : detailLoading || !org ? (
                <p role="status">회사 정보를 불러오는 중입니다…</p>
              ) : reviewing && org.status !== "PENDING" ? (
                <p className="admin-note">
                  현재 심사 대기 대상이 아닙니다. 이용 상태는 계정 관리에서
                  확인할 수 있습니다.
                </p>
              ) : (
                <>
                  <div className="admin-row">
                    {badge(org.status)}
                    <span>
                      {labels[org.type]}
                      {org.testAccess ? " · 테스트 계정" : ""}
                    </span>
                  </div>
                  <dl className="admin-fields">
                    {org.fields.map((field) => (
                      <div key={field.label}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {reviewing && (
                    <>
                      <h3>제출 문서</h3>
                      {org.documents.length ? (
                        <ul className="admin-documents">
                          {org.documents.map((doc) => (
                            <li key={doc.id}>
                              <div>
                                <strong>{doc.fileName}</strong>
                                <span>
                                  {labels[doc.kind] ?? doc.kind} ·{" "}
                                  {(doc.size / 1024).toFixed(0)} KB ·{" "}
                                  {labels[doc.state] ?? doc.state}
                                </span>
                              </div>
                              {doc.state === "UPLOADED" && (
                                <a href={`/api/admin/documents/${doc.id}`}>
                                  <Download size={16} />
                                  비공개 다운로드
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-note">제출된 문서가 없습니다.</p>
                      )}
                      {!org.submitted && !org.testAccess && (
                        <p className="admin-note">
                          회사 정보와 증빙 제출이 완료되면 승인할 수 있습니다.
                        </p>
                      )}
                    </>
                  )}
                  <div className="admin-actions">
                    {reviewing ? (
                      <>
                        <AdminButton
                          className="primary"
                          disabled={busy || (!org.submitted && !org.testAccess)}
                          onClick={() =>
                            act(
                              "approveOrganization",
                              "심사 승인",
                              `${org.name}의 심사를 승인하고 워크스페이스 접근 권한을 부여합니다.`,
                            )
                          }
                        >
                          <CheckCircle2 size={18} />
                          승인
                        </AdminButton>
                        <AdminButton
                          disabled={busy}
                          onClick={() =>
                            act(
                              "requestOrganizationChanges",
                              "회사 정보 보완 요청",
                              "기존 회사 정보와 문서는 보관되며 신청자가 회사 정보를 수정하고 다시 제출할 수 있습니다.",
                            )
                          }
                        >
                          보완 요청
                        </AdminButton>
                      </>
                    ) : (
                      <>
                        {org.status === "PENDING" && (
                          <AdminButton
                            onClick={() =>
                              onReview(org.id, org.type as AccountType)
                            }
                          >
                            심사 관리에서 확인
                            <ChevronRight size={16} />
                          </AdminButton>
                        )}
                        {org.status === "SUSPENDED" ? (
                          <AdminButton
                            className="primary"
                            disabled={
                              busy || (!org.submitted && !org.testAccess)
                            }
                            onClick={() =>
                              act(
                                "approveOrganization",
                                "계정 이용 재개",
                                `${org.name}의 회사 정보와 기존 심사 내용을 확인하고 워크스페이스 접근을 다시 허용합니다.`,
                              )
                            }
                          >
                            이용 재개
                          </AdminButton>
                        ) : (
                          <AdminButton
                            className="danger"
                            disabled={busy}
                            onClick={() =>
                              act(
                                "suspendOrganization",
                                "계정 이용 정지",
                                `${org.name}에 소속된 모든 계정의 조직 접근을 차단합니다. 브랜드의 모집 캠페인은 에이전시 검색에서 제외되며 기존 데이터는 보관됩니다.`,
                              )
                            }
                          >
                            이용 정지
                          </AdminButton>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </TabPanel>
      </Tab>
    </section>
  );
}

function EmptyRow({ reviewing = false }: { reviewing?: boolean }) {
  return (
    <tr>
      <td colSpan={5} className="admin-empty">
        <strong>
          {reviewing ? "심사 대기 대상이 없습니다." : "표시할 계정이 없습니다."}
        </strong>
        <span className="admin-sub">검색어나 탭을 변경해보세요.</span>
      </td>
    </tr>
  );
}
