import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";
import {
  DEMO_BRANDS,
  DEMO_CREATORS,
  DIRECTORY_TAGS,
  defaultFilters,
  filterCreators,
  findSimilarCreators,
  platformCapabilities,
  recommendForBrand,
  validateFilters,
} from "../lib/creator-directory.ts";

const platformIds = ["youtube", "tiktok", "instagram", "twitch", "x", "facebook"];
const filters = (overrides = {}) => ({ ...defaultFilters("youtube"), ...overrides });
const ids = (creators) => creators.map((creator) => creator.id);
const sharedTags = (left, right) => left.filter((tag) => right.includes(tag)).length;

test("fixtures are deterministic, explicitly fictional, and cover every platform", () => {
  assert.equal(DEMO_CREATORS.length, 60);
  assert.equal(new Set(ids(DEMO_CREATORS)).size, DEMO_CREATORS.length);
  assert.equal(DEMO_BRANDS.length, 6);
  assert.ok(DEMO_BRANDS.every((brand) => brand.name.endsWith("(Demo)")));
  for (const platform of platformIds) {
    const results = filterCreators(defaultFilters(platform));
    assert.equal(results.length, 10);
    assert.ok(results.every((creator) => creator.platform === platform));
    assert.ok(results.every((creator) => creator.name.endsWith("(Demo)")));
    assert.ok(results.every((creator) => new URL(creator.profileUrl).hostname === "example.com"));
    assert.ok(results.every((creator) => creator.tags.every((tag) => DIRECTORY_TAGS.includes(tag))));
    assert.ok(results.every((creator) => creator.brands.every((id) => DEMO_BRANDS.some((brand) => brand.id === id))));
  }
});

test("defaults do not share mutable tag arrays", () => {
  const first = defaultFilters("youtube");
  const second = defaultFilters("youtube");
  first.includeTags.push("gaming");
  first.excludeTags.push("anime");
  assert.deepEqual(second.includeTags, []);
  assert.deepEqual(second.excludeTags, []);
});

test("platform capabilities match available reference controls", () => {
  assert.deepEqual(platformCapabilities("youtube"), { videoType: true, keywords: true, volatility: true });
  assert.deepEqual(platformCapabilities("tiktok"), { videoType: false, keywords: true, volatility: true });
  assert.deepEqual(platformCapabilities("twitch"), { videoType: false, keywords: false, volatility: true });
  for (const platform of ["instagram", "x", "facebook"]) {
    assert.deepEqual(platformCapabilities(platform), { videoType: false, keywords: false, volatility: false });
  }
});

test("numeric ranges accept blank, zero, decimal, and inclusive K boundaries", () => {
  for (const patch of [
    {}, { followersMin: "0", followersMax: "0" },
    { followersMin: " 24 ", followersMax: "24.0" },
    { viewsMin: ".5", viewsMax: "18." }, { viewsMin: " ", viewsMax: "" },
  ]) assert.equal(validateFilters(filters(patch)), true);

  const exact = filterCreators(filters({ followersMin: "24", followersMax: "24" }));
  assert.equal(exact.length, 1);
  assert.equal(exact[0].followers, 24000);
  assert.deepEqual(filterCreators(filters({ followersMax: "0" })), []);
  assert.deepEqual(filterCreators(filters({ followersMin: "99999" })), []);
  assert.equal(filterCreators(filters({ followersMin: "24", followersMax: "82" })).length, 4);
});

test("invalid, infinite, negative, and reversed bounds return no results", () => {
  for (const field of ["followersMin", "followersMax", "viewsMin", "viewsMax"]) {
    for (const value of ["NaN", "Infinity", "-1", "1e9", "0x20", "1,000", "hello", "1.2.3", "9".repeat(400)]) {
      const input = filters({ [field]: value });
      assert.equal(validateFilters(input), false, `${field}: ${value}`);
      assert.deepEqual(filterCreators(input), []);
    }
  }
  for (const patch of [{ followersMin: "10", followersMax: "9" }, { viewsMin: "1", viewsMax: "0" }]) {
    assert.equal(validateFilters(filters(patch)), false);
    assert.deepEqual(filterCreators(filters(patch)), []);
  }
});

test("view ranges switch between average of last 10 posts and last 30 days", () => {
  const seed = DEMO_CREATORS[0];
  assert.notEqual(seed.views10, seed.views30);
  assert.deepEqual(ids(filterCreators(filters({ viewsMin: "18", viewsMax: "18" }), [seed])), [seed.id]);
  assert.deepEqual(filterCreators(filters({ viewsMin: "18", viewsMax: "18", viewsWindow: "last30" }), [seed]), []);
  const exact = String(seed.views30 / 1000);
  assert.deepEqual(ids(filterCreators(filters({ viewsMin: exact, viewsMax: exact, viewsWindow: "last30" }), [seed])), [seed.id]);
});

test("creator, media content, bio, and brand queries search the intended fields", () => {
  assert.equal(filterCreators(filters({ query: "  MOSS ARCADE  " }))[0].name, "Moss Arcade (Demo)");
  assert.equal(filterCreators(filters({ query: "@demo-moss-arcade" })).length, 1);
  assert.equal(filterCreators(filters({ query: DEMO_CREATORS[0].profileUrl })).length, 1);
  assert.ok(filterCreators(filters({ query: "beginner guide", searchMode: "content" })).length > 0);
  assert.deepEqual(filterCreators(filters({ query: "beginner guide", searchMode: "creator" })), []);
  assert.equal(filterCreators(filters({ query: "Singapore-based", searchMode: "bio" }))[0].country, "SG");
  const brandResults = filterCreators(filters({ query: "Lumen Quest", searchMode: "brand" }));
  assert.ok(brandResults.length > 0);
  assert.ok(brandResults.every((creator) => creator.brands.includes("lumen-quest")));
  assert.deepEqual(ids(filterCreators(filters({ query: "lumen-quest", searchMode: "brand" }))), ids(brandResults));
  assert.deepEqual(filterCreators(filters({ query: "definitely unknown sample" })), []);
});

test("tag inclusion supports ANY and ALL; exclusions always remove matches", () => {
  const any = filterCreators(filters({ includeTags: ["anime", "strategy"] }));
  assert.ok(any.length > 0);
  assert.ok(any.every((creator) => creator.tags.includes("anime") || creator.tags.includes("strategy")));
  const all = filterCreators(filters({ includeTags: ["gaming", "rpg"], tagMatch: "all" }));
  assert.ok(all.length > 0);
  assert.ok(all.every((creator) => creator.tags.includes("gaming") && creator.tags.includes("rpg")));
  const excluded = filterCreators(filters({ includeTags: ["gaming"], excludeTags: ["anime", "strategy"] }));
  assert.ok(excluded.length > 0);
  assert.ok(excluded.every((creator) => creator.tags.includes("gaming") && !creator.tags.includes("anime") && !creator.tags.includes("strategy")));
  assert.deepEqual(filterCreators(filters({ includeTags: ["unknown"] })), []);
  assert.deepEqual(filterCreators(filters({ includeTags: ["gaming"], excludeTags: ["gaming"] })), []);
});

test("keyword inclusion supports comma/semicolon/newline phrases and ANY/ALL", () => {
  const source = [DEMO_CREATORS[0]];
  assert.equal(filterCreators(filters({ keywordInclude: "RPG, unavailable" }), source).length, 1);
  assert.equal(filterCreators(filters({ keywordInclude: "RPG; beginner guide", keywordMatch: "all" }), source).length, 1);
  assert.equal(filterCreators(filters({ keywordInclude: "RPG\nbeginner guide", keywordMatch: "all" }), source).length, 1);
  assert.deepEqual(filterCreators(filters({ keywordInclude: "RPG, unavailable", keywordMatch: "all" }), source), []);
  assert.deepEqual(filterCreators(filters({ keywordExclude: "unavailable, beginner guide" }), source), []);
  assert.equal(filterCreators(filters({ keywordInclude: " , ; \n " }), source).length, 1);
});

test("each demographic and channel field independently filters correctly", () => {
  const source = [{
    ...DEMO_CREATORS[0], followers: 100000, views10: 50000, views30: 40000,
    country: "KR", language: "ko", volatility: 0.2, daysSincePosted: 7,
    audienceCountry: "US", audienceAge: "25-34", audienceGender: "female", videoTypes: ["shorts"],
  }];
  const cases = [
    ["country", "kr", "JP"], ["language", "KO", "en"],
    ["audienceCountry", "us", "KR"], ["audienceAge", "25-34", "18-24"],
    ["audienceGender", "female", "male"], ["videoType", "shorts", "live"],
    ["volatility", "low", "high"], ["followersMin", "100", "100.01"],
    ["followersMax", "100", "99.99"], ["viewsMin", "50", "50.01"], ["viewsMax", "50", "49.99"],
  ];
  for (const [field, positive, negative] of cases) {
    assert.equal(filterCreators(filters({ [field]: positive }), source).length, 1, `${field} positive`);
    assert.equal(filterCreators(filters({ [field]: negative }), source).length, 0, `${field} negative`);
  }
  assert.equal(filterCreators(filters({ lastPosted: "7" }), source).length, 1);
  assert.equal(filterCreators(filters({ lastPosted: "30" }), [{ ...source[0], daysSincePosted: 31 }]).length, 0);
  assert.equal(filterCreators(filters({ lastPosted: "90" }), [{ ...source[0], daysSincePosted: 90 }]).length, 1);
  assert.equal(filterCreators(filters({ lastPosted: "90" }), [{ ...source[0], daysSincePosted: 91 }]).length, 0);
});

test("volatility thresholds include exact boundaries", () => {
  for (const [value, level] of [[0, "low"], [0.29, "low"], [0.3, "medium"], [0.6, "medium"], [0.61, "high"], [1, "high"]]) {
    assert.equal(filterCreators(filters({ volatility: level }), [{ ...DEMO_CREATORS[0], volatility: value }]).length, 1);
  }
});

test("platform switching ignores hidden video/keyword/volatility controls", () => {
  for (const platform of platformIds) {
    const base = defaultFilters(platform);
    const capabilities = platformCapabilities(platform);
    if (!capabilities.videoType) assert.deepEqual(ids(filterCreators({ ...base, videoType: "live" })), ids(filterCreators(base)));
    if (!capabilities.keywords) {
      assert.deepEqual(ids(filterCreators({ ...base, keywordInclude: "no-known-keyword", keywordExclude: "gaming" })), ids(filterCreators(base)));
    }
    if (!capabilities.volatility) assert.deepEqual(ids(filterCreators({ ...base, volatility: "low" })), ids(filterCreators(base)));
  }
  assert.ok(filterCreators(filters({ videoType: "live" })).length < 10);
  assert.deepEqual(filterCreators(filters({ platform: "tiktok", keywordInclude: "no-known-keyword" })), []);
  assert.ok(filterCreators(filters({ platform: "twitch", volatility: "low" })).length < 10);
});

test("combined filters are conjunctive and never mutate filters or fixture input", () => {
  const input = filters({ country: "KR", language: "ko", includeTags: ["gaming", "rpg"], tagMatch: "all", followersMin: "20", lastPosted: "7" });
  const beforeFilters = globalThis.structuredClone(input);
  const beforeData = globalThis.structuredClone(DEMO_CREATORS);
  const results = filterCreators(input);
  assert.deepEqual(ids(results), [DEMO_CREATORS[0].id]);
  assert.deepEqual(input, beforeFilters);
  assert.deepEqual(DEMO_CREATORS, beforeData);
});

test("similar search resolves exact known name, handle, and canonical URL only", () => {
  const seed = DEMO_CREATORS[0];
  for (const query of [seed.name, seed.name.toUpperCase(), seed.handle, seed.profileUrl, `${seed.profileUrl}/?ref=sample#profile`]) {
    const result = findSimilarCreators("youtube", query, filters());
    assert.equal(result.seed?.id, seed.id);
    assert.ok(result.results.length > 0);
    assert.ok(result.results.every((creator) => creator.id !== seed.id));
    assert.ok(result.results.every((creator) => creator.platform === "youtube" && sharedTags(creator.tags, seed.tags) > 0));
  }
  for (const query of ["", "   ", "Moss", "unknown", "https://example.com/unknown", "https://example.com.evil.invalid/demo/youtube/demo-moss-arcade", "javascript:alert(1)", "https://user@example.com/demo/youtube/demo-moss-arcade"]) {
    assert.deepEqual(findSimilarCreators("youtube", query, filters()), { seed: null, results: [] });
  }
  assert.equal(findSimilarCreators("tiktok", seed.profileUrl, filters()).seed, null);
});

test("similar search never requests user-supplied or sample URLs", () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = () => { fetchCount++; throw new Error("Unexpected outbound request"); };
  try {
    findSimilarCreators("youtube", "http://127.0.0.1/private", filters());
    findSimilarCreators("youtube", DEMO_CREATORS[0].profileUrl, filters());
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("similar results are deterministic, ranked by shared tags, and honor all filters", () => {
  const seed = DEMO_CREATORS[0];
  const input = filters({ platform: "instagram", query: seed.name, country: "KR", followersMin: "80", lastPosted: "90" });
  const result = findSimilarCreators("youtube", seed.handle, input);
  assert.equal(result.seed?.id, seed.id);
  assert.ok(result.results.length > 0);
  assert.ok(result.results.every((creator) => creator.platform === "youtube" && creator.country === "KR" && creator.followers >= 80000 && creator.daysSincePosted <= 90));
  const overlaps = result.results.map((creator) => sharedTags(creator.tags, seed.tags));
  assert.deepEqual(overlaps, [...overlaps].sort((a, b) => b - a));
  assert.deepEqual(result, findSimilarCreators("youtube", seed.handle, input));
  assert.deepEqual(findSimilarCreators("youtube", seed.handle, filters({ followersMin: "100", followersMax: "1" })).results, []);
});

test("brand recommendations use fictional brand tags and publishing-platform filters", () => {
  const selected = DEMO_BRANDS[0];
  const result = recommendForBrand(selected.id, filters(), "mobile");
  assert.equal(result.brands[0].id, selected.id);
  assert.ok(result.brands.every((brand) => brand.publishingPlatform === "mobile" && sharedTags(brand.tags, selected.tags) > 0));
  assert.ok(result.creators.length > 0);
  assert.ok(result.creators.every((creator) => creator.platform === "youtube" && sharedTags(creator.tags, selected.tags) > 0));
  assert.deepEqual(result, recommendForBrand(selected.id, filters(), "mobile"));
  assert.deepEqual(recommendForBrand(selected.id, filters(), "pc"), { brands: [], creators: [] });
  const noSelection = recommendForBrand("", filters(), "console");
  assert.ok(noSelection.brands.length > 0);
  assert.ok(noSelection.brands.every((brand) => brand.publishingPlatform === "console"));
  assert.deepEqual(noSelection.creators, []);
  assert.deepEqual(recommendForBrand("unknown", filters(), "all").creators, []);
});

test("brand creator recommendations respect channel, audience, and numeric constraints", () => {
  const input = filters({ platform: "tiktok", query: "ignored seed query", country: "KR", language: "ko", followersMin: "30", audienceGender: "mixed" });
  const result = recommendForBrand("lumen-quest", input, "all");
  assert.ok(result.creators.length > 0);
  assert.ok(result.creators.every((creator) => creator.platform === "tiktok" && creator.country === "KR" && creator.language === "ko" && creator.followers >= 30000 && creator.audienceGender === "mixed"));
  assert.deepEqual(recommendForBrand("lumen-quest", filters({ followersMin: "100", followersMax: "1" }), "all").creators, []);
  assert.deepEqual(recommendForBrand("lumen-quest", filters({ audienceCountry: "ZZ" }), "all").creators, []);
});

test("similar and brand queries use only supplied database records, including empty sources", () => {
  const seed = DEMO_CREATORS[0];
  const subset = [seed, DEMO_CREATORS[1], DEMO_CREATORS[2]];
  const similar = findSimilarCreators("youtube", seed.handle, filters(), subset);
  assert.equal(similar.seed?.id, seed.id);
  assert.deepEqual(new Set(ids(similar.results)), new Set(ids(subset.slice(1))));
  assert.deepEqual(findSimilarCreators("youtube", seed.handle, filters(), []), { seed: null, results: [] });
  assert.deepEqual(findSimilarCreators("youtube", seed.handle, filters(), [DEMO_CREATORS[1]]), { seed: null, results: [] });
  const recommended = recommendForBrand("lumen-quest", filters(), "all", subset);
  assert.ok(recommended.creators.length > 0);
  assert.ok(recommended.creators.every((creator) => subset.includes(creator)));
  assert.deepEqual(recommendForBrand("lumen-quest", filters(), "all", []).creators, []);
});
