// Game context comes from the official NTE site. Campaigns, creators, pricing,
// deliverables and approvals below are fictional internal demonstration data.
export const NTE_SEED = "official-proposals-nte-v1";
export const NTE_PREFIX = "fm-demo-nte-v1";
export const NTE_GAME = {
  name: "이환 (Neverness to Everness)",
  officialUrl: "https://nte.perfectworld.com/kr/",
  sourceUrl:
    "https://nte.perfectworld.com/kr/article/news/gamebroad/20260426/261934.html",
  genre: "초자연 어반 오픈월드 RPG",
};

export const nteCreators = [
  {
    key: "raon",
    name: "라온 플레이 · 시연",
    platform: "youtube",
    channelUrl: "https://example.invalid/nte-demo/raon",
    category: "오픈월드 탐험·게임 리뷰",
    description: "도시 탐험과 첫 플레이 동선을 소개하는 가상 크리에이터입니다.",
  },
  {
    key: "moa",
    name: "모아 게임노트 · 시연",
    platform: "youtube",
    channelUrl: "https://example.invalid/nte-demo/moa",
    category: "서브컬처·초보자 가이드",
    description: "게임의 세계관과 초보자 가이드를 정리하는 가상 크리에이터입니다.",
  },
  {
    key: "haru",
    name: "하루 시티워크 · 시연",
    platform: "tiktok",
    channelUrl: "https://example.invalid/nte-demo/haru",
    category: "게임 숏폼·도시 풍경",
    description: "도시 풍경과 재미있는 플레이 순간을 담는 가상 크리에이터입니다.",
  },
];

export const nteCampaigns = [
  {
    key: "private",
    state: "DRAFT",
    title: "[시연] 이환 · 헤테로 시티 탐험 제안 준비",
    goal: "헤테로 시티의 일상과 초자연적 사건을 처음 접하는 한국 이용자에게 소개합니다.",
    summary: "도시 탐험, 이상 사건, 에이본의 의뢰를 중심으로 이환의 매력을 소개하는 내부 시연 캠페인입니다. 관리자 초안 단계에서는 브랜드에 크리에이터가 공개되지 않습니다.",
    budgetAmount: "9600000.00",
    desiredDays: 35,
    format: "YouTube 탐험 영상 2편 + TikTok 숏폼 2편",
    note: "발행 전 비공개를 확인하는 시연입니다. 게임사와의 실제 계약·제휴나 출연 확정을 의미하지 않습니다.",
    items: [
      { creator: "raon", deliverables: "헤테로 시티 탐험 영상 8~10분 1편", quantity: 1, unitPrice: "3200000.00" },
      { creator: "moa", deliverables: "에이본·이상 헌터 세계관 입문 영상 6~8분 1편", quantity: 1, unitPrice: "2800000.00" },
      { creator: "haru", deliverables: "도시 풍경과 이상 현상을 담은 세로 영상 30~45초", quantity: 2, unitPrice: "1100000.00" },
    ],
  },
  {
    key: "review",
    state: "PUBLISHED",
    title: "[시연] 이환 · 한국 크리에이터 도시 탐험",
    goal: "한국 게임 이용자가 헤테로 시티의 탐험과 초자연 어반 판타지 세계관을 이해하도록 돕습니다.",
    summary: "탐험 중심의 장편 영상과 세계관 입문 콘텐츠를 제안합니다. 운영팀이 공식 제안을 발행했으며, 브랜드가 항목별 조건을 확인하고 승인할 수 있는 시연입니다.",
    budgetAmount: "6800000.00",
    desiredDays: 40,
    format: "YouTube 장편 영상 2편",
    note: "브랜드 승인 대기 시연입니다. 승인 기록은 내부 시연용이며 지급·계약 체결을 실행하지 않습니다.",
    items: [
      { creator: "raon", deliverables: "헤테로 시티 첫 탐험 영상 8~10분 1편", quantity: 1, unitPrice: "3200000.00" },
      { creator: "moa", deliverables: "이상 헌터 입문 가이드 영상 6~8분 1편", quantity: 1, unitPrice: "2700000.00" },
    ],
  },
  {
    key: "revision",
    state: "CHANGES_REQUESTED",
    title: "[시연] 이환 · 도시의 이상한 순간 숏폼",
    goal: "게임의 도시 분위기와 초자연적 순간을 짧은 영상으로 전달합니다.",
    summary: "도시 탐험 숏폼과 입문 영상으로 구성한 제안입니다. 브랜드가 영상 길이와 메시지 보완을 요청했으며, 운영팀이 새 버전을 발행하는 과정을 시연합니다.",
    budgetAmount: "5400000.00",
    desiredDays: 45,
    format: "TikTok 숏폼 2편 + YouTube 입문 영상 1편",
    note: "수정 요청과 재발행 시연입니다. 기존 발행 버전은 수정하지 않고 새 버전을 작성합니다.",
    changeReason: "숏폼 첫 3초에 헤테로 시티와 이상 현상의 대비를 넣고, 영상 길이를 30~45초로 맞춰 주세요. 장편은 초보자 동선을 먼저 보여 주세요.",
    items: [
      { creator: "haru", deliverables: "도시의 이상한 순간 세로 영상 30~60초", quantity: 2, unitPrice: "950000.00" },
      { creator: "moa", deliverables: "세계관 중심 입문 영상 6~8분 1편", quantity: 1, unitPrice: "2500000.00" },
    ],
  },
  {
    key: "approved",
    state: "APPROVED",
    title: "[시연] 이환 · 초보 감정사 가이드",
    goal: "처음 이환을 접한 이용자에게 도시 탐험과 에이본 의뢰를 이해하기 쉬운 흐름으로 안내합니다.",
    summary: "입문 가이드와 요약 숏폼 구성에 브랜드 승인이 완료된 시연입니다. 승인된 크리에이터와 조건 및 승인 이력을 확인할 수 있습니다.",
    budgetAmount: "8400000.00",
    desiredDays: 50,
    format: "YouTube 가이드 2편 + TikTok 요약 영상 2편",
    note: "승인 완료 시연입니다. 실제 제작물·조회수·정산 기록은 생성하지 않습니다.",
    items: [
      { creator: "raon", deliverables: "도시 탐험 입문 가이드 영상 8~10분 1편", quantity: 1, unitPrice: "3000000.00" },
      { creator: "moa", deliverables: "에이본 의뢰와 세계관 가이드 영상 6~8분 1편", quantity: 1, unitPrice: "2600000.00" },
      { creator: "haru", deliverables: "초보 감정사 팁 세로 영상 30~45초", quantity: 2, unitPrice: "900000.00" },
    ],
  },
];
