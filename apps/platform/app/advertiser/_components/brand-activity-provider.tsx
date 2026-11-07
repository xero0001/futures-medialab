"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getBrandActions, type BrandAction } from "../../../lib/brand-progress";
import type { BrandWorkspace } from "../../../lib/brand-workspace-types";

type BrandActivity = {
  data: BrandWorkspace | null;
  actions: BrandAction[];
  now: number;
  error: string;
  refresh: () => Promise<void>;
  changed: () => void;
};
const BrandActivityContext = createContext<BrandActivity | null>(null);

// One snapshot drives the navigation badge, home actions and request inbox.
export function BrandActivityProvider({
  scope,
  children,
}: {
  scope: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [data, setData] = useState<BrandWorkspace | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const response = await fetch("/api/brand/workspace", {
        cache: "no-store",
        signal: controller.signal,
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setData(null);
        throw new Error(
          typeof body.message === "string" ? body.message : "LOAD_FAILED",
        );
      }
      setData(body as BrandWorkspace);
      setNow(Date.now());
      setError("");
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "LOAD_FAILED");
    }
  }, []);

  useEffect(() => {
    // Start an abortable API read; state changes happen after its response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => pending.current?.abort();
  }, [pathname, refresh]);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void refresh();
      }
    };
    const timer = window.setInterval(resume, 60_000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(`brand-activity:${scope}`);
      channel.current.onmessage = () => void refresh();
    }
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh, scope]);

  const changed = useCallback(() => {
    channel.current?.postMessage("changed");
    void refresh();
  }, [refresh]);
  const actions = useMemo(
    () => (data ? getBrandActions(data, now) : []),
    [data, now],
  );

  return (
    <BrandActivityContext
      value={{ data, actions, now, error, refresh, changed }}
    >
      {children}
    </BrandActivityContext>
  );
}

export function useOptionalBrandActivity() {
  return useContext(BrandActivityContext);
}

export function useBrandActivity() {
  const activity = useOptionalBrandActivity();
  if (!activity) throw new Error("Brand activity provider is required");
  return activity;
}
