# Google Drive Archive Site v3

Google Drive의 TXT 콘텐츠를 Cloudflare Pages + Pages Functions + Workers KV로 제공하는 아카이브 사이트입니다.

## 주요 변경사항

- 일반 화면은 Google Drive를 매번 조회하지 않고 `ARCHIVE_KV`에 저장된 JSON 목록을 읽음
- 관리자 페이지에서 `Drive 다시 읽기`를 누를 때만 Google Drive 메타데이터 재동기화
- TXT 본문도 첫 조회 후 KV 캐시에 저장
- 관리자 페이지: `/admin.html`
- 자동 파일명 파싱 실패 항목을 원본 파일명과 함께 확인 후 수동 수정
- 관리자 페이지에서 메인 화면 서브 타이틀 / 메인 타이틀 / 설명 문구 수정
- 본문 글꼴 `Ridibatang` 적용
- 로딩 중 하단 `검색 결과가 없습니다`가 보이던 hidden CSS 문제 수정

## GitHub 업로드 구조

저장소 루트에 아래와 같이 업로드합니다.

```text
public/
functions/
README.md
wrangler.toml
.gitignore
```

## 기존 Secret

Cloudflare Pages 프로젝트 → Settings → Variables and Secrets

### GOOGLE_SERVICE_ACCOUNT_JSON

기존과 동일하게 Google 서비스 계정 JSON 전체 내용을 Secret으로 저장합니다.

### ADMIN_PASSWORD

새 Secret을 하나 추가합니다.

```text
ADMIN_PASSWORD
```

값에는 관리자 페이지에서 사용할 비밀번호를 직접 정해서 넣으세요.

예:

```text
ADMIN_PASSWORD = 본인이 정한 긴 비밀번호
```

실제 비밀번호를 GitHub 파일 안에 작성하지 마세요.

## 필수: Workers KV 생성 및 연결

v3부터 빠른 목록 조회와 관리자 설정 저장을 위해 Workers KV가 필요합니다.

Cloudflare Dashboard에서 KV namespace를 하나 생성합니다.

이름 예:

```text
rjs-archive-kv
```

그다음 Pages 프로젝트에서:

```text
Settings
→ Bindings
→ Add
→ KV namespace
```

설정:

```text
Variable name: ARCHIVE_KV
KV namespace: 방금 만든 rjs-archive-kv
```

Production 환경에 연결한 뒤 프로젝트를 재배포합니다.

Cloudflare 공식 Pages Functions 문서에서 KV namespace는 Pages 프로젝트의 `Settings > Bindings > Add > KV namespace`에서 연결할 수 있으며, 코드에서는 `context.env.<binding>`으로 접근합니다.

## 첫 사용

배포 후:

```text
https://내주소.pages.dev/admin.html
```

접속합니다.

1. `ADMIN_PASSWORD`에 지정한 비밀번호로 로그인
2. `Drive 다시 읽기` 클릭
3. Drive 목록이 KV JSON에 저장됨
4. 이후 메인 사이트는 Google Drive 목록을 매번 조회하지 않고 KV를 읽음

KV에 목록이 아직 없을 경우 메인 화면 첫 요청에서도 자동으로 1회 Drive 동기화를 시도합니다.

## Drive 변경 후

Google Drive에 파일을 추가/삭제/이동했으면 관리자 페이지에서:

```text
Drive 다시 읽기
```

를 눌러주세요.

파일 내용만 수정했고 파일 ID는 그대로인 경우 `modifiedTime`이 바뀌며, 본문을 다시 열 때 새 캐시 키로 읽습니다.

## 관리자에서 파일명 수정

자동 파싱 실패 파일은 관리자 페이지의 `파일명 확인 필요` 영역에 표시됩니다.

예:

```text
원본 파일명:
[AB] 이상한_형식.txt
```

관리자가 제목 / 작성자를 직접 지정하고 저장하면, Google Drive 원본 파일명 자체를 바꾸는 것이 아니라 사이트 표시용 수정값을 KV에 저장합니다.

따라서 Drive 재동기화를 해도 수동 수정값은 유지됩니다.

## 메인 문구 수정

관리자 페이지에서 다음 항목을 변경할 수 있습니다.

- 서브 타이틀
- 메인 타이틀
- 설명 문구

메인 타이틀 textarea의 줄바꿈은 메인 화면에도 그대로 반영됩니다.

## 본문 폰트

본문에는 아래 웹폰트를 적용했습니다.

```css
@font-face {
  font-family: 'Ridibatang';
  src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff') format('woff');
  font-weight: normal;
  font-display: swap;
}
```

## Cloudflare Pages 설정

```text
Framework preset: None
Build command: exit 0
Build output directory: public
Root directory: 비워두기
```

`functions` 폴더는 저장소 루트에 둡니다.
