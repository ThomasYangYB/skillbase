# skillbase 운영 가이드

## 검증 운영

- `정적 검사`: 원격 `SKILL.md`를 실행하지 않고 frontmatter, 위험 명령, 비밀값 접근 패턴을 점검합니다.
- `공식 격리 검증`: Cloudflare Sandbox에서 사전 설치된 `skills` CLI를 실행합니다.
- `무결성 fallback`: 공식 CLI가 제한 시간 안에 끝나지 않으면 원본 해시를 재확인하고 `SKILL.md`만 격리 경로에 기록합니다. 이 결과는 공식 CLI 성공과 구분해 표시합니다.
- Sandbox Queue가 30분 안에 완료되지 않으면 stale 작업으로 만료 처리되며, 운영자 큐에서 다시 요청할 수 있습니다.

운영자 화면의 최근 30일 지표에서 공식 CLI 성공, fallback, 실패·대기 건수와 평균 소요 시간을 확인합니다. fallback 비율이 높으면 먼저 CLI 실행 로그와 허용 호스트를 점검한 뒤 timeout을 조정합니다.

## 공개 기준

1. 원본 URL과 `SKILL.md`의 이름·디렉터리가 일치하는지 확인합니다.
2. 정적 차단 신호가 없어야 합니다.
3. 승인 후 공개 전 검증 상태가 `legacy`, `static_passed`, `sandbox_passed`, `sandbox_fallback_passed` 중 하나여야 합니다.
4. fallback 통과는 운영자 확인이 필요한 상태로 취급합니다.

## 데이터 백업

운영자 큐 상단의 `데이터 백업`을 누르면 Skill, 승인 이력, 검증 이력, 수집 상태가 JSON으로 다운로드됩니다. 최소 주 1회와 대규모 수집 직후 백업을 보관합니다.

## 배포와 소스

- GitHub `main`은 공개 코드·CI 기준 저장소입니다.
- Sites 원격 저장소는 운영 배포 소스입니다.
- 변경 후 CI가 성공했는지 확인하고, Sites에도 같은 커밋을 반영합니다.
- 운영 runtime secret은 소스에 저장하지 않습니다.
