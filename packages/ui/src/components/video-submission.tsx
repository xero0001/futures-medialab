"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button, TextField } from "@montage-ui/core";
type Locale = "ko" | "en" | "zh";
export function VideoPreview({
  source,
  title,
}: {
  source: { kind: "video" | "youtube"; src: string } | null;
  title: string;
}) {
  if (!source) return null;
  const style = {
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    border: 0,
    borderRadius: 12,
    background: "#171719",
  };
  return source.kind === "youtube" ? (
    <iframe
      key={source.src}
      src={source.src}
      title={title}
      style={style}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  ) : (
    <video
      key={source.src}
      src={source.src}
      aria-label={title}
      controls
      playsInline
      preload="metadata"
      style={style}
    />
  );
}
export function VideoSubmissionInput({
  value,
  onChange,
  onUpload,
  onUploadingChange,
  disabled,
  locale = "ko",
  label,
  canUpload = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onUpload: (
    file: File,
    signal: AbortSignal,
    onProgress: (percentage: number) => void,
  ) => Promise<string>;
  onUploadingChange: (value: boolean) => void;
  disabled?: boolean;
  locale?: Locale;
  label?: string;
  canUpload?: boolean;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const t = (ko: string, en: string, zh: string) => ({ ko, en, zh })[locale];
  useEffect(() => () => controller.current?.abort(), []);
  const uploaded = value.startsWith("production-media:");
  async function choose(file?: File) {
    if (!file || uploading || disabled) return;
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setProgress(0);
    setUploading(true);
    onUploadingChange(true);
    try {
      const url = await onUpload(file, abort.signal, setProgress);
      if (!abort.signal.aborted) onChange(url);
    } catch (reason) {
      if (!abort.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : t("업로드하지 못했습니다.", "Upload failed.", "上传失败。"),
        );
    } finally {
      setUploading(false);
      onUploadingChange(false);
      controller.current = null;
    }
  }
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
    >
      <label htmlFor={uploaded ? `${id}-file` : `${id}-url`}>
        {label ||
          t(
            "동영상 또는 콘텐츠 링크",
            "Video or content link",
            "视频或内容链接",
          )}{" "}
        *
      </label>
      {!uploaded && (
        <TextField
          id={`${id}-url`}
          type="url"
          width="100%"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
          maxLength={2048}
          disabled={disabled || uploading}
        />
      )}
      {uploaded && (
        <span role="status">
          {t("동영상 업로드 완료", "Video uploaded", "视频已上传")}
        </span>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          disabled={disabled || uploading}
          style={{ display: "none" }}
          aria-label={t(
            "동영상 파일 선택",
            "Choose a video file",
            "选择视频文件",
          )}
          onChange={(e) => {
            void choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {canUpload && (
          <Button
            type="button"
            variant="outlined"
            color="assistive"
            size="small"
            disabled={disabled || uploading}
            onClick={() => input.current?.click()}
          >
            {uploaded
              ? t("동영상 교체", "Replace video", "替换视频")
              : t("동영상 업로드", "Upload video", "上传视频")}
          </Button>
        )}
        {uploaded && (
          <Button
            type="button"
            variant="outlined"
            color="assistive"
            size="small"
            disabled={disabled || uploading}
            onClick={() => onChange("")}
          >
            {t("링크로 변경", "Use a link", "改用链接")}
          </Button>
        )}
        {canUpload && (
          <small>
            {t(
              "MP4 · WebM, 최대 200MB",
              "MP4 · WebM, up to 200MB",
              "MP4 · WebM，最大 200MB",
            )}
          </small>
        )}
      </div>
      {uploading && (
        <div
          role="status"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <progress
            value={progress}
            max={100}
            aria-label={t("업로드 진행률", "Upload progress", "上传进度")}
          />
          <span>{Math.round(progress)}%</span>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => controller.current?.abort()}
          >
            {t("취소", "Cancel", "取消")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" style={{ color: "#bf3525", margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
