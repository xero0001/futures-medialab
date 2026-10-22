/**
 * Fictional, deterministic fixtures for the directory UI. These are not real
 * creator identities, audience measurements, endorsements, or live search data.
 * Reserved example.com URLs are only identifiers; this module never fetches them.
 */
export type PlatformId =
  "youtube" | "tiktok" | "instagram" | "twitch" | "x" | "facebook";
export type SearchMode = "creator" | "content" | "bio" | "brand";
export type PublishingPlatform = "all" | "mobile" | "pc" | "console";

export type DirectoryFilters = {
  platform: PlatformId;
  query: string;
  searchMode: SearchMode;
  videoType: "all" | "video" | "shorts" | "live";
  includeTags: string[];
  excludeTags: string[];
  tagMatch: "any" | "all";
  keywordInclude: string;
  keywordExclude: string;
  keywordMatch: "any" | "all";
  country: string;
  followersMin: string;
  followersMax: string;
  viewsMin: string;
  viewsMax: string;
  viewsWindow: "last10" | "last30";
  volatility: "" | "low" | "medium" | "high";
  lastPosted: "" | "7" | "30" | "90";
  language: string;
  audienceCountry: string;
  audienceAge: string;
  audienceGender: string;
};

export type Creator = {
  id: string;
  name: string;
  handle: string;
  profileUrl: string;
  platform: PlatformId;
  country: string;
  language: string;
  followers: number;
  /** Fictional average views for the last 10 posts. */
  views10: number;
  /** Fictional average views for posts published in the last 30 days. */
  views30: number;
  /** Fixture coefficient between 0 and 1, not a measured platform metric. */
  volatility: number;
  /** Percentage points, e.g. 4.2 represents 4.2%. */
  engagement: number;
  tags: string[];
  bio: string;
  content: string[];
  brands: string[];
  videoTypes: string[];
  daysSincePosted: number;
  audienceCountry: string;
  audienceAge: string;
  audienceGender: string;
  accent: string;
};

export type DemoBrand = {
  id: string;
  name: string;
  tags: string[];
  publishingPlatform: Exclude<PublishingPlatform, "all">;
};

export const DIRECTORY_TAGS = [
  "gaming",
  "rpg",
  "strategy",
  "esports",
  "anime",
  "technology",
  "lifestyle",
  "entertainment",
];

export const DEMO_BRANDS: DemoBrand[] = [
  {
    id: "lumen-quest",
    name: "Lumen Quest (Demo)",
    tags: ["gaming", "rpg", "anime"],
    publishingPlatform: "mobile",
  },
  {
    id: "cloudkeep",
    name: "Cloudkeep Tactics (Demo)",
    tags: ["gaming", "strategy"],
    publishingPlatform: "mobile",
  },
  {
    id: "orbit-rally",
    name: "Orbit Rally (Demo)",
    tags: ["gaming", "esports", "technology"],
    publishingPlatform: "pc",
  },
  {
    id: "mossvale",
    name: "Mossvale Stories (Demo)",
    tags: ["gaming", "rpg", "lifestyle"],
    publishingPlatform: "console",
  },
  {
    id: "prism-stage",
    name: "Prism Stage (Demo)",
    tags: ["anime", "entertainment", "lifestyle"],
    publishingPlatform: "mobile",
  },
  {
    id: "cobalt-frontier",
    name: "Cobalt Frontier (Demo)",
    tags: ["gaming", "strategy", "technology"],
    publishingPlatform: "pc",
  },
];

const platforms: PlatformId[] = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "x",
  "facebook",
];

type Persona = {
  slug: string;
  name: string;
  country: string;
  language: string;
  tags: string[];
  bio: string;
  content: string[];
  brands: string[];
  accent: string;
};

// These invented names intentionally avoid using real creators or game brands.
const personas: Persona[] = [
  {
    slug: "moss-arcade",
    name: "Moss Arcade",
    country: "KR",
    language: "ko",
    tags: ["gaming", "rpg", "anime"],
    bio: "Fictional Korean RPG channel with beginner guides and character stories.",
    content: [
      "Lumen Quest beginner guide",
      "RPG team building",
      "Anime character showcase",
    ],
    brands: ["lumen-quest", "mossvale"],
    accent: "#6366f1",
  },
  {
    slug: "pixel-orchard",
    name: "Pixel Orchard",
    country: "KR",
    language: "ko",
    tags: ["gaming", "strategy", "technology"],
    bio: "Fictional strategy enthusiast exploring games and desktop technology.",
    content: [
      "Cloudkeep strategy guide",
      "Building a starter team",
      "Desktop setup tour",
    ],
    brands: ["cloudkeep", "cobalt-frontier"],
    accent: "#0ea5e9",
  },
  {
    slug: "lilac-level",
    name: "Lilac Level",
    country: "JP",
    language: "ja",
    tags: ["gaming", "rpg", "anime", "entertainment"],
    bio: "Fictional Japanese anime and RPG creator sharing friendly walkthroughs.",
    content: [
      "Lumen Quest character stories",
      "RPG adventure highlights",
      "Anime music session",
    ],
    brands: ["lumen-quest", "prism-stage"],
    accent: "#a855f7",
  },
  {
    slug: "comet-keyboard",
    name: "Comet Keyboard",
    country: "US",
    language: "en",
    tags: ["gaming", "esports", "technology"],
    bio: "Fictional English-language esports and technology channel.",
    content: [
      "Orbit Rally practice session",
      "Esports team guide",
      "Keyboard review",
    ],
    brands: ["orbit-rally", "cobalt-frontier"],
    accent: "#2563eb",
  },
  {
    slug: "paper-lantern-play",
    name: "Paper Lantern Play",
    country: "CN",
    language: "zh",
    tags: ["gaming", "strategy", "rpg"],
    bio: "Fictional Chinese-language channel for tactical RPG adventures.",
    content: [
      "Cloudkeep team building",
      "Cobalt Frontier strategy guide",
      "RPG world exploration",
    ],
    brands: ["cloudkeep", "cobalt-frontier"],
    accent: "#f59e0b",
  },
  {
    slug: "soft-signal",
    name: "Soft Signal",
    country: "KR",
    language: "ko",
    tags: ["lifestyle", "entertainment", "anime"],
    bio: "Fictional Korean lifestyle creator with cozy stories and anime-inspired art.",
    content: [
      "Prism Stage weekend diary",
      "Cozy desk makeover",
      "Anime sketchbook tour",
    ],
    brands: ["prism-stage"],
    accent: "#ec4899",
  },
  {
    slug: "fern-and-frame",
    name: "Fern & Frame",
    country: "GB",
    language: "en",
    tags: ["gaming", "lifestyle", "rpg"],
    bio: "Fictional English-language storyteller exploring cozy games and daily life.",
    content: [
      "Mossvale Stories first look",
      "Cozy RPG journal",
      "Weekend lifestyle diary",
    ],
    brands: ["mossvale", "prism-stage"],
    accent: "#10b981",
  },
  {
    slug: "violet-circuit",
    name: "Violet Circuit",
    country: "KR",
    language: "en",
    tags: ["gaming", "esports", "entertainment"],
    bio: "Fictional Korea-based English-language gaming host and esports commentator.",
    content: [
      "Orbit Rally live match",
      "Esports highlights",
      "Community game night",
    ],
    brands: ["orbit-rally"],
    accent: "#7c3aed",
  },
  {
    slug: "cloudberry-lab",
    name: "Cloudberry Lab",
    country: "SG",
    language: "en",
    tags: ["technology", "lifestyle", "entertainment"],
    bio: "Fictional Singapore-based creator covering technology and everyday design.",
    content: [
      "Desktop setup experiments",
      "Everyday technology guide",
      "Creative workspace tour",
    ],
    brands: ["prism-stage", "orbit-rally"],
    accent: "#06b6d4",
  },
  {
    slug: "amber-sidequest",
    name: "Amber Sidequest",
    country: "KR",
    language: "ko",
    tags: ["gaming", "rpg", "strategy"],
    bio: "Fictional Korean gaming channel dedicated to RPG quests and tactical tips.",
    content: [
      "Lumen Quest advanced guide",
      "Cloudkeep tactics explained",
      "Mossvale Stories side quests",
    ],
    brands: ["lumen-quest", "cloudkeep", "mossvale"],
    accent: "#f97316",
  },
];

const fixtureFollowers = [
  24000, 82000, 156000, 410000, 67000, 18500, 98000, 265000, 54000, 320000,
];
const fixtureViews = [
  18000, 43000, 95000, 182000, 34000, 12500, 57000, 139000, 22000, 165000,
];
const fixturePosted = [2, 6, 12, 1, 22, 41, 8, 3, 95, 65];
const fixtureVolatility = [
  0.18, 0.46, 0.72, 0.27, 0.58, 0.81, 0.24, 0.65, 0.35, 0.53,
];

export const DEMO_CREATORS: Creator[] = platforms.flatMap(
  (platform, platformIndex) =>
    personas.map((persona, index) => ({
      id: `demo-${platform}-${persona.slug}`,
      name: `${persona.name} (Demo)`,
      handle: `@demo-${persona.slug}`,
      profileUrl: `https://example.com/demo/${platform}/demo-${persona.slug}`,
      platform,
      country: persona.country,
      language: persona.language,
      followers: fixtureFollowers[index]! + platformIndex * 12000,
      views10: fixtureViews[index]! + platformIndex * 3500,
      views30:
        Math.round(fixtureViews[index]! * (index % 2 === 0 ? 0.82 : 1.13)) +
        platformIndex * 2600,
      volatility: fixtureVolatility[index]!,
      engagement: Number(
        (2.4 + (index % 5) * 0.7 + platformIndex * 0.2).toFixed(1),
      ),
      tags: [...persona.tags],
      bio: persona.bio,
      content: [...persona.content],
      brands: [...persona.brands],
      videoTypes:
        platform === "twitch"
          ? ["live"]
          : platform === "tiktok"
            ? ["shorts"]
            : index % 3 === 0
              ? ["video", "shorts", "live"]
              : index % 3 === 1
                ? ["video"]
                : ["shorts"],
      daysSincePosted: fixturePosted[index]!,
      audienceCountry: index === 7 ? "US" : persona.country,
      audienceAge: ["18-24", "25-34", "35-44", "45+"][index % 4]!,
      audienceGender: ["mixed", "male", "female"][index % 3]!,
      accent: persona.accent,
    })),
);

export function defaultFilters(platform: PlatformId): DirectoryFilters {
  return {
    platform,
    query: "",
    searchMode: "creator",
    videoType: "all",
    includeTags: [],
    excludeTags: [],
    tagMatch: "any",
    keywordInclude: "",
    keywordExclude: "",
    keywordMatch: "any",
    country: "",
    followersMin: "",
    followersMax: "",
    viewsMin: "",
    viewsMax: "",
    viewsWindow: "last10",
    volatility: "",
    lastPosted: "",
    language: "",
    audienceCountry: "",
    audienceAge: "",
    audienceGender: "",
  };
}

export function platformCapabilities(platform: PlatformId) {
  return {
    videoType: platform === "youtube",
    keywords: platform === "youtube" || platform === "tiktok",
    volatility:
      platform === "youtube" || platform === "tiktok" || platform === "twitch",
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

/** Input bounds use K units. Blank means unbounded; zero is a real boundary. */
function numericBound(input: string): number | null {
  if (!input.trim()) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(input.trim())) return Number.NaN;
  const value = Number(input) * 1000;
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}

export function validateFilters(filters: DirectoryFilters): boolean {
  for (const [minimum, maximum] of [
    [filters.followersMin, filters.followersMax],
    [filters.viewsMin, filters.viewsMax],
  ]) {
    const min = numericBound(minimum!);
    const max = numericBound(maximum!);
    if (
      (min !== null && !Number.isFinite(min)) ||
      (max !== null && !Number.isFinite(max))
    )
      return false;
    if (min !== null && max !== null && min > max) return false;
  }
  return true;
}

function withinBounds(
  value: number,
  minimum: string,
  maximum: string,
): boolean {
  const min = numericBound(minimum);
  const max = numericBound(maximum);
  return (min === null || value >= min) && (max === null || value <= max);
}

function matchesValue(actual: string, selected: string): boolean {
  return !selected.trim() || normalize(actual) === normalize(selected);
}

function keywordTerms(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map(normalize)
    .filter(Boolean);
}

function matchesTerms(
  haystack: string,
  terms: string[],
  match: "any" | "all",
): boolean {
  if (terms.length === 0) return true;
  return match === "all"
    ? terms.every((term) => haystack.includes(term))
    : terms.some((term) => haystack.includes(term));
}

function brandText(creator: Creator): string {
  return creator.brands
    .map(
      (id) =>
        `${id} ${DEMO_BRANDS.find((brand) => brand.id === id)?.name ?? ""}`,
    )
    .join(" ");
}

function searchText(creator: Creator, mode: SearchMode): string {
  switch (mode) {
    case "creator":
      return `${creator.name} ${creator.handle} ${creator.profileUrl}`;
    case "content":
      return creator.content.join(" ");
    case "bio":
      return creator.bio;
    case "brand":
      return brandText(creator);
  }
}

function volatilityLevel(value: number): "low" | "medium" | "high" {
  return value < 0.3 ? "low" : value <= 0.6 ? "medium" : "high";
}

export function filterCreators(
  filters: DirectoryFilters,
  source: Creator[] = DEMO_CREATORS,
): Creator[] {
  if (!validateFilters(filters)) return [];
  const capabilities = platformCapabilities(filters.platform);
  const query = normalize(filters.query);
  const includeTags = filters.includeTags.map(normalize).filter(Boolean);
  const excludeTags = filters.excludeTags.map(normalize).filter(Boolean);
  const includeKeywords = keywordTerms(filters.keywordInclude);
  const excludeKeywords = keywordTerms(filters.keywordExclude);

  return source.filter((creator) => {
    if (creator.platform !== filters.platform) return false;
    if (
      query &&
      !normalize(searchText(creator, filters.searchMode)).includes(query)
    )
      return false;
    if (
      capabilities.videoType &&
      filters.videoType !== "all" &&
      !creator.videoTypes.includes(filters.videoType)
    )
      return false;

    const tags = creator.tags.map(normalize);
    if (
      includeTags.length > 0 &&
      !(filters.tagMatch === "all"
        ? includeTags.every((tag) => tags.includes(tag))
        : includeTags.some((tag) => tags.includes(tag)))
    )
      return false;
    if (excludeTags.some((tag) => tags.includes(tag))) return false;

    if (capabilities.keywords) {
      const channelText = normalize(
        `${creator.bio} ${creator.tags.join(" ")} ${creator.content.join(" ")}`,
      );
      if (!matchesTerms(channelText, includeKeywords, filters.keywordMatch))
        return false;
      if (excludeKeywords.some((keyword) => channelText.includes(keyword)))
        return false;
    }

    if (
      !matchesValue(creator.country, filters.country) ||
      !matchesValue(creator.language, filters.language)
    )
      return false;
    if (
      !withinBounds(
        creator.followers,
        filters.followersMin,
        filters.followersMax,
      )
    )
      return false;
    const views =
      filters.viewsWindow === "last30" ? creator.views30 : creator.views10;
    if (!withinBounds(views, filters.viewsMin, filters.viewsMax)) return false;
    if (
      capabilities.volatility &&
      filters.volatility &&
      volatilityLevel(creator.volatility) !== filters.volatility
    )
      return false;
    if (
      filters.lastPosted &&
      creator.daysSincePosted > Number(filters.lastPosted)
    )
      return false;
    return (
      matchesValue(creator.audienceCountry, filters.audienceCountry) &&
      matchesValue(creator.audienceAge, filters.audienceAge) &&
      matchesValue(creator.audienceGender, filters.audienceGender)
    );
  });
}

function canonicalProfileUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    // Tracking query/hash and a trailing slash do not identify a different profile.
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function sharedTags(left: string[], right: string[]): number {
  const tags = new Set(right.map(normalize));
  return new Set(left.map(normalize).filter((tag) => tags.has(tag))).size;
}

function rankByTags(creators: Creator[], tags: string[]): Creator[] {
  return creators
    .filter((creator) => sharedTags(creator.tags, tags) > 0)
    .sort(
      (a, b) =>
        sharedTags(b.tags, tags) - sharedTags(a.tags, tags) ||
        a.id.localeCompare(b.id),
    );
}

export function findSimilarCreators(
  platform: PlatformId,
  query: string,
  filters: DirectoryFilters,
  source: Creator[] = DEMO_CREATORS,
): { seed: Creator | null; results: Creator[] } {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return { seed: null, results: [] };
  const queryUrl = canonicalProfileUrl(query.trim());
  const seed =
    source.find(
      (creator) =>
        creator.platform === platform &&
        (normalize(creator.name) === normalizedQuery ||
          normalize(creator.handle) === normalizedQuery ||
          (queryUrl !== null &&
            canonicalProfileUrl(creator.profileUrl) === queryUrl)),
    ) ?? null;
  if (!seed) return { seed: null, results: [] };
  const candidates = filterCreators(
    { ...filters, platform, query: "" },
    source,
  ).filter((creator) => creator.id !== seed.id);
  return { seed, results: rankByTags(candidates, seed.tags) };
}

export function recommendForBrand(
  brandId: string,
  filters: DirectoryFilters,
  publishingPlatform: PublishingPlatform,
  source: Creator[] = DEMO_CREATORS,
): { brands: typeof DEMO_BRANDS; creators: Creator[] } {
  const eligibleBrands = DEMO_BRANDS.filter(
    (brand) =>
      publishingPlatform === "all" ||
      brand.publishingPlatform === publishingPlatform,
  );
  const seed = DEMO_BRANDS.find((brand) => brand.id === brandId);
  if (!seed) return { brands: eligibleBrands, creators: [] };
  if (!eligibleBrands.some((brand) => brand.id === seed.id))
    return { brands: [], creators: [] };
  const brands = eligibleBrands
    .filter((brand) => sharedTags(brand.tags, seed.tags) > 0)
    .sort(
      (a, b) =>
        Number(b.id === seed.id) - Number(a.id === seed.id) ||
        sharedTags(b.tags, seed.tags) - sharedTags(a.tags, seed.tags) ||
        a.id.localeCompare(b.id),
    );
  const creators = rankByTags(
    filterCreators({ ...filters, query: "" }, source),
    seed.tags,
  );
  return { brands, creators };
}
