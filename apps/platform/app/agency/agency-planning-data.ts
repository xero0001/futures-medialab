export type Creator = {
  channels?: { platform: string; channel: string }[];
  id: string;
  name: string;
  channel: string;
  platform: string;
  genre: string;
  followers: number;
  format: string;
  rate: number;
  available: string;
  acceptance: string;
  updated: string;
  bio: string;
  color: string;
};
export type ApplicationLine = {
  creatorName?: string;
  channel?: string;
  id: string;
  creatorId: string;
  platform: string;
  format: string;
  quantity: number;
  rate: number;
  date: string;
  status: string;
};
export type LocalApplication = {
  canEdit?: boolean;
  platforms?: string[];
  supplierRateCap?: string | null;
  canWithdraw?: boolean;
  id: string;
  campaignId: string;
  title: string;
  currency: string;
  note: string;
  updated: string;
  status: string;
  lines: ApplicationLine[];
};
export type Invitation = {
  id: string;
  title: string;
  category: string;
  creatorIds: string[];
  platforms: string[];
  format: string;
  quantity: number;
  rate: number;
  deadline: string;
  start: string;
  end: string;
  rights: string;
  brief: string;
  status: string;
  response: string;
};
export type ThreadMessage = {
  id: string;
  sender: "agency" | "futures";
  text: string;
  time: string;
  files?: string[];
};
export type PartnerRequest = {
  id: string;
  subject: string;
  category: string;
  related: string;
  status: string;
  messages: ThreadMessage[];
};
export const platforms = ["YouTube", "치지직", "SOOP", "TikTok", "Instagram"];
export const formats = ["라이브", "VOD", "쇼츠", "커뮤니티"];
export const initialCreators: Creator[] = [
  {
    id: "lumi",
    name: "루미 플레이",
    channel: "https://example.com/channels/lumi",
    platform: "YouTube",
    genre: "RPG · 서브컬처",
    followers: 128000,
    format: "VOD",
    rate: 1800000,
    available: "2026-11-16",
    acceptance: "검토 가능",
    updated: "2026-11-04",
    bio: "스토리 중심 게임 리뷰와 첫 플레이 콘텐츠를 제작합니다.",
    color: "#e9e3ff",
  },
  {
    id: "haru",
    name: "하루게임",
    channel: "https://example.com/channels/haru",
    platform: "치지직",
    genre: "액션 · 어드벤처",
    followers: 67000,
    format: "라이브",
    rate: 1200000,
    available: "2026-11-19",
    acceptance: "조건 협의",
    updated: "2026-11-02",
    bio: "시청자와 함께하는 라이브 플레이를 진행합니다. 주중 저녁 방송 협의가 가능합니다.",
    color: "#dff2e8",
  },
  {
    id: "pixel",
    name: "픽셀 노트",
    channel: "https://example.com/channels/pixel",
    platform: "SOOP",
    genre: "전략 · 인디",
    followers: 42000,
    format: "라이브",
    rate: 900000,
    available: "2026-11-23",
    acceptance: "검토 가능",
    updated: "2026-07-12",
    bio: "전략 게임과 인디 게임 소개를 진행합니다. 공급 조건을 새로 확인해 주세요.",
    color: "#ffeadb",
  },
  {
    id: "mori",
    name: "모리의 게임일기",
    channel: "https://example.com/channels/mori",
    platform: "TikTok",
    genre: "캐주얼 · 일상",
    followers: 210000,
    format: "쇼츠",
    rate: 600000,
    available: "2026-11-12",
    acceptance: "진행 불가",
    updated: "2026-11-01",
    bio: "짧은 게임 공략과 하이라이트 영상을 제작합니다.",
    color: "#e1ecff",
  },
];
export const initialInvitations: Invitation[] = [
  {
    id: "inv-101",
    title: "신작 RPG · 첫 플레이 캠페인",
    category: "RPG · 비공개 모집",
    creatorIds: ["lumi", "haru"],
    platforms: ["YouTube", "치지직"],
    format: "VOD",
    quantity: 1,
    rate: 1800000,
    deadline: "2026-11-12",
    start: "2026-11-16",
    end: "2026-11-23",
    rights: "브랜드 공식 채널에 3개월 게시 · 유료 광고 활용은 별도 협의",
    brief:
      "신작 게임의 초반 플레이 경험과 주요 콘텐츠를 소개합니다. 광고주와 게임 정보는 공개가 승인된 범위에서 퓨처스가 안내합니다. 가이드와 제공 자료를 확인한 뒤 제작을 시작해 주세요.",
    status: "pending",
    response: "",
  },
  {
    id: "inv-102",
    title: "전략 게임 · 라이브 체험",
    category: "전략 · 초청형",
    creatorIds: ["pixel"],
    platforms: ["SOOP"],
    format: "라이브",
    quantity: 1,
    rate: 900000,
    deadline: "2026-11-14",
    start: "2026-11-23",
    end: "2026-11-26",
    rights: "콘텐츠 180일 유지 · 2차 편집 및 광고 소재 활용 제외",
    brief:
      "라이브 플레이와 시청자 Q&A를 진행합니다. 방송 일정과 경쟁 게임 협업 여부를 확인해 주세요.",
    status: "negotiating",
    response: "11월 24일 저녁 방송으로 일정 조정을 요청합니다.",
  },
  {
    id: "inv-103",
    title: "캐주얼 게임 · 하이라이트 영상",
    category: "캐주얼 · 초청형",
    creatorIds: ["mori"],
    platforms: ["TikTok"],
    format: "쇼츠",
    quantity: 2,
    rate: 600000,
    deadline: "2026-11-01",
    start: "2026-11-08",
    end: "2026-11-12",
    rights: "원본 게시 채널 내 활용",
    brief: "게임의 핵심 플레이를 짧은 영상으로 소개합니다.",
    status: "expired",
    response: "",
  },
];
export const initialApplications: LocalApplication[] = [
  {
    id: "app-example-1",
    campaignId: "sample-autumn",
    title: "오로라 온라인 · 가을 플레이 캠페인",
    currency: "KRW",
    note: "크리에이터별 가능 일정으로 제안드립니다.",
    updated: "2026-11-04",
    status: "review",
    lines: [
      {
        id: "line-1",
        creatorId: "lumi",
        platform: "YouTube",
        format: "VOD",
        quantity: 1,
        rate: 1800000,
        date: "2026-11-18",
        status: "brand_pending",
      },
      {
        id: "line-2",
        creatorId: "haru",
        platform: "치지직",
        format: "라이브",
        quantity: 1,
        rate: 1200000,
        date: "2026-11-20",
        status: "review",
      },
      {
        id: "line-3",
        creatorId: "pixel",
        platform: "SOOP",
        format: "라이브",
        quantity: 1,
        rate: 900000,
        date: "2026-11-24",
        status: "not_selected",
      },
    ],
  },
  {
    id: "app-example-2",
    campaignId: "sample-winter",
    title: "윈터 가든 · 숏폼 크리에이터 모집",
    currency: "KRW",
    note: "",
    updated: "2026-11-03",
    status: "draft",
    lines: [
      {
        id: "line-4",
        creatorId: "mori",
        platform: "TikTok",
        format: "쇼츠",
        quantity: 2,
        rate: 600000,
        date: "2026-11-22",
        status: "draft",
      },
    ],
  },
];
export const initialRequests: PartnerRequest[] = [
  {
    id: "req-101",
    subject: "라이브 방송 일정 변경 문의",
    category: "일정 변경",
    related: "전략 게임 · 라이브 체험",
    status: "waiting",
    messages: [
      {
        id: "msg-1",
        sender: "agency",
        text: "픽셀 노트의 방송 일정을 11월 24일 저녁으로 조정할 수 있을까요?",
        time: "2026-11-04T09:20:00+09:00",
      },
      {
        id: "msg-2",
        sender: "futures",
        text: "가능한 시간대와 예상 방송 길이를 알려주시면 제작 일정과 함께 확인하겠습니다.",
        time: "2026-11-04T14:30:00+09:00",
      },
    ],
  },
  {
    id: "req-102",
    subject: "콘텐츠 활용 범위 확인",
    category: "제작 조건",
    related: "신작 RPG · 첫 플레이 캠페인",
    status: "progress",
    messages: [
      {
        id: "msg-3",
        sender: "agency",
        text: "공식 채널 재게시 시 별도 편집이 포함되는지 확인 부탁드립니다.",
        time: "2026-11-05T10:00:00+09:00",
      },
    ],
  },
  {
    id: "req-103",
    subject: "지난 캠페인 정산 문서 확인",
    category: "정산 문의",
    related: "예시 캠페인 · 정산",
    status: "resolved",
    messages: [
      {
        id: "msg-4",
        sender: "futures",
        text: "발행된 정산 문서를 확인하실 수 있습니다. 추가 문의가 있으면 이 대화에서 이어서 말씀해 주세요.",
        time: "2026-11-02T11:00:00+09:00",
      },
    ],
  },
];
