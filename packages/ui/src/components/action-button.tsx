"use client";

import type { ComponentPropsWithRef } from "react";
import { Button, TextButton } from "@montage-ui/core";

export type ActionButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "color"
> & {
  intent?: "primary" | "secondary" | "danger" | "text";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  iconOnly?: boolean;
};

/** Shared action semantics; Montage owns size, color, hover and disabled styles. */
export function ActionButton({
  intent = "secondary",
  size = "medium",
  type = "button",
  children,
  iconOnly,
  ...props
}: ActionButtonProps) {
  // Montage generates aria-labelledby for its content. An explicit aria-label
  // must remain authoritative (for example, repeated row actions).
  const accessibleName = props["aria-label"]
    ? { "aria-labelledby": props["aria-labelledby"] }
    : {};
  const content = <span className="fm-action-content">{children}</span>;
  if (intent === "text") {
    return (
      <TextButton
        {...props}
        {...accessibleName}
        type={type}
        data-fm-control="action"
        color="primary"
        size={size === "small" ? "small" : "medium"}
      >
        {content}
      </TextButton>
    );
  }
  return (
    <Button
      {...props}
      {...accessibleName}
      type={type}
      data-fm-control="action"
      size={size}
      iconOnly={iconOnly}
      variant={intent === "secondary" ? "outlined" : "solid"}
      color={
        intent === "danger"
          ? "negative"
          : intent === "primary"
            ? "primary"
            : "assistive"
      }
    >
      {iconOnly ? children : content}
    </Button>
  );
}
