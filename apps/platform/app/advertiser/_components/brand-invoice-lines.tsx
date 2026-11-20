import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Typography } from "@montage-ui/core";
import type { BrandInvoice } from "@futures-medialab/database/settlement-types";
import { campaignMoney } from "../../../lib/settlement-display";
import type { Locale } from "../../_components/landing-copy";
import { productionText } from "../../_components/workspace/production-shared";
import styles from "../../_components/workspace/settlement-workspace.module.css";
import { ProposalChannelAvatar } from "./proposal-channel-avatar";

export function BrandInvoiceLines({ invoice, locale }: { invoice: BrandInvoice; locale: Locale }) {
  const t = productionText(locale);
  const quantityLabel = t("수량", "Quantity", "数量");
  const unitLabel = t("단가", "Unit amount", "单价");
  const amountLabel = t("금액", "Amount", "金额");
  return (
    <div className={styles.invoiceLines}>
      <Table className={styles.table}>
        <caption className={styles.invoiceCaption}>{t("청구 항목", "Invoice lines", "账单明细")}</caption>
        <TableHead>
          <TableRow>
            <TableHeadCell scope="col">{t("항목", "Item", "项目")}</TableHeadCell>
            <TableHeadCell scope="col">{quantityLabel}</TableHeadCell>
            <TableHeadCell scope="col">{unitLabel}</TableHeadCell>
            <TableHeadCell scope="col">{amountLabel}</TableHeadCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.lines.map((line, index) => {
            const quantity = line.quantity.toLocaleString(locale);
            const unit = campaignMoney(line.unitAmount, invoice.currency, locale);
            const amount = campaignMoney(line.lineAmount, invoice.currency, locale);
            return (
              <TableRow key={`${line.proposalItemId}-${index}`}>
                <TableCell>
                  <div className={styles.creatorLine}>
                    <ProposalChannelAvatar name={line.creatorName} channelUrl={line.channelUrl ?? ""} alt="" />
                    <div>
                      <Typography as="strong" variant="label1" weight="medium">{line.creatorName}</Typography>
                      <Typography as="p" variant="caption1" className={styles.muted}>
                        {line.platform} · {line.description}
                      </Typography>
                    </div>
                  </div>
                  <dl className={styles.invoiceLineAmounts}>
                    <div><dt>{quantityLabel}</dt><dd>{quantity}</dd></div>
                    <div><dt>{unitLabel}</dt><dd>{unit}</dd></div>
                    <div><dt>{amountLabel}</dt><dd>{amount}</dd></div>
                  </dl>
                </TableCell>
                <TableCell>{quantity}</TableCell>
                <TableCell><span className={styles.money}>{unit}</span></TableCell>
                <TableCell><span className={styles.money}>{amount}</span></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
