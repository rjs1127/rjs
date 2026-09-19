# Google Drive Archive Site

Google Drive 폴더 구조를 그대로 읽어서 콘텐츠 아카이브 사이트로 보여주는 Cloudflare Pages 프로젝트입니다.

## 현재 연결된 메인 폴더

`13F9JJxO2fayYeD9K6-wwjWrVOTQC7-AJ`

예상 구조:

```text
메인폴더
├─ AB
│  ├─ 단편
│  │  └─ [AB] 제목_작성자.txt
│  └─ 장편
│     └─ [AB] 제목_작성자.txt
├─ B
├─ CB
└─ ABC
```

인물조합 폴더명은 고정 개수일 필요가 없습니다.
메인폴더 바로 아래에 있는 폴더들을 자동으로 인물조합 필터로 사용합니다.

## 기능

- Google Drive 목록 자동 조회
- 인물조합 필터 자동 생성
- 단편 / 장편 필터
- 제목 / 작성자 / 파일명 검색
- 본문 모달 뷰어
- 제목 또는 작성자 파싱 실패 시 `파일명 불명`
- 본문 API 요청 시 메인 아카이브 폴더 내부 파일인지 서버에서 다시 검증
- 서비스 계정 키는 브라우저에 노출되지 않음

## Cloudflare Pages 배포

### 1. GitHub

이 프로젝트 폴더의 파일 전체를 GitHub 저장소에 업로드합니다.

### 2. Cloudflare Pages 프로젝트 생성

Cloudflare Dashboard → Workers & Pages → Create → Pages → GitHub 저장소 연결

설정:

- Framework preset: None
- Build command: 비워두기
- Build output directory: `public`

`functions` 폴더는 프로젝트 루트에 그대로 두어야 합니다.

### 3. 서비스 계정 Secret 등록

Cloudflare 프로젝트:

Settings → Variables and Secrets → Add

다음 값을 추가합니다.

- 이름: `GOOGLE_SERVICE_ACCOUNT_JSON`
- 타입: Secret / Encrypt
- 값: Google Cloud에서 내려받은 서비스 계정 JSON 파일의 **전체 내용**

예시 형태:

```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...@....iam.gserviceaccount.com"
}
```

실제 JSON 내용은 절대 GitHub에 업로드하지 마세요.

### 4. Google Drive 공유 확인

메인 Google Drive 폴더가 서비스 계정의 `client_email` 주소에 **뷰어**로 공유되어 있어야 합니다.

### 5. 재배포

Secret을 등록한 후 새 배포를 실행합니다.

## 로컬 개발

Wrangler가 설치되어 있지 않으면:

```bash
npm install -D wrangler
```

프로젝트 루트에 `.dev.vars` 파일 생성:

```text
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
```

`.dev.vars`는 Git에 올리지 않습니다.

실행:

```bash
npx wrangler pages dev public
```

## 파일명 파싱

기본 파일명:

```text
[AB] 제목_작성자.txt
```

앞의 `[AB]`는 제거하고, 마지막 `_`를 기준으로 제목과 작성자를 분리합니다.

예:

```text
[AB] 제목에_언더바가_있음_홍길동.txt
```

결과:

- 제목: `제목에_언더바가_있음`
- 작성자: `홍길동`

정상적으로 나눌 수 없으면:

- 제목: `파일명 불명`
- 작성자: `파일명 불명`

## 주의

`GOOGLE_SERVICE_ACCOUNT_JSON`은 반드시 Cloudflare Secret으로만 저장하세요.
`public/app.js`, GitHub 저장소, HTML 등에 서비스 계정 JSON이나 private key를 넣으면 안 됩니다.
