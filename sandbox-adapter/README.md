# Skillbase Sandbox Adapter

별도 Cloudflare Worker + Sandbox Container에서 Skill 설치 명령을 검증하는 어댑터입니다.

## 안전 경계

- `/verify`는 `SANDBOX_ADAPTER_TOKEN` 없이는 동작하지 않습니다.
- 설치 명령은 `npx skills add https://github.com/<owner>/<repo> --skill <name>` 형식만 허용합니다.
- Sandbox는 인터넷을 기본 차단하고 GitHub·npm 허용 목록만 사용합니다.
- 사이트의 비밀값은 Container에 전달하지 않습니다.
- 작업마다 고유 Sandbox를 만들고 완료 후 `destroy()` 합니다.
- 검증 결과는 사이트의 callback API로 `sourceHash`와 함께 되돌립니다.

## 로컬 준비

Docker Desktop과 Cloudflare 로그인이 필요합니다.

```powershell
npm install
npm run typecheck
npm test
npx wrangler login
```

로컬 실행:

```powershell
npx wrangler secret put SANDBOX_ADAPTER_TOKEN
npx wrangler secret put SKILLBASE_CALLBACK_TOKEN
npm run dev
```

운영 배포:

```powershell
npx wrangler secret put SANDBOX_ADAPTER_TOKEN
npx wrangler secret put SKILLBASE_CALLBACK_TOKEN
npm run deploy
```

배포 후 `/health`가 200인지 확인하고, 어댑터 URL을 사이트의 `SKILLBASE_SANDBOX_URL`로 설정합니다. `SANDBOX_ADAPTER_TOKEN`과 사이트의 `SKILLBASE_SANDBOX_TOKEN`은 같은 값이어야 하며, callback을 쓰려면 `SKILLBASE_CALLBACK_TOKEN`과 사이트의 `SKILLBASE_SANDBOX_TOKEN`도 같은 값으로 둡니다.
