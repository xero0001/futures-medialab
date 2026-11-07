import { gameThumbnailHash } from "@futures-medialab/database/game-thumbnail-shared";
import { storedGameThumbnailExists } from "@futures-medialab/database/game-thumbnail-storage";
import "server-only";
import { createHash } from "node:crypto";
import { getDatabase, Prisma } from "@futures-medialab/database";
import { normalizeGameTitle } from "@futures-medialab/database/game-catalog";
import {
  boundary,
  fail,
  json,
  rateLimit,
  readBody,
  recheckAdmin,
  requireAdmin,
  verifyOrigin,
} from "./access";
import {
  gameLanguages,
  gameMutationSchema,
  gameQuerySchema,
  type AdminGame,
  type GameProfile,
} from "./game-catalog-model";

const include = {
  localizations: true,
  organization: { select: { name: true } },
  _count: { select: { campaigns: true } },
} satisfies Prisma.GameCatalogInclude;
type Row = Prisma.GameCatalogGetPayload<{ include: typeof include }>;
function dto(row: Row): AdminGame {
  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    verified: row.verified,
    aliases: row.aliases.filter(
      (alias) =>
        ![row.title, ...row.localizations.map((l) => l.title)]
          .map(normalizeGameTitle)
          .includes(alias),
    ),
    updatedAt: row.updatedAt.toISOString(),
    organizationName: row.organization?.name ?? null,
    campaignCount: row._count.campaigns,
    localizations: gameLanguages.map(([locale]) => {
      const value = row.localizations.find((item) => item.locale === locale);
      return {
        locale,
        title: value?.title ?? "",
        officialUrl: value?.officialUrl ?? "",
      };
    }),
  };
}
function fields(profile: GameProfile) {
  const aliases = [
    ...new Set(
      [
        profile.title,
        ...profile.localizations.map((l) => l.title),
        ...profile.aliases,
      ]
        .filter(Boolean)
        .map(normalizeGameTitle),
    ),
  ];
  return {
    title: profile.title,
    thumbnailUrl: profile.thumbnailUrl,
    verified: profile.verified,
    aliases,
    searchText: aliases.join(" "),
  };
}
export function adminGameCatalog(request: Request) {
  return boundary(async () => {
    if (request.method === "POST") verifyOrigin(request);
    const admin = await requireAdmin(request.headers);
    await rateLimit(
      admin,
      request.method === "POST" ? "game-write" : "game-read",
      request.method === "POST" ? 40 : 160,
    );
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      return json(
        await getDatabase().$transaction(async (tx) => {
          await recheckAdmin(tx, admin);
          if (params.has("id")) {
            const id = params.get("id")!;
            if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id))
              fail(404, "NOT_FOUND", "게임을 찾을 수 없습니다.");
            const game = await tx.gameCatalog.findUnique({
              where: { id },
              include,
            });
            if (!game) fail(404, "NOT_FOUND", "게임을 찾을 수 없습니다.");
            return { game: dto(game) };
          }
          const parsed = gameQuerySchema.safeParse(Object.fromEntries(params));
          if (!parsed.success)
            fail(400, "INVALID_QUERY", "검색 조건을 확인해 주세요.");
          const { q, status, page } = parsed.data;
          const where: Prisma.GameCatalogWhereInput = {
            ...(q && {
              searchText: {
                contains: normalizeGameTitle(q),
                mode: "insensitive",
              },
            }),
            ...(status !== "all" && { verified: status === "verified" }),
          };
          const total = await tx.gameCatalog.count({ where });
          const pageSize = 20,
            currentPage = Math.min(
              page,
              Math.max(1, Math.ceil(total / pageSize)),
            );
          const games = await tx.gameCatalog.findMany({
            where,
            include,
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            skip: (currentPage - 1) * pageSize,
            take: pageSize,
          });
          return { games: games.map(dto), total, page: currentPage, pageSize };
        }),
      );
    }
    const input = await readBody(request, gameMutationSchema);
    if (
      gameThumbnailHash(input.profile.thumbnailUrl) &&
      !(await storedGameThumbnailExists(input.profile.thumbnailUrl))
    )
      fail(
        400,
        "INVALID_THUMBNAIL",
        "업로드한 이미지를 찾을 수 없습니다. 다시 업로드해 주세요.",
      );
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const game = await getDatabase().$transaction(
      async (tx) => {
        await recheckAdmin(tx, admin);
        const id =
          input.action === "create" ? `game_${input.requestId}` : input.id;
        const before = await tx.gameCatalog.findUnique({
          where: { id },
          include,
        });
        if (input.action === "create" && before) {
          const prior = await tx.auditLog.findFirst({
            where: {
              entityType: "GameCatalog",
              entityId: id,
              action: "admin.game.create",
              actorId: admin.userId,
            },
          });
          const payload = prior?.payload as
            { payloadHash?: string } | undefined;
          if (payload?.payloadHash !== payloadHash)
            fail(
              409,
              "REQUEST_CONFLICT",
              "이미 사용된 등록 요청입니다. 목록을 다시 확인해 주세요.",
            );
          return dto(before);
        }
        if (input.action === "update" && !before)
          fail(404, "NOT_FOUND", "게임을 찾을 수 없습니다.");
        const data = fields(input.profile);
        if (input.profile.verified) {
          const duplicate = await tx.gameCatalog.findFirst({
            where: {
              id: { not: id },
              verified: true,
              aliases: { hasSome: data.aliases },
            },
            select: { title: true },
          });
          if (duplicate)
            fail(
              409,
              "DUPLICATE_GAME",
              `같은 명칭 또는 별칭의 공식 게임이 있습니다: ${duplicate.title}`,
            );
        }
        if (input.action === "create") {
          await tx.gameCatalog.create({
            data: { id, key: `admin:${input.requestId}`, ...data },
          });
        } else {
          const result = await tx.gameCatalog.updateMany({
            where: { id, updatedAt: new Date(input.expectedUpdatedAt) },
            data: { ...data, updatedAt: new Date() },
          });
          if (result.count !== 1)
            fail(
              409,
              "STALE_GAME",
              "다른 담당자가 먼저 수정했습니다. 최신 내용을 다시 불러온 뒤 저장해 주세요.",
            );
        }
        await tx.gameLocalization.deleteMany({ where: { gameId: id } });
        await tx.gameLocalization.createMany({
          data: input.profile.localizations
            .filter((row) => row.title)
            .map((row) => ({
              gameId: id,
              locale: row.locale,
              title: row.title,
              officialUrl: row.officialUrl || null,
            })),
        });
        const after = await tx.gameCatalog.findUniqueOrThrow({
          where: { id },
          include,
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.userId,
            entityType: "GameCatalog",
            entityId: id,
            action: `admin.game.${input.action}`,
            payload: {
              reason: input.action === "create" ? "게임 DB 등록" : input.reason,
              payloadHash,
              before: before ? dto(before) : null,
              after: dto(after),
            },
          },
        });
        return dto(after);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
    return json({ game });
  });
}
