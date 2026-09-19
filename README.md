# Google Drive Archive Site — Change Log

이 README는 패치 버전별 변경사항을 누적 기록합니다.

## v6.2

### 수정
- 관리자 ZIP 배포에서 `README.md`가 보호된 설정 파일로 차단되던 문제 수정
- `README.md`는 앞으로 버전 변경이력 파일로 배포 허용
- `wrangler.toml`, `.env`, `.dev.vars`, `.gitignore`, credentials/secret 계열 파일은 계속 차단

## v6.1

### 수정
- v6 패치가 v4 기준 `admin.js`를 덮어써 v5의 관리자 배포 기능이 사라지는 문제 수정
- v5의 ZIP 업로드 → GitHub 커밋 → Cloudflare 자동 배포 기능 유지
- v6의 메인폴더 하위 전체 인물조합 탐색 기능 유지
- Google Drive 폴더 바로가기 탐색 지원
- 관리자 페이지에 폴더 탐색 현황 유지

### 포함 기능
- 관리자 페이지 ZIP 배포
- GitHub 자동 커밋
- Cloudflare Pages 자동 배포 연계
- Drive 재동기화
- AB / CB / ABC 등 메인폴더 하위 인물조합 전체 탐색
- 단편 / 장편별 TXT 개수 진단
- 파일명 수동 수정
- 메인 화면 문구 수정
- KV 캐시 기반 빠른 목록 조회
- 본문 캐시
- Ridibatang 본문 웹폰트 적용

## v6

### 추가
- 메인폴더 바로 아래 모든 인물조합 폴더 탐색
- 일반 폴더 및 Google Drive 폴더 바로가기 지원
- 인물조합별 단편 / 장편 / 총 콘텐츠 수 진단
- 특정 하위 폴더 오류가 전체 동기화를 중단하지 않도록 개선

## v5

### 추가
- 관리자 페이지에 사이트 배포 기능 추가
- ZIP 업로드 후 `public/`, `functions/` 경로만 GitHub에 커밋
- `wrangler.toml`, `.env`, `.gitignore`, credentials 등 보호 파일 자동 제외
- GitHub `main` 브랜치 커밋 후 Cloudflare Pages 자동 배포 연계

## v4

### 변경
- Drive 재동기화 시 정상 형식의 파일명이 관리자 수동 수정값보다 우선
- 정상 파일명으로 복원된 경우 기존 KV override 자동 제거

## v3

### 추가
- Cloudflare KV 기반 아카이브 JSON 캐시
- 관리자 페이지 추가
- Drive 수동 동기화 기능
- 파일명 파싱 실패 항목 수동 수정 기능
- 메인 화면 서브 타이틀 / 메인 타이틀 / 설명 문구 수정 기능
- 본문 첫 조회 후 KV 캐시
- Ridibatang 본문 폰트 적용
- 로딩 중 `검색 결과가 없습니다` 영역이 보이던 문제 수정

## v2

### 추가
- 카드형 / 리스트형 보기 전환
- `정상 / 확인 필요` 필터
- 파일명 파싱 실패 시 원본 파일명을 최대한 제목으로 사용
- 작성자 미확인 시 `작성자 미상`
- UTF-8 / UTF-16 / EUC-KR 계열 TXT 디코딩 보완

## v1

### 최초 구성
- Google Drive 메인폴더 연동
- 인물조합 / 단편·장편 필터
- 제목 / 작성자 검색
- TXT 본문 뷰어
- Cloudflare Pages Functions 기반 Drive API 연동

---

## 패치 배포 원칙

앞으로 각 패치 ZIP에는 다음을 포함합니다.

- 실제 변경된 소스 파일
- `README.md` 변경 이력

다음 파일은 사용자가 명시적으로 요청하지 않는 한 패치 ZIP에 포함하지 않습니다.

- `wrangler.toml`
- `.env`, `.dev.vars`
- `.gitignore`
- 서비스 계정 / 토큰 / 인증정보 관련 파일
- 기타 Cloudflare 배포 설정 파일
