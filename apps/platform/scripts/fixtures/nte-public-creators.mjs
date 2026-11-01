// Public channel references selected from the roster supplied by the user.
// These are campaign-planning examples, not confirmed bookings or rate cards.
export const NTE_CREATOR_REFERENCE_SEED = "nte-public-channels-v1";
export const NTE_CREATOR_ROSTER_URL = "https://futuresenter.com/";
export const NTE_CREATOR_CHECKED_AT = "2026-11-02";
export const ntePublicCreators = {
  raon: {
    name: "이다의게임방송",
    channelUrl:
      "https://www.youtube.com/@%EC%9D%B4%EB%8B%A4%EC%9D%98%EA%B2%8C%EC%9E%84%EB%B0%A9%EC%86%A1",
    followers: 144000,
    role: "직접 플레이와 전투·성장 동선 소개",
    concept:
      "헤테로 시티를 직접 탐험하며 전투, 이동, 초반 성장 동선을 설명하는 체험형 구성안",
  },
  moa: {
    name: "박서림",
    channelUrl: "https://www.youtube.com/@%EB%B0%95%EC%84%9C%EB%A6%BC",
    followers: 82900,
    role: "세계관과 도시 탐험 해설",
    concept:
      "에이본과 이상 현상, 도시의 주요 장소를 게임 스토리 입문자의 시선으로 정리하는 구성안",
  },
  haru: {
    name: "프레이 TV",
    channelUrl: "https://www.youtube.com/channel/UCSzHok6X5qXEO7cjvVnE62g",
    followers: 698000,
    role: "게임 플레이 하이라이트와 Shorts",
    concept:
      "도시 이동과 전투에서 발견한 인상적인 순간을 YouTube Shorts로 전달하는 구성안",
  },
};
export const ntePublicCreatorNotice =
  "[공개 채널을 참고한 내부 시연] 퓨처스엔터테인먼트 홈페이지에 소개된 실제 게임 크리에이터 채널을 참고한 후보 구성입니다. 이환 협업·출연·제작이 확정되었다는 의미가 아닙니다. 견적, 공급가, 일정, 승인, 게시·성과, 청구·정산은 모두 시연용 가상 데이터입니다.";

export function publicCreatorFields(key, originalDeliverables) {
  const creator = ntePublicCreators[key];
  if (!creator) throw new Error("UNKNOWN_DEMO_CREATOR_SLOT");
  return {
    creatorName: `${creator.name} · 시연 후보`,
    channelLabel: creator.name,
    channelUrl: creator.channelUrl,
    platform: "youtube",
    followers: creator.followers,
    averageViews: null,
    deliverables: `${originalDeliverables.replaceAll("TikTok", "YouTube Shorts")}\n제안 방향: ${creator.concept}. 실제 채널이 제작한 콘텐츠가 아닌 시연용 기획입니다.`,
  };
}

// Deliberately fixture-only: ordinary published proposals remain immutable.
// Rewrites only the named internal NTE demo snapshots, preserving IDs, approvals,
// versions, quantities, prices and production/reporting history, with an audit.
export async function applyNtePublicCreatorReferences(
  tx,
  adminId,
  campaignIds,
) {
  const updated = [];
  for (const campaignId of campaignIds) {
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      include: { proposals: { include: { items: true } } },
    });
    if (
      campaign.requirements?.demo !== true ||
      campaign.requirements?.seed !== "official-proposals-nte-v1" ||
      !campaignId.startsWith("fm-demo-nte-")
    )
      throw new Error("NOT_AN_AUTHORIZED_NTE_FIXTURE");
    if (
      campaign.requirements?.publicCreatorReferenceSeed ===
      NTE_CREATOR_REFERENCE_SEED
    )
      continue;
    for (const proposal of campaign.proposals) {
      for (const item of proposal.items) {
        const key = item.creatorId?.replace("fm-demo-nte-v1-creator-", "");
        const fields = publicCreatorFields(key, item.deliverables);
        const before = Object.fromEntries(
          Object.keys(fields).map((field) => [field, item[field]]),
        );
        await tx.proposalItem.update({ where: { id: item.id }, data: fields });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: "admin.demo.nte.creatorReference.correct",
            entityType: "ProposalItem",
            entityId: item.id,
            payload: {
              seed: NTE_CREATOR_REFERENCE_SEED,
              campaignId,
              sourceUrl: NTE_CREATOR_ROSTER_URL,
              checkedAt: NTE_CREATOR_CHECKED_AT,
              before,
              after: fields,
            },
          },
        });
      }
      await tx.campaignProposal.update({
        where: { id: proposal.id },
        data: {
          summary: `${proposal.summary}\n\n${ntePublicCreatorNotice}`,
          terms: `${proposal.terms}\n\n${ntePublicCreatorNotice}\n채널 확인: ${NTE_CREATOR_CHECKED_AT}. 구독자 수는 YouTube 공개 표시값의 근사치이며 평균 조회수는 미검증으로 제공하지 않습니다. 공급 조직은 내부 테스트용 연결입니다. 출처: ${NTE_CREATOR_ROSTER_URL}`,
        },
      });
    }
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        platforms: ["youtube"],
        requirements: {
          ...campaign.requirements,
          publicCreatorReferenceSeed: NTE_CREATOR_REFERENCE_SEED,
        },
      },
    });
    updated.push(campaignId);
  }
  return updated;
}
