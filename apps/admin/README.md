# 운영 콘솔

`apps/admin`은 같은 모노레포의 별도 Next.js 앱입니다. `apps/platform`과 PostgreSQL/Prisma 모델을 공유하고 별도 Vercel 프로젝트로 배포합니다.

## 접근 제어

- 공개 회원가입, 비밀번호 재설정, 계정 수정 API는 제공하지 않습니다.
- 활성 `PLATFORM` 조직의 `OWNER` 또는 `ADMIN` 멤버만 접근 가능합니다. 일반 브랜드·에이전시의 조직 관리자 역할과 다릅니다.
- 모든 관리 API와 서버 페이지가 권한을 DB에서 재확인합니다. 변경 트랜잭션에서는 세션 유효성도 다시 확인합니다.
- 관리자 쿠키 이름은 `futures-medialab-admin`으로 분리합니다. 이 프로젝트 전용 `BETTER_AUTH_SECRET`과 정확한 `BETTER_AUTH_URL`을 설정하세요. 플랫폼의 인증 secret을 재사용하지 마세요.
- 최초 관리자는 운영자가 별도 안전한 절차로 생성하거나 기존 사용자에게 `PLATFORM` 멤버십을 부여해야 합니다. 자동 권한 상승 기능은 없습니다.
- 이메일 인증 상태를 임의로 변경하지 않습니다. 이메일 OTP·MFA는 아직 연결되어 있지 않습니다. 실서비스 운영 확대 전에 추가해야 합니다.

## 기능

- 사용자 조회, 소속 조직·역할·이메일 인증 상태 확인, 일반 사용자 세션 종료
- 회사 정보와 비공개 사업자 증빙 검토, 조직 승인·보완 요청·이용 정지
- 캠페인 검토, 공개 승인 (`REVIEW → RECRUITING`), 보완 요청 (`REVIEW → DRAFT`), 모집 마감 (`RECRUITING → IN_PROGRESS`)
- 캠페인별 신청 에이전시 및 제안서 조회
- 주요 변경 및 증빙 다운로드 감사 기록

캠페인 공개는 활성 브랜드, 미래 신청 마감일, 플랫폼·요약 및 양수 예산이 필요합니다. 결제·계약·송금은 실행하지 않습니다. 조직 정보 보완 요청은 기존 프로필·문서를 보관하고 제출 완료 표시만 해제하여 재입력을 허용합니다. 플랫폼 운영 조직의 정지·권한 변경은 이 콘솔에서 지원하지 않습니다.

목록은 최근 200개, 감사 기록은 100개, 캠페인별 신청은 100개까지 표시합니다. 전체 합계와 표시 한도를 화면에 안내합니다. 대규모 운영에서는 서버 검색과 페이지네이션을 확장하세요.

## 환경 변수

- `DATABASE_URL` (기존 플랫폼과 동일 DB, 연결 풀 사용)
- `BETTER_AUTH_URL` (관리자 앱의 정확한 origin)
- `BETTER_AUTH_SECRET` (관리자 앱 전용, 최소 32자)
- `BLOB_READ_WRITE_TOKEN` (기존 비공개 사업자 증빙 저장소, 다운로드를 위해 필요)

증빙은 로그인·관리자 권한 검증 후 서버에서 읽고 첨부파일로 전달합니다. Blob URL·키·파일 경로를 클라이언트에 노출하지 않습니다.

## 확인

```sh
pnpm --filter @futures-medialab/admin build
pnpm --filter @futures-medialab/admin lint
node --experimental-strip-types --test apps/admin/scripts/verification.test.mjs
```
