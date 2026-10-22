import { LoginForm } from "./login-form";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="admin-login">
      <section>
        <div className="admin-wordmark">
          Futures Medialab <span>운영 콘솔</span>
        </div>
        <h1>관리자 로그인</h1>
        <p>
          운영자로 지정된 계정만 접근할 수 있습니다.
          <br />
          브랜드·에이전시 계정으로는 접속할 수 없습니다.
        </p>
        <LoginForm denied={query.denied === "1"} />
        <p className="admin-small">
          이메일 인증번호 입력은 현재 사용하지 않습니다. 계정 권한과 모든 주요
          조치는 서버에서 확인합니다.
        </p>
      </section>
    </main>
  );
}
