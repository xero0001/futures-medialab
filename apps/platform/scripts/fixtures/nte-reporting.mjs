export const NTE_REPORTING_SEED = "nte-reporting-v1";
export const NTE_REPORTING_PREFIX = "fm-demo-nte-reporting-v1";
// This PV is linked from the official Korean NTE homepage. It is a reference,
// not a video created by the fictional campaign creators.
export const NTE_REFERENCE_POST = "https://youtu.be/lLmUGwqap6Y";
export const nteReportingScenarios = [
  {
    key: "waiting",
    state: "AWAITING_SUBMISSION",
    creator: "raon",
    title: "도시 탐험 게시 준비",
    concept: "승인된 콘텐츠의 게시 링크와 첫 보고서 등록",
    price: "3200000.00",
  },
  {
    key: "admin-review",
    state: "ADMIN_REVIEW",
    creator: "moa",
    title: "헤테로 시티 첫 성과",
    concept: "에이전시가 제출한 게시 링크와 성과를 운영팀에서 확인",
    price: "2700000.00",
  },
  {
    key: "agency-revision",
    state: "AGENCY_REVISION",
    creator: "haru",
    title: "이상한 순간 집계 보완",
    concept: "집계 기준과 누락 수치를 보완해 보고서 재제출",
    price: "1100000.00",
  },
  {
    key: "published-initial",
    state: "PUBLISHED",
    creator: "haru",
    title: "도시의 일상 게시 확인",
    concept: "게시 링크를 먼저 공개하고 성과 수치는 집계 중으로 표시",
    price: "1100000.00",
  },
  {
    key: "published",
    state: "PUBLISHED",
    creator: "raon",
    title: "에이본 탐험 성과 보고",
    concept: "두 차례 공개한 성과 보고서의 최신 수치와 버전 비교",
    price: "3200000.00",
  },
  {
    key: "update-review",
    state: "ADMIN_REVIEW",
    creator: "moa",
    title: "도시 탐험 추가 집계",
    concept:
      "추가 집계 보고서는 관리자 검토 중이며 브랜드에는 이전 공개본 유지",
    price: "2700000.00",
  },
];
export const emptyReportingMetrics = () => ({
  views: null,
  impressions: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  clicks: null,
});
export function nteReportingSnapshot(scene, version, now) {
  const collecting = scene.key === "published-initial";
  const asOf = new Date(
    now.getTime() - (version === 1 ? 86400000 : 3600000),
  ).toISOString();
  return {
    title: `[시연] ${scene.title} · ${collecting ? "게시 확인" : `성과 보고 v${version}`}`,
    postUrl: NTE_REFERENCE_POST,
    publishedAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
    metricsAsOf: collecting ? null : asOf,
    metrics: collecting
      ? emptyReportingMetrics()
      : version === 1
        ? {
            views: 18420,
            impressions: 28700,
            reach: 16300,
            likes: 932,
            comments: 87,
            shares: 104,
            saves: null,
            clicks: 0,
          }
        : {
            views: 34680,
            impressions: 51900,
            reach: 28100,
            likes: 1786,
            comments: 164,
            shares: 213,
            saves: null,
            clicks: 128,
          },
    evidenceUrl: null,
    note: `[내부 시연용 가상 성과 보고]\n${scene.concept}.\n\n게시 링크는 이환 공식 홈페이지에 연결된 공식 PV 참고 자료입니다. 가상 크리에이터가 제작·게시한 영상이 아니며, 등록한 게시 시각과 성과 수치는 내부 시연을 위해 만든 예시입니다. 실제 영상의 조회수나 실제 캠페인 성과를 나타내지 않습니다.\n\n${collecting ? "게시 확인 단계입니다. 성과 수치는 아직 집계하지 않았으며 0으로 대체하지 않습니다." : `집계 기준: 게시 이후 ${version === 1 ? "첫" : "추가"} 누적 성과 스냅샷. 저장 수는 미제공이며, 클릭 ${version === 1 ? "0은 확인된 0건" : "128은 가상 집계값"}입니다. 서로 다른 보고 버전의 누적 수치를 더하지 않습니다.`}`,
  };
}
