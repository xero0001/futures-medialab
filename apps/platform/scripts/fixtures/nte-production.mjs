export const NTE_PRODUCTION_SEED = "nte-production-v1";
export const NTE_PRODUCTION_PREFIX = "fm-demo-nte-production-v1";
export const NTE_ART = {
  coverImageUrl: "/demo/nte/city-key-art.jpg",
  iconUrl: "/demo/nte/game-icon.png",
  sourceUrl: "https://nte.perfectworld.com/kr/",
  imageSourceUrl: "https://nte.perfectworld.com/kr/images/main260402/slide1.jpg",
  credit: "© Hotta Studio, a Perfect World Company.",
};

export const nteProductionScenarios = [
  { key: "waiting", state: "AWAITING_SUBMISSION", creator: "raon", title: "헤테로 시티 첫 산책", deliverables: "헤테로 시티 탐험 영상 8~10분 1편", concept: "도시의 일상에서 시작해 처음 마주치는 이상 현상으로 자연스럽게 연결하는 탐험 구성", price: "3200000.00" },
  { key: "admin-review", state: "ADMIN_REVIEW", creator: "moa", title: "이상 현상 탐험 노트", deliverables: "이상 현상 입문 가이드 영상 6~8분 1편", concept: "초보 이용자가 도시의 변화와 이상 사건을 발견하는 순서에 맞춘 입문 가이드", price: "2700000.00" },
  { key: "agency-revision", state: "AGENCY_REVISION", creator: "haru", title: "도시의 색을 담는 45초", deliverables: "도시 탐험 세로 영상 30~45초 1편", concept: "평온한 거리와 초자연적 순간의 대비를 첫 3초 안에 보여 주는 숏폼", price: "1100000.00" },
  { key: "brand-review", state: "BRAND_REVIEW", creator: "raon", title: "에이본의 하루", deliverables: "에이본과 도시 탐험을 소개하는 영상 8~10분 1편", concept: "에이본에서 시작해 도시를 돌아보며 이환의 일상과 초자연 세계관을 소개하는 하루", price: "3200000.00" },
  { key: "brand-revision", state: "BRAND_REVISION", creator: "moa", title: "도시 속 반전 찾기", deliverables: "이환 첫 탐험 가이드 영상 6~8분 1편", concept: "도시 일상 속 작은 반전을 찾아가는 탐험으로 신규 이용자의 호기심을 유도하는 가이드", price: "2700000.00" },
  { key: "approved", state: "APPROVED", creator: "haru", title: "초보 감정사 체크리스트", deliverables: "초보 이용자 팁 세로 영상 30~45초 1편", concept: "처음 접속한 이용자가 도시와 에이본을 알아가는 세 가지 관찰 포인트를 정리한 숏폼", price: "1100000.00" },
];

export function nteProductionNote(scenario, version = 1) {
  return `[내부 시연용 콘텐츠 구성안 · v${version}]
${scenario.concept}

01 오프닝: 헤테로 시티의 거리와 캐릭터가 등장하는 공식 이미지를 참고해 첫 장면을 구성합니다.
02 본문: 도시 탐험 → 초자연적 사건 발견 → 에이본과 이상 헌터의 세계관 순서로 설명합니다.
03 마무리: ‘당신이 발견한 도시의 이상한 순간은?’이라는 질문과 이환 공식 사이트 안내로 마무리합니다.

검수 항목: 게임명 ‘이환’ 표기, 한국어 자막 가독성, 실제 플레이와 연출의 구분, 음원·이미지 이용 범위, 광고 표기 위치.
${version > 1 ? "수정 반영: 도입부를 3초로 줄이고 게임명 자막과 공식 사이트 안내를 선명하게 배치했습니다.\n" : ""}
첨부 링크는 이환 공식 참고 이미지입니다. 이 구성안과 검수 이력은 가상의 내부 시연 자료이며 실제 크리에이터 제작 영상이 아닙니다.`;
}
