import { LoginForm } from "./login-form";
import {
  ArrowUpRight,
  Building2,
  ClipboardCheck,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "../brand-logo";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="admin-login">
      <section className="admin-login-story" aria-label="퓨쳐스 운영 콘솔">
        <BrandLogo href="https://futures-medialab.vercel.app" />
        <div className="admin-login-story-content">
          <span className="admin-eyebrow">퓨쳐스 운영 콘솔</span>
          <h2>
            좋은 협업의 시작,
            <br />
            빈틈없는 운영에서.
          </h2>
          <p>
            브랜드와 에이전시가 만나는 곳.
            <br />그 연결을 함께 관리해요.
          </p>
          <div className="admin-login-workflow">
            <div>
              <span className="admin-feature-icon">
                <Building2 size={23} />
              </span>
              <span>
                믿을 수 있는 파트너<small>회사 정보와 자격 심사</small>
              </span>
              <ArrowUpRight size={20} />
            </div>
            <div>
              <span className="admin-feature-icon">
                <Megaphone size={23} />
              </span>
              <span>
                새로운 캠페인의 시작<small>캠페인 검토와 공개 관리</small>
              </span>
              <ArrowUpRight size={20} />
            </div>
            <div>
              <span className="admin-feature-icon">
                <ClipboardCheck size={23} />
              </span>
              <span>
                투명하게 남기는 과정<small>운영 조치와 변경 이력</small>
              </span>
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>
        <span className="admin-login-copyright">
          Futures Medialab · 운영자 전용 공간
        </span>
      </section>
      <section className="admin-login-access" aria-labelledby="login-title">
        <a
          className="admin-back-to-site"
          href="https://futures-medialab.vercel.app"
        >
          퓨쳐스 메인으로 <ArrowUpRight size={18} />
        </a>
        <div className="admin-login-card">
          <span className="admin-login-lock">
            <ShieldCheck size={28} />
          </span>
          <h1 id="login-title">관리자 로그인</h1>
          <p className="admin-login-intro">
            오늘의 협업을 이어갈 준비가 되셨나요?
            <br />
            운영자 계정으로 시작하세요.
          </p>
          <LoginForm denied={query.denied === "1"} />
          <div className="admin-login-notice">
            <ShieldCheck size={18} />
            <p>
              운영자로 지정된 계정만 접근할 수 있습니다.
              <br />
              브랜드·에이전시 계정은 메인에서 로그인해주세요.
            </p>
          </div>
          <p className="admin-login-method">
            현재는 이메일 인증번호 없이 비밀번호로 로그인합니다.
          </p>
        </div>
      </section>
    </main>
  );
}
