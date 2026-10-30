"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@montage-ui/core";

/** Preserve native form semantics while sharing Montage's action styles. */
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
