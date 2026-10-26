export const requestStatuses = {
  REQUESTED: "접수",
  IN_PROGRESS: "처리 중",
  WAITING_BRAND: "브랜드 회신 대기",
  RESOLVED: "처리 완료",
  CLOSED: "종료",
} as const;

export const requestPriorities = {
  LOW: "낮음",
  NORMAL: "보통",
  HIGH: "높음",
} as const;

export type RequestStatus = keyof typeof requestStatuses;
export type RequestPriority = keyof typeof requestPriorities;
export type RequestAssignee = { id: string; name: string };
export type RequestRow = {
  id: string;
  title: string;
  tool: string;
  status: RequestStatus;
  priority: RequestPriority;
  organizationName: string;
  campaignId: string | null;
  campaignTitle: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};
export type RequestAttachment = {
  id: string;
  fileName: string;
  size: number;
  contentType: string;
  downloadUrl?: string;
};
export type RequestMessage = {
  id: string;
  body: string;
  internal: boolean;
  authorName: string;
  authorRole: "ADMIN" | "BRAND";
  createdAt: string;
  attachments: (RequestAttachment & { downloadUrl: string })[];
};
export type RequestDetail = RequestRow & {
  description: string;
  pendingAttachments: (RequestAttachment & { downloadUrl: string })[];
  messages: RequestMessage[];
  events: {
    id: string;
    action: string;
    actorName: string;
    createdAt: string;
    detail: string;
  }[];
  attachmentsEnabled: boolean;
};
export type RequestsResponse = {
  items: RequestRow[];
  total: number;
  page: number;
  pageSize: number;
  assignees: RequestAssignee[];
  counts: { open: number; overdue: number; unassigned: number };
};
