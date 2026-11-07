"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { TextField } from "@montage-ui/core";
import {
  GAME_THUMBNAIL_ACCEPT,
  GAME_THUMBNAIL_MAX_BYTES,
  GAME_THUMBNAIL_TYPES,
  gameThumbnailHash,
} from "@futures-medialab/database/game-thumbnail-shared";
import { AdminButton } from "./_components/admin-button";
import { validGameThumbnail } from "../lib/game-catalog-model";
import s from "./game-catalog.module.css";

export function GameThumbnailField({
  value,
  disabled,
  onChange,
  onBusyChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const active = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const [failedUrl, setFailedUrl] = useState(""),
    [filename, setFilename] = useState("");
  const [showUrl, setShowUrl] = useState(
    Boolean(value) && !gameThumbnailHash(value),
  );
  useEffect(
    () => () => {
      active.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
  }
  async function upload(file?: File) {
    if (!file || disabled || active.current) return;
    setError("");
    if (
      !GAME_THUMBNAIL_TYPES.includes(
        file.type as (typeof GAME_THUMBNAIL_TYPES)[number],
      )
    ) {
      setError("PNG, JPG, WebP 이미지 파일을 선택해 주세요.");
      return;
    }
    if (!file.size || file.size > GAME_THUMBNAIL_MAX_BYTES) {
      setError("이미지는 4MB 이하로 선택해 주세요.");
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    clearPreview();
    const local = URL.createObjectURL(file);
    previewRef.current = local;
    setPreview(local);
    setUploading(true);
    onBusyChange(true);
    setFilename(file.name);
    try {
      const response = await fetch("/api/admin/games/thumbnail", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(
          result.message ||
            "이미지를 업로드하지 못했습니다. 다시 시도해 주세요.",
        );
      }
      if (!gameThumbnailHash(result.thumbnailUrl ?? ""))
        throw new Error(
          "업로드 결과를 확인할 수 없습니다. 다시 시도해 주세요.",
        );
      if (controller.signal.aborted) return;
      onChange(result.thumbnailUrl);
      setShowUrl(false);
      setFailedUrl("");
      clearPreview();
    } catch (caught) {
      clearPreview();
      setFilename("");
      if (!controller.signal.aborted)
        setError(
          caught instanceof Error
            ? caught.message
            : "이미지를 업로드하지 못했습니다.",
        );
    } finally {
      active.current = null;
      setUploading(false);
      onBusyChange(false);
    }
  }
  const image =
    preview ?? (validGameThumbnail(value.trim()) ? value.trim() : "");
  return (
    <div className={s.imageRow}>
      <span className={`${s.thumbnail} ${s.large}`}>
        {image && image !== failedUrl ? (
          <Image
            src={image}
            alt="게임 썸네일 미리보기"
            width={112}
            height={112}
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(image)}
          />
        ) : (
          <span>이미지 미리보기</span>
        )}
        {image && image === failedUrl && (
          <small>이미지를 불러올 수 없습니다</small>
        )}
      </span>
      <div className={s.uploadFields}>
        <div className={s.uploadActions}>
          <input
            ref={fileInput}
            type="file"
            accept={GAME_THUMBNAIL_ACCEPT}
            aria-label="게임 썸네일 파일"
            className={s.fileInput}
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void upload(file);
            }}
          />
          <AdminButton
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading
              ? "업로드 중…"
              : value
                ? "이미지 파일 변경"
                : "이미지 파일 업로드"}
          </AdminButton>
          {uploading ? (
            <AdminButton type="button" onClick={() => active.current?.abort()}>
              업로드 취소
            </AdminButton>
          ) : (
            <AdminButton
              type="button"
              disabled={disabled}
              onClick={() => setShowUrl((v) => !v)}
            >
              {showUrl ? "URL 입력 닫기" : "URL로 입력"}
            </AdminButton>
          )}
        </div>
        <small>PNG, JPG, WebP · 최대 4MB · 정사각형 게임 아이콘 권장</small>
        {uploading && (
          <p className={s.uploadStatus} role="status">
            {filename} 업로드 중입니다…
          </p>
        )}
        {!uploading && gameThumbnailHash(value) && (
          <p className={s.uploadStatus} role="status">
            {filename
              ? `${filename} 업로드 완료`
              : "업로드한 이미지가 등록되어 있습니다."}
          </p>
        )}
        {showUrl && (
          <div className={s.field}>
            <label htmlFor="game-thumbnail">썸네일 이미지 주소</label>
            <TextField
              id="game-thumbnail"
              value={gameThumbnailHash(value) ? "" : value}
              disabled={disabled || uploading}
              onChange={(event) => {
                clearPreview();
                setFilename("");
                setError("");
                onChange(event.target.value);
              }}
              maxLength={2048}
              width="100%"
              placeholder="https://example.com/game-icon.png"
            />
          </div>
        )}
        {error && (
          <p role="alert" className={s.uploadError}>
            {error} 기존 썸네일은 유지됩니다.
          </p>
        )}
        <small>
          아래의 게임 등록·저장 버튼을 누르면 연결된 캠페인에도 반영됩니다.
        </small>
      </div>
    </div>
  );
}
