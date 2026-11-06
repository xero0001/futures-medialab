"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@montage-ui/core";

/** Preserve native form semantics and explicit accessible names with Montage styles. */
export function AdminButton({
  className = "",
  type = "submit",
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  const classes = className.split(/\s+/);
  const primary = classes.includes("primary");
  const danger = classes.includes("danger");
  return (
    <Button
      {...props}
      {...(props["aria-label"]
        ? { "aria-labelledby": props["aria-labelledby"] }
        : {})}
      type={type}
      size="medium"
      variant={primary || danger ? "solid" : "outlined"}
      color={danger ? "negative" : primary ? "primary" : "assistive"}
      className={`admin-control ${className}`}
    >
      <span className="admin-control-content">{children}</span>
    </Button>
  );
}
