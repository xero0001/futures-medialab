"use client";

import { useState, type ComponentProps } from "react";
import {
  FormControl,
  FormControlField,
  FormControlLabel,
  FormControlMessage,
  FormControlNegativeMessage,
  IconButton,
  TextField,
  TextFieldContent,
} from "@montage-ui/core";
import { IconEye, IconEyeSlash } from "@montage-ui/icon";

type Props = Omit<ComponentProps<typeof TextField>, "ref" | "size"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  visibilityLabels?: { show: string; hide: string };
};

export function RegisterField({
  id,
  label,
  hint,
  error,
  type = "text",
  visibilityLabels,
  ...inputProps
}: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const description = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");

  return (
    <FormControl size="large">
      <FormControlLabel htmlFor={id}>{label}</FormControlLabel>
      <FormControlField>
        <TextField
          {...inputProps}
          id={id}
          type={isPassword && visible ? "text" : type}
          width="100%"
          status={error ? "negative" : "normal"}
          aria-describedby={description || undefined}
          trailingContent={
            isPassword && visibilityLabels ? (
              <TextFieldContent variant="icon-button">
                <IconButton
                  type="button"
                  size="large"
                  sx={{ width: 40, height: 40 }}
                  aria-label={
                    visible ? visibilityLabels.hide : visibilityLabels.show
                  }
                  aria-pressed={visible}
                  disabled={inputProps.disabled}
                  onClick={() => setVisible((value) => !value)}
                >
                  {visible ? <IconEyeSlash /> : <IconEye />}
                </IconButton>
              </TextFieldContent>
            ) : undefined
          }
        />
      </FormControlField>
      {hint && (
        <FormControlMessage id={`${id}-hint`}>{hint}</FormControlMessage>
      )}
      {error && (
        <FormControlNegativeMessage id={`${id}-error`}>
          {error}
        </FormControlNegativeMessage>
      )}
    </FormControl>
  );
}
