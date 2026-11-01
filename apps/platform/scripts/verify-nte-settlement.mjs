import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";
import { setInterval, clearInterval } from "node:timers";
import { createDatabaseClient } from "../../../packages/database/src/client-factory.mjs";
import {
  listAdminSettlement,
  listBrandInvoices,
  listAgencyPayouts,
} from "@futures-medialab/database/settlement";
import { listBrandCampaignProposals } from "@futures-medialab/database/proposals";
import {
  nteSettlementScenarios,
  NTE_SETTLEMENT_PREFIX,
} from "./fixtures/nte-settlement.mjs";
import {
  ntePublicCreators,
  NTE_CREATOR_REFERENCE_SEED,
} from "./fixtures/nte-public-creators.mjs";

const require = createRequire(
  new URL("../../../packages/database/package.json", import.meta.url),
);
require("dotenv").config({
  path: new URL("../.env.local", import.meta.url).pathname,
  quiet: true,
});
const db = createDatabaseClient(),
  keepAlive = setInterval(() => {}, 1000);
const report = {
  checkedAt: new Date().toISOString(),
  mode: "read-only database and service verification",
  overall: "pending",
  scenarios: [],
  checks: [],
};
function privacy(value, denied) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!denied.includes(key), `Private field exposed: ${key}`);
    privacy(child, denied);
  }
}
try {
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const actor = async (email, type) => {
        const user = await tx.user.findUniqueOrThrow({
          where: { email },
          include: { memberships: { where: { organization: { type } } } },
        });
        assert.equal(user.memberships.length, 1);
        return {
          userId: user.id,
          organizationId: user.memberships[0].organizationId,
        };
      };
      const brand = await actor("brand@brand.com", "BRAND"),
        agency = await actor("agency@agency.com", "AGENCY"),
        admin = await actor("admin@admin.com", "PLATFORM");
      for (const scene of nteSettlementScenarios) {
        const campaignId = `${NTE_SETTLEMENT_PREFIX}-campaign-${scene.key}`;
        const adminView = await listAdminSettlement(
          tx,
          admin.userId,
          campaignId,
        );
        const invoices = await listBrandInvoices(tx, brand, campaignId),
          payouts = await listAgencyPayouts(tx, agency, campaignId);
        if (scene.key === "ready") {
          assert.equal(adminView.canComplete, true);
          assert.equal(adminView.completion, null);
          assert.equal(adminView.invoice, null);
        } else {
          assert.equal(adminView.campaignStatus, "COMPLETED");
          assert.ok(adminView.completion);
          assert.equal(adminView.invoice.status, scene.state);
          assert.ok(adminView.payouts.every((p) => p.status === scene.state));
        }
        const visible = ["issued", "paid"].includes(scene.key);
        assert.equal(invoices.length, visible ? 1 : 0);
        assert.equal(payouts.length, visible ? 1 : 0);
        if (visible) {
          assert.equal(invoices[0].amount, scene.price);
          assert.equal(
            payouts[0].amount,
            `${(BigInt(scene.price.split(".")[0]) * 60n) / 100n}.00`,
          );
          assert.equal(invoices[0].status, scene.state);
          assert.equal(payouts[0].status, scene.state);
          assert.ok(
            invoices[0].lines[0].creatorName.includes(
              ntePublicCreators[scene.creator].name,
            ),
          );
          assert.ok(invoices[0].note.includes("가상"));
        }
        privacy(invoices, [
          "supplierOrganizationId",
          "supplierName",
          "supplierCost",
          "itemTotalAmount",
          "internalNote",
          "externalPaymentReference",
          "payouts",
          "totalSupplierAmount",
        ]);
        privacy(payouts, [
          "brandOrganizationId",
          "brandTotalAmount",
          "unitAmount",
          "lineAmount",
          "internalNote",
          "externalPaymentReference",
          "invoices",
        ]);
        report.scenarios.push({
          campaignId,
          campaignStatus: adminView.campaignStatus,
          invoiceStatus: adminView.invoice?.status ?? null,
          brandVisible: invoices.length,
          agencyVisible: payouts.length,
        });
      }
      const campaigns = await tx.campaign.findMany({
        where: {
          id: { startsWith: "fm-demo-nte-" },
          createdById: brand.userId,
        },
        include: { proposals: { include: { items: true } } },
      });
      assert.equal(campaigns.length, 20);
      for (const c of campaigns) {
        assert.equal(
          c.requirements.publicCreatorReferenceSeed,
          NTE_CREATOR_REFERENCE_SEED,
        );
        for (const p of c.proposals)
          for (const item of p.items) {
            const key = item.creatorId.replace("fm-demo-nte-v1-creator-", ""),
              source = ntePublicCreators[key];
            assert.equal(item.channelUrl, source.channelUrl);
            assert.equal(item.platform, "youtube");
            assert.equal(item.followers, source.followers);
            assert.equal(item.averageViews, null);
            assert.ok(item.creatorName.endsWith("시연 후보"));
            assert.ok(p.terms.includes("시연용 가상"));
          }
      }
      const hidden = await listBrandCampaignProposals(
        tx,
        brand.organizationId,
        "fm-demo-nte-v1-campaign-private",
        true,
      );
      assert.equal(hidden.length, 0);
      const visible = await listBrandCampaignProposals(
        tx,
        brand.organizationId,
        "fm-demo-nte-reporting-v1-campaign-published",
        true,
      );
      assert.equal(visible[0].items[0].channelLabel, "이다의게임방송");
      privacy(visible, [
        "creatorId",
        "supplierOrganizationId",
        "supplierCost",
        "internalNotes",
      ]);
      report.checks.push(
        "20 NTE campaigns preserved with verified public channel references",
        "Unpublished proposals remain hidden",
        "Draft financial records remain hidden",
        "Brand invoices and agency payouts are separate projections",
        "Issued and paid states, exact amounts and public notes verified",
      );
    },
    { isolationLevel: "RepeatableRead", timeout: 60000 },
  );
  report.overall = "pass";
} catch (error) {
  report.overall = "fail";
  report.error = error.code || error.message;
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  clearInterval(keepAlive);
}
await mkdir("output/settlement-review", { recursive: true });
await writeFile(
  "output/settlement-review/nte-seed-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
