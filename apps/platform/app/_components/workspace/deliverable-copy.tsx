import { Typography } from "@montage-ui/core";
import { splitDeliverable } from "../../../lib/campaign-copy";

export function DeliverableCopy({ value }: { value: string }) {
  const { title, description } = splitDeliverable(value);
  return (
    <>
      {title && <Typography as="strong" variant="body2" weight="bold">{title}</Typography>}
      {description && (
        <Typography as="p" variant="label1-reading" color="semantic.foreground.neutral.secondary">
          {description}
        </Typography>
      )}
    </>
  );
}
