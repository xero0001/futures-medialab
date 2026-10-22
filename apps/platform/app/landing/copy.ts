import type { Locale } from "../_components/landing-copy";

export type LandingCopy = {
  nav: {
    explore: string;
    how: string;
    partners: string;
    login: string;
    join: string;
    language: string;
    menu: string;
    close: string;
  };
  announcement: { line: string; link: string };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    body: string;
    primary: string;
    secondary: string;
    visualLabel: string;
    artTag: string;
  };
  quickLinks: {
    brand: { title: string; description: string };
    agency: { title: string; description: string };
  };
  discovery: {
    eyebrow: string;
    title: string;
    body: string;
    all: string;
    game: string;
    technology: string;
    lifestyle: string;
    sampleLabel: string;
    viewAll: string;
    cardAction: string;
    close: string;
    platform: string;
    region: string;
    budget: string;
    notReal: string;
  };
  sampleCampaigns: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
  }>;
  workflow: {
    eyebrow: string;
    title: string;
    body: string;
    steps: Array<{ title: string; body: string }>;
  };
  partners: {
    eyebrow: string;
    title: string;
    body: string;
    brandTitle: string;
    brandLabel: string;
    brandBody: string;
    brandCta: string;
    agencyTitle: string;
    agencyLabel: string;
    agencyBody: string;
    agencyCta: string;
  };
  faq: { title: string; items: Array<{ question: string; answer: string }> };
  final: { title: string; body: string; button: string };
  footer: {
    tagline: string;
    home: string;
    login: string;
    register: string;
    prototype: string;
  };
};

const en: LandingCopy = {
  nav: {
    explore: "Explore campaigns",
    how: "How it works",
    partners: "For partners",
    login: "Log in",
    join: "Get started",
    language: "Language",
    menu: "Open menu",
    close: "Close menu",
  },
  announcement: {
    line: "A new connection for global games and Korean creators.",
    link: "Meet Futures Medialab",
  },
  hero: {
    eyebrow: "GOOD GAMES. GREAT CONNECTIONS.",
    titleLine1: "New worlds.",
    titleLine2: "Meet your people.",
    body: "Bring global games closer to Korean audiences. Find your next campaign connection with local MCNs and agencies.",
    primary: "Start a campaign",
    secondary: "Join as a partner",
    visualLabel: "An imagined world of games, creators, and new connections",
    artTag: "Play. Create. Connect.",
  },
  quickLinks: {
    brand: {
      title: "A game worth sharing?",
      description: "Bring your brief. Find the right local partners.",
    },
    agency: {
      title: "A team full of talent?",
      description: "Discover campaigns for your creator lineup.",
    },
  },
  discovery: {
    eyebrow: "A LITTLE INSPIRATION",
    title: "Your next collaboration starts here.",
    body: "Explore a few campaign ideas. Real opportunities are available to approved agency partners.",
    all: "All ideas",
    game: "Gaming",
    technology: "Technology",
    lifestyle: "Lifestyle",
    sampleLabel: "Campaign concept",
    viewAll: "Explore partner access",
    cardAction: "Explore this concept",
    close: "Close concept",
    platform: "Platform",
    region: "Market",
    budget: "Budget",
    notReal:
      "These are fictional campaign concepts, not open offers or confirmed brand partnerships.",
  },
  sampleCampaigns: [
    {
      id: "moonlit-odyssey",
      title: "Crown of Ashes",
      category: "MMORPG",
      description:
        "Rally a guild and claim the battlefield. Bring epic sieges and rivalries to life through creator-led play.",
    },
    {
      id: "aurora-arena",
      title: "Asteria Protocol",
      category: "Anime RPG",
      description:
        "Meet your next favorite character. Share first impressions, story reactions, and team-building ideas.",
    },
    {
      id: "pocket-planet",
      title: "Frost Frontier",
      category: "Survival strategy",
      description:
        "Build a haven in a frozen world. Turn survival decisions and base-building challenges into stories worth watching.",
    },
  ],
  workflow: {
    eyebrow: "LESS BACK-AND-FORTH. MORE POSSIBILITY.",
    title: "A clear path from brief to connection.",
    body: "One place to share your campaign, find a partner, and agree on what comes next.",
    steps: [
      {
        title: "Tell us about your campaign",
        body: "Brands set the audience, content requirements, budget, and application deadline.",
      },
      {
        title: "Meet the right partners",
        body: "After platform review, approved MCNs and agencies can explore the campaign and send a proposal.",
      },
      {
        title: "Choose your next collaboration",
        body: "Brands review proposals and select a partner, with requests and coordination through the platform.",
      },
    ],
  },
  partners: {
    eyebrow: "TWO SIDES. ONE SHARED IDEA.",
    title: "Made for people who make things happen.",
    body: "Global ambition meets local understanding.",
    brandTitle: "For brands with a world to share.",
    brandLabel: "BRANDS",
    brandBody:
      "Turn your next game launch into a clear campaign brief. Connect with Korean MCNs and agencies through one platform.",
    brandCta: "Join as a brand",
    agencyTitle: "For teams with a story to tell.",
    agencyLabel: "AGENCIES & STUDIOS",
    agencyBody:
      "Find campaigns that fit your creators, propose your approach, and keep track of your applications in one place.",
    agencyCta: "Join as an agency",
  },
  faq: {
    title: "A few things you might be wondering.",
    items: [
      {
        question: "Who can join?",
        answer:
          "Brands and agency or studio organizations can register. Agency access to live campaigns requires platform approval. Individual creator registration is not available at the moment.",
      },
      {
        question: "Are the campaigns on this page open for applications?",
        answer:
          "No. These cards are fictional examples to show the kinds of collaborations the platform can support. Approved agencies can view published campaigns and their current requirements in their workspace.",
      },
      {
        question: "How does a campaign go live?",
        answer:
          "A brand creates a draft and submits it for review. After the platform approves publication, eligible agencies can apply. The brand can then review, shortlist, accept, or decline proposals.",
      },
    ],
  },
  final: {
    title: "Something great starts with a connection.",
    body: "Bring your next game. Bring your team. Let’s find what you can make together.",
    button: "Find your starting point",
  },
  footer: {
    tagline: "Global games. Local connections.",
    home: "Main website",
    login: "Log in",
    register: "Get started",
    prototype:
      "A new look for Futures Medialab. Campaign visuals and concepts are illustrative.",
  },
};

const ko: LandingCopy = {
  nav: {
    explore: "캠페인 둘러보기",
    how: "이용 방법",
    partners: "파트너 안내",
    login: "로그인",
    join: "시작하기",
    language: "언어",
    menu: "메뉴 열기",
    close: "메뉴 닫기",
  },
  announcement: {
    line: "글로벌 게임과 한국 크리에이터를 잇는 새로운 연결.",
    link: "퓨처스 미디어랩 알아보기",
  },
  hero: {
    eyebrow: "좋은 게임, 새로운 만남",
    titleLine1: "새로운 세계가",
    titleLine2: "당신의 팬을 만나는 곳.",
    body: "글로벌 게임을 한국의 팬들에게 더 가까이. 국내 MCN·에이전시와 함께 다음 캠페인의 가능성을 찾아보세요.",
    primary: "캠페인 시작하기",
    secondary: "파트너로 함께하기",
    visualLabel: "게임과 크리에이터, 새로운 만남을 표현한 상상 속 세계",
    artTag: "즐기고, 만들고, 연결하고.",
  },
  quickLinks: {
    brand: {
      title: "알리고 싶은 게임이 있나요?",
      description: "캠페인 아이디어를 나누고, 국내 파트너를 만나보세요.",
    },
    agency: {
      title: "함께하는 크리에이터가 있나요?",
      description: "우리 팀에 어울리는 다음 캠페인을 찾아보세요.",
    },
  },
  discovery: {
    eyebrow: "다음 협업의 힌트",
    title: "이런 만남, 어떨까요?",
    body: "새로운 캠페인 아이디어를 둘러보세요. 실제 모집 중인 캠페인은 승인된 에이전시에게 공개됩니다.",
    all: "전체 아이디어",
    game: "게임",
    technology: "테크",
    lifestyle: "라이프스타일",
    sampleLabel: "캠페인 예시",
    viewAll: "파트너 참여 안내",
    cardAction: "이 캠페인 아이디어 보기",
    close: "상세 닫기",
    platform: "플랫폼",
    region: "대상 국가",
    budget: "예산",
    notReal:
      "이 캠페인들은 이해를 돕기 위한 가상의 예시이며, 실제 모집 공고나 확정된 브랜드 협업이 아닙니다.",
  },
  sampleCampaigns: [
    {
      id: "moonlit-odyssey",
      title: "잿빛 왕관",
      category: "MMORPG",
      description:
        "길드와 함께 전장을 누비는 순간. 크리에이터의 플레이로 공성전과 라이벌의 이야기를 전해요.",
    },
    {
      id: "aurora-arena",
      title: "아스테리아 프로토콜",
      category: "서브컬처 RPG",
      description:
        "새로운 최애와의 첫 만남. 캐릭터 소개부터 스토리 리액션, 나만의 팀 조합까지 함께 나눠요.",
    },
    {
      id: "pocket-planet",
      title: "프로스트 프런티어",
      category: "생존 전략",
      description:
        "얼어붙은 세계에 세우는 우리만의 기지. 생존을 위한 선택과 건설 과정을 흥미로운 콘텐츠로 담아요.",
    },
  ],
  workflow: {
    eyebrow: "복잡한 연락은 줄이고, 가능성은 넓히고",
    title: "아이디어에서 파트너를 만나기까지.",
    body: "캠페인 소개부터 파트너 선정까지, 한곳에서 차근차근 진행해요.",
    steps: [
      {
        title: "어떤 캠페인인지 알려주세요",
        body: "브랜드가 대상 고객, 콘텐츠 조건, 예산, 신청 마감일을 정해 캠페인을 등록해요.",
      },
      {
        title: "함께할 파트너를 만나요",
        body: "플랫폼 검토 후 캠페인이 공개되면, 승인된 MCN·에이전시가 내용을 확인하고 제안해요.",
      },
      {
        title: "다음 협업을 결정해요",
        body: "브랜드가 제안을 검토하고 파트너를 선정해요. 양쪽의 요청과 조율은 플랫폼을 통해 진행해요.",
      },
    ],
  },
  partners: {
    eyebrow: "서로 다른 출발, 같은 기대",
    title: "함께 만들어갈 사람들을 위해.",
    body: "글로벌 브랜드의 아이디어에, 한국 시장을 아는 파트너의 감각을 더해요.",
    brandTitle: "새로운 세계를 알리고 싶은 브랜드.",
    brandLabel: "브랜드",
    brandBody:
      "다음 게임 출시를 구체적인 캠페인으로 만들어보세요. 하나의 플랫폼에서 한국 MCN·에이전시와 연결됩니다.",
    brandCta: "브랜드로 시작하기",
    agencyTitle: "우리만의 이야기가 있는 에이전시.",
    agencyLabel: "에이전시 · 스튜디오",
    agencyBody:
      "소속 크리에이터에게 어울리는 캠페인을 찾고, 우리 팀의 아이디어를 제안해보세요. 신청 현황도 한곳에서 확인해요.",
    agencyCta: "에이전시로 시작하기",
  },
  faq: {
    title: "궁금한 점을 모았어요.",
    items: [
      {
        question: "누가 가입할 수 있나요?",
        answer:
          "브랜드와 에이전시·스튜디오가 가입할 수 있어요. 에이전시의 실제 캠페인 열람은 플랫폼 승인 후 가능하며, 개인 크리에이터 가입은 현재 제공하지 않아요.",
      },
      {
        question: "여기 보이는 캠페인에 바로 신청할 수 있나요?",
        answer:
          "이 페이지의 카드는 협업 형태를 보여주는 가상의 예시예요. 승인된 에이전시는 전용 화면에서 실제 공개된 캠페인과 모집 조건을 확인하고 신청할 수 있어요.",
      },
      {
        question: "캠페인은 어떻게 공개되나요?",
        answer:
          "브랜드가 초안을 작성해 검토를 요청하면, 플랫폼 승인 후 캠페인이 공개돼요. 이후 에이전시가 신청하고, 브랜드가 제안을 검토해 후보 선정·수락·거절을 진행할 수 있어요.",
      },
    ],
  },
  final: {
    title: "좋은 협업은, 새로운 만남에서.",
    body: "당신의 게임과 우리 팀의 이야기가 만나는 곳. 다음 가능성을 함께 찾아보세요.",
    button: "나에게 맞는 시작 찾기",
  },
  footer: {
    tagline: "글로벌 게임과 한국의 새로운 연결.",
    home: "기존 메인으로",
    login: "로그인",
    register: "시작하기",
    prototype:
      "퓨처스 미디어랩의 새로운 디자인. 캠페인 이미지와 내용은 이해를 돕기 위한 예시입니다.",
  },
};

const zh: LandingCopy = {
  nav: {
    explore: "探索营销活动",
    how: "合作流程",
    partners: "合作伙伴",
    login: "登录",
    join: "开始合作",
    language: "语言",
    menu: "打开菜单",
    close: "关闭菜单",
  },
  announcement: {
    line: "连接全球游戏与韩国创作者，让合作有更多可能。",
    link: "了解 Futures Medialab",
  },
  hero: {
    eyebrow: "好游戏，遇见好伙伴",
    titleLine1: "新的世界，",
    titleLine2: "遇见你的玩家。",
    body: "让全球游戏走近韩国玩家。携手当地 MCN 与代理机构，寻找下一次营销合作的可能。",
    primary: "发起营销活动",
    secondary: "成为合作伙伴",
    visualLabel: "以游戏、创作者与新连接为主题的幻想世界",
    artTag: "畅玩，创作，连接。",
  },
  quickLinks: {
    brand: {
      title: "有一款值得分享的游戏？",
      description: "带上你的活动创意，找到合适的本地伙伴。",
    },
    agency: {
      title: "拥有充满创意的团队？",
      description: "为旗下创作者寻找合适的营销活动。",
    },
  },
  discovery: {
    eyebrow: "为下一次合作寻找灵感",
    title: "让新的合作，从这里开始。",
    body: "看看这些活动创意。实际招募中的活动将向通过审核的代理机构开放。",
    all: "全部创意",
    game: "游戏",
    technology: "科技",
    lifestyle: "生活方式",
    sampleLabel: "活动示例",
    viewAll: "了解伙伴准入",
    cardAction: "查看活动创意",
    close: "关闭详情",
    platform: "平台",
    region: "目标市场",
    budget: "预算",
    notReal: "这些活动为虚构示例，不代表实际招募或已确认的品牌合作。",
  },
  sampleCampaigns: [
    {
      id: "moonlit-odyssey",
      title: "灰烬王冠",
      category: "MMORPG",
      description:
        "集结公会，驰骋战场。通过创作者的实战体验，分享攻城对决与宿敌交锋的精彩时刻。",
    },
    {
      id: "aurora-arena",
      title: "星辉协议",
      category: "二次元 RPG",
      description:
        "遇见下一个心动角色。从角色初印象、剧情反应到阵容搭配，用创作者的视角分享游戏魅力。",
    },
    {
      id: "pocket-planet",
      title: "冰霜边境",
      category: "生存策略",
      description:
        "在冰封世界建起一座避风港。把生存抉择与基地建设的挑战，变成值得追看的故事。",
    },
  ],
  workflow: {
    eyebrow: "少一些反复沟通，多一些合作可能",
    title: "从活动创意，到遇见伙伴。",
    body: "发布需求、寻找伙伴、确认合作，在同一个平台有序推进。",
    steps: [
      {
        title: "介绍你的营销活动",
        body: "品牌填写目标受众、内容要求、预算及申请截止日期。",
      },
      {
        title: "寻找合适的合作伙伴",
        body: "活动经平台审核发布后，通过准入审核的 MCN 与代理机构可查看详情并提交方案。",
      },
      {
        title: "确定下一次合作",
        body: "品牌审核方案并选择伙伴，双方的需求与协调均通过平台推进。",
      },
    ],
  },
  partners: {
    eyebrow: "不同的起点，共同的期待",
    title: "为让创意成真的人而打造。",
    body: "让全球视野，遇见对本地市场的理解。",
    brandTitle: "让更多人发现你的游戏世界。",
    brandLabel: "品牌",
    brandBody:
      "把下一次游戏发布变成清晰的营销计划，通过一个平台连接韩国 MCN 与代理机构。",
    brandCta: "以品牌身份加入",
    agencyTitle: "让团队的创意拥有新的舞台。",
    agencyLabel: "代理机构与工作室",
    agencyBody:
      "为旗下创作者寻找合适的活动，提出团队方案，并在同一处查看申请进度。",
    agencyCta: "以代理机构身份加入",
  },
  faq: {
    title: "你可能想了解这些。",
    items: [
      {
        question: "谁可以注册？",
        answer:
          "品牌、代理机构及工作室可以注册。代理机构需通过平台审核后才能查看实际营销活动，目前暂不开放个人创作者注册。",
      },
      {
        question: "可以直接申请本页展示的活动吗？",
        answer:
          "不可以。这些卡片是用于说明合作形式的虚构示例。通过审核的代理机构可在工作台查看已发布活动的实际要求并提交申请。",
      },
      {
        question: "活动如何正式发布？",
        answer:
          "品牌创建草稿并提交审核，经平台批准后正式发布。符合条件的代理机构可提交申请，品牌随后可以审核、列入候选、接受或拒绝方案。",
      },
    ],
  },
  final: {
    title: "好的合作，从一次连接开始。",
    body: "带上你的游戏，带上你的团队。一起发现下一种可能。",
    button: "找到你的合作起点",
  },
  footer: {
    tagline: "全球游戏，本地连接。",
    home: "原版首页",
    login: "登录",
    register: "开始合作",
    prototype: "Futures Medialab 的全新设计。活动图片与内容仅为示意。",
  },
};

export const landingCopy: Record<Locale, LandingCopy> = { en, ko, zh };
