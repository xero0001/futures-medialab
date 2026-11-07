"use client";
import { useState } from "react";
import type {
  AdminProductionItem,
  AgencyProductionMutation,
} from "@futures-medialab/database/production-types";
import { uploadProductionVideo } from "@futures-medialab/database/production-media-client";
import { productionVideoSource } from "@futures-medialab/database/production-media-shared";
import {
  VideoSubmissionInput,
  VideoPreview,
} from "@futures-medialab/ui/video-submission";
import { AdminButton } from "./_components/admin-button";
import s from "./production-review.module.css";
export function AdminProductionSubmit({
  item,
  busy,
  onSubmit,
}: {
  item: AdminProductionItem;
  busy: boolean;
  onSubmit: (
    input: Omit<AgencyProductionMutation, "clientRequestId"> & {
      campaignId: string;
    },
  ) => void;
}) {
  const [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [note, setNote] = useState(""),
    [uploading, setUploading] = useState(false);
  if (!item.isManaged) return null;
  return (
    <section className={s.internal}>
      <h4>매니지드 제작물 직접 등록</h4>
      <p className={s.muted}>
        새 버전으로 등록한 뒤, 운영 검토에서 브랜드에게 공유할 수 있습니다. 이전
        제출·공유 기록은 보관됩니다.
      </p>
      {!item.canSubmit ? (
        <p>{item.submitDisabledReason}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && !uploading && title.trim().length >= 2 && url)
              onSubmit({
                action: "submit",
                campaignId: item.campaignId,
                productionItemId: item.id,
                expectedRevision: item.revision,
                title: title.trim(),
                url,
                note: note.trim(),
              });
          }}
          style={{ display: "grid", gap: 16 }}
        >
          <label className={s.field}>
            콘텐츠 제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              maxLength={160}
              disabled={busy || uploading}
            />
          </label>
          <VideoSubmissionInput
            value={url}
            onChange={setUrl}
            disabled={busy}
            onUploadingChange={setUploading}
            onUpload={(file, signal, progress) =>
              uploadProductionVideo(
                "/api/admin/production/media",
                item.id,
                item.revision,
                file,
                signal,
                progress,
              )
            }
          />
          <VideoPreview
            source={productionVideoSource(url)}
            title={title || "제출 동영상"}
          />
          <label className={s.field}>
            구성·원고 및 전달 사항
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={4000}
              rows={3}
              disabled={busy || uploading}
            />
          </label>
          <div className={s.actions}>
            <AdminButton
              type="submit"
              disabled={busy || uploading || title.trim().length < 2 || !url}
            >
              새 버전 등록
            </AdminButton>
          </div>
        </form>
      )}
    </section>
  );
}
