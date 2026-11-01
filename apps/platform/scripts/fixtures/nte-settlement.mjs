export const NTE_SETTLEMENT_SEED = "nte-settlement-v1";
export const NTE_SETTLEMENT_PREFIX = "fm-demo-nte-settlement-v1";
export const nteSettlementScenarios = [
  {
    key: "ready",
    state: null,
    creator: "raon",
    title: "도시 탐험 캠페인 완료 대기",
    concept: "최종 성과를 확인한 뒤 관리자가 캠페인 완료 처리",
    price: "3200000.00",
  },
  {
    key: "draft",
    state: "DRAFT",
    creator: "moa",
    title: "에이본 스토리 청구·정산 검토",
    concept: "완료된 캠페인의 브랜드 청구와 에이전시 지급을 각각 검토",
    price: "2700000.00",
  },
  {
    key: "issued",
    state: "ISSUED",
    creator: "haru",
    title: "도시 하이라이트 청구·정산 발행",
    concept: "발행된 청구 내역과 지급 예정 내역을 수신 조직별로 확인",
    price: "1100000.00",
  },
  {
    key: "paid",
    state: "PAID",
    creator: "raon",
    title: "도시 탐험 입금·지급 확인",
    concept: "브랜드 입금 확인과 에이전시 지급 완료를 별도로 기록",
    price: "3200000.00",
  },
];
