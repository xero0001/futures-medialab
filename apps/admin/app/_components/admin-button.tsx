"use client";

import type { ComponentPropsWithoutRef } from "react";
import { ActionButton } from "@futures-medialab/ui/action-button";

/** Compatibility adapter for existing console forms and action classes. */
export function AdminButton({
  className = "",
  type = "submit",
  ...props
}: ComponentPropsWithoutRef<"button">) {
  const classes = className.split(/\s+/);
  const intent = classes.includes("danger")
    ? "danger"
    : classes.includes("primary")
      ? "primary"
      : classes.includes("admin-text-button")
        ? "text"
        : "secondary";
  return (
    <ActionButton
      {...props}
      type={type}
      intent={intent}
      iconOnly={classes.includes("icon")}
      className={`admin-control ${className}`}
    />
  );
}
