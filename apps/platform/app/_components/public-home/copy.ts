import type { Locale } from "../landing-copy";

const ko = {
  title: "한국 게임 마케팅 | Futures Medialab",
  description:
    "글로벌 게임과 한국의 팬을 연결합니다. 캠페인 기획, 콘텐츠 현지화, 파트너 운영을 Futures Medialab과 함께하세요.",
  nav: {
    explore: "캠페인 아이디어",
    how: "이용 방법",
    partners: "파트너 안내",
    contact: "문의",
    login: "로그인",
    join: "시작하기",
    language: "언어",
    menu: "메뉴 열기",
    close: "메뉴 닫기",
    skip: "본문으로 바로가기",
  },
  hero: {
    eyebrow: "GLOBAL GAMES. KOREAN AUDIENCES.",
    lines: ["좋은 게임이,", "한국의 팬을 만나는 곳."],
    body: "게임의 매력을 한국 시장의 언어와 콘텐츠로 연결합니다. 캠페인 기획부터 현지화, 파트너 운영까지 함께합니다.",
    primary: "브랜드·대행사로 시작",
    secondary: "공급 파트너 입주 신청",
    approval: "조직 심사 승인 후 플랫폼을 이용할 수 있습니다.",
  },
  quick: [
    {
      title: "함께 알리고 싶은 게임이 있나요?",
      body: "브랜드·광고 대행사의 다음 캠페인을 시작하세요.",
    },
    {
      title: "함께 성장할 크리에이터가 있나요?",
      body: "MCN·에이전시의 새로운 협업 기회를 만나보세요.",
    },
  ],
  discovery: {
    title: "어떤 게임을 알려볼까요?",
    carousel: "캐러셀",
    slide: "슬라이드",
    loginTitle: "로그인하고 협업을 시작해보세요",
    loginBody: "캠페인 준비부터 협업 제안까지, Futures Medialab에서 시작하세요.",
    loginAction: "로그인하고 시작하기",
    action: "협업 시작 안내",
    close: "안내 닫기",
  },
  campaigns: [
    {
      id: "genshin",
      title: "원신",
      genre: "오픈월드 RPG",
      body: "티바트의 풍경과 원소 전투, 캐릭터의 이야기를 탐험 콘텐츠로 풀어냅니다.",
      ideas: [
        "지역 탐험과 숨은 명소",
        "원소 반응 플레이 가이드",
        "캐릭터 스토리 리액션",
      ],
    },
    {
      id: "star-rail",
      title: "붕괴: 스타레일",
      genre: "턴제 RPG",
      body: "은하열차를 타고 만나는 세계와 동료들. 스토리 감상과 전략적인 파티 플레이를 연결합니다.",
      ideas: [
        "개척 임무 스토리 감상",
        "캐릭터와 파티 조합 소개",
        "턴제 전투 전략 가이드",
      ],
    },
    {
      id: "wuthering-waves",
      title: "명조: 워더링 웨이브",
      genre: "오픈월드 액션 RPG",
      body: "솔라리스의 탐험과 속도감 있는 전투. 공명자들의 액션을 생생한 플레이로 전합니다.",
      ideas: [
        "오픈월드 탐험 라이브",
        "회피와 반격 플레이 가이드",
        "공명자 조합과 전투 하이라이트",
      ],
    },
    {
      id: "zenless",
      title: "젠레스 존 제로",
      genre: "어반 판타지 액션 RPG",
      body: "뉴에리두의 일상과 공동 속 전투. 개성 있는 캐릭터와 연계 액션을 콘텐츠로 소개합니다.",
      ideas: [
        "뉴에리두 첫 탐방",
        "캐릭터 연계 액션 가이드",
        "전투 하이라이트 숏폼",
      ],
    },
    {
      id: "nte",
      title: "이환",
      genre: "어반 오픈월드 RPG",
      body: "초자연적인 사건과 도시의 일상이 만나는 세계. 크리에이터의 시선으로 새로운 도시를 탐험합니다.",
      ideas: [
        "도시 탐험과 일상 플레이",
        "초자연 사건 스토리 리액션",
        "캐릭터 첫인상 콘텐츠",
      ],
    },
    {
      id: "once-human",
      title: "원스 휴먼",
      genre: "오픈월드 생존",
      body: "기묘한 크리처가 등장하는 세계에서 탐험하고 기지를 건설합니다. 친구들과 함께하는 생존 과정을 콘텐츠로 전합니다.",
      ideas: [
        "협동 생존 플레이",
        "나만의 기지 건설",
        "보스 공략과 탐험 하이라이트",
      ],
    },
    {
      id: "infinity-nikki",
      title: "인피니티 니키",
      genre: "오픈월드 드레스업 어드벤처",
      body: "의상의 능력으로 새로운 길을 찾고 아름다운 풍경을 탐험합니다. 스타일링과 사진 촬영으로 모험의 순간을 담아냅니다.",
      ideas: ["스타일링과 의상 소개", "풍경 사진 촬영", "퍼즐과 오픈월드 탐험"],
    },
    {
      id: "naraka",
      title: "나라카: 블레이드포인트",
      genre: "무협 액션 배틀로얄",
      body: "근접 전투와 영웅의 기술로 승부하는 무협 액션. 팀워크와 빠른 판단이 빛나는 대결을 생생하게 전합니다.",
      ideas: [
        "영웅과 무기 플레이 가이드",
        "팀 배틀로얄 라이브",
        "근접 전투 하이라이트",
      ],
    },
  ],
  workflow: {
    eyebrow: "HOW IT WORKS",
    title: "아이디어에서 협업까지, 명확하게.",
    body: "캠페인을 공유하고, 제안을 검토하고, 함께할 파트너를 선택하세요.",
    steps: [
      {
        title: "캠페인을 알려주세요",
        body: "브랜드·광고 대행사가 목표, 콘텐츠 방향, 예산과 일정을 담아 캠페인을 등록합니다.",
      },
      {
        title: "파트너의 제안을 만나보세요",
        body: "플랫폼 검토 후 승인된 MCN·에이전시가 캠페인을 확인하고 제안을 보냅니다.",
      },
      {
        title: "함께할 팀을 선택하세요",
        body: "제안을 비교하고 파트너를 선택합니다. 요청사항과 진행 과정은 플랫폼에서 조율합니다.",
      },
    ],
  },
  partners: {
    title: "게임과 크리에이터,\n함께 만드는 다음 이야기.",
    body: "브랜드의 목표와 크리에이터의 가능성을 하나의 캠페인으로 연결합니다.",
    items: [
      {
        label: "브랜드·광고 대행사",
        title: "게임의 매력을 한국의 팬에게",
        body: "캠페인을 기획하고, 함께 실행할 크리에이터 파트너를 만나세요.",
        cta: "캠페인 시작하기",
      },
      {
        label: "MCN·에이전시",
        title: "크리에이터의 다음 기회를 함께",
        body: "소속 크리에이터에게 맞는 게임 캠페인을 찾고 협업을 제안하세요.",
        cta: "파트너로 참여하기",
      },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "궁금한 점이 있나요?",
    body: "시작하기 전에 확인해보세요.",
    items: [
      {
        question: "누가 가입할 수 있나요?",
        answer:
          "게임사·퍼블리셔와 캠페인을 의뢰하는 광고 대행사는 브랜드·대행사 경로로 가입할 수 있습니다. 크리에이터와 콘텐츠를 공급하는 MCN·에이전시는 공급 파트너 경로로 신청해주세요. 모든 조직은 심사 승인 후 플랫폼을 이용할 수 있습니다.",
      },
      {
        question: "메인페이지의 캠페인은 실제 모집 중인가요?",
        answer:
          "메인페이지는 게임별 콘텐츠와 협업 아이디어를 소개합니다. 실제 모집 중인 캠페인은 승인 후 서비스에서 확인할 수 있습니다.",
      },
      {
        question: "캠페인은 어떤 과정을 거쳐 공개되나요?",
        answer:
          "브랜드·광고 대행사가 캠페인 정보를 등록하면 플랫폼에서 내용을 검토합니다. 검토를 마친 캠페인은 승인된 공급 파트너에게 공개되며, 파트너의 제안을 받은 뒤 함께할 팀을 선택할 수 있습니다.",
      },
    ],
  },
  final: {
    title: "우리 게임의 다음 캠페인을 시작해볼까요?",
    body: "한국의 크리에이터와 함께 게임의 매력을 전해보세요.",
    cta: "캠페인 시작하기",
  },
  contact: {
    title: "한국 캠페인을 준비하고 계신가요?",
    body: "게임과 목표를 알려주세요. 함께할 방법을 이야기하겠습니다.",
    email: "이메일",
    emailPlaceholder: "이메일 입력 위치",
    wechatPlaceholder: "WeChat ID 위치",
  },
  footer: "글로벌 게임과 한국 시장을 연결합니다.",
};

export type HomeCopy = typeof ko;
const en: HomeCopy = {
  title: "Game marketing in Korea | Futures Medialab",
  description:
    "Connecting global games with Korean audiences. Campaign planning, localization and partner coordination with Futures Medialab.",
  nav: {
    explore: "Campaign ideas",
    how: "How it works",
    partners: "For partners",
    contact: "Contact",
    login: "Log in",
    join: "Get started",
    language: "Language",
    menu: "Open menu",
    close: "Close menu",
    skip: "Skip to content",
  },
  hero: {
    eyebrow: "GLOBAL GAMES. KOREAN AUDIENCES.",
    lines: ["Great games.", "Meet your next fans."],
    body: "Bring your game's world closer to Korean audiences. From campaign planning and localization to finding and coordinating the right partners.",
    primary: "Start as a brand or agency",
    secondary: "Apply as a creator partner",
    approval: "Platform access is available after organization approval.",
  },
  quick: [
    {
      title: "A game worth sharing?",
      body: "Start your next campaign as a brand or advertising agency.",
    },
    {
      title: "A team full of talent?",
      body: "Find your next collaboration as an MCN or creator partner.",
    },
  ],
  discovery: {
    title: "Imagine your next collaboration.",
    carousel: "carousel",
    slide: "slide",
    loginTitle: "Log in to start collaborating",
    loginBody:
      "From planning campaigns to proposing collaborations, get started with Futures Medialab.",
    loginAction: "Log in to get started",
    action: "See how to start collaborating",
    close: "Close dialog",
  },
  campaigns: [
    {
      id: "genshin",
      title: "Genshin Impact",
      genre: "Open-world RPG",
      body: "Explore Teyvat through its landscapes, elemental combat and character stories.",
      ideas: [
        "World exploration and hidden locations",
        "Elemental reaction guides",
        "Character story reactions",
      ],
    },
    {
      id: "star-rail",
      title: "Honkai: Star Rail",
      genre: "Turn-based RPG",
      body: "Follow the Astral Express through new worlds, stories and strategic team battles.",
      ideas: [
        "Trailblaze story reactions",
        "Character and team introductions",
        "Turn-based combat guides",
      ],
    },
    {
      id: "wuthering-waves",
      title: "Wuthering Waves",
      genre: "Open-world action RPG",
      body: "Discover Solaris through exploration and fast-paced Resonator combat.",
      ideas: [
        "Open-world exploration streams",
        "Dodge and counter guides",
        "Resonator teams and combat highlights",
      ],
    },
    {
      id: "zenless",
      title: "Zenless Zone Zero",
      genre: "Urban fantasy action RPG",
      body: "Discover daily life in New Eridu and stylish team combat inside the Hollows.",
      ideas: [
        "First impressions of New Eridu",
        "Character combo guides",
        "Short-form combat highlights",
      ],
    },
    {
      id: "nte",
      title: "Neverness to Everness",
      genre: "Urban open-world RPG",
      body: "Explore a city where supernatural encounters meet everyday life.",
      ideas: [
        "City exploration and daily life",
        "Supernatural story reactions",
        "Character first impressions",
      ],
    },
    {
      id: "once-human",
      title: "Once Human",
      genre: "Open-world survival",
      body: "Explore a strange world, build a base and share survival adventures with friends.",
      ideas: [
        "Co-op survival streams",
        "Creative base-building",
        "Boss fights and exploration highlights",
      ],
    },
    {
      id: "infinity-nikki",
      title: "Infinity Nikki",
      genre: "Open-world dress-up adventure",
      body: "Discover new paths through outfit abilities, scenic exploration and creative styling.",
      ideas: [
        "Outfit styling showcases",
        "Scenic photography",
        "Puzzles and open-world exploration",
      ],
    },
    {
      id: "naraka",
      title: "NARAKA: BLADEPOINT",
      genre: "Martial arts battle royale",
      body: "Showcase fast-paced melee combat, unique hero skills and coordinated team battles.",
      ideas: [
        "Hero and weapon guides",
        "Team battle royale streams",
        "Melee combat highlights",
      ],
    },
  ],
  workflow: {
    eyebrow: "HOW IT WORKS",
    title: "A clear path from idea to collaboration.",
    body: "Share a brief, review proposals and choose your next partner.",
    steps: [
      {
        title: "Tell us about your campaign",
        body: "Brands and advertising agencies share their goals, content direction, budget and schedule.",
      },
      {
        title: "Meet your potential partners",
        body: "After platform review, approved MCNs and agencies can explore the campaign and send proposals.",
      },
      {
        title: "Choose your next team",
        body: "Compare proposals and select a partner. Coordinate requests and progress through the platform.",
      },
    ],
  },
  partners: {
    title: "Great games. Creative people.\nOne story, together.",
    body: "Connect your brand's goals with creators through a campaign built together.",
    items: [
      {
        label: "Brands & advertising agencies",
        title: "Bring your game to Korean fans",
        body: "Plan your campaign and meet creator partners who can bring it to life.",
        cta: "Start a campaign",
      },
      {
        label: "MCNs & creator agencies",
        title: "Find your creators' next opportunity",
        body: "Discover game campaigns that fit your creators and propose a collaboration.",
        cta: "Join as a partner",
      },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "A few things to know.",
    body: "Before your next connection.",
    items: [
      {
        question: "Who can join?",
        answer:
          "Game studios, publishers and advertising agencies commissioning campaigns can join through the brand and agency route. MCNs and agencies supplying creators and content can apply through the creator partner route. All organizations require approval before using the platform.",
      },
      {
        question: "Are these campaigns open for applications?",
        answer:
          "The homepage introduces game content and collaboration ideas. Campaigns currently accepting applications are available within the service after approval.",
      },
      {
        question: "How does a campaign get published?",
        answer:
          "A brand or advertising agency submits a campaign for platform review. After review, approved creator partners can see it and submit proposals. The client then selects a partner.",
      },
    ],
  },
  final: {
    title: "Ready to launch your next game campaign?",
    body: "Bring your game to Korean audiences with the right creators.",
    cta: "Start a campaign",
  },
  contact: {
    title: "Planning a campaign in Korea?",
    body: "Tell us about your game and goals. Let's talk about working together.",
    email: "Email",
    emailPlaceholder: "Email address placeholder",
    wechatPlaceholder: "WeChat ID placeholder",
  },
  footer: "Connecting global games with Korea.",
};
const zh: HomeCopy = {
  title: "韩国游戏营销 | Futures Medialab",
  description:
    "连接全球游戏与韩国玩家。与 Futures Medialab 一起完成营销策划、内容本地化及合作方协调。",
  nav: {
    explore: "营销创意",
    how: "合作流程",
    partners: "合作伙伴",
    contact: "联系我们",
    login: "登录",
    join: "立即开始",
    language: "语言",
    menu: "打开菜单",
    close: "关闭菜单",
    skip: "跳至正文",
  },
  hero: {
    eyebrow: "GLOBAL GAMES. KOREAN AUDIENCES.",
    lines: ["让好游戏，", "遇见韩国的玩家。"],
    body: "用韩国市场的语言与内容传递游戏魅力。从营销策划、内容本地化到合作方协调，我们全程同行。",
    primary: "品牌与广告代理机构入驻",
    secondary: "创作者合作机构入驻申请",
    approval: "机构审核通过后即可使用平台。",
  },
  quick: [
    {
      title: "让更多人发现您的游戏？",
      body: "品牌与广告代理机构，从这里开启下一次营销。",
    },
    {
      title: "让创作者拥有更多机会？",
      body: "MCN 与创作者合作机构，寻找下一次合作。",
    },
  ],
  discovery: {
    title: "想象下一次精彩合作。",
    carousel: "轮播",
    slide: "幻灯片",
    loginTitle: "登录，开启下一次合作",
    loginBody: "从筹备营销活动到提交合作方案，在 Futures Medialab 开始。",
    loginAction: "登录并开始",
    action: "了解如何开始合作",
    close: "关闭提示",
  },
  campaigns: [
    {
      id: "genshin",
      title: "原神",
      genre: "开放世界 RPG",
      body: "通过提瓦特的风景、元素战斗与角色故事，呈现探索的乐趣。",
      ideas: ["区域探索与隐藏景点", "元素反应玩法指南", "角色剧情反应"],
    },
    {
      id: "star-rail",
      title: "崩坏：星穹铁道",
      genre: "回合制 RPG",
      body: "搭乘星穹列车，体验不同世界的故事与富有策略的队伍战斗。",
      ideas: ["开拓任务剧情体验", "角色与队伍搭配介绍", "回合制战斗策略"],
    },
    {
      id: "wuthering-waves",
      title: "鸣潮",
      genre: "开放世界动作 RPG",
      body: "探索索拉里斯，以流畅的实机内容展现共鸣者的战斗魅力。",
      ideas: ["开放世界探索直播", "闪避与反击指南", "共鸣者搭配与战斗集锦"],
    },
    {
      id: "zenless",
      title: "绝区零",
      genre: "都市幻想动作 RPG",
      body: "从新艾利都的日常到空洞中的战斗，展现鲜明角色与连携动作。",
      ideas: ["新艾利都初体验", "角色连携动作指南", "战斗精彩短视频"],
    },
    {
      id: "nte",
      title: "异环",
      genre: "都市开放世界 RPG",
      body: "超自然事件与都市日常交织，以创作者的视角探索这座城市。",
      ideas: ["都市探索与日常体验", "超自然剧情反应", "角色初印象内容"],
    },
    {
      id: "once-human",
      title: "七日世界",
      genre: "开放世界生存",
      body: "探索充满异常生物的世界，建造自己的领地，与伙伴一起记录生存冒险。",
      ideas: ["多人合作生存实况", "个性化领地建造", "首领挑战与探索集锦"],
    },
    {
      id: "infinity-nikki",
      title: "无限暖暖",
      genre: "开放世界换装冒险",
      body: "运用服装能力探索新路线，在绮丽风景中通过搭配与拍照记录冒险。",
      ideas: ["服装搭配与能力展示", "风景摄影", "谜题挑战与开放世界探索"],
    },
    {
      id: "naraka",
      title: "永劫无间",
      genre: "武侠动作竞技",
      body: "以近战博弈与英雄技能展开对决，呈现团队协作和瞬间决策的精彩。",
      ideas: ["英雄与武器玩法指南", "组队竞技直播", "近战对决精彩集锦"],
    },
  ],
  workflow: {
    eyebrow: "HOW IT WORKS",
    title: "从创意到合作，每一步都清晰。",
    body: "发布需求、评估提案，选择下一位合作伙伴。",
    steps: [
      {
        title: "介绍您的营销计划",
        body: "品牌与广告代理机构填写目标、内容方向、预算及日程。",
      },
      {
        title: "发现合适的合作伙伴",
        body: "平台审核后，获批的 MCN 与合作机构可查看项目并提交提案。",
      },
      {
        title: "选择携手合作的团队",
        body: "比较提案并选择合作方，通过平台协调需求与进度。",
      },
    ],
  },
  partners: {
    title: "游戏与创作者，\n一起开启新的故事。",
    body: "以营销活动连接品牌目标与创作者的无限可能。",
    items: [
      {
        label: "品牌与广告代理机构",
        title: "让韩国玩家发现游戏的魅力",
        body: "策划营销活动，找到携手执行的创作者合作伙伴。",
        cta: "发起营销活动",
      },
      {
        label: "MCN 与创作者合作机构",
        title: "一起发现创作者的下一次机会",
        body: "寻找适合旗下创作者的游戏项目，提出您的合作方案。",
        cta: "成为合作伙伴",
      },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "还有疑问？",
    body: "开始之前，了解这些信息。",
    items: [
      {
        question: "哪些机构可以入驻？",
        answer:
          "游戏公司、发行商以及委托营销项目的广告代理机构可通过品牌与广告代理机构入口注册。提供创作者和内容的 MCN、合作机构请通过创作者合作机构入口申请。所有机构均需审核通过后使用平台。",
      },
      {
        question: "首页的项目正在招募吗？",
        answer:
          "首页介绍游戏内容与合作创意。正在招募的项目可在机构获批后于服务内查看。",
      },
      {
        question: "营销项目如何发布？",
        answer:
          "品牌与广告代理机构提交营销信息后，由平台进行审核。审核完成的项目将向获批的创作者合作机构开放，客户收到提案后可选择合作团队。",
      },
    ],
  },
  final: {
    title: "准备好开启游戏的下一场营销活动了吗？",
    body: "携手韩国创作者，让更多玩家发现游戏的魅力。",
    cta: "发起营销活动",
  },
  contact: {
    title: "正在筹备韩国营销活动？",
    body: "告诉我们您的游戏与目标，一起探讨合作方式。",
    email: "邮箱",
    emailPlaceholder: "邮箱地址填写位置",
    wechatPlaceholder: "WeChat ID 填写位置",
  },
  footer: "连接全球游戏与韩国市场。",
};
export const homeCopy: Record<Locale, HomeCopy> = { ko, en, zh };
