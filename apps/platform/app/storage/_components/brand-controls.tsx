"use client";

import {
  createContext,
  useContext,
  type ComponentProps,
  type ComponentPropsWithRef,
} from "react";
import { Button, TextField, TextArea, Select, Option } from "@montage-ui/core";
import { ProfileSelect } from "../../onboarding/brand/profile-select";

// Archived design explorations keep their original controls.
export const BrandThemeContext = createContext(false);

export function BrandButton({
  className = "",
  children,
  type = "submit",
  ...props
}: ComponentPropsWithRef<"button">) {
  const themed = useContext(BrandThemeContext);
  if (!themed)
    return (
      <button className={className} type={type} {...props}>
        {children}
      </button>
    );
  const primary = className.split(/\s+/).includes("cw-button-primary");
  return (
    <Button
      {...props}
      type={type}
      size="medium"
      variant={primary ? "solid" : "outlined"}
      color={primary ? "primary" : "assistive"}
      className={`${className} brand-button`}
    >
      <span className="brand-button-content">{children}</span>
    </Button>
  );
}

export function BrandInput({
  size,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "onReset">) {
  const themed = useContext(BrandThemeContext);
  if (
    !themed ||
    ["checkbox", "radio", "file", "hidden"].includes(props.type ?? "")
  )
    return <input size={size} {...props} />;
  return (
    <TextField
      {...props}
      size="large"
      width="100%"
      sx={{
        fontFamily: "inherit",
        minWidth: 0,
        '& [data-role="text-field-reset"]': { display: "none" },
      }}
    />
  );
}

export function BrandTextArea({
  value,
  defaultValue,
  rows,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  const themed = useContext(BrandThemeContext);
  if (!themed)
    return (
      <textarea
        value={value}
        defaultValue={defaultValue}
        rows={rows}
        {...props}
      />
    );
  return (
    <TextArea
      {...props}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue}
      minRows={rows ?? 4}
      size="large"
      width="100%"
      sx={{ fontFamily: "inherit" }}
    />
  );
}

export function BrandSelect(props: ComponentProps<typeof ProfileSelect>) {
  const themed = useContext(BrandThemeContext);
  if (!themed || props.groups) return <ProfileSelect {...props} />;
  const {
    id,
    label,
    placeholder,
    value,
    onChange,
    options,
    invalid,
    describedBy,
    required,
  } = props;
  return (
    <div className="fmb-select brand-select">
      <label id={`${id}-label`} htmlFor={id} className="fmb-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <Select
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-required={required}
        status={invalid ? "negative" : "normal"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        size="large"
        width="100%"
        sx={{ fontFamily: "inherit" }}
      >
        {options.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Select>
    </div>
  );
}
