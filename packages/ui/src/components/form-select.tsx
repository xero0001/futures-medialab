"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import { Option, OptionGroup, Select } from "@montage-ui/core";

type NativeProps = ComponentPropsWithRef<"select">;
export type FormSelectProps = Omit<
  NativeProps,
  "multiple" | "size" | "value" | "defaultValue"
> & {
  value?: string | number;
  defaultValue?: string | number;
  size?: "medium" | "large";
};
type Choice = {
  value: string;
  label: ReactNode;
  disabled: boolean;
  hidden?: boolean;
  group?: string;
};

function textContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? textContent(child.props.children)
        : String(child),
    )
    .join("");
}

function choicesFrom(
  children: ReactNode,
  group?: string,
  disabled = false,
): Choice[] {
  return Children.toArray(children).flatMap((child): Choice[] => {
    if (
      !isValidElement<{
        children?: ReactNode;
        label?: string;
        value?: string | number;
        disabled?: boolean;
        hidden?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment)
      return choicesFrom(child.props.children, group, disabled);
    if (child.type === "optgroup")
      return choicesFrom(
        child.props.children,
        child.props.label,
        disabled || Boolean(child.props.disabled),
      );
    if (child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? textContent(child.props.children)),
        label: child.props.label ?? child.props.children,
        disabled: disabled || Boolean(child.props.disabled),
        hidden: child.props.hidden,
        group,
      },
    ];
  });
}

/** Montage single-select with native change events, FormData and validation. */
export function FormSelect({
  children,
  className,
  style,
  size = "medium",
  value,
  defaultValue,
  disabled,
  required,
  id,
  ref,
  onChange,
  onInvalid,
  onFocus,
  ...props
}: FormSelectProps) {
  const generatedId = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLDivElement>(null);
  const resetting = useRef(false);
  const [open, setOpen] = useState(false);
  const choices = choicesFrom(children);
  const initial = String(
    defaultValue ?? choices.find((choice) => !choice.disabled)?.value ?? "",
  );
  const [internalValue, setInternalValue] = useState(initial);
  const [inheritedDisabled, setInheritedDisabled] = useState(false);
  const [labelledBy, setLabelledBy] = useState<string>();
  const [menuContainer, setMenuContainer] = useState<HTMLDialogElement | null>(
    null,
  );
  const [validation, setValidation] = useState("");
  const selected = value === undefined ? internalValue : String(value);
  const errorId = `${generatedId}-error`;

  useEffect(() => {
    const element = native.current;
    if (!element) return;
    // A native modal dialog makes body portals inert; keep its menu in the top layer.
    setMenuContainer(element.closest("dialog"));
    // The native control remains the label target, including implicit labels.
    const labels = Array.from(element.labels ?? []);
    setLabelledBy(
      labels
        .map((label, index) => {
          if (!label.id) label.id = `${generatedId}-label-${index}`;
          return label.id;
        })
        .join(" ") || undefined,
    );
    // A disabled fieldset must also disable the portalled Montage menu.
    const fieldsets: HTMLFieldSetElement[] = [];
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (parent instanceof HTMLFieldSetElement) fieldsets.push(parent);
    }
    const syncDisabled = () => {
      const inactive = element.matches(":disabled");
      setInheritedDisabled(inactive);
      if (inactive) setOpen(false);
    };
    syncDisabled();
    const observer = new MutationObserver(syncDisabled);
    for (const fieldset of fieldsets)
      observer.observe(fieldset, {
        attributes: true,
        attributeFilter: ["disabled"],
      });
    const form = element.form;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      // Montage also listens for form resets. Native selects do not emit change
      // on reset, so suppress that callback and synchronize after the browser.
      resetting.current = true;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetting.current = false;
        if (event.defaultPrevented) return;
        if (value === undefined) setInternalValue(element.value);
        else element.value = String(value);
        setValidation("");
      });
    };
    form?.addEventListener("reset", reset, true);
    return () => {
      clearTimeout(resetTimer);
      resetting.current = false;
      observer.disconnect();
      form?.removeEventListener("reset", reset, true);
    };
  }, [generatedId, disabled, value]);

  function choose(next: string) {
    const element = native.current;
    if (!element || resetting.current || element.matches(":disabled")) return;
    // Dispatch a real native change, preserving existing event handlers and
    // form listeners instead of fabricating a React ChangeEvent.
    element.value = next;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const menu = choices
    .filter((choice) => !choice.hidden)
    .map((choice, index) => (
      <Option
        key={`${choice.value}-${index}`}
        value={choice.value}
        disabled={choice.disabled}
      >
        {choice.label}
      </Option>
    ));
  const groups = [...new Set(choices.map((choice) => choice.group))];

  return (
    <span
      className={["fm-form-select", className].filter(Boolean).join(" ")}
      style={style}
    >
      <select
        {...props}
        id={id}
        ref={(element) => {
          native.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        className="fm-form-select-native"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        required={required}
        value={value}
        defaultValue={defaultValue}
        onFocus={(event) => {
          onFocus?.(event);
          trigger.current?.focus();
        }}
        onInvalid={(event) => {
          onInvalid?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          setValidation(event.currentTarget.validationMessage);
          trigger.current?.focus();
        }}
        onChange={(event) => {
          if (value === undefined) setInternalValue(event.currentTarget.value);
          setValidation(
            event.currentTarget.validity.valid
              ? ""
              : event.currentTarget.validationMessage,
          );
          onChange?.(event);
        }}
      >
        {children}
      </select>
      <Select
        ref={trigger}
        data-fm-control="select"
        open={open && !disabled && !inheritedDisabled}
        onOpenChange={setOpen}
        contentProps={{ container: menuContainer }}
        aria-label={props["aria-label"]}
        aria-labelledby={
          props["aria-labelledby"] ??
          (props["aria-label"] ? undefined : labelledBy)
        }
        aria-describedby={
          [props["aria-describedby"], validation ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-required={required}
        status={
          validation ||
          props["aria-invalid"] === true ||
          props["aria-invalid"] === "true"
            ? "negative"
            : "normal"
        }
        disabled={disabled || inheritedDisabled}
        value={selected}
        onChange={choose}
        placeholder={textContent(
          choices.find((choice) => choice.value === "")?.label,
        )}
        width="100%"
        size={size}
      >
        {groups.length === 1 && groups[0] === undefined
          ? menu
          : groups.map((group) => (
              <OptionGroup key={group ?? "ungrouped"} title={group}>
                {choices
                  .filter((choice) => choice.group === group && !choice.hidden)
                  .map((choice, index) => (
                    <Option
                      key={`${choice.value}-${index}`}
                      value={choice.value}
                      disabled={choice.disabled}
                    >
                      {choice.label}
                    </Option>
                  ))}
              </OptionGroup>
            ))}
      </Select>
      {validation && (
        <span id={errorId} className="fm-form-select-error" role="alert">
          {validation}
        </span>
      )}
    </span>
  );
}
