export type CampaignStatus = "제안 검토" | "제작 중" | "모집 중" | "완료" | "접수 완료";
export type DetailTab = "개요" | "제안·승인" | "제작·검수" | "성과" | "문서";
export type Campaign = {
  id: string;
  title: string;
  game: string;
  genre: string;
  route: "managed" | "open";
  status: CampaignStatus;
  budget: number;
  platform: string;
  date: string;
  goal: string;
  deliverables: string;
  initials: string;
  color: string;
  next: string;
  progress: number;
  selectedPlan?: string;
  note?: string;
  attachmentNames?: string[];
};

export const initialCampaigns: Campaign[] = [
  { id: "FM-26031", title: "오르빗 폴 한국 출시 캠페인", game: "ORBIT FALL", genre: "액션 RPG", route: "managed", status: "제안 검토", budget: 20000, platform: "YouTube · 치지직", date: "2026-11-20", goal: "한국 출시 인지도 확대와 사전예약 유입", deliverables: "라이브 3회 · VOD 3편 · 쇼츠 6편", initials: "OF", color: "violet", next: "공식 제안서 v2 검토", progress: 35 },
  { id: "FM-26028", title: "문가든 가을 업데이트", game: "MOONGARDEN", genre: "라이프 시뮬레이션", route: "managed", status: "제작 중", budget: 12000, platform: "YouTube · TikTok", date: "2026-11-08", goal: "신규 업데이트 체험과 복귀 이용자 유입", deliverables: "VOD 3편 · 쇼츠 6편", initials: "MG", color: "green", next: "콘텐츠 초안 1건 승인", progress: 65 },
  { id: "FM-26035", title: "프로젝트 노바 체험단", game: "PROJECT NOVA", genre: "전략 시뮬레이션", route: "open", status: "모집 중", budget: 9000, platform: "YouTube", date: "2026-11-25", goal: "다양한 플레이 스타일의 체험 콘텐츠 확보", deliverables: "VOD 6편", initials: "PN", color: "orange", next: "11월 6일 모집 마감", progress: 20 },
  { id: "FM-26019", title: "스텔라 런 시즌 오픈", game: "STELLAR RUN", genre: "캐주얼 액션", route: "managed", status: "완료", budget: 16000, platform: "YouTube · TikTok", date: "2026-10-21", goal: "신규 시즌 인지도 및 게임 방문 확대", deliverables: "VOD 4편 · 쇼츠 8편", initials: "SR", color: "blue", next: "최종 성과 보고서 발행", progress: 100 },
];

export const creators = [
  { id: "a", name: "플레이노트 (예시)", channel: "PLAYNOTE · EXAMPLE", category: "액션 RPG · 라이브", followers: "18.4만", average: "6.2만", share: 0.5, initials: "A", tone: "violet" },
  { id: "b", name: "레벨업 다이어리 (예시)", channel: "LEVELUP DIARY · EXAMPLE", category: "게임 리뷰 · 공략", followers: "9.8만", average: "3.8만", share: 0.3, initials: "B", tone: "green" },
  { id: "c", name: "온게임 스튜디오 (예시)", channel: "ONGAME STUDIO · EXAMPLE", category: "신작 체험 · 쇼츠", followers: "5.6만", average: "2.4만", share: 0.2, initials: "C", tone: "orange" },
];

export function creatorProduction(campaign: Campaign, creatorId: string) {
  if (campaign.id === "FM-26028") return { live: 0, vod: 1, shorts: 2 };
  if (campaign.id === "FM-26019") return creatorId === "a" ? { live: 0, vod: 2, shorts: 4 } : { live: 0, vod: 1, shorts: 2 };
  return { live: 1, vod: 1, shorts: 2 };
}

export function creatorProductionLabel(campaign: Campaign, creatorId: string) {
  const counts = creatorProduction(campaign, creatorId);
  return [counts.live > 0 ? `라이브 ${counts.live}회` : null, counts.vod > 0 ? `VOD ${counts.vod}편` : null, counts.shorts > 0 ? `쇼츠 ${counts.shorts}편` : null].filter(Boolean).join(" + ");
}

export function campaignProductionCount(campaign: Campaign) {
  return creators.reduce((total, creator) => {
    const counts = creatorProduction(campaign, creator.id);
    return total + counts.live + counts.vod + counts.shorts;
  }, 0);
}

export type Inquiry = { id: string; title: string; campaign: string; type: string; status: string; date: string; body: string; answer?: string };
export const initialInquiries: Inquiry[] = [
  { id: "RQ-104", title: "런칭 메시지의 한국어 표현 검토", campaign: "오르빗 폴 한국 출시 캠페인", type: "로컬라이징", status: "회신 도착", date: "11.01", body: "게임의 세계관을 살리면서 한국 시청자에게 자연스러운 런칭 메시지를 제안해 주세요.", answer: "핵심 기능을 먼저 보여주는 표현으로 정리했습니다. ‘새로운 세계가 시작됩니다’ 대신 실제 플레이 장면과 함께 ‘함께 공략하는 첫 번째 레이드’를 중심 메시지로 제안드립니다. 공식 제안서의 제작 가이드에도 반영했습니다." },
  { id: "RQ-101", title: "업데이트 영상의 게시 일정 확인", campaign: "문가든 가을 업데이트", type: "일정 변경", status: "처리 중", date: "10.30", body: "업데이트 배포 이후 영상이 게시되도록 일정을 확인해 주세요." },
  { id: "RQ-098", title: "시즌 오픈 캠페인 최종 보고서", campaign: "스텔라 런 시즌 오픈", type: "성과 분석", status: "처리 완료", date: "10.27", body: "집행 결과와 다음 시즌에 적용할 개선점을 확인하고 싶습니다.", answer: "캠페인 상세의 성과 탭에 최종 보고서를 정리했습니다. 숏폼의 유입 효율이 높았으며, 다음 캠페인에서는 숏폼 비중을 확대하는 구성을 제안드립니다." },
];

export const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
export const hasProposal = (campaign: Campaign) => ["제안 검토", "제작 중", "완료"].includes(campaign.status);
