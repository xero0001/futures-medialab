"use client";

import {
  createContext,
  useContext,
  type ComponentProps,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import {
  Button,
  TextField,
  TextArea,
  Select,
  Option,
  Tab,
  TabList,
  TabListItem,
  TabPanel,
} from "@montage-ui/core";
import { ProfileSelect } from "../../onboarding/brand/profile-select";

// Archived design explorations keep their original controls.
export const WorkspaceThemeContext = createContext(false);

export function WorkspaceButton({
  className = "",
  children,
  type = "submit",
  ...props
}: ComponentPropsWithRef<"button">) {
  const themed = useContext(WorkspaceThemeContext);
  if (!themed)
    return (
      <button className={className} type={type} {...props}>
        {children}
      </button>
    );
  const primary = className
    .split(/\s+/)
    .some((name) =>
      ["cw-button-primary", "cwa-button-primary", "aop-primary"].includes(name),
    );
  return (
    <Button
      {...props}
      type={type}
      size="medium"
      variant={primary ? "solid" : "outlined"}
      color={primary ? "primary" : "assistive"}
      className={`${className} brand-button workspace-button`}
    >
      <span className="brand-button-content workspace-button-content">
        {children}
      </span>
    </Button>
  );
}

export function WorkspaceInput({
  size,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "onReset">) {
  const themed = useContext(WorkspaceThemeContext);
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

export function WorkspaceTextArea({
  value,
  defaultValue,
  rows,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  const themed = useContext(WorkspaceThemeContext);
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

export function WorkspaceSelect(props: ComponentProps<typeof ProfileSelect>) {
  const themed = useContext(WorkspaceThemeContext);
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
    <div className="fmb-select brand-select workspace-select">
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

export function WorkspaceTabs({
  label,
  options,
  value,
  onChange,
  children,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Tab value={value} onValueChange={onChange} disableScrollMoveOnChange>
      <TabList
        className="workspace-tabs"
        size="medium"
        resize="hug"
        aria-label={label}
      >
        {options.map((option) => (
          <TabListItem
            key={option.value}
            value={option.value}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChange(option.value);
              }
            }}
          >
            <span className="workspace-tab-label">
              {option.label}
              {option.count !== undefined && (
                <span className="workspace-tab-count">{option.count}</span>
              )}
            </span>
          </TabListItem>
        ))}
      </TabList>
      <TabPanel value={value} mountMode="always">
        {children}
      </TabPanel>
    </Tab>
  );
}
