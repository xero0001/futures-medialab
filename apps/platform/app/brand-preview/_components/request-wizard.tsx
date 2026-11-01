"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, FileText, Globe2, LockKeyhole, Paperclip, ShieldCheck, Sparkles, X } from "lucide-react";
import s from "./request-wizard.module.css";

export type PreviewRequest = {
  title: string;
  route: "managed" | "open";
  budget: number;
  platform: string;
  goal: string;
  date: string;
  format: string;
  people: string;
  genre: string;
  selectedPlan: string;
  note: string;
  attachmentNames: string[];
};

type Props = {
  initialRoute: "managed" | "open";
  onClose: () => void;
  onSubmit: (value: PreviewRequest) => void;
};

const steps = ["브리프 작성", "익명 프리뷰", "요청 확인"];
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function RequestWizard({ initialRoute, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ title: "", genre: "RPG · MMORPG", budget: "20000", platform: "YouTube + 치지직", goal: "", date: "2026-11-20", format: "라이브 + VOD", people: "3" });
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [route, setRoute] = useState(initialRoute);
  const [selectedPlan, setSelectedPlan] = useState("A");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
    if (step > 0) dialog.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [step]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const budget = Number(form.budget);
  const people = Math.max(1, Number(form.people) || 1);
  const plans = [
    { id: "A", name: "요청 조건 중심", detail: "원하시는 형식과 인원에 집중한 균형 있는 구성", tag: "추천 구성", people, structure: people === 1 ? "상위 티어 1명" : `상위 티어 1명 + 미드 티어 ${people - 1}명`, range: [0.9, 0.98], reach: "35만–50만", focus: "핵심 메시지 전달 · 깊이 있는 플레이" },
    { id: "B", name: "도달 범위 확대", detail: "짧은 콘텐츠를 더해 다양한 시청자에게 도달", tag: "도달 우선", people: people + 2, structure: `미드 티어 ${people}명 + 라이징 2명`, range: [0.95, 1], reach: "45만–65만", focus: "쇼츠 비중 확대 · 새로운 시청자 유입" },
    { id: "C", name: "예산 효율 중심", detail: "필수 제작물을 중심으로 여유 예산을 확보", tag: "효율 우선", people, structure: people === 1 ? "미드 티어 1명" : `미드 티어 1명 + 라이징 ${people - 1}명`, range: [0.75, 0.85], reach: "25만–40만", focus: "제작물 집중 · 후속 집행 여력 확보" },
  ];
  const chosen = plans.find((plan) => plan.id === selectedPlan)!;
  const priceRange = (range: number[]) => `${usd(Math.floor(budget * (range[0] ?? 0)))}–${usd(Math.floor(budget * (range[1] ?? 1)))}`;
  const next = () => {
    if (step === 0) {
      if (!form.title.trim() || !form.goal.trim()) { setError("게임·제품명과 캠페인 목표를 입력해 주세요."); return; }
      if (!Number.isFinite(budget) || budget <= 0 || budget > 10000000) { setError("예산은 0보다 큰 금액으로 입력해 주세요. 최대 USD 10,000,000까지 입력할 수 있습니다."); return; }
      if (!Number.isInteger(Number(form.people)) || Number(form.people) < 1 || Number(form.people) > 100) { setError("희망 인원은 1명부터 100명까지 입력해 주세요."); return; }
      if (!form.date || form.date <= "2026-11-01") { setError("희망 게시일은 2026년 11월 2일 이후로 선택해 주세요."); return; }
    }
    setError("");
    setStep((current) => Math.min(2, current + 1));
  };

  return (
    <div className={s.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={s.dialog} ref={dialog} role="dialog" aria-modal="true" aria-labelledby="request-wizard-title" tabIndex={-1}>
        <header className={s.header}>
          <div><span className={s.eyebrow}>NEW CAMPAIGN</span><h2 id="request-wizard-title">새 캠페인 요청</h2><span className={s.demo}>화면 검토용 · 예시 데이터</span></div>
          <button className={s.close} type="button" onClick={onClose} aria-label="새 캠페인 요청 닫기"><X size={21} /></button>
        </header>
        <ol className={s.steps} aria-label="요청 작성 단계">
          {steps.map((label, index) => <li className={`${s.step} ${index === step ? s.current : ""} ${index < step ? s.completed : ""}`} key={label} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</li>)}
        </ol>
        <div className={s.content} ref={content}>
          {step === 0 && <>
            <div className={s.intro}><h3 tabIndex={-1} data-step-heading>어떤 캠페인을 준비하고 계신가요?</h3><p>핵심 조건을 알려주시면 예산에 맞는 구성을 먼저 보여드릴게요.</p></div>
            <div className={s.formGrid}>
              <label className={s.field}>게임·제품명 <span>필수</span><input autoComplete="off" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="예: 오로라 퀘스트 한국 출시" maxLength={100} /></label>
              <label className={s.field}>장르<select value={form.genre} onChange={(event) => update("genre", event.target.value)}><option>RPG · MMORPG</option><option>액션 · 슈팅</option><option>전략 · 시뮬레이션</option><option>캐주얼 · 퍼즐</option><option>기타</option></select></label>
              <label className={s.field}>총 예산 <span>USD</span><div className={s.currencyInput}><b>$</b><input type="number" min="1" max="10000000" step="1" value={form.budget} onChange={(event) => update("budget", event.target.value)} aria-label="총 예산 USD" /></div><small>프리뷰의 모든 구성은 입력 예산 안에서 제안합니다.</small></label>
              <label className={s.field}>콘텐츠 형식<select value={form.format} onChange={(event) => update("format", event.target.value)}><option>라이브 + VOD</option><option>VOD</option><option>쇼츠</option><option>라이브 + 쇼츠</option><option>퓨처스 추천에 맡기기</option></select></label>
              <label className={s.field}>희망 인원 <span>명</span><input type="number" min="1" max="100" step="1" value={form.people} onChange={(event) => update("people", event.target.value)} /></label>
              <label className={s.field}>플랫폼<select value={form.platform} onChange={(event) => update("platform", event.target.value)}><option>YouTube + 치지직</option><option>YouTube</option><option>치지직</option><option>SOOP</option><option>TikTok</option><option>퓨처스 추천에 맡기기</option></select></label>
              <label className={s.field}>캠페인 목표 <span>필수</span><input value={form.goal} onChange={(event) => update("goal", event.target.value)} placeholder="예: 출시 주간 인지도와 사전예약 확대" maxLength={200} /></label>
              <label className={s.field}>희망 게시일<input type="date" min="2026-11-02" value={form.date} onChange={(event) => update("date", event.target.value)} /></label>
              <label className={`${s.field} ${s.full}`}>추가로 알려주실 내용 <span>선택</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="타깃 시청자, 꼭 전달할 메시지, 비공개 여부 등을 알려주세요." maxLength={2000} /></label>
            </div>
            <label className={s.upload}><Paperclip size={18} /><span><strong>브리프·게임 소개 자료 첨부</strong><small>{files.length ? files.join(" · ") : "파일 선택을 체험할 수 있습니다. 파일은 전송되지 않습니다."}</small></span><input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.png,.jpg" onChange={(event) => setFiles(Array.from(event.target.files ?? []).map((file) => file.name))} /><b>파일 선택</b></label>
          </>}
          {step === 1 && <>
            <div className={s.intro}><span className={s.aiLabel}><Sparkles size={14} /> 구성 프리뷰</span><h3 tabIndex={-1} data-step-heading>같은 목표, 세 가지 실행 방향</h3><p>{form.title} · {form.platform} · 예산 {usd(budget)}</p></div>
            <div className={s.notice}><LockKeyhole size={17} /><p><strong>참고용 구성 · 가용성 미확인</strong><br />이름과 채널은 공개하지 않습니다. 운영팀이 검토한 공식 제안에서 크리에이터와 확정 조건을 확인할 수 있습니다.</p></div>
            <div className={s.planGrid}>{plans.map((plan) => <button type="button" key={plan.id} className={`${s.plan} ${selectedPlan === plan.id ? s.selectedPlan : ""}`} onClick={() => setSelectedPlan(plan.id)} aria-pressed={selectedPlan === plan.id}><div className={s.planTop}><span className={s.planLetter}>{plan.id}</span><span className={s.planTag}>{plan.tag}</span><span className={s.radio}>{selectedPlan === plan.id && <Check size={13} />}</span></div><h4>{plan.name}</h4><p>{plan.detail}</p><div className={s.planPrice}>{priceRange(plan.range)}</div><div className={s.planRule} /><dl><div><dt>구성 인원</dt><dd>{plan.people}명</dd></div><div><dt>예상 조회</dt><dd>{plan.reach}</dd></div></dl><div className={s.structure}>{plan.structure}</div><small>{plan.focus}</small></button>)}</div>
            <p className={s.footnote}>시안의 구성과 예상 조회는 화면 설명을 위한 예시입니다. 실제 견적·성과를 보장하지 않습니다.</p>
          </>}
          {step === 2 && <>
            <div className={s.intro}><h3 tabIndex={-1} data-step-heading>어떤 방식으로 진행할까요?</h3><p>선택한 구성을 바탕으로 퓨처스가 소싱과 공식 제안을 준비합니다.</p></div>
            <div className={s.routeGrid}>
              <button type="button" className={`${s.route} ${route === "managed" ? s.selectedRoute : ""}`} onClick={() => setRoute("managed")} aria-pressed={route === "managed"}><Clock3 size={24} /><div><strong>48시간 맞춤 제안</strong><p>정해진 일정에 맞춰 퓨처스가 직접 구성합니다.</p><small>접수 완료부터 주말 포함 48시간 안에 공식 제안</small></div><span className={s.radio}>{route === "managed" && <Check size={13} />}</span></button>
              <button type="button" className={`${s.route} ${route === "open" ? s.selectedRoute : ""}`} onClick={() => setRoute("open")} aria-pressed={route === "open"}><Globe2 size={24} /><div><strong>오픈 캠페인</strong><p>검증된 파트너 모집을 통해 폭넓게 찾아봅니다.</p><small>모집 조건과 일정은 담당자 확인 후 안내</small></div><span className={s.radio}>{route === "open" && <Check size={13} />}</span></button>
            </div>
            <section className={s.summary} aria-label="요청 내용 확인"><h4><FileText size={17} /> 요청 내용 확인</h4><dl><div><dt>게임·제품</dt><dd>{form.title}</dd></div><div><dt>캠페인 목표</dt><dd>{form.goal}</dd></div><div><dt>선택 구성</dt><dd>{chosen.id} · {chosen.name} / {priceRange(chosen.range)}</dd></div><div><dt>매체·형식</dt><dd>{form.platform} · {form.format}</dd></div><div><dt>희망 게시일</dt><dd>{form.date.replaceAll("-", ".")}</dd></div>{note && <div><dt>추가 내용</dt><dd>{note}</dd></div>}{files.length > 0 && <div><dt>선택한 자료</dt><dd>{files.length}개 · 전송되지 않음</dd></div>}</dl></section>
            <div className={s.assurance}><ShieldCheck size={18} /><span>브랜드는 공식 제안의 구성과 조건을 승인합니다. 소싱과 파트너 소통은 퓨처스가 맡습니다.</span></div>
          </>}
          {error && <div className={s.error} role="alert">{error}</div>}
        </div>
        <footer className={s.footer}>
          <button type="button" className={s.secondary} onClick={() => { if (step === 0) onClose(); else { setError(""); setStep((current) => current - 1); } }}><ArrowLeft size={16} />{step === 0 ? "닫기" : "이전 단계"}</button>
          <span className={s.footerHint}>{step === 2 ? "실제 요청은 전송되지 않습니다" : `${step + 1} / 3`}</span>
          {step < 2 ? <button type="button" className={s.primary} onClick={next}>{step === 0 ? "익명 프리뷰 보기" : "이 구성으로 계속"}<ArrowRight size={16} /></button> : <button type="button" className={s.primary} onClick={() => onSubmit({ ...form, title: form.title.trim(), goal: form.goal.trim(), route, budget, people: String(chosen.people), note, attachmentNames: files, selectedPlan: `${chosen.id} · ${chosen.name}` })}><CheckCircle2 size={17} />요청 접수 체험</button>}
        </footer>
      </div>
    </div>
  );
}
