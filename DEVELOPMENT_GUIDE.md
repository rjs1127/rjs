# v10.71 — 도감 목록 메타·스포일러 최소 패치 원칙

- `wc-card-open .wc-book`는 목록에서 높이를 고정하고 `align-self:flex-start`로 텍스트/채움률 증가에 따른 이미지 모형 높이 늘어짐을 막습니다. 상세의 큰 책 모형은 별도 규칙을 유지합니다.
- 목록 `source_completion`은 기존 공개 인덱스의 연결 원본 source_type/id와 실제 상태를 비교해 **일치하는 알려진 상태 1종만** 보조값으로 내려줍니다. `catalog_works.completion` 직접 저장값은 우선하고 DB 상태는 바꾸지 않습니다. 원본 참고 상태는 채움률 계산에 들어가지 않습니다.
- 주의/호불호 및 작품 속 문장은 기본 접기 상태를 유지합니다. 문장 목록은 중첩 `<details>` 구조로 사용자가 먼저 섹션을 펼쳐야 내용이 보이도록 합니다. 비공개 문장 노출 정책/API는 바꾸지 않습니다.
- 표지 URL 필드는 현재 도감 DB/API에 없으므로 임의 추정하거나 파일명으로 URL을 만들지 않습니다. 실표지 지원은 검증된 이미지 참조 필드/저장 위치/접근 정책을 설계한 후 별도 패치로 진행합니다.
- HISTORY.md의 GitHub main 자동 재생성 정책을 유지합니다.

# v10.70 — 작품 도감 작은 채움률·퀘스트 시트 안전 규칙

- `catalogFill(work)`의 **5개 기본 정보** 채움률은 목록·상세·퀘스트에서 같은 규칙을 사용합니다. 실제 공용 도감에 저장한 장르/키워드 배열, 줄거리/추천 문구, 연재 상태(unknown 이외)만 인정하며 원본 참고 상태 `source_completion`은 계산하지 않습니다. 채움률은 정확도/검증도나 개별 이용자 기여도가 아닙니다.
- `wc-quest-trigger`는 작품 상세의 이전 큰 참여 안내 카드를 대신하는 작은 한 줄 버튼입니다. `wcQuestDialog`는 접근 가능한 네이티브 모달이며 모바일 하단 시트/PC 소형 팝업으로 표현합니다. Escape/닫기/퀘스트 편집 이동/상세 닫기/페이지 숨김 시 닫히는 상태를 관리합니다.
- 퀘스트 항목의 완료는 저장된 DB 필드 기반 읽기 전용 상태입니다. 미완료 작업은 기존 `openEditor(op)`를 재사용하므로 로그인 선확인, API Origin·세션, 24시간 한도, 409 revision 충돌, 감사 이력 등은 변하지 않습니다. 기존 편집 다이얼로그와 동시에 모달을 열지 않습니다.
- 직접 편집 성공 시 서버의 새 공용 작품 데이터로 다시 계산하여 **값이 증가할 때만** 이전→이후 안내를 보여줍니다. 단순 정보 보완 시 퍼센트가 오르지 않아도 별도의 감사 문구를 보여줍니다. 목록에서 재진입하면 갱신된 데이터로 계산합니다.
- 새 D1 테이블, 신규 API, KV 캐시나 추가 요청 없음. 기존 관리자/드라이브/포스타입/독서 뷰어/문장 기능은 변경하지 않습니다.
- HISTORY.md는 GitHub main 실제 커밋 기준 자동 생성본을 보존하며 수동으로 커밋 내역을 추가하지 않습니다.

# v10.69 — 작품 도감 참여 안내 UI 최소 변경 안전 규칙

- 공개 작품 상세의 기존 `renderDetail()`과 `wcEditDialog`를 재사용해 빈 정보에 대한 안내/빠른 접근과 작성 가이드·저장 확인만 추가한다. `data-wc-edit` 및 `data-wc-edit-menu`로 기존 클릭 경로를 유지한다.
- 미등록 여부는 서버 응답의 공개 필드(`synopsis`, `genres`, `tags`, `recommendation`, `completion`/`source_completion`)를 화면에서만 판정하며, 별도 DB 쓰기나 신규 API 호출을 하지 않는다. 서브커플/주의사항은 선택적으로 남길 수 있는 정보이므로 필수 빈 정보로 오인하여 강조하지 않는다.
- 편집 버튼을 누를 때 기존 계정 버튼의 `logged-in` 상태를 확인하고, 비로그인 시 기존 로그인 클릭 핸들러를 호출한다. 서버의 세션/Origin/수정 횟수/리비전 검사와 401/409 대응은 변경하지 않는다.
- 성공 알림은 동일한 작품 상세를 다시 렌더할 때 화면 상단에 표시하고, 새 작품을 열 때 초기화한다. 이전 작품/다른 사용자로 알림이 누적되지 않도록 한다.
- 다중 장르·키워드/추천 문구는 기존 누적/중복/원자 저장 API를 그대로 사용하며 기존 메타 및 긴 텍스트는 HTML escape 처리한다. 관리자/Drive/POSTYPE/독서 뷰어는 수정하지 않는다.
- `HISTORY.md` 실제 커밋 자동 생성본은 덮어쓰거나 임의로 작성하지 않는다.

# v10.68 — 작품 도감 상세 레이아웃 개선 안전 원칙

- 공개 작품 상세의 `renderDetail()` 마크업과 `work-catalog.css`의 도감 전용 클래스만 조정. `data-wc-edit` 동작 식별자(`synopsis_set`, `genre_add`, `tag_add`, `recommendation_add`, `completion_set`, `subcouple_update`, `warnings_set`)는 기존 값 그대로 유지한다.
- 섹션 제목/하위 분류/기본 정보 항목의 버튼을 동일 크기로 우측 정렬하고, 접힌 서브커플·주의요소는 기존 펼침 구조와 접근성을 보존한다.
- 공개 문장(`wc-work-quote`)의 목록 미리보기·펼침 텍스트만 소폭 축소한다. 문장 피드 자체 UI와 문장 조회·저장·저작권·공개 정책은 변경하지 않는다.
- 라이트/다크 테마 변수를 재사용하고 320px에서도 텍스트/버튼 겹침이 없도록 그리드를 제한한다. 사용자 인증·D1/API·관리자 코드·파일 열람 동작에는 변경을 가하지 않는다.
- `HISTORY.md`는 GitHub main 실제 커밋 기준 자동 생성 원본을 유지한다.

# v10.67 — 작품 도감 입력·초기값·이력 안전 규칙

- 사용자 즉시 편집 API에 `genre_add`(기존 태그/장르 JSON 배열 검증 재사용), `completion_set`(기존 `unknown`, `ongoing`, `completed`, `hiatus` 유지 + `incomplete` 추가), `subcouple_update`(상태·설명을 동일 UPDATE/batch/revision/이력에서 원자적으로 갱신)를 추가. 기존 단건 제안/승인 및 `subcouple_set`/`subcouple_note_set` API는 호환 유지.
- `catalogFields()`의 연재 상태 값에 `incomplete`를 추가하지만 운영 DB CHECK나 기존 값을 이전/강제 변경하지 않는다. 원본 공개 인덱스의 실제 `status`(`완결`/`연재`/`연재중`/`미완`)만 초기 기본값으로 대응하고 작품형태(단편/연재물)만으로 `연재 중`을 추측하지 않는다.
- 기존 미확인 작품의 공개 상세 API는 **현재 연결된 공개 원본**에 확정적/동일한 상태가 있을 때만 `source_completion` 값을 제공한다. 사용자가 이미 수정한 도감 `completion`은 덮지 않으며, 원본 간 상태가 다르면 미확인으로 유지한다.
- `/api/work-catalog/history`는 서버에서 `published` 상태를 검사하고 최근 감사 기록의 **허용한 작업명·변경 시각만** 반환한다. 작업 전후 데이터·user_id·request_id·원문은 내보내지 않으며, 화면에서 눌렀을 때만 조회한다. 이력 UI는 되돌리기/전체 감사 다운로드와 다르다.
- 추가 GET 이력 조회는 최대 20개 행으로 제한해 D1 Rows Read를 관리한다. 다른 기능/독서 데이터/관리자 세션 경로는 수정하지 않는다.
- `HISTORY.md` 원본 자동 갱신 정책 유지.

# v10.66 — 작품 도감 빠른 입력·여러 항목 저장 안전 규칙

- 사용자는 `작품 정보 보완하기`에서 입력 항목을 선택하거나 상세 섹션별 수정 버튼에서 해당 항목을 바로 열 수 있다. 이 UI만 변경하며 관리자 편집 폼과 기존 작품 데이터는 보존한다.
- `POST /api/work-catalog/edit`는 레거시 단건 `{change:{value:string}}`을 유지한다. 신규 `{change:{values:string[]}}`는 `tag_add`, `recommendation_add`에만 허용하며 1~5개를 담는다. 양쪽 필드를 동시에 보내면 거부한다.
- 여러 항목은 기존 `catalogOperation()`을 작업용 row에 순서대로 적용해 중복, NFKC 태그 정규화, 최대 20개 태그, 추천 전체 1500자 등을 검사한다. DB UPDATE는 최종 단일 컬럼만 한 번 수정하고 revision 1회 증가, 요청 ID 1개·감사 이력 1개로 기존 D1 batch에서 원자적으로 수행한다.
- 기존 세션/Origin, 공개 작품, revision, 변경 전 값, 24시간 최대 12회 제한, 재요청 멱등성 및 409 충돌 처리 유지. 기존 단건·관리자 승인 경로에는 영향 주지 않는다.
- 사용자가 입력한 문자열은 항상 escapeHtml을 거쳐 미리보기 칩으로 출력하며, 팝업 HTML 이벤트는 도감 범위에만 바인딩한다. 모바일/PC, 다크모드, 취소·Escape·중복 추가 테스트를 포함한다.
- 이전 DB 테이블 변경 없음. HISTORY 원본 자동 생성 방식 보존.

# v10.65 — 작품 도감 보완 안전 규칙

- `POST /api/work-catalog/create`의 기존 공개 TXT·POSTYPE 원본 검증, 등록 중복 검사(원본 ID / 정규화 제목+작가), 이미 등록된 공개 작품 ID 응답 및 비공개 데이터 보호를 그대로 유지한다.
- `warnings_set`은 기존 `catalogOperation()`에서 지원하는 `warnings` 컬럼 연산을 공개 작품 `POST /api/work-catalog/edit` 화이트리스트에만 추가한다. 최대 1000자이며 기존 원자적 revision 조건, 멱등성, 수정 이력/24시간 한도 적용. 비어 있는 기존 주의 요소는 변경 없이 유지하고, 기존 값이 있는 경우 비우기를 허용한다.
- 모바일 하단 필터 시트 헤더 `wc-panel-title`은 2열 필터 CSS 그리드 전체를 차지해야 한다. 초기화/닫기는 `wc-panel-actions`로 묶고 WC 전용 CSS에만 반영한다. 검색·키워드·장르·필터 호출은 변경하지 않는다.
- `HISTORY.md`는 수동으로 커밋/날짜를 작성하지 않으며 배포 시 GitHub main 자동 생성 원본을 유지한다.

# v10.64 — 모바일 도감·콘텐츠 메뉴 UI 최소 수정 규칙

- 컴팩트 헤더의 사이트 이름은 모바일에서도 숨기지 않습니다. 부화면 검색창 숨김 조건(`is-secondary-page`)은 보존하며 헤더 오른쪽 버튼과의 레이아웃은 CSS로 정리합니다.
- 도감 모바일 `wc-quick-filters`는 장르 스크롤과 작은 필터 버튼을 가로로 배치합니다. `wcFilterPanel`은 모바일에서만 하단 시트이며, 열기·닫기·Escape·배경 클릭·완료 버튼에서 모두 상태/포커스/스크롤 잠금을 복원해야 합니다. PC의 기존 좌측 필터 패널 동작은 유지합니다.
- `wcOriginalLinks`는 작품 상세 헤더의 돌아가기 오른쪽에 배치합니다. TXT/POSTYPE 연결 API와 기존 `RJSOpenCatalogSource()` 사용 및 원본 공개 검사 정책은 수정하지 않습니다.
- 모바일 메인 콘텐츠 리스트 `details[data-list-more]`의 메뉴는 열린 동안 viewport 고정 위치로 배치합니다. 스크롤 컨테이너에 의해 잘리지 않도록, 열린 행의 `list-title-actions` transform(고정 위치의 containing block을 생성)을 제거하고 동일한 수직 중앙 위치로 보정합니다. 현재 스크롤·화면 크기에 따라 메뉴를 재배치하며 기존 북마크/다운로드/공유 핸들러를 유지합니다.
- 관리자, API, D1, TXT 뷰어 및 개인 독서 데이터는 변경하지 않습니다. HISTORY 원본은 수정하지 않습니다.

# v10.63 — 도감 등록 원본 검증 및 뷰어 링크 안전 규칙

- 신규 공개 도감은 **현행 `PUBLIC_ARCHIVE_INDEX_KEY`에 있는 TXT 또는 POSTYPE 원본 선택을 필수**로 한다. 클라이언트가 보낸 title/author/url을 신뢰하여 도감 작품을 생성하지 않는다. 공개 인덱스가 없거나 원본이 사라진 경우 등록을 거부한다.
- `POST /api/work-catalog/create`는 서버에서 `source_type`+`source_id`로 원본 존재를 확인하고 원본 메타로 제목/작가를 확정한다. 등록과 `catalog_source_links` 링크, 중복 요청 이력, 감사 이력은 동일 D1 batch에 포함한다. 링크의 UNIQUE 충돌은 batch rollback되어야 한다.
- `GET /api/work-catalog/sources`는 현재 공개 인덱스에서 최소 정보만 12건까지 검색한다. `GET /api/work-catalog/links`는 `published` 도감의 연결 중 현재 공개 원본만 내보내며, 비공개/관리자 원본 정보는 노출하지 않는다.
- 도감 상세 `보러가기`는 원본 ID를 기존 사용자 메인 콘텐츠 `state.items`에서 찾아 `openContentItem()`로 연다. TXT는 현재 화면에 기존 뷰어 오버레이를 띄우며 메인 화면으로 이동하지 않는다. POSTYPE은 기존 `noopener,noreferrer` 외부 새 탭 처리를 재사용한다.
- 기존 연결 없는 도감에 제목/작가 유사도만으로 임의 원본 링크를 만들지 않는다. README, 도움말, version.json, index.html 정적 캐시 키를 같은 버전으로 맞춘다. HISTORY는 GitHub main 실제 커밋 자동 생성 원본 그대로 포함한다.

# v10.62 — 신규 작품 즉시 등록 안전 규칙

- 독자 등록은 로그인·동일 Origin을 요구하는 `POST /api/work-catalog/create` 전용 경로로 분리한다. 기존 작품 항목별 직접 수정(`edit`)과 승인 대기(`proposals`) API는 변경하지 않는다.
- 작품 등록은 제목만 필수로 두고 작가/원제를 선택 입력한다. 전부 서버에서 길이 검증과 NFKC/공백 정규화를 수행한다. 등록 즉시 `catalog_works.status='published'`로 저장되며 사용자의 개인 파일·메모·책갈피·문장/원본 링크는 만들지 않는다.
- 공개/비공개/보관 작품 전체에서 제목+작가 중복을 확인하고 INSERT SQL 내부에 NOT EXISTS를 둬 요청 경쟁 시에도 중복 신규 INSERT를 막는다. 비공개/보관 작품에 대해서는 제목·내용·ID를 반환하지 않는다. 공개 중복은 기존 공개 ID로 이동하도록 안내한다. 제목이 다르거나 번역 제목이 다른 동일 작품 여부는 자동 판단하지 않으며 관리자 검토가 필요하다.
- 기존 `catalog_direct_edits`에 `operation='work_create'`, `request_json`, 요청 UUID·사용자·시간·작품 ID를 기록하고 동일 batch에서 `catalog_audit`를 남긴다. 최근 24시간 신규 최대 3건, 전체 직접 편집 합계 최대 12건. INSERT 조건 미충족 시 감사/등록 로그 삽입도 없어야 한다.
- 도감 목록 헤더의 작은 버튼으로 등록 팝업을 열고 등록 후 즉시 새 작품 상세로 이동한다. 새 작품을 더 자세히 채울 때는 기존 즉시 수정 UI를 사용한다. 새로 공개된 작품을 찾기 쉽도록 기존 필터를 정리하며 기존 검색/관리자/개인 기능은 건드리지 않는다.
- 운영 D1·대량 작품 시 제목/작가 중복 조회 비용, 중복 작품·악의적 등록·삭제/신고 처리량을 모니터링한다. 일치하지 않는 번역 제목 등 유사 중복은 이 규칙만으로 막을 수 없으므로 운영 관리가 필요하다.

# v10.61 — 작품 도감 정보 강조·메인 전환·컴팩트 검색 표시 규칙

- 서브커플은 부가 정보로 분류하며 작품 카드와 상세 상단의 중복 표시는 없애되, 상세 「부가 정보」 안에서 유무 확인 및 상태·설명 직접 수정은 유지한다.
- 상단 로고의 일반 클릭은 `navigateMobileBottomNav("home")`을 재사용해 독서 메인으로 전환하고 해당 히스토리 마커를 정리한다. Ctrl/Meta 등 수정키 클릭은 기본 링크 동작을 유지한다.
- `updateMobileBottomNav`의 현 페이지 표식을 헤더에도 반영하여 `compact-mode`의 메인 목록 검색창만 부화면에서 숨긴다. 도감 자체 검색, 프로필 검색, 뷰어 내 검색은 변경하지 않는다.
- 기존 API/D1 및 관리자 팝업/즉시 수정 인증·감사 이력 로직은 손대지 않는다.

# v10.60 — 작품 도감 사용자 즉시 편집 안전 규칙

- 로그인한 회원은 **공개(`published`) 작품의 허용된 단일 항목만** `POST /api/work-catalog/edit`로 즉시 반영한다. 지원 범위는 `tag_add`, `synopsis_set`, `subcouple_set`, `subcouple_note_set`, `recommendation_add`. 기존 전체 정보 덮어쓰기 또는 기존 관리자 승인 기능과 합치지 않는다.
- `catalogOperation()`의 필드 화이트리스트·제한값을 재사용한다. `catalog_works.revision` 조건 UPDATE, `last_mutation_token` 소유권 검사, `catalog_direct_edits` 요청 이력 및 `catalog_audit` 관리자 감사 이력은 한 D1 `db.batch()`에 묶는다. 업데이트 실패 시 감사 이력만 단독으로 생성되면 안 된다.
- 직접 편집은 Origin 검사, 기존 사용자 세션 인증, 요청 UUID 중복 방지, 최근 24시간 12건 제한, 비공개 작품 차단 적용. 입력 문자열을 DOM에 HTML로 직접 삽입하지 않고 escape 처리한다. 기존 `catalog_proposals` 및 관리자 수동 수정/승인 시스템은 남긴다.
- 운영 DB는 기존 `ensureWorkCatalogSchema()`에서 `catalog_direct_edits`/인덱스를 `IF NOT EXISTS`로 추가하고 기존 사용자 문장/서재/원본 데이터에는 관여하지 않는다. 관리자 작품 완전 삭제 시 전용 이력만 함께 정리한다.
- 공개 도감 상세·목록·필터 GET 캐시는 즉시 공개 요구에 따라 `no-store`. 성능/DB 읽기 증가를 감시한다. 프로그래밍 포커스를 받는 비대화형 `#wcDetailHeading`에만 outline을 제거하고 기존 키보드 포커스 표시를 유지한다.
- 실제 운영 D1 및 모바일 실기기 검증은 배포 후 수행한다. HISTORY.md 수동 편집 금지.

# v10.59 — 도감 CP와 공개 문장 연결 규칙

- CP는 공개 인덱스의 combination과 catalog_source_links 원본 ID로 읽는다. 별도 CP 컬럼이나 제목 기반 자동 병합을 추가하지 않는다.
- 관리자 POST /api/admin/work-catalog-import는 세션 검사 후 미등록 원본을 최대 20건 공개 등록한다. 기존 도감은 덮어쓰지 않는다. INSERT 조건과 D1 batch로 동시 실행/재시도의 중복 및 고아 작품을 방지한다. 운영 등록은 관리자가 버튼을 실행할 때만 수행한다.
- shared_quotes.work_id는 원본 ID이며 도감 UUID와 다르다. 원본 공개 인덱스에 없는 ID, 같은 ID의 모호한 원본은 등록에서 제외한다. 제목/작가는 현재 원본에서, 다른 정보는 공란/unknown으로 초기화한다.
- 04 공개 문장은 catalog_source_links를 통해 현재 shared_quotes에서만 조회하며 사용자 기록과 작성자 식별 정보는 응답하지 않는다. no-store, 5건 cursor 조회, 공개 도감 검사 및 실패 후 재시도를 유지한다. 열린 화면의 자동 실시간 갱신은 하지 않는다.
- 사이트 버전 10.59 / 정적 캐시 1059. HISTORY.md 수동 변경 금지.

# v10.58 — 도감 UI 및 페이지 복원

- 페이지 복원은 기존 history.state의 rjsWorkCatalogPage/rjsQuoteFeedPage/rjsProfilePage 표식을 재사용합니다. DOMContentLoaded 이후 도감 스크립트가 준비되고 인증 복원이 끝난 뒤 기존 show 함수를 호출합니다.
- 일시 인증 실패 시 마이페이지 자동 진입을 보류하고 기존 복원 재시도 성공 시 다시 확인합니다. 공통 401 처리와 로그인 권한은 유지합니다.
- 도감 상세는 기존 rjsWorkCatalogDetailId를 유효성 검사 후 push:false로 조회하여 새 history 항목을 만들지 않습니다.
- 모바일 필터의 선택 완료는 패널만 닫고 선택값을 보존합니다. DB/API·개인 기록·뷰어·이어보기는 변경하지 않습니다.
- HISTORY는 실제 GitHub main 커밋 기반 자동 생성 규칙을 유지합니다.

# v10.57 — 작품 도감 목적·테마·버튼 UI 정리

- `public/index.html`의 `wc-hero`와 `public/work-catalog.css`의 사용자 도감 전용 스타일을 수정. 도감은 독자가 소설 정보를 함께 정리하는 공간이며 현재 공개 정보 **조회 전용**임을 구분한다.
- 색상은 기존 사용자 테마의 `--theme-*`를 참조하고 임의 청회색 활성 버튼을 제거한다. 소개 정보 텍스트는 제어 버튼처럼 보이지 않도록 구성.
- CSS만으로 검색/장르/키워드/모바일 필터/상세 이동 버튼을 시각적으로 간결히 한다. 사용자 도감 JS, DB·API, 관리자 팝업, 개인 독서 기능은 수정하지 않는다.
- `HISTORY.md`는 수동으로 이력 날짜·커밋을 추가하지 않는다. GitHub main 실제 커밋 자동 재생성 체계 유지.

# v10.56 — 사용자 작품 도감 헤더 디자인 정리

- 작품 도감 상단의 과장된 랜딩 히어로를 제거하고, 기존 셩냥책 UI 톤과 맞는 단정한 안내형 헤더를 사용한다.
- 오른쪽 큰 책 오브젝트 대신 짧은 포인트 칩(장르·키워드 탐색 / 연재 상태 확인 / 공개 작품만 보기)을 사용한다.
- 모바일에서는 단일 열 카드 + 포인트 칩 래핑 구조를 유지해 가로 넘침을 피한다.
- JS/API 변경 없이 `public/index.html`, `public/work-catalog.css`, 버전 정보만 수정한다.

# v10.55 — 사용자 작품 도감 탐색·상세 화면 (2차)

- 모바일 하단 작품도감/PC 작품도감 버튼의 안내 화면을 실제 공개 도감 목록, 검색, 장르/키워드 AND·OR, 연재 상태, 서브커플 필터 및 작품 상세로 확장.
- 작품 상세에서는 줄거리, 장르·키워드, 추천 문구, 서브커플 설명과 주의 요소(펼쳐보기)를 표시.
- API는 `published` 작품만 조회, 필터 집계 또한 공개 작품에 한정. 기존 관리자 및 개인 TXT·POSTYPE 기록은 수정하지 않음.
- 이번 버전에서는 사용자 정보 제안/수정 UI를 구현하지 않으며 다음 단계에서 연결.
- 배포 후 실제 D1 공개 도감 데이터와 모바일 실기기 동작은 별도 확인 필요.

# v10.54 작품 도감 백엔드 안전 규칙

- `catalog_works.revision`은 공용 작품의 변경 기준이며, 관리자 팝업 저장/삭제와 v2 승인 모두 읽은 기준 버전과 일치할 때만 변경한다. 사용자 공개 API `revision`은 캐시/검토용이며 클라이언트가 기준값을 임의 증분하지 않는다.
- 제안 `payload_json`은 `format:2`면 단일 필드 `{operation,change,before,base_revision}`이고, format이 없으면 기존 전체 필드 v1이다. 두 형식을 섞어 전체 작품 데이터를 덮어쓰지 않는다. 새로운 연산은 서버 whitelist 검증과 관리자 전후 비교 UI를 함께 확장한다.
- `review_token` 조건부 승인과 `db.batch`는 필수다. v2 상태 전환 보호 트리거는 구버전 코드를 배포하더라도 제거하지 않는다. 잘못된 승인·실패 후 pending 잔존과 동일 제출/동시 승인 경쟁을 테스트한다.
- `catalog_proposals`의 request_id 및 pending fingerprint UNIQUE 인덱스는 네트워크 재시도·중복 제안을 막는다. 최근 24시간 5건 한도는 D1 INSERT 조건으로 검사한다. 삭제된 제안은 카운트에서 빠지는 현재 정책을 유지한다.
- v10.54는 내부 API와 관리자 안정화 단계일 뿐, 사용자용 작품 도감 목록/검색/상세/제안 UI를 구현한 것이 아니다. 다음 패치에서도 기존 개인 TXT/POSTYPE/이어보기/문장 기능을 수정하지 말고 도감 전용 페이지에 연결한다.
- 운영 D1에는 예전 테이블이 있으므로 `CREATE TABLE IF NOT EXISTS` 뒤 `PRAGMA table_info`/추가 컬럼으로 점진 이관한다. 새 제안이 접수된 뒤의 롤백은 v2 인식 및 검토 토큰 가드를 유지한 API로만 진행하며 기존 v10.53 API를 그대로 덮어쓰지 않는다.

## v10.53 관리자 도감 입력 데이터 호환 규칙

- `catalog_works.country` 필드는 운영 중인 기존 자료와 API의 호환을 위해 **유지**하며, 관리자 팝업에서만 국가 입력을 숨긴다. 기존 값은 `form.elements.country` hidden으로 채워서 수정 저장 시 소실되지 않게 한다.
- `completion`/`subcouple` 신규 등록 선택값은 `unknown`으로 강제 초기화하되 등록된 기존 값은 그대로 표시한다.
- 태그 입력 UI는 `#` 접두어를 표시용으로 사용하고 저장 값은 기존 D1 JSON 배열에 접두어 없이 저장한다. 태그 목록 제한(20개, 30자)은 기존 서버 유효성 검사를 그대로 따르며 별도 API/DB는 신설하지 않는다.
- 복수의 추천 문구는 기존 단일 `recommendation` 문자열 내 빈 줄 구분(\n\n)으로 저장하며, 이전 저장 문자열은 조회 시 그대로 남겨야 한다. 사용자용 도감에서 문구를 카드/리스트로 보여줄 때 빈 줄을 기준으로 나눌 수 있지만 아직 해당 화면을 수정하지 않는다.
- 모바일 로그아웃 아이콘 UI CSS/SVG만 수정하며 세션 API와 기존 뷰어 상단 액션/컴팩트 검색 상태는 유지한다.

## v10.52 도감 관리자 등록 목록·완전 삭제 안전 규칙

- 기존 `GET /api/admin/drive-items`(Drive TXT)와 `GET /api/admin/postype-list`(POSTYPE 시트)를 관리자 도감 탭에서 **조회 전용**으로 사용합니다. 검색·필터·페이지 표시(50건)는 관리자 브라우저에서 처리합니다. 이 원본 목록은 `catalog_works`와 구분하며 도감 자료가 미등록인 작품도 선택 가능합니다.
- 등록된 원본을 선택하면 `GET /api/admin/work-catalog?source_type=...&source_id=...`로 연결된 도감 한 건을 별도 조회하므로, 목록 요약의 100건 제한에 의해 기존 도감 값이 누락되어 덮어써지는 문제를 피합니다. 조회가 끝나기 전에는 저장을 막습니다.
- `action=upsert_source`는 도감 저장과 원본 링크 생성(신규)을 D1 `db.batch()` 한 트랜잭션으로 수행합니다. 저장된 작품은 필드와 공개 상태를 한 번에 갱신합니다. `action=delete`는 도감 작품/그 작품을 가리키는 원본 링크/제안/감사 이력을 제거합니다. 삭제 확인에는 별도 재확인 문구 입력이 필요합니다. **원본 TXT·POSTYPE·개인 서재/문장 데이터는 삭제하지 않습니다.**
- 기존 도감 단독 작품(원본 연결 없음)은 접기 목록을 통해 접근하며 기존 도감 테이블 4개와 기존 사용자 기록 테이블은 변경하지 않습니다. 사용자의 작품 도감 화면은 이번 패치에서도 안내 화면으로 유지합니다.
- 모바일 헤더 로그아웃은 기존 인증 종료 이벤트를 그대로 사용합니다. 일반 뷰어의 딱지/상단 메뉴는 CSS 레이아웃만 조정하며 축소 뷰어의 기존 5개 액션과 오버플로 메뉴는 보존합니다.
- 관리자 폼 팝업 테스트는 가상 원본/가상 API를 사용한 Chromium 테스트입니다. 실 Cloudflare Pages/D1/Google Sheet/Android 실기기 검증을 대체하지 않습니다.

## v10.51 작품 도감 백엔드 안전 원칙

- 기존 D1 `USER_DB` 바인딩만 사용하고 `functions/_work_catalog.js`에서 **별도 테이블**을 최초 관리자 도감 API 접근 시 `CREATE TABLE IF NOT EXISTS`로 준비합니다. 기존 `user_items`, `user_quotes`, `user_sessions` 또는 저장된 TXT 원문을 이관·수정하지 않습니다.
- `catalog_works.status`는 `draft / published / archived`이며 공개 GET API는 `published`만 반환합니다. 공개 여부는 클라이언트가 아닌 서버 SQL에서 검사합니다. 개인 서재와 도감 사이에는 `catalog_source_links`를 통해 관리자 확인을 거친 `drive / postype` 원본 ID만 연결합니다. 단순 작품명·파일명 일치로 자동 병합하지 않습니다.
- 사용자 수정 제안은 `catalog_proposals`에만 저장하고 관리자 승인 후 반영합니다. 기존 작품 수정 제안에는 제출 당시 `updated_at`을 함께 저장하고 검토 중 원본이 변경되면 승인하지 않습니다. 신규 제안은 승인 후에도 `draft`로 생성됩니다. 관리자 작업은 `catalog_audit`에 작업 종류/시간을 기록하며, 관리자 세션 쿠키와 기존 사용자 세션 인증을 각각 재사용합니다.
- `public/admin-catalog.js`·`.css`는 도감 탭에만 적용하며 `functions/admin.js`가 로그인한 관리자에게만 관리자 HTML을 제공합니다. 기존 관리자 `admin-app.js`에서는 탭 전환 이벤트만 추가합니다.
- 현재 사용자 `workCatalogPage`는 준비 화면으로 유지합니다. 사용자 도감 목록/상세/제안 UI의 실제 연결은 별도 버전에서 시행하며 비공개 인생책이나 개인 독서 기록을 공용 도감에 자동 노출하지 않습니다.
- DB 생성 자체는 운영 배포 후 관리자 도감 탭 최초 진입 시 발생합니다. 실 D1/운영 Cloudflare 환경에서의 쓰기·인덱스 생성은 배포 후 별도 확인이 필요합니다.

## v10.48 — 프리셋 6종 후속 조정

- `public/app.js`에서 잉크잔향 전용 Canvas와 CSS override를 함께 갱신한다. 변경 대상은 잉크잔향, 레드 에디션, 필름누광, 크럼플, 글로우, 스테인드 로즈로 한정한다.
- 레드 에디션은 배경 장식 활자와 메타가 겹치지 않게 별도 불투명 하단 띠를 둔다. CSS 썸네일은 Canvas로 전환하지 않는다.
- 나머지 공통 프리셋 저장/관리자/API/렌더 분기는 유지한다.
- 버전 v10.48, 캐시 1048. HISTORY.md 수동 변경 금지(배포 시 실제 GitHub main 커밋으로 재생성).

## v10.47 — 문장 이미지 프리셋 후속 수정

- 잉크잔향은 `READER_SHARE_REDESIGN8.renderers` 전용 Canvas 렌더러와 `READER_SHARE_REDESIGN_OVERRIDES` CSS 썸네일을 함께 조정한다. 공통 문장 이미지 상태/저장/공유 로직은 변경하지 않는다.
- 레드 에디션 CSS 썸네일은 `READER_SHARE_CURATED_SET2.scene()`의 실제 벡터 장면을 CSS `background` data-SVG로 재사용하며 썸네일용 Canvas를 만들지 않는다. 최종 PNG는 전용 렌더러에서 안전 quoteBox와 clip을 사용한다.
- 테라코타 아치/테라조 팝/모아레 울트라는 사용자 카탈로그·효과 연결·서버 카탈로그·피드 후보에서 제거한다. 기존 D1/KV override와 localStorage 즐겨찾기/최근 사용 값은 직접 정리하지 않고 현재 카탈로그 필터에 맡긴다.
- 노을 한옥문은 기존 배경/색/메타를 유지하고 quoteBox 높이만 소폭 늘린다.
- `public/version.json`, `public/index.html` 표시 버전과 `/app.js` 캐시 키를 `10.47`/`1047`로 맞춘다. HISTORY.md는 GitHub main 실제 커밋 자동 생성 구조를 보존한다.

## v10.46 — 피드·PNG 준비 성능

- loadQuoteFeed()는 공개 프리셋 조회를 병렬 시작하되 피드 표시를 기다리게 하지 않는다. 설정 도착 후 refreshQuoteFeedThemes()로 기존 카드 스타일만 갱신한다.
- 최신순 좋아요 성공/실패는 updateQuoteFeedLikeButton()으로 해당 버튼만 갱신한다. 인기순 성공은 기존 서버 재조회 흐름을 유지한다.
- 클립보드 PNG 준비는 createImageBitmap 지원 시 유효성을 확인하고 bitmap을 닫은 뒤 원래 PNG 바이트의 독립 Blob을 만든다. 두 번째 Canvas 그리기/인코딩은 하지 않는다. 클릭 순간 ClipboardItem/write()와 generation/Promise 동일성 보호는 유지한다. 모바일 실기기 붙여넣기 호환성은 별도 확인 대상이다.

## v10.45 — 프리셋 보정·기본 문장 영역

- 기본 좌우 여백은 기존보다 1%p, 상하 여백은 2%p 작게 유지한다. 공통 렌더러는 getReaderShareTextInsets(), 전용 렌더러는 getReaderShareCustomQuoteBox()를 재사용하며 사용자 여백 조절값은 이 기본값에 더한다. 본문 뷰어·이어보기·문장 저장 위치 계산은 변경하지 않는다.
- 벨럼 문장은 sheets[2]의 중심과 회전값을 그대로 사용해 그린 뒤 Canvas 상태를 복원한다. 출처·브랜드와 다른 프리셋에 회전을 전달하지 않는다.
- 크래프트/kraft, 시트러스 슬라이스/citrus-slice, 옵틱 플리츠/optic-pleats는 사용자 및 서버 카탈로그에서 제거한다. 기존 D1/KV override와 즐겨찾기/최근 사용 데이터는 직접 삭제하지 않고 기존 키 필터를 유지한다.
- 아크릴 스텝 CSS 배경은 기존 scene()/svgScene()의 벡터 장면을 재사용한다. 한지 CSS의 섬유는 인라인 SVG이며 외부 이미지 요청이나 썸네일 Canvas 생성을 추가하지 않는다. 로컬 preset-review 테스트 페이지는 배포 파일에 포함하지 않는다.
- HISTORY.md는 기존 관리자 배포의 GitHub main 실제 커밋 자동 생성 구조를 유지한다.

## v10.41 — 문장 이미지 선택 썸네일 CSS 전환

- `READER_SHARE_REFERENCE_SET5.presets[].background`는 신규 5종의 CSS 배경이다. 가로 빠른 선택 목록과 전체보기는 해당 CSS 및 `.reader-share-css-art` 의사요소만 사용한다. **선택 썸네일 때문에 5종 Canvas renderer 또는 `toDataURL()`을 호출하지 않는다.**
- 최종 1:1·4:5·2:3 PNG는 기존 `READER_SHARE_REFERENCE_SET5.renderers`를 `renderReaderShareCanvas()`에서 호출하여 만든다. 미리보기/최종 저장·공유에서만 Canvas가 동작한다.
- 과거 `getReaderShareReferenceCanvasThumbnail()`와 메모리 PNG 캐시는 삭제했다. 기존 픽셀 폴더 프리셋의 전용 처리/지연 SVG 처리 및 관리자 서버 프리셋 공개 설정은 그대로 둔다.
- `public/version.json`과 `public/index.html` 앱 JS 캐시 키를 `10.41`/`1041`로 맞춘다. HISTORY.md는 GitHub main 실커밋 이력으로 관리자에서 재생성하는 구조를 보존한다.

## v10.40 Canvas 프리셋 썸네일 및 키치 그리드 문장 패널

- `READER_SHARE_REFERENCE_SET5.renderers`의 신규 5종은 기존 `renderReaderShareCanvas()`에서 최종 PNG를 생성한다. 사용자 프리셋 선택 목록과 전체보기 갤러리도 단순 CSS 그라데이션 대신 **동일 전용 렌더러를 소형 Canvas에 재사용**하여 색/장식/본문/메타가 예시로 보이게 한다.
- `getReaderShareCssBackground()`에서 5종만 `getReaderShareReferenceCanvasThumbnail()`을 사용한다. 키/비율별 `Map` 캐시 및 `IntersectionObserver` 지연 생성을 유지하고, 갤러리 카드의 별도 예시 문자와 이중 겹침이 생기지 않도록 5종에서는 CSS 예시 텍스트를 추가하지 않는다. 사용자 공유 PNG가 이 작은 썸네일로 대체되는 일이 없도록 한다.
- `kitsch-grid-memo`는 실제 메모지 패널의 크기와 quoteBox 안전 공간을 함께 넓히고 장식을 바깥쪽으로 옮겼다. 다른 4종의 Canvas 외형 및 기존 quote/shared APIs는 변경하지 않는다.
- `public/index.html`의 `/app.js?v=1040`과 `public/version.json` `10.40`을 일치시키고, HISTORY 자동 커밋 이력 구조는 유지한다.

## v10.39 이어보기 위치 보호

- `resumeScrollReaderFromSaved()`는 스크롤 높이가 준비되지 않았을 때 저장된 `scrollTop`을 0에 클램프한 결과를 성공으로 판정하지 않는다. 의미 있는 저장 위치가 있는 경우 0px 이동에 성공 판정을 내리지 않고 배너를 다시 표시한다.
- `saveReaderProgress()`는 미해결 이어보기 배너가 표시되고 본문이 시작 위치에 머무는 동안 임시 0%를 저장하지 않는다. 실제 사용자 스크롤 또는 페이지 전환 후에는 기존 저장 로직을 재개한다.
- 서버 `progress_saved_at`, 사용자 계정 정보, 다른 화면의 문장 위치 이동, 모바일 Safari 선택 제스처, 프리셋 Canvas 및 D1/KV 코드는 변경하지 않는다. `HISTORY.md`는 실제 GitHub main 이력 자동 생성 체계를 유지한다.

# v10.38 작업 메모

- 후속 디자인 수정은 항상 **직전 배포 기준 Canvas 렌더러만 최소 수정**합니다.
- `hanok-sunset-gate`는 v10.37 변경폭이 과했다는 피드백에 따라, 하늘·노을 배경 톤은 유지/복구하고 **제거 요청된 건물과 낙관 요소만 삭제**하는 방향으로 보정합니다.
- `kitsch-grid-memo`는 문장 가독성이 우선이므로 장식 요소보다 **quoteBox 확장**을 우선합니다.
- `public/index.html`과 `public/version.json` 캐시 키는 Canvas 렌더 변경에도 함께 갱신합니다.

---

# v10.37 작업 메모

- 문장 이미지 신규 Canvas 프리셋 후속 보정은 **기존 프리셋 키/공개 상태를 건드리지 않고 `public/app.js`의 전용 렌더러만 최소 수정**하는 것을 원칙으로 합니다.
- `hanok-sunset-gate`는 배경 일러스트 단순화 요청이므로 서버 프리셋 카탈로그 변경 없이 Canvas 도형만 수정합니다.
- `blue-vhs-sky`의 OSD 텍스트 제거처럼 저장 이미지 내부 문구만 바뀌는 경우에도 `public/index.html`과 `public/version.json`의 캐시 키는 함께 갱신합니다.
- `HISTORY.md`는 GitHub `main` 실제 커밋 기준 자동 생성 구조를 유지하며 수동 수정하지 않습니다.

---

## v10.36 신규 Canvas 프리셋 5종 공개 목록 등록

- 프리셋을 추가할 때는 사용자 `READER_SHARE_BACKGROUNDS`와 최종 `renderReaderShareCanvas()`의 렌더러 맵뿐 아니라 **서버 `QUOTE_IMAGE_PRESET_CATALOG`에도 동일한 키·이름·defaultVisible**을 반드시 등록해야 한다. 관리자 공개 Y/N과 사용자 공개 API는 서버 카탈로그가 기준이다.
- v10.35에서 빠진 5개 신규 키를 서버 카탈로그 끝에 등록하고 사용자와 서버의 기본 공개값을 `true`로 동기화한다. 기존 71종의 정의와 D1 설정 JSON은 변경하지 않는다. 서버에서 받은 explicit override가 있으면 그것을 우선한다.
- 5종은 custom Canvas renderers이고 문장피드 CSS 배경 후보는 아니므로 `QUOTE_FEED_CSS_KEYS`와 피드 공개 기본값에는 추가하지 않는다. 운영 KV/D1 쓰기·스키마 변경 없이 배포한다.
- 배포본 `public/index.html` 캐시 키와 `public/version.json`을 v10.36으로 맞추고 `HISTORY.md`의 실제 커밋 기반 자동 재생성을 유지한다.

## v10.35 문장 이미지 신규 Canvas 프리셋 5종

- 사용자 문장 이미지 배경 카탈로그에 **안개 산수(misty-ink-landscape) / 노을 한옥문(hanok-sunset-gate) / 블루 VHS 스카이(blue-vhs-sky) / 빈티지 뉴스 콜라주(vintage-news-collage) / 키치 그리드 메모(kitsch-grid-memo)**를 추가한다. 모두 기존과 같은 프리셋 객체(`name/key/background/text/meta/accent`)를 가지며 `defaultVisible: false`로 시작한다.
- 최종 PNG는 `renderReaderShareCanvas()` 내부 custom renderer 경로에서 처리한다. 즉 CSS 카드 배경은 빠른 미리보기용이고, 저장/공유되는 실제 이미지는 각 전용 Canvas 렌더러가 브랜드명·문장·작품명·작가명·장식 요소를 직접 그린다. 새 프리셋을 단순 `drawReaderShareThemeEffect()`용 CSS-only 효과로 축약하지 않는다.
- 기존 텍스트 설정(글꼴·굵기·자간·행간·좌우/상하 여백)과 `getReaderShareCustomQuoteBox()`를 그대로 사용한다. 새 프리셋에서도 텍스트 영역은 장식을 피하는 안전 구역 안에서만 조정하며, 기존 저장/공유/클립보드/즐겨찾기·최근 사용 키 및 공개 Y/N 필터는 그대로 유지한다.
- 배포본 `public/index.html`의 앱 JS 캐시 키와 `public/version.json`은 v10.35로 맞춘다. `HISTORY.md`는 실제 GitHub main 커밋 기준 자동 재생성을 유지한다.

## v10.34 문장 이미지 배경 갤러리 방문 기록 및 버튼 배치

- 사용자 문장 이미지 팝업의 기존 `rjsReaderShare` history 단계 위에 전체보기 갤러리용 `rjsReaderShareGallery` 단계를 추가한다. 시스템/브라우저 뒤로가기 시 갤러리만 닫고 편집기는 유지한다. 갤러리의 닫기·선택·Escape는 `history.back()`으로 해당 단계만 소비하며 popstate는 history를 추가 조작하지 않는다. 브라우저 앞으로가기도 갤러리 화면과 일치하게 갱신한다.
- 모바일 Capacitor backButton 핸들러는 `rjsReaderShareGallery`를 최상단 우선으로 처리하고 기존 문장 이미지 팝업·리더 닫기 순서를 보존한다.
- 작품 링크 복사 버튼은 두 열을 차지하고, 갤러리 즐겨찾기 별은 SVG로 중앙 정렬한다. 메인 썸네일의 즐겨찾기 배지는 생성 시 클래스 적용 순서를 유지하고, 즐겨찾기 localStorage 키와 공개 프리셋 필터, 관리자 화면·Canvas/API는 변경하지 않는다.
- 배포본 `public/index.html`의 앱 JS 캐시 키 및 `public/version.json`은 v10.34로 맞춘다. `HISTORY.md`는 실제 GitHub main 커밋 기준 자동 재생성을 유지한다.

# v10.33 문장 이미지 팝업 UI·즐겨찾기 우선 정렬

- v10.32 사용자 선택 화면만 소폭 재배치했다. Canvas 출력 모델, 프리셋 정의, 이미지 생성/저장/복사/공유/로그인/서버 요청·D1/KV 관리 구조는 건드리지 않는다. 관리자 quote embed는 기존 히든 처리·기능 유지.
- 빠른 선택과 전체보기 '전체' 목록은 공개 배경 중 즐겨찾기 키 → 최근 사용 키 → 기존 카탈로그 순서로 우선 보여준다. 숨김 프리셋은 로컬 기록에 남더라도 노출하지 않는다. 기존 즐겨찾기·최근 사용 localStorage 키와 갱신 흐름 유지.
- 갤러리 열기 시 close 버튼에만 포커스하고 검색 입력창에는 자동 포커스하지 않는다. 검색을 사용자가 눌러야 모바일 키보드가 나타난다. Escape 닫기, 기존 inert/return focus 경로 유지.
- 사용자 메인 sheet 내에서만 CSS 색 토큰을 분리해 `html.theme-dark`의 버튼/본문/비활성 텍스트 대비를 보장한다. 전체보기와 글꼴/비율/텍스트 설정, 즐겨찾기 상태, 저장/공유를 모바일에서 같이 검증한다.
- 이전 제공된 선택적 v10.33 롤백 ZIP을 **이 v10.33 개선 ZIP에 추가 적용하지 않는다**. 사용 후 UI만 원복하려면 현재 배포 버전보다 상위 버전 번호를 부여한 별도 원복 패치로 진행한다. HISTORY 자동 생성은 계속 GitHub main 실커밋 기준.

# v10.32 — 문장 이미지 배경 선택 UI

- 사용자 문장 이미지 팝업의 기존 슬라이드 썸네일과 Canvas 최종 결과를 유지하면서 배경 전체보기 갤러리·현재 배경 즐겨찾기·최근 사용·이름 검색만 추가한다. 관리자 iframe/프리셋 공개 검수에는 갤러리 버튼을 노출하지 않는다.
- 프리셋 키 기반 즐겨찾기(`rjsReaderShareFavoritesV1`)와 최근 사용 최대 12개(`rjsReaderShareRecentsV1`)만 브라우저 `localStorage`에 저장하고, 문장 내용/이미지/로그인 정보는 저장하지 않는다. 계정 간 동기화나 Cloudflare D1/KV 쓰기는 추가하지 않는다.
- 사용자 갤러리는 기존 서버 공개 Y/N을 그대로 필터로 적용한다. 관리자에 의해 숨김으로 바뀐 키는 로컬 즐겨찾기/최근 사용에 남더라도 공개되지 않는다. 기존 공개 API 캐시 정책과 재조회 빈도는 변경하지 않는다.
- SVG CSS 배경은 가까운 갤러리 카드만 IntersectionObserver로 지연 로드한다. 이미지 생성 경로·PNG 데이터·브라우저 클립보드 직접 클릭 경로는 건드리지 않는다. 모바일/다크모드에서 갤러리는 기존 팝업 내부 UI로 열고 뒤쪽 편집 영역의 포커스를 일시적으로 막는다.
- v10.31로 롤백하면 새로운 UI만 제거되며 브라우저 로컬 키는 무해하게 남는다. 관리자 ZIP 배포의 구버전 허용 여부는 기존 관리자 정책을 따른다. HISTORY.md는 실제 GitHub main 이력 자동 생성 구조를 유지한다.

# v10.31 사용자 기록·프리셋 저장 정합성

- 사용자 library/profile은 500행과 목록별 nextCursor를 반환하며 501번째 행은 후속 페이지 존재 확인에만 사용한다. 기존 날짜 내림차순과 file_id/work_id 오름차순·id 내림차순을 유지한 keyset 조건으로 앞 페이지 삭제에 따른 밀림을 방지한다. bootstrap도 items/likes 커서를 제공한다. 기존 offset 요청/응답은 호환용으로 유지하며 새 클라이언트는 커서를 우선한다. 추가 COUNT/쓰기/스냅샷 테이블 없이 기존 페이지 SELECT만 사용한다. 수집 중 같은 ID는 중복 추가하지 않고 반복 커서는 오류로 종료하며 완료 후 전체 상태를 적용한다. 동시 삭제된 이미 수집한 행이나 날짜가 변경된 행까지 완전한 스냅샷으로 고정하지는 않는다.
- 프리셋 설정의 source of truth는 v10.31부터 기존 D1 user_system_meta의 quote-image:preset-visibility:v1 행이다. 관리자 최초 저장 시 기존 KV 값을 INSERT OR IGNORE로 승계하며, 키별 JSON 수정과 이미지/피드 최소 1개 검사를 단일 SQL에서 실행한다. 기본값 복귀는 override를 제거하고 동일 값은 UPDATE하지 않는다. KV는 전환 전 읽기 fallback으로만 사용하며 쓰지 않는다. 공개 API의 기존 캐시 정책을 유지해 변경 반영에 기존 캐시 지연이 있을 수 있다.
- null/미지정/빈 문자열/공백 문자열 위치값은 숫자 변환 전에 제외하고, 정상적인 시작 위치 0은 허용한다. 위치 없는 내 서재 기록은 임의로 본문 처음으로 이동시키지 않는다. 과거 잘못 저장된 0은 정상 0과 구별할 수 없으므로 자동 데이터 보정은 하지 않는다.

## v10.31 문장 이미지 프리셋 보완
- 공개 설정 메모리 캐시는 성공 시 60초, 실패 fallback은 15초이며 기존 편집기/피드 진입에서만 만료를 확인한다. 진행 중 요청을 공유하고 이미지/피드 맵을 같이 갱신한다. 서버의 기존 max-age=60, stale-while-revalidate=300 정책은 그대로이므로 운영 설정의 반영 지연이 즉시 없어지는 것은 아니다. 공개 설정 갱신 시 열린 편집기의 숨겨진 선택 배경은 공개 목록의 첫 배경으로 전환한다. 서버 API/D1/KV 저장 구조와 sessionStorage fallback 형식은 변경하지 않는다.
- 팝업 종료는 이전 렌더 Promise/키를 분리하고 generation을 증가시킨다. 완료/실패/정리에서 이전 작업이 새 Promise나 팝업을 변경하지 않도록 generation과 Promise 동일성을 확인한다.
- bauhaus-constructivism/holographic-vaporwave/botanical-press/neon-matrix-terminal은 명시 선택 전 기본 굵기 700을 유지한다. 굵기 버튼 클릭 후에는 선택한 300/500/700을 사용하며 명시 선택 여부도 PNG 캐시 키에 포함한다. 편집기 재열기는 이 구분을 초기화하고 CSS/Canvas 모델은 같은 유효 굵기를 사용한다.
- 문장 이미지의 grapheme 분할기는 Intl.Segmenter 인스턴스 1개를 재사용하며 미지원 시 결합 문자·ZWJ·emoji modifier·regional indicator 쌍·한글 자모를 보수적으로 묶는다. fallback은 전체 Unicode grapheme 규칙을 구현한 외부 라이브러리가 아니다. 자간 0의 measureText/fillText 빠른 경로는 유지하고 줄바꿈·생략은 grapheme 경계를 보존한다. 본문 렌더링·이어보기 위치·사용자 저장 API는 변경하지 않는다.

## v10.30 프리셋 설정 롤백 절차
- v10.31의 첫 관리자 저장은 기존 KV의 overrides와 feedOverrides를 함께 INSERT OR IGNORE로 승계한다. 이후 D1이 기준이며 KV 이중 저장은 하지 않는다.
- v10.30은 KV만 읽으므로 코드만 되돌리면 v10.31에서 변경한 설정을 잃는다. 롤백 전 관리자 설정 변경을 잠시 중단하고, 실제 USER_DB의 user_system_meta에서 meta_key = 'quote-image:preset-visibility:v1'인 meta_value 전체 JSON을 읽어 안전하게 백업한다. ARCHIVE_KV의 동일 키 기존 JSON도 백업한다.
- 해당 D1 행이 있으면 JSON의 overrides/feedOverrides/updatedAt을 검증한 후 동일 JSON을 ARCHIVE_KV의 quote-image:preset-visibility:v1 키에 기존 관리자/Cloudflare 관리 절차로 반영하고 읽어 대조한다. D1 행이 없으면 이전이 시작되지 않았으므로 KV를 덮어쓰지 않는다. 그 뒤 v10.30으로 롤백하고 공개·관리자 양쪽 Y/N을 확인한다. 공개 응답의 기존 캐시 지연도 고려한다.
- v10.30에서 설정을 바꾼 뒤 v10.31로 재전환할 때는 설정 변경을 중단하고 양쪽을 백업한 뒤 최신 KV JSON을 동일 D1 행에 반영·대조한 후 배포한다. 남아 있는 D1 행 때문에 INSERT OR IGNORE는 다시 승계하지 않는다. 신규 테이블이나 상시 이중 저장은 필요 없다. 운영 KV/D1 쓰기는 운영자의 명시적 승인·관리 절차로만 수행하며 이 패치 작업에서는 실행하지 않는다.


# v10.24 — 문장피드 배경 Y/N 독립 관리

- 문장 이미지 프리셋 공개 여부와 문장피드 랜덤 배경 허용 여부는 같은 KV `quote-image:preset-visibility:v1`의 `overrides` / `feedOverrides`에 따로 저장한다. 기존 공개 플래그나 전체 이미지용 `getVisibleReaderShareBackgroundEntries()`를 피드에 재사용하지 않는다.
- 피드는 CSS-only 배경만 사용하고 이미지/SVG URL 및 Canvas 전용 장식은 선택 불가능하게 처리한다. 복잡한 디자인의 초기 feedVisible은 N이며, 화면에 문장이 겹쳐 가독성이 저하되는 것을 줄인다. 최소 한 개 이상의 피드 배경을 활성 상태로 보존한다.
- 최종 PNG는 기존 `renderReaderShareCanvas()`와 전용 renderers를 유지한다. 파스텔 픽셀 폴더 UI CSS는 전용 Canvas 렌더러의 `backgroundOnly` 분기로 브라우저에서 소형 프리뷰를 만들고 비율별 재사용한다. 프리셋 선택/관리자 갤러리의 1:1 미리보기 이외에는 불필요한 Canvas 생성 금지.
- `public/quote-pixel-folder-ui-background.webp` 참조 제거. 관리자 업로드 ZIP이 파일을 자동 삭제하지 않는 경우 저장소의 구 버전 정적 파일은 별도 삭제해야 한다.

# v10.16 — 초대 Drive 동기화 보안·안정성 기준

- `public/drive-sync.html`은 미리 알려 준 PIN을 입력하는 모바일 UI이며 관리자 계정/자동화 토큰을 전달하지 않는다. 값은 Cloudflare Secret `DRIVE_GUEST_SYNC_PIN`에만 저장한다. 이 PIN을 자바스크립트 소스, URL, 저장소, 응답 본문에 노출하지 않는다.
- `functions/api/guest-drive-sync.js`는 **POST + same-origin + JSON + PIN 검증** 후 기존 `runDriveAutoSync(env,"guest")`만 호출한다. POSTYPE나 강제 대량 삭제 옵션을 허용하지 않는다. 응답에서 원본 파일 목록·관리자 진단 정보를 보내지 않는다.
- 동일 isolate/IP 단위 요청 제한은 best-effort다. 공유 PIN은 이메일 인증이나 개인식별이 아니므로 특정 한 사람만의 사용을 보장하지 않는다. PIN 유출 시 Secret 교체가 필요하다.
- 기존 Drive/POSTYPE 자동동기화, 관리자 수동 동기화, 대량 삭제 보류·실패한 폴더 스캔 보호를 바꾸지 않는다. 초대 페이지와 기존 admin 경로는 기능 및 인증을 분리한다.

# v10.07 — 신규 문장 이미지 8종 Canvas·타이포그래피 구현 기준

- v10.07의 신규 8종은 `public/app.js` 내 `READER_SHARE_NEW8`에 제공받은 프리셋 정의와 Canvas 효과 함수를 원본의 이름/좌표/색상으로 함께 보존한다. 별도 API·Canvas 렌더 서버·외부 이미지/폰트 리소스는 추가하지 않는다.
- `READER_SHARE_BACKGROUNDS`에 `...READER_SHARE_NEW8.presets`를 추가하고 `drawReaderShareThemeEffect()`에서 동일한 효과 함수를 재사용한다. 관리자 갤러리와 사용자 PNG 저장·복사는 기존 `renderReaderShareCanvas()` 단일 경로를 이용한다.
- 제공된 `textFx`의 그림자/금박/엠보싱/외곽선은 신규 프리셋에만 적용한다. 기존 45종의 텍스트 배치·줄바꿈·선택 폰트·클립보드 클릭 경로는 변경하지 않는다.
- 신규 key 8종은 `functions/_quote_image_presets.js`에 동일한 이름/기본 `defaultVisible:false`로 추가한다. 공개 여부는 기존 관리자 KV override와 최소 1개 공개 정책을 그대로 따른다.

# v10.06 문장 이미지 관리자 갤러리·렌더링 안전 기준

- 관리자 문장 이미지 탭은 CSS 배경과 사용자 Canvas 결과를 컴팩트 카드 두 칸에 동시 표시하고 각각 1:1 확대 모달로 검수한다. 기존 Y/N 저장 API·KV 상태·최소 1개 공개 정책을 유지한다.
- `public/admin-app.js`는 인증된 단일 `?quote-test=KEY&quote-embed=1&quote-gallery=1` iframe에 `postMessage`로 렌더를 요청한다. iframe `public/app.js`는 관리 API 조회가 성공하고 등록된 key일 때만 메시지를 수락하며, 요청 전후에 origin/source/key/requestId를 확인한다. 일반 `quote-test` 검수와 사용자 편집기를 수정하지 않는다.
- 사용자와 **동일한 `renderReaderShareCanvas()`**를 사용해 1:1 1200px를 그린다. 목록의 Canvas 썸네일만 280px로 축소해 메모리에 저장하며, 모달 Canvas 확대는 별도로 1200px PNG를 요청한다. 화면에 보이는 항목부터 한 번에 하나씩 그려 동시 캔버스 메모리 부하를 억제한다. 모달/카드 URL 객체를 재사용하거나 폐기할 때 `URL.revokeObjectURL()`을 유지한다.
- 운영자 화면의 실제 인증·KV 설정·기기 성능은 브라우저 모의 테스트와 별도로 운영 배포 후 확인해야 한다. `functions/_quote_image_presets.js` 서버 key/기본 노출 목록과 `public/app.js` UI 카탈로그의 정합성을 유지한다.

# v9.93 문장 이미지 프리셋 검수·노출 기준

- 코드로 새 문장 이미지 프리셋을 추가할 때는 사용자에게 즉시 노출하지 않고, `functions/_quote_image_presets.js` 카탈로그와 `public/app.js` 배경 정의에 같은 안정된 key를 등록한다. 새 실험 프리셋의 기본값은 `defaultVisible:false`를 사용하고 관리자 `문장 이미지` 탭에서 실제 편집기 저장/복사 테스트 후 Y로 전환한다.
- 사용자 노출 여부는 KV `quote-image:preset-visibility:v1`의 작은 override 맵을 단일 출처로 사용한다. 기본값과 같은 값은 저장하지 않고, 사용자 편집기는 실제로 열 때만 공개 설정을 읽어 같은 페이지에서 재사용한다. 모든 프리셋을 숨기는 설정은 허용하지 않는다.
- 관리자 `문장 이미지` 검수는 별도 렌더러를 만들지 않고 숨은 `?quote-test=KEY&quote-embed=1` iframe에서 일반 사용자와 같은 Canvas PNG 경로를 재사용한다. `?quote-test=`는 관리자 세션 확인에 성공한 경우에만 비공개 프리셋을 열 수 있다.
- 문장 이미지 프리셋 효과·폰트·비율·저장/복사 로직을 변경할 때는 관리자 검수 기능과 사용자 공개 필터를 함께 확인하며, 서버 Functions/D1/KV에 이미지 렌더링 작업을 옮기지 않는다. 새 프리셋은 `public/app.js`와 `functions/_quote_image_presets.js` 양쪽에 같은 key와 `defaultVisible:false`를 함께 추가한다.

# v9.81 — 사용자 새 테마 잔여 베이지 상태색 통일

- `?ui=next`에서 메인/서재 `더보기` hover를 공통 control hover 토큰으로 통일했습니다.
- 리스트/카드의 TXT 다운로드·문장 인용 원형 버튼이 다크모드에서 따뜻한 베이지/브라운 계열로 남던 부분을 surface/border/text 공통 토큰으로 교체했습니다.
- 뷰어 설정의 선택 글꼴과 `내 정보 → 내 서재 → 저장 기록/오프라인 저장` 선택 상태를 다른 선택형 버튼과 같은 accent-soft 계열로 통일했습니다.
- 라이트/다크 모두 같은 `--sy-*` 토큰을 사용하며, 기존 기본 테마에는 영향을 주지 않고 `?ui=next` 미리보기에서만 적용됩니다.

**커밋 메시지 요약:** `v9.81 사용자 새 테마의 잔여 베이지 상태색을 통일합니다.`

---

# v9.65 관리자 프롬프트 보관함

- 관리자 `프롬프트` 탭은 `functions/admin.js`의 패널, `public/admin-app.js`의 정적 프롬프트 목록/복사·펼침 로직, `public/admin.css`의 전용 스타일로 구성합니다. 별도 KV/D1/API 저장소는 사용하지 않습니다.
- 프롬프트 추가·수정 시 인증/배포 기능과 분리된 정적 UI를 유지하고, 모바일 가독성과 클립보드 실패 fallback을 보존합니다.

# v9.64 TXT 분량순 정렬 기준

- 메인 정렬의 `분량순`은 공개 인덱스에 이미 존재하는 TXT(Drive) `size` 바이트 값을 큰 순서로 사용한다. 새 분량 메타데이터나 본문 글자 수 계산을 추가하지 않는다.
- `size`가 없거나 유효하지 않은 항목은 0으로 취급해 실제 size가 있는 TXT 뒤로 정렬하며, 동률은 제목순으로 안정적으로 정리한다. POSTYPE는 현재 `size`가 없으므로 전체 목록의 분량순에서는 뒤쪽에 위치한다.
- 제목순·작가순·최근등록일·최근발행일·북마크순과 출처 필터는 그대로 유지한다. 출처에 따라 정렬 옵션을 숨기거나 선택값을 자동 변경하지 않는다.

# v9.63 공개 통계·인증 API 남용 완화

- `_abuse_guard.js`는 Cloudflare의 CF-Connecting-IP와 visitor/세션/로그인 대상별 TTL 메모리 카운터를 사용한다. X-Forwarded-For와 클라이언트 전송 간격을 신뢰하지 않으며 KV/D1 쓰기·새 바인딩을 추가하지 않는다. 카운터·세션은 각각 최대 12,000개, 만료 정리는 최대 분당 1회다. IP 누락 시 공통 전역 버킷을 만들지 않으며 상한에서는 기존 제한을 유지하고 새 키는 fail-open한다. 재시작·분산 isolate·프록시 IP 변경에 대한 엄격한 전역 방어를 보장하지 않는다.
- analytics는 IP 120회/분·visitor 30회/분, 새 세션 IP 60개/10분·visitor 20개/10분을 제한한다. 같은 세션의 동일 지표는 2초 내 추가 쓰기를 생략하지만 활동/성능/가입 지표·인증 여부 변경은 보존한다. 가입은 IP별 시도 10회/15분·성공 3회/15분이며 INSERT 전에 슬롯을 예약하고 INSERT 실패 시 반환한다. 같은 공인 IP를 공유하는 다수 사용자는 IP 한도를 공유한다.
- 일반 로그인은 IP 60회/분·IP+아이디 12회/분 요청 상한과 IP+아이디 실패 8회/5분·IP 전체 실패 30회/10분을 적용한다. 관리자는 IP 10회/분·실패 5회/15분이다. 성공한 세션 발급 후 해당 실패 카운터만 지우고 요청량 카운터는 유지한다. 429는 기존 error JSON·no-store·Retry-After를 사용하며 인증 401과 세션 쿠키 흐름은 바꾸지 않는다. Turnstile은 기존 의견 제출 전용 흐름을 유지한다.

# v9.62 오프라인 저장 상태 UI 기준

- 오프라인 저장 여부의 source of truth는 `public/body-sw.js`가 관리하는 실제 본문 Cache Storage다. 별도 IndexedDB/localStorage에 본문이나 저장 상태를 중복 기록하지 않고, Service Worker 메시지로 현재 저장 ID 목록을 페이지에 전달한다.
- 본문 저장 성공, LRU/용량 정리, 404/410 삭제, 최신 공개 목록에서 제거, Worker 활성화/구버전 정리 뒤에는 열린 클라이언트가 저장 ID 목록을 다시 받아 UI를 갱신한다. UI 표시가 캐시 실재 여부보다 앞서거나 오래 남지 않게 한다.
- 메인 리스트는 데스크톱·태블릿에서 작은 오프라인 배지를 사용하고, 640px 이하 모바일에서는 긴 제목 폭을 침범하지 않도록 텍스트 배지를 숨기고 저장 행의 배경만 은은하게 구분한다. 카드형은 왼쪽 하단 배지를 사용한다.
- 내 정보의 `내 서재`에는 `저장 기록 / 오프라인 저장` 보기를 유지한다. 오프라인 저장 목록은 현재 공개 인덱스의 TXT와 실제 Cache Storage ID의 교집합만 보여주며, 온라인/오프라인 상태와 무관하게 확인할 수 있다.
- 리더가 열린 동안 네트워크 상태 안내는 페이지 모드 하단 이동 버튼과 겹치지 않도록 `reader-open` 상태에서 safe-area 포함 하단 여백을 추가한다. v9.60의 network-first·본문 전용 저장·용량/개수 제한·HTTP 오류 미대체 정책은 변경하지 않는다.

# v9.61 관리자 통계 내보내기 기준

- 기간은 공통 `_admin_period.js`의 KST 14·30·90일·전체를 사용한다. 화면은 기존 집계 API를 재사용하고 90일/전체의 성능 JSON 원본을 응답하지 않는다. 일반 페이지는 XLSX 생성기를 읽지 않는다.
- `stats-export`는 관리자 인증 후에만 D1 SELECT batch와 기존 KV snapshot/GitHub main 조회 캐시를 사용한다. 운영 상태를 수정하거나 새 통계 이력을 저장하지 않는다. export schema 1, 서버 cutoff를 고정하며 이후 갱신된 보존 원본이 감지되면 실패한다. 과거 가변 상태/삭제 이력 복원은 보장하지 않는다.
- 일/월 distinct는 원본 ID 기준으로 재계산한다. 재방문은 해당 기간 방문 브라우저의 cutoff까지 누적 세션 >=2이다. ID는 파일마다 임의 salt로 SHA-256 익명화하고 salt·계정명·인증값·사용자 원문은 내보내지 않는다. 성능 JSON은 기존 숫자 필드만 허용한다.
- 시트 00~13은 고정 순서다. 브라우저의 지연 로드 OOXML writer는 inline string을 사용해 수식 주입을 방지하고 숫자/날짜/비율을 타입으로 저장한다. 검산 FAIL은 다운로드를 중단한다. 원본 10,000행, 성능 JSON 8MiB, 응답 12MiB, XLSX 40MiB 초과는 명시 실패이며 조용히 자르지 않는다.
- 사용자 기록/콘텐츠는 현재 상태, 동기화는 마지막 저장 실행만 제공한다. 자동 동기화 running/error의 이전 실행 수치는 재사용하지 않는다. 없는 이력은 N/A이며 histogram 분위수는 구간 상한 근사값임을 표기한다. GitHub 커밋과 Pages 배포 수를 합치지 않는다. 기존 관리자 배포/HISTORY 자동 생성은 유지한다.

# v9.60 공개 TXT 오프라인 본문 캐시

- `public/body-sw.js`는 공개 표시 헤더가 있는 GET `/api/content?raw=1`의 정상 200 text/plain 본문만 저장한다. 원래 인증 요청은 서버에 전달하지만 캐시 키·저장 헤더에는 인증/사용자 정보를 넣지 않는다.
- 온라인 network-first, 네트워크 실패에서만 fallback한다. HTTP 오류는 fallback하지 않으며 404/410 및 정상 공개 목록의 ID 누락 시 본문을 정리한다. 목록은 정리 신호로만 읽고 캐시하지 않는다.
- Cache Storage 최근사용 순서로 최대 40개·총 32MiB·본문당 8MiB를 제한하고 QuotaExceeded 시 오래된 본문을 정리해 한 번 재시도한다. 저장 실패는 온라인 응답을 막지 않는다. 이어보기·본문 검색·렌더링 좌표 계산은 변경하지 않는다.
- 안정된 `/body-sw.js` URL은 no-cache·updateViaCache:none으로 갱신한다. 정책/저장 형식 변경 시 `rjs-body-` 네임스페이스 버전을 올리고 activate에서 구버전만 삭제한다. API 계약이 동일한 본문 전용 worker에 한해 skipWaiting/clients.claim을 사용하고 페이지를 강제 새로고침하지 않는다.
- HTML/정적 자산/작품 목록/계정 API는 저장하지 않는다. 오프라인 재열기는 이미 열린 사이트 화면에서만 보장하며 HTTPS/localhost 및 Service Worker 지원 브라우저에서 사용한다. Android 네이티브 실행에서는 등록하지 않는다.

# v9.59 삭제 작품 본문 보호

- Drive 원본 아카이브 저장 후 기존 본문 캐시 삭제 대기열을 공개 인덱스 갱신보다 먼저 처리한다. 정리 실패 시 대기열과 재시도를 유지한다.
- 본문 API는 원본 아카이브에서 제공 여부를 확인한 뒤 캐시를 반환한다. 정상 HIT는 Drive 호출 없이 KV 2회 병렬 조회를 사용하고, 아카이브가 없으면 기존 Drive 검증을 거친다. 본문 응답은 private, no-cache로 브라우저 재검증을 요구한다.

# v9.58 관리자 히스토리 데이터 기준

- 관리자 히스토리 화면의 source of truth는 GitHub main의 실제 커밋 이력이다. 기존 history API의 GitHub 조회 경로를 기본으로 사용해 관리자 배포를 거치지 않은 직접 Git push도 표시한다.
- 성공한 이력은 동일 Worker isolate에서 최대 5분간 캐시하고 동시 조회를 공유한다. 관리자 인증과 GITHUB_TOKEN 존재 확인은 캐시 접근 전에 수행하며, 오류는 캐시하지 않는다. 브라우저 응답은 no-store를 유지한다.
- 커밋 수·메시지의 버전 표시는 실제 Pages 배포 횟수와 구분한다. 커밋 이력을 배포 성공 횟수로 취급하지 않는다.
- HISTORY.md 파일은 기존 관리자 배포 시 실제 main 이력을 바탕으로 자동 재생성하는 구조를 유지한다. 직접 Git 배포 뒤 HISTORY만을 위한 별도 커밋이나 수동 추측 기록을 만들지 않는다.

# v9.55 GPT 새 채팅 인수인계 기준

- 메인 hero의 eyebrow/title 표시값은 `/api/archive`가 반환하는 `settings.eyebrow`/`settings.title`을 단일 출처로 사용한다. `index.html`에 과거 문구를 fallback 데이터처럼 하드코딩하지 않고, 빈 문자열도 유효한 설정값으로 DOM에 그대로 반영한다. `hero-settings-pending`/`hero-settings-ready` 깜빡임 방지 구조와 SITE_NAME/favicon/설정 저장 구조는 별도 요구 없이 함께 변경하지 않는다.
- 새 채팅의 개발 시작점은 루트 `GPT_DEVELOPMENT_HANDOFF.md`로 통일한다. 사용자가 최신 전체 ZIP을 첨부하면 해당 ZIP을 유일한 기준본으로 삼고 `public/version.json` → 인수인계 문서 → README 최신 섹션 → DEVELOPMENT_GUIDE 관련 구간 → 작업 관련 실제 소스 순으로 최소 범위만 확인한다.
- 전체 HISTORY와 전체 개발 가이드를 매 작업마다 처음부터 읽지 않는다. 과거 회귀 확인이 필요한 경우에만 `HISTORY.md`를 기능/버전 키워드로 검색해 컨텍스트 사용량을 줄인다.
- `GPT_DEVELOPMENT_HANDOFF.md`는 관리자 ZIP 배포가 허용하는 루트 문서로 취급한다. 브라우저 배포 미리보기와 서버 배포 허용 목록을 항상 같은 상태로 유지한다.
- `AUDIT_LOG.md`는 Claude/ChatGPT Work/GPT 독립 감사와 교차검증의 날짜·기준 버전·분석 수단·판정·반영 버전을 보존하는 전용 문서로 사용한다. 감사 관련 개발은 이 파일의 최신 관련 구간을 먼저 확인해 이미 수정한 결함이나 오탐을 반복 제안하지 않는다.
- `AUDIT_LOG.md`도 관리자 ZIP 배포가 허용하는 루트 문서로 유지하고, 새 감사 결과가 생길 때만 갱신한다. 정확한 모델명·날짜·원문이 확인되지 않는 내용은 추측해 채우지 않는다.
- 새 채팅 인수인계 방식, 기본 패치 절차, 핵심 회귀 주의 영역이 바뀌면 `GPT_DEVELOPMENT_HANDOFF.md`도 함께 갱신한다. 실제 사용자 기능 설명이 바뀌지 않은 문서/개발 절차 패치에서는 `HELP_GUIDE.md`를 불필요하게 수정하지 않는다.
- `HISTORY.md`의 커밋 이력은 계속 GitHub `main`의 실제 커밋을 기준으로 관리자 배포 로직이 재생성한다. 새 버전 기록을 수동 추측해 HISTORY에 작성하지 않는다.

# v9.53 관리자·계정 후속 안정화 기준

- 관리자 비밀번호 초기화처럼 서버에서 이미 파괴적/비가역 작업이 성공한 뒤 후속 목록 재조회가 실패할 수 있는 흐름은, 작업 성공 UI와 새로고침 실패 UI를 분리한다. 임시 비밀번호처럼 응답에서 한 번만 받을 수 있는 값은 후속 API 호출보다 먼저 사용자에게 표시한다.
- 자동동기화 `running` 표시는 무기한 신뢰하지 않는다. 마지막 상태 갱신이 15분 이상 지난 실행은 서버 상태를 임의 변경하지 않고 관리자 UI에서 `중단됨 · 다시 실행` 경고로 취급한다.
- Drive 관리자 목록의 제목·작가는 공개 인덱스와 동일하게 파일명 파싱 실패 항목의 수동 override를 적용한 값을 사용한다. 검색 별칭·중복 판정이 원본 파싱 실패값과 공개값을 서로 다르게 보지 않게 한다.
- 검색 별칭은 동일한 값을 다시 저장할 때 KV write와 공개 인덱스 재생성을 생략한다. 저장 후 공개 인덱스 갱신 여부를 응답으로 구분하고, 현재 작품 목록과 매칭되지 않는 별칭은 관리자 UI에서 고아로 확인할 수 있게 한다.
- 일반 의견함은 기존 익명 정책을 유지한다. 계정 문의의 회신 연락수단은 처리완료 시 관리자 확인 후 비우며, 계정 ID를 유저 관리 검색으로 연결한다. 미확인 의견 수는 기존 관리자 초기 데이터 요청에 포함해 별도 전체 의견 목록 API 호출을 만들지 않는다.
- feedback 테이블 자동 마이그레이션은 공개/관리자 라우트에 중복 정의하지 않고 공용 helper를 사용하며, 동일 isolate에서는 완료된 스키마 확인 Promise를 재사용한다.
- 로그인 여부를 선택적으로 읽는 공개 API는 Bearer 토큰과 서버 세션 쿠키를 `requireUser`와 같은 기준으로 인식해야 한다. 쿠키 전용 복원 사용자가 개인화 상태(예: 문장 피드 좋아요)를 잃어 보이지 않게 한다.
- 관리자 이벤트 리스너는 탭 전환 함수 안에서 반복 등록하지 않는다. 초기화 시 한 번만 등록해 동일 버튼 클릭이 여러 서버 요청으로 증폭되지 않게 한다.
- analytics 보존·인덱스·heartbeat 구조, 1000명 이상 사용자 서버 검색, 중복 제외 되돌리기, 고아 file_id 이전은 실측 또는 별도 설계 전 이 안정화 패치에 섞지 않는다.

# v9.52 문장·본문 요청 정합성 기준

- 저장 문장은 신규 저장 시 서버에서 중복 여부를 최종 판정한다. TXT는 `user_id + quote_text + work_id + start_offset`, 위치가 없는 직접입력/POSTYPE 문장은 `user_id + quote_text + title + author` 기준으로 새 중복 행을 만들지 않는다. 기존 중복 데이터를 임의 정리하지 않는다.
- 오래된 저장 문장의 `workId`가 현재 목록에서 사라졌을 때 제목·작성자 fallback 후보가 둘 이상이면 첫 후보를 임의 선택하거나 `quote_location_update`로 잘못된 새 ID를 저장하지 않는다. 유일 후보일 때만 기존 위치 보정 흐름을 사용한다.
- 문장 피드의 TXT 원문 이동은 저장 당시 `start_offset/source_text`가 현재 본문에서도 유효하면 그 위치를 사용한다. 저장 위치가 유효하지 않을 때는 문장이 유일하게 일치하는 경우에만 기존 텍스트 탐색으로 보정한다. 피드용 jump는 사용자 저장 위치를 갱신하지 않으며, 여러 위치가 일치하거나 찾지 못하면 0 위치로 열어 안내한다.
- `/api/content`는 Google Drive ID 형태와 RFC3339 `modified`(또는 `unknown`)만 받는다. KV MISS 뒤에는 Drive가 반환한 실제 `modifiedTime`으로 canonical `body:` 키를 정하고 그 키만 새로 쓴다. 클라이언트가 보낸 임의 `modified` 값으로 신규 본문 캐시 키를 만들지 않는다.
- 로그인 최근조회는 `/api/content` 요청 시작 시 선기록하지 않는다. 유효 KV 본문 HIT 또는 Drive 본문 다운로드·디코딩·KV 저장 성공 뒤에만 best-effort로 기록하며 본문 실패가 `user_items` 최근조회에 남지 않게 한다.
- 다기기 이어보기 저장 경쟁, bootstrap/profile LIMIT 확대, 인증 해시 변경, 게스트 이어보기는 별도 검토 전 이 정합성 패치에 섞지 않는다.

# v9.51 로그인·저장·동기화 안전 기준

- 자동 로그인 복원은 HTTP 401처럼 실제 인증 거절이 확인된 경우에만 장기 토큰·쿠키를 폐기한다. 네트워크 오류나 5xx에서는 토큰을 보존하고 공개 화면 사용을 유지하며, 온라인 복귀 시 복원을 다시 시도한다.
- 북마크는 UI 선반영 후 저장 실패 시 마지막으로 서버에서 확인된 bookmarked 값으로 롤백한다. 목록 TXT·POSTYPE·리더의 저장 경로는 같은 helper를 사용한다. 실제 페이지 종료 시 대기 중인 저장은 `keepalive`로 전송하되 bfcache pagehide에서는 중복 요청을 만들지 않는다.
- Drive 목록 스캔에서 조합 폴더 또는 단편/장편 하위 폴더 조회 오류가 하나라도 남으면 해당 스캔을 파괴적 삭제로 반영하지 않는다. Google Drive 429/5xx는 최대 2회만 재시도하고 그 외 오류를 숨기지 않는다.
- 자동동기화는 기존 목록 대비 전부 삭제되거나 `10개 이상 + 10% 이상` 감소하는 변경을 자동으로 확정하지 않는다. 관리자가 직접 실행한 동기화에서 경고를 확인하고 재승인한 경우에만 대량 삭제를 적용한다.
- POSTYPE의 enabled 전체 해제/대량 감소도 같은 안전 기준을 적용한다. 필수 컬럼·행 검증 실패는 기존처럼 즉시 중단한다.
- 자동동기화 `warning`은 실패(error)와 구분해 기록하며, 보류된 실행은 기존 공개 인덱스/KV 목록을 유지한다.
- 안정화된 이어보기 offset·페이지/스크롤 계산·문장 저장 구조는 이 안전 패치에서 변경하지 않는다.

# v9.50 계정 문의·관리자 초기화 기준

- 비밀번호 분실 복구는 이메일·휴대폰 자동 인증을 새로 만들지 않고 `로그인 → 비밀번호를 잊으셨나요? → 계정 문의 → 관리자 사용자 관리에서 초기화 → 임시 비밀번호 수동 전달` 흐름을 사용한다.
- 일반 익명 의견은 기존처럼 사용자 ID·로그인 정보를 요구하거나 저장하지 않는다. `계정 문의`에서만 사용자가 직접 입력한 `account_user_id`와 `reply_contact`를 저장하며, 이 경우 오류 진단정보는 저장하지 않는다. 공개 feedback API는 계정 존재 여부를 조회하거나 응답으로 드러내지 않는다.
- 관리자 비밀번호 초기화는 서버에서 임시 비밀번호를 생성하고 새 salt/hash로 저장한 뒤 해당 사용자의 `user_sessions`를 모두 삭제한다. 임시 비밀번호 원문은 응답에서 한 번만 관리자에게 보여주고 DB/로그에 별도 저장하지 않는다.
- 계정 삭제는 `users`, `user_sessions`, `user_items`, `user_likes`, `user_quotes`, `reader_notes`, `shared_quotes`, 사용자가 남긴 `shared_quote_likes`, `user_visits`, `user_visit_stats`, 계정 연결 `analytics_sessions`, 해당 계정 ID로 접수된 계정 문의까지 함께 정리한다. 공유 문장·좋아요 트리거와 북마크 집계 정합성을 유지한다.
- 아이디 찾기, 이메일/휴대폰 자동 재설정, OAuth/Google 로그인, PBKDF2 전환, 사용자 직접 탈퇴·자유 비밀번호 변경은 별도 설계 전 임의로 추가하지 않는다.

# v9.49 KoPub 지연 로딩·최근조회 요청 기준

- KoPub 바탕 CSS는 초기 `<head>`의 렌더 차단 stylesheet로 두지 않는다. 저장된 리더 글꼴이 KoPub이거나 사용자가 KoPub을 선택하거나 문장 이미지가 KoPub을 실제로 사용할 때만 `ensureKopubFont()`로 로드한다.
- KoPub 동적 로더는 같은 Promise를 재사용하고 실패 시 재시도 가능 상태로 돌아간다. 외부 CDN 장애가 리더 전체를 무기한 막지 않도록 제한 시간을 두며, 실패 시 기존 fallback 글꼴로 독서를 계속한다.
- 저장된 KoPub으로 TXT를 열 때 폰트 로딩은 본문 네트워크 수신과 병렬로 시작하되 `renderLongText()` 이전에 완료 여부를 기다려 초기 페이지 계산·이어보기 레이아웃이 fallback→KoPub 순서로 뒤늦게 바뀌지 않도록 한다.
- 문장 이미지에서 KoPub을 사용할 때는 `document.fonts.load()` 전에 KoPub stylesheet/font 등록을 보장한다. 설정 미리보기만으로 KoPub 다운로드를 유발하지 않는다.
- 로그인 상태의 TXT 열기는 `/api/content`에 `cache: "no-store"`를 사용해 같은 작품의 짧은 시간 재열기에서도 서버에 접속하고 최근조회 기록을 갱신한다. 비로그인도 v9.59부터 서버의 `private, no-cache` 재검증 정책을 유지한다.
- 위 변경으로 TXT KV 캐시 키·TTL, 본문 offset, 이어보기 저장 구조, 검색·페이지 계산 공식을 변경하지 않는다.

# v9.48 KV 응답 경로 최소 변환 기준

- `/api/archive` 정상 HIT는 `PUBLIC_ARCHIVE_INDEX_KEY`를 `text`로 읽어 저장된 JSON 바이트 의미를 유지한 채 직접 응답한다. 인덱스가 없거나 `null`/빈 값이면 기존 `ARCHIVE_CACHE_KEY` 및 Drive 복구 경로를 사용한다.
- `/api/content?raw=1`의 KV HIT는 `arrayBuffer`로 읽어 `TextEncoder` 재인코딩 없이 직접 응답한다. `raw=0` JSON 응답과 Drive MISS 디코딩/저장 경로는 기존 문자열 로직을 유지한다.
- 위 최적화는 HTTP 응답의 의미·본문 문자 내용·이어보기 offset·최근조회 기록·캐시 키와 TTL 정책을 변경하지 않는다.
- 접근성용 landmark/group 역할 추가는 기존 DOM id/class와 이벤트 바인딩을 바꾸지 않는다.
- KoPub 지연 로딩, ETag/SWR, Smart Placement, 인증 해시 마이그레이션, SEO처럼 측정·설계가 필요한 변경은 별도 검토 없이 묶어 적용하지 않는다.

# v9.47 검색·접근성·정적 캐시 안전 기준

- 메인 검색과 컴팩트 검색은 모두 한글 IME 조합 중 전체 목록 `render()`를 실행하지 않고, 조합 종료 후 결과를 갱신한다. 일반 연속 입력은 90ms 짧은 지연으로 묶는다.
- 작품 검색용 haystack은 항목 객체별로 한 번 정규화해 재사용하고, 정렬용 `Intl.Collator`도 공용 인스턴스를 재사용한다. 검색어가 비어 있을 때는 검색 haystack을 만들지 않는다.
- 단일 선택 필터 칩은 시각적 `.active` 상태와 `aria-pressed` 값을 항상 함께 갱신한다. 검색 입력과 동적 아이콘 버튼은 화면 문구가 없어도 접근 가능한 이름을 유지한다.
- `public/_headers`의 `immutable` 대상(`app.js`, `style.css`, `theme.css`)은 운영 빌드 및 로컬 출력에서 `public/_build/version-static-assets.cjs`가 실제 파일 SHA-256 앞 12자리로 최종 `?v=`를 치환한다. 예상 자산 참조가 없으면 빌드가 실패해 오래된 URL로 배포되는 것을 막는다.
- 운영 빌드의 `public/_build/inject-site-name.cjs`는 `public/version.json`의 버전을 `index.html #publicVersion`에 함께 주입한다. 버전 표시를 수동으로 따로 맞추는 방식에 의존하지 않으며, `version.json` 형식이나 표시 대상이 없으면 빌드를 실패시킨다.
- 소스 `index.html`의 사람이 읽는 `?v=` 값도 변경 파일과 함께 계속 갱신해 빌드가 없는 환경의 fallback을 유지한다.
- 대용량 TXT 스트림 수신 루프는 전경에서는 `requestAnimationFrame`으로 UI 갱신 여유를 주되, 문서가 hidden이면 `nextTask()`로 yield해 백그라운드에서 body 수신 자체가 멈추지 않도록 한다. 이어보기 좌표·본문 검색·페이지 계산 로직은 건드리지 않는다.
- 폰트 로딩 방식, SWR/ETag, Smart Placement, minify, SEO/공유 정책처럼 실측 또는 운영 선택이 필요한 최적화는 측정/결정 전 임의 적용하지 않는다.

# v9.46 정적 파일 브라우저 캐시 정책

- `public/_headers`는 메인 정적 리소스 `app.js`, `style.css`, `theme.css`에만 1년 `immutable` 브라우저 캐시를 적용한다. API/Pages Functions 응답에는 이 정책을 확장하지 않는다.
- 장기 캐시 대상 파일을 수정하는 배포에서는 반드시 같은 커밋에서 `index.html`의 해당 `?v=` 값을 변경한다. URL 버전을 바꾸지 않은 채 파일 내용만 교체하지 않는다.
- `/`, `index.html`, `version.json`, `manifest.webmanifest`는 `no-cache`를 유지해 새 배포와 설치형 웹앱 메타데이터를 재검증할 수 있게 한다.
- v9.60의 명시 요청에 따라 공개 TXT 본문 전용 서비스 워커를 사용한다. 범위를 HTML·목록·사용자 API로 확장하지 않는다. `_headers`의 브라우저 캐시와 혼합해 업데이트 경로를 복잡하게 만들지 않는다.
- 정적 캐시 최적화의 주 목적은 첫 방문이 아니라 재방문·PWA 재실행 시 JS/CSS 재검증 비용을 줄이는 것이다. 변경 전후 측정에서 이득이 확인되지 않으면 범위를 무리하게 넓히지 않는다.

# v8.67 로그인 유지 정책

- 자동 로그인 선택 시 인증 토큰은 `localStorage`와 180일 `SameSite=Lax` 1st-party 쿠키에 함께 저장한다.
- `getAuthToken()`은 localStorage → sessionStorage → 자동 로그인 쿠키 순으로 확인한다.
- 자동 로그인 미선택은 기존처럼 sessionStorage만 사용하며, 자동 로그인 쿠키는 만들지 않는다.
- 로그아웃/토큰 초기화 시 localStorage, sessionStorage, 자동 로그인 쿠키를 모두 제거한다.
- Safari 비공개 브라우징은 브라우저가 창 종료 시 저장소를 폐기할 수 있으므로 영구 로그인 보장을 전제로 하지 않는다.

## v8.66 — 방문 통계·로그인 유지 기준

- 관리자 `방문 통계`는 기존 `/api/admin/users?days=14` 응답을 재사용해 대시보드와 유저 관리의 추가 API 호출을 만들지 않는다.
- 재방문 사용자는 선택 기간 내 `last_visit_at`이 있고 누적 `visit_count >= 2`인 계정으로 정의한다. 재방문율은 `재방문 사용자 / 기간 방문 사용자`, 평균 방문은 `기간 방문 횟수 / 기간 방문 사용자`로 계산한다.
- 자동 로그인 체크 시 인증 토큰은 `localStorage`, 해제 시 `sessionStorage`에 저장한다. `getAuthToken()`은 기존 localStorage 토큰을 우선 인식한 뒤 sessionStorage를 확인한다.
- 로그아웃은 두 저장소의 토큰을 모두 제거한다. 서버 세션 TTL과 인증 API는 변경하지 않는다.
- v8.66은 사용자가 실제 정상 동작을 확인한 v8.64를 기준으로 하며 v8.65 문장 정규화 통합 변경은 포함하지 않는다.

## v8.64 — POSTYPE 문장 입력 정규화 기준

- POSTYPE 문장 직접 입력창의 빈 줄 제거는 `paste` 이벤트의 clipboardData 유무에 의존하지 않고 textarea 최종값 기준으로 처리한다.
- 내용이 있는 줄 사이의 한 번 줄바꿈은 유지하고, 공백/특수 공백/제로폭 문자만 있는 줄은 제거한다.
- 한글 IME 조합 중에는 값을 재작성하지 않고 조합 종료 후 정규화한다.
- 문장 저장 직전에도 동일 정규화를 한 번 수행해 입력 이벤트 차이로 빈 줄이 남지 않도록 한다.

## v8.63 — 붙여넣기·콘텐츠 복귀 기준

- POSTYPE 문장 붙여넣기는 브라우저별 paste/inputType 차이에 의존하지 않고, paste 직후 최종 textarea 값을 정규화해 빈 줄을 제거한다.
- 마이페이지/문장피드의 화면 내 `콘텐츠로 돌아가기` 버튼은 history.back을 사용하지 않고 즉시 닫기 + history marker 제거 + 기존 콘텐츠 스크롤 복원을 사용한다. 브라우저 자체 뒤로가기는 기존 popstate 흐름을 유지한다.

## v8.62 — POSTYPE 붙여넣기 빈 줄 처리

- POSTYPE 직접 입력 모달의 붙여넣기는 내용이 없는 줄을 모두 제거하고, 내용이 있는 줄만 한 줄바꿈으로 연결한다.
- 모바일 브라우저에서 ClipboardEvent 데이터가 비어 있을 수 있으므로 `insertFromPaste` 후처리를 함께 유지한다.
- 사용자가 붙여넣기 후 직접 입력한 Enter는 일반 input으로 취급해 임의 정규화하지 않는다.

## v8.61 — 문장 입력 정규화·뒤로가기 기준

- POSTYPE 직접 입력 paste는 CR/LF뿐 아니라 Unicode line separator, NBSP, ideographic space, zero-width 문자를 정규화한 뒤 빈 줄만 축소한다. 정상 한 번 줄바꿈과 사용자가 편집 후 직접 입력한 Enter는 유지한다.
- 문장 이미지 편집 모달은 일반 페이지/리더 위에 독립 history marker를 쌓고, 모바일/브라우저 뒤로가기 시 배경 탐색보다 모달 닫기를 우선한다.

## v8.60 — POSTYPE 붙여넣기 정규화 기준

- POSTYPE 문장 직접 입력의 붙여넣기 정규화는 TXT 본문 문장 최초 선택과 동일한 `normalizeReaderShareInitialText()` 규칙을 사용한다.
- 단일 줄바꿈은 보존하고 연속된 빈 줄만 하나로 축소한다. 사용자가 편집창에서 직접 입력한 줄바꿈은 후처리로 제거하지 않는다.

## v8.59 — POSTYPE 붙여넣기 정규화

- POSTYPE 직접 입력형 문장 편집기에서는 외부 원문 붙여넣기 시 클립보드 줄바꿈/탭만 한 칸 공백으로 정리한다.
- 이 정규화는 `paste` 이벤트에만 적용하고, 사용자가 편집창에서 직접 입력한 Enter는 보존한다.
- TXT 본문 선택형 문장 편집의 기존 줄바꿈 처리에는 영향을 주지 않는다.

## v8.58 — 콘텐츠 액션 아이콘 규격 통일

- 카드형 액션은 좋아요/북마크/다운로드/POSTYPE 북마크/따옴표가 동일한 원형 박스와 SVG 크기를 사용한다.
- 목록형 POSTYPE 따옴표는 TXT 다운로드가 차지하는 액션 위치/크기 기준을 따른다. 모바일 전용 액션은 PC에서 반드시 숨기고, 모바일에서는 북마크+따옴표 두 버튼만 동일 간격으로 표시한다.
- 따옴표처럼 도형 자체의 시각 중심이 viewBox 중심과 다른 SVG는 박스 크기를 바꾸지 않고 SVG 자체에 최소 광학 보정만 적용한다.

## v8.57 — 버전 단일 기준

- 관리자 ZIP 배포의 버전 기준은 `public/version.json`을 최우선으로 한다. README와 ZIP 파일명은 보조 기준으로만 사용한다.
- README 버전 제목은 1단계/2단계 제목(`# v...`, `## v...`)을 모두 지원한다.
- 서버는 커밋 직전에 전달받은 배포 버전을 커밋 메시지 접두사에 다시 적용해 클라이언트의 오래된 자동 메시지가 그대로 커밋되지 않게 한다.
- HISTORY.md 재생성 시 최근 커밋의 당시 `public/version.json`으로 버전 접두사를 보정하되 GitHub subrequest 한도를 위해 최근 범위만 제한적으로 확인한다.

## v8.56 — 익명 의견 진단정보 재사용

- 익명 의견은 별도 진단 로직을 새로 만들지 않고 기존 `getIssueReportText()` 결과를 재사용해 저장한다.
- 저장 항목은 환경/화면/정렬/필터 등 디버깅 정보이며 계정 ID와 IP는 D1에 저장하지 않는다.
- 관리자 의견함은 본문 아래 `페이지 · 버전` 줄을 접기/펼치기 트리거로 사용해 진단정보를 인라인 표시한다.
- 기존 feedback 행과 호환되도록 `diagnostic` 컬럼은 자동 마이그레이션하고 null이면 `진단정보 없음`으로 처리한다.

## v8.55 — POSTYPE 직접 입력 저장 안정화

- POSTYPE 직접 입력 문장은 selection 이벤트 상태에만 의존하지 않고 저장 버튼 클릭 시 textarea 현재 값을 최종 저장값으로 사용한다.
- 저장/피드 공유의 출처는 해당 문장 편집을 연 POSTYPE 작품의 ID·제목·작가로 유지하고, 모달 종료 시 임시 출처 상태를 정리한다.

## v8.54 — POSTYPE 문장 입력형 공유 흐름

- POSTYPE는 목록/카드 클릭 시 외부 링크 이동을 유지하되, 보조 액션으로 따옴표 아이콘을 제공해 기존 문장 이미지 편집 모달로 진입한다.
- POSTYPE 문장 입력 흐름은 새 모달을 만들지 않고 기존 `reader share` 편집기와 저장/공유 API를 재사용한다.
- 이 경로에서는 작품 제목·작가 메타만 자동 반영하고, 문장 본문은 사용자가 직접 입력한다.
- 문장 피드 상세의 `작품 열기`는 작품 소스에 따라 TXT 내부 뷰어 / POSTYPE 외부 링크로 분기한다.

## v8.53 상세 도움말 최신화 + Turnstile 생명주기 최적화

- 상세 도움말은 현재 사용자 기능을 기준으로 유지합니다.
- 최근 추가된 북마크순, 문장 피드 좋아요/좋아요순, 익명 의견함 사용법을 반영했습니다.
- 도움말 개편 시 기존 모달 구조·반응형 레이아웃은 유지하고 문구 중심으로 최소 수정합니다.
- 익명 의견 Turnstile은 모달 단순 재오픈 시 유효 상태를 재사용하고, 제출 성공·토큰 만료·서버 검증 실패처럼 실제 새 토큰이 필요한 시점에만 새 확인을 진행합니다.
- 제출 성공 후에는 닫힌 모달 뒤에서 즉시 새 챌린지를 만들지 않고 위젯을 제거한 뒤 다음 오픈 시 렌더링합니다. Site Key는 같은 페이지 세션에서 재사용합니다.

# v8.52 — 도움말 연동 익명 의견함 + Turnstile

- 상단 헤더에는 새 버튼을 추가하지 않고 기존 `? 도움말` 모달 하단에 `익명 의견` 버튼을 추가함. 비로그인은 `상세 도움말 / 익명 의견 / 로그인하기` 3개, 로그인 상태는 `상세 도움말 / 익명 의견` 2개를 PC·모바일 모두 한 줄 균등 비율로 배치함.
- 익명 의견 폼에서 문의/오류·수정/기능 제안/추가 요청/기타를 로그인 없이 제출할 수 있으며, `feedback` D1 테이블에 사용자 ID·로그인 정보·IP 없이 현재 페이지·사이트 버전과 함께 저장함.
- 관리자 페이지에 `의견함` 탭을 추가해 전체/미확인/확인/처리완료 필터와 상태 변경을 지원함.
- 자동 입력 방지를 위해 기존 허니팟 + 브라우저 30초 제출 쿨다운에 Cloudflare Turnstile 서버 검증을 추가함. Turnstile은 의견 모달을 실제로 열 때만 지연 로드되어 일반 페이지 방문에는 추가 요청을 만들지 않음.
- Cloudflare Pages 환경 변수 `TURNSTILE_SITE_KEY`와 Secret `TURNSTILE_SECRET_KEY`가 모두 있어야 제출할 수 있으며 Secret은 브라우저에 노출하지 않음.
- 커밋 메시지 요약: `feat: add help-integrated anonymous feedback with Turnstile`

# DEVELOPMENT_GUIDE

이 문서는 새 ChatGPT 채팅에서도 현재 개발 방식을 동일하게 이어가기 위한 간단한 작업 기준이다.

## 기준본
- 항상 사용자가 업로드한 **최신 전체 소스 또는 GitHub 최신 상태**를 기준본으로 사용한다.
- 이전 채팅의 파일을 추측해서 복원하지 않는다. 실제 소스를 먼저 확인한다.
- 이미 정상이라고 확인된 기능은 불필요하게 건드리지 않는다.

## 수정 원칙
- 증상만 덮지 말고 관련 함수·상태·이벤트 경로를 확인한 뒤 최소 범위로 수정한다.
- 아직 배포하지 않은 수정이 여러 개면 다음 버전 하나로 합친다.
- UI는 기존 디자인 톤과 모바일/태블릿/PC 반응형을 유지한다.
- JS 수정 후 가능한 경우 `node --check`로 문법 검사를 한다.

## 배포 파일
- 기본 산출물은 **실제로 변경된 파일만 포함한 패치 ZIP**이다.
- 전체 배포본은 사용자가 요청할 때만 만든다.
- Secret, API token, `.env` 등 민감정보는 ZIP에 넣지 않는다.
- `version.json`을 올리고 README 변경 이력은 최신 버전이 맨 위에 오도록 작성한다.
- README에는 변경사항과 **커밋 메시지 요약**을 한국어로 남긴다.
- `HISTORY.md`는 관리자 배포 시 GitHub `main`의 실제 커밋 기록으로 자동 재생성한다. 수동으로 날짜나 커밋 이력을 추측해 작성하지 않는다.
- v9.58부터 관리자 히스토리 API는 HISTORY.md의 존재·내용과 관계없이 GitHub 실제 main 커밋 목록을 조회한다. HISTORY.md 파일 원본은 다음 관리자 배포에서 기존 방식으로 자동 생성된다.
- 관리자 히스토리 화면은 날짜별 상세 커밋을 본문에 모두 펼치지 않고 날짜 카드 선택 시 모달로 표시한다. 활동 그래프는 같은 히스토리 원본을 프론트에서 시간별·일자별·주간별·월별로 재집계하며 단위 전환만으로 추가 API 호출을 만들지 않는다.
- 히스토리 활동 그래프는 모바일에서 가로 스크롤을 만들지 않으며, 밀집 구간의 카운트는 선택적으로 표시해 축/숫자 겹침을 방지한다. 히스토리 강조색은 관리자 기본 웜그레이·베이지 계열을 우선한다.
- 메인 UI 애니메이션은 기능 로직을 건드리지 않는 짧은 CSS 마이크로 인터랙션만 사용하고 `prefers-reduced-motion`을 존중한다.
- 모바일의 최근 7일 POSTYPE 번개 표시는 작품형태 태그가 아니라 실제 최근발행 날짜 바로 옆에 둔다. 최초 접속 시 최근 7일 POSTYPE가 상단 우선 노출된다는 짧은 안내를 콘텐츠 목록 위에 유지한다.
- 도움말 모달 하단은 헤더를 복잡하게 만들지 않도록 `상세 도움말 / 익명 의견 / 로그인하기` 액션을 사용한다. 비로그인은 3개, 로그인 상태는 로그인 버튼을 숨긴 2개를 PC·모바일 모두 한 줄에서 균등 비율로 배치한다. 상세 도움말은 처음 방문한 사용자가 검색→읽기→기록→공유 흐름을 이해할 수 있도록 유지한다.
- 일반 익명 의견은 사용자 ID·로그인 정보·IP를 저장하지 않고 D1 `feedback`에 카테고리·내용·현재 페이지·사이트 버전·진단정보·처리 상태만 저장한다. `계정 문의`에 한해 사용자가 직접 입력한 계정 ID와 답변 연락수단을 추가 저장하고 진단정보는 저장하지 않는다. 제출 보호는 허니팟 + 브라우저 30초 쿨다운 + Cloudflare Turnstile 서버 검증을 사용하며, Turnstile 스크립트는 의견 모달을 실제로 열 때만 지연 로드한다. 모달을 닫았다 다시 열기만 한 경우 유효한 위젯/토큰을 재사용하고, 제출 성공 후에는 위젯을 제거해 다음 오픈까지 숨은 재검증 요청을 만들지 않는다.
- 로그인 사용자의 테마/뷰어 설정은 인증 복원 전에도 `localStorage`를 우선 사용하고, `<head>` 초기 스크립트에서 저장 테마를 CSS 렌더 전에 적용해 새로고침 시 라이트↔다크 순간 전환을 만들지 않는다. 비로그인은 기존처럼 `sessionStorage`를 사용한다.
- 저장된 인증 토큰이 있는 경우 인증 복원 완료 전에는 비로그인용 `로그인/회원가입` UI를 먼저 노출하지 않는다. 모바일 컴팩트 헤더의 로그인 계정 컨트롤은 사용자 아이디 길이에 영향받지 않도록 `로그아웃` 고정 문구와 제한된 폭을 사용하고, 일반 헤더의 마이페이지 진입 동작은 유지한다.
- 초기 부팅에서는 저장 토큰이 있는 상태에서 `updateAccountUi()`를 인증 복원 전에 호출하지 않는다. `auth-session-pending`은 bootstrap 성공/실패로 실제 로그인 상태가 확정된 뒤에만 해제해 첫 페인트 로그인 깜빡임을 방지한다.
- 콘텐츠 목록의 결과 개수는 실제 리스트 바로 위 우측에 두고, 최근 7일 POSTYPE 안내문이 표시되는 경우에는 같은 행의 좌측에 맞춰 한 기준선으로 정렬한다. 문장 피드 진입 딱지는 콘텐츠 헤더 보조 기능으로 유지하며 다크모드에서도 충분한 대비를 확보한다.
- 이후 패치 ZIP에는 변경된 소스와 `README.md`뿐 아니라 `HISTORY.md`도 함께 포함하는 것을 기본으로 한다.

## 현재 구조에서 특히 지킬 것
- 사이트명은 런타임 API/KV 조회가 아니라 빌드타임 정적 주입 구조를 유지한다.
- 관리자 전체 ZIP 배포는 Worker subrequest 한도를 피하도록 파일 준비를 분할하되 최종 GitHub commit은 가능한 한 1개만 만든다.
- Cloudflare KV/D1/R2/API 호출을 불필요하게 늘리지 않는다.
- 관리자 리소스 탭의 D1 운영 데이터 요약은 `/api/admin/resources` 한 응답으로 사용자 수·`user_items`·저장문장·공유문장·DB 용량·오늘 Rows Written을 표시한다. D1 DB 용량은 실환경에서 비어 있을 수 있는 파일 PRAGMA 대신 Cloudflare `d1StorageAdaptiveGroups.databaseSizeBytes`를 사용하며, 이 저장용량 조회 외에 요약 UI만을 위한 별도 API나 중복 D1 조회는 만들지 않는다.
- 메인 정적 리소스(`app.js`, `style.css`, `theme.css`)의 쿼리 캐시 버전은 사이트 버전과 함께 갱신해 새 배포 후 구버전 JS/CSS가 브라우저 캐시에 남지 않게 한다.
- 공통 디자인 시스템은 `public/design-tokens.css`의 `--sy-*` 토큰을 기준으로 확장한다. 관리자 1차 시각 레이어는 `public/admin-next.css`에 두며 기존 `admin.css` 기능 구조를 덮어쓰지 않는다. 사용자 페이지/뷰어로 확장할 때도 같은 토큰을 재사용하되 화면별 밀도와 레이아웃은 별도 스타일에서 조정한다. 라이트/다크는 동일 토큰명에 값만 교체한다.
- 메인 화면의 공개 버전 표시는 `index.html` 배포 버전을 직접 사용한다. 페이지 진입마다 `version.json`을 `no-store`로 다시 요청하지 않는다. `version.json`은 배포/관리용 버전 기준 파일로 유지한다.
- 관리자 첫 화면에서 서로 의존하지 않는 `/api/admin/data`와 `/api/archive`는 병렬로 시작하되, `/api/archive` 실패가 관리자 기본 데이터 로딩을 막지 않도록 실패 격리 구조를 유지한다.
- `/api/archive`는 공개 인덱스 최신성이 우선이므로 실제 리소스 병목이 확인되기 전에는 단순 TTL 브라우저/엣지 캐시를 추가하지 않는다. 정상 경로의 KV 1회 읽기 구조를 우선 유지한다.
- 관리자 KV 저장은 실제 값이 변경된 경우에만 수행한다. 화면 문구/파비콘, 파일 제목·작성자 override, 중복 제외 pair처럼 기존 값을 이미 읽는 저장 경로는 동일 값 재저장을 막고 공개 인덱스 재생성도 함께 생략한다.
- 로그인 첫 진입의 인증·라이브러리·개인화·방문 기록은 `/api/user/bootstrap` 1회로 통합하는 구조를 유지한다. 같은 초기 화면 데이터 때문에 인증 세션을 여러 Functions 요청에서 반복 조회하지 않는다.
- 로그인 bootstrap에는 메인 화면에 즉시 필요한 개인화 데이터만 포함한다. 저장문장처럼 프로필 특정 탭에서만 쓰는 대용량 텍스트 데이터는 해당 탭 최초 진입 시 지연 로딩하고 같은 세션에서는 재사용한다.
- 저장문장 본문은 지연 로딩을 유지하되 마이페이지 요약 숫자는 bootstrap에서 `COUNT(*)`만 경량 조회해 최초 진입부터 정확히 표시한다. 문장 저장·삭제 시에는 전체 목록 재조회 없이 프론트 개수만 증감한다.
- 문장 피드 카드는 정방형 카드 안에서 문장 본문과 작품명·작가를 충분히 분리하고 반복 기능명 라벨은 넣지 않는다. 좋아요 버튼은 제목·작가 영역과 같은 카드 하단 우측 끝에 두고 본문 상단을 가리지 않는다. 상세 모달은 기본 글자 크기를 우선 유지하고 약간 넘치면 단계 축소해 중앙 배치를 유지하며, 최소 크기까지 줄여도 넘치는 매우 긴 문장만 첫 줄 기준 상단 정렬·내부 스크롤로 전환한다. 공유 날짜는 이미지 좌측 상단 딱지로 표시하고 하단에는 작품 열기 동작만 둔다.
- 마이페이지 저장문장 공개 전환은 토글 문구를 상태 전송 중에도 고정하고, 빠른 연속 입력은 마지막 의도만 반영하며 실제 서버 요청 중에는 토글을 잠시 disabled 처리해 중복 D1 write와 시각적 깜빡임을 억제한다.
- PC 문장 이미지 배경 선택 가로 목록은 스크롤바를 노출하지 않되 마우스 드래그로 좌우 탐색할 수 있게 하고, 모바일 터치 스크롤·클릭·키보드 선택 접근성은 기존 동작을 유지한다.
- 로그인 방문 통계는 새로고침 횟수가 아니라 30분 단위 세션으로 집계한다. `bootstrap`의 기존 사용자 조회에서 `last_visit_at`을 함께 확인하고, 30분 이내 재진입은 `user_visit_stats`/`daily_user_metrics` write를 생략한다.
- 로그인 TXT 작품 열람 시 최근조회 서버 기록은 별도 `/api/user/item` 요청을 만들지 않고 `/api/content` 요청 안에서 best-effort로 함께 처리한다. 본문 응답은 최근조회 D1 저장을 기다리지 않으며 비로그인 본문 조회 경로는 인증 작업을 만들지 않는다.
- 성능 최적화는 `측정 → 저위험 요청 통합/중복 제거 → 재측정` 순서로 진행하며, 리소스 절감 목적으로 정상 동작 중인 뷰어·이어보기·개인화 저장 시맨틱을 바꾸지 않는다.
- 긴 TXT 열람의 이어보기는 같은 기기 로컬 복구와 서버 동기화를 분리한다. 로컬 위치는 최대 10초 간격으로 저장하고 서버 D1 동기화는 120초 간격을 기본으로 하며, 뷰어 닫기·백그라운드·`pagehide`에서는 최신 위치를 즉시 로컬에 남기고 서버 저장을 시도한다.
- v8.37 이후 이어보기는 새로고침·백그라운드·브라우저 완전 종료·스크롤/페이지 모드·다작품 전환·재로그인·기기간 이어보기 등 10개 사용자 테스트가 정상 확인된 기준 동작이다. 성능 최적화 과정에서 이 저장/복구 시맨틱을 임의로 변경하지 않는다.
- 리더가 열린 동안 주기 진행률 저장 성공만을 이유로 뒤쪽 메인 카드/목록 DOM을 재렌더하지 않는다. 진행률 상태는 메모리/로컬/서버에 갱신하고, 메인 목록의 시각적 갱신은 리더를 닫을 때 한 번 수행해 모바일 CPU·배터리 사용을 줄인다.
- 로컬 이어보기는 사용자 ID·작품 ID별 버전 키를 사용하고 서버 위치와 저장 시각을 비교해 더 최신 기록만 사용한다. 서버 저장 성공 시 전송 중 새로 생긴 더 최신 로컬 기록을 지우지 않는다.
- 향후 Android/iOS 앱 전환 가능성을 고려해 브라우저 저장 접근은 이어보기 helper처럼 한곳에 모으고, UI/비즈니스 로직이 Web Storage 구현에 직접 결합되지 않도록 한다. 네이티브 전환 시 Capacitor Preferences 등으로 교체 가능한 경계를 유지한다.
- API token과 Secret은 브라우저 코드에 넣지 않는다.
- 관리자 리소스의 Cloudflare Pages 배포 현황은 서버에서만 조회하며 `CLOUDFLARE_PAGES_TOKEN` 전용 Secret을 사용한다. 기존 Analytics/KV/D1/R2 통계는 `CLOUDFLARE_ANALYTICS_TOKEN`을 그대로 사용해 기능을 분리한다.
- Pages 월 배포 조회는 필요한 페이지만 읽고 최근 내역은 UI에서 기본 10건만 표시해 불필요한 호출/렌더링을 늘리지 않는다.
- 관리자 ZIP 배포 허용 루트 문서는 `README.md`, `DEVELOPMENT_GUIDE.md`, `HISTORY.md`로 제한하고 Secret/설정 파일은 계속 차단한다.
- 포스타입/Drive 작품 관리의 중복 판정은 같은 소스와 교차 소스를 모두 비교하되, 확정/의심으로 구분하고 자동 삭제·숨김은 하지 않는다. 제목·작가 표기 차이 때문에 오탐이 가능하므로 사용자가 필터에서 직접 확인하는 구조를 유지한다.

## 회귀 주의 기능
- 스크롤 ↔ 페이지 모드 이어보기 좌표
- 이어보기 안내가 표시된 상태의 페이지 이동
- 페이지 첫 이동 시 컴팩트 헤더와 페이지 영역 높이 유지
- 단편/연재 뷰어 모드 일관성
- 문장 선택 공유 버튼의 모바일 선택 핸들 회피
- 문장 이미지 미리보기/PNG 저장/클립보드/시스템 공유
- 문장 이미지 텍스트는 최초 선택 시 과도한 줄바꿈만 정리하고, 편집창에서 사용자가 직접 입력한 엔터는 렌더/저장 단계에서 다시 정규화하지 않는다.
- 모바일 이미지 클립보드는 사용자 클릭 시점의 권한을 보존하기 위해 미리 생성한 PNG Blob을 클릭 순간 즉시 `ClipboardItem({ "image/png": blob })`으로 기록한다. v7.77에서 실제 모바일 붙여넣기까지 확인된 직접 Blob 경로를 기준 동작으로 유지하며, Promise<Blob> 우선 경로로 임의 변경하지 않는다.
- PC 페이지 모드 최초 컴팩트 전환은 컴팩트 레이아웃 확정 후 viewport 높이를 계산해 이후 페이지와 하단 위치가 달라지지 않게 한다.

## 새 채팅에서
최신 소스를 먼저 확인하고 이 문서를 읽은 뒤 작업한다. 사용자가 "정상 동작"이라고 확인한 부분은 기준 동작으로 취급하고, 수정 범위 밖의 리팩터링은 하지 않는다.

## v8 로컬 개발 환경
- Windows에서 처음 한 번만 `powershell -ExecutionPolicy Bypass -File .\public\_build\setup-local.ps1`을 실행한다.
- 위 스크립트가 로컬 전용 `package.json`, `.dev.vars`, `.dev.vars.example`, `.gitignore`를 자동으로 준비하고 Wrangler를 설치한다.
- 이후에는 프로젝트 루트에서 `npm run dev` 한 줄로 로컬 Pages/Functions를 실행한다.
- `npm run dev`는 `public`을 `.local-public`에 복사하고 사이트명을 로컬 출력본에만 주입한 뒤 Wrangler를 실행한다. Git 소스의 `public/index.html`은 직접 변경하지 않는다.
- 기존 `wrangler.toml`의 `[vars]SITE_NAME`이 한 줄로 붙어 있어도 로컬 실행용 임시 config에서만 정상 TOML로 보정한다. 운영 설정 파일을 자동 수정하지 않는다.
- 로컬 KV/D1은 `.wrangler/state`에 저장되어 운영 KV/D1과 분리된다. 로컬 회원은 로컬 회원가입으로 따로 만들 수 있다.
- Google Drive 원본 콘텐츠를 로컬에서 읽으려면 `.dev.vars`의 `GOOGLE_SERVICE_ACCOUNT_JSON`을 사용한다. 서비스 계정 JSON은 한 줄 JSON 문자열 형태로 넣고 실제 값을 문서/채팅/커밋에 남기지 않는다.
- 관리자 기능까지 테스트할 때만 `.dev.vars`에 필요한 `ADMIN_PASSWORD`, Cloudflare/GitHub 관련 Secret을 직접 입력한다.
- 실제 Secret 값이 들어간 `.dev.vars`, `.env`, `.wrangler/`, `.local-public/`은 Git에 올리지 않는다.
- `public/_build`의 로컬 도우미 파일은 운영 빌드 시 `inject-site-name.cjs`가 빌드 출력에서 제거하므로 공개 사이트에 남기지 않는다.

## v8 개인화 기능
- 상단 북마크/최근 조회 팝업은 빠른 접근용 최근 10개만 표시한다. 전체 목록은 로그인 사용자 `내 정보` 페이지에서 관리한다.
- 회원 버튼을 누르면 메인 SPA 안의 `내 정보` 페이지로 이동하며 북마크, 최근 본 작품, 좋아요, 저장한 문장을 한곳에서 확인한다.
- 좋아요는 D1 `user_likes`에 사용자별 작품 1행만 저장하고, 로그인 시 한 번에 목록을 읽어 프론트에서 하트 상태를 표시한다. 작품 카드마다 개별 조회를 만들지 않는다.
- 저장한 문장은 D1 `user_quotes`에 제목, 작가, 발췌 텍스트만 사용자별로 저장한다. 이미지 Blob은 서버에 저장하지 않는다.
- 문장 피드 공개는 반드시 사용자 명시 선택(기본 OFF)으로만 이루어지며, 공개 데이터는 `shared_quotes`에 별도 스냅샷으로 저장한다. 공개 피드 응답에는 사용자 아이디를 노출하지 않는다.
- 문장 피드는 최신순/좋아요순 모두 18건 커서 페이지네이션을 사용하고 전체 공개 문장을 한 번에 내려받지 않는다. 카드 배경은 기존 문장 이미지 테마를 문장 ID 기반 고정 랜덤으로 재사용해 새 이미지 요청/저장소를 만들지 않는다.
- 문장 피드 상세의 공유 날짜는 한국 표준시 기준 `YYMMDD` 6자리로 간결하게 표시한다.
- 문장 피드 카드와 상세 모달의 문장 본문은 `--reader-font-family`를 사용해 사용자가 선택한 뷰어 글꼴을 재사용한다. 작품명·날짜·버튼 등 UI 텍스트는 사이트 기본 폰트를 유지한다.
- 문장 피드 상세 모달은 모달 전체를 스크롤시키지 않는다. 본문은 기본 크기 유지→단계 축소를 먼저 적용하고, 최소 크기에서도 넘치는 경우에만 본문 내부 스크롤을 허용한다. 모바일 닫기 버튼은 스크롤 영역과 분리하고 안전 여백을 유지한다.
- 문장 피드 카드에서는 기능명 라벨을 반복하지 않고 문장 본문과 하단 작품명·작가 사이에 충분한 여백을 유지한다. 매우 긴 문장 상세는 첫 문장부터 위에서 시작하고 모달을 열 때 본문 스크롤 위치를 항상 0으로 초기화한다.
- 콘텐츠 섹션의 결과 개수와 문장 피드 진입은 실제 카드/목록 바로 위 한 줄에 좌우 정렬한다. 문장 피드는 작은 딱지형 보조 버튼으로 유지하고, 최근 7일 POSTYPE 안내는 실제 최초 우선 노출(NEW/번개) 대상이 있을 때만 표시한다.
- 저장문장 원문은 카드에 맞춰 서버에서 잘라 저장하지 않는다. 피드 카드만 줄 수를 제한하고 상세 모달에서는 전체 문장을 보여준다. 비공개 전환·문장 삭제·계정 삭제 시 `shared_quotes`도 함께 정리한다.
- 좋아요 전체 수 집계/공개 카운트는 v8.0에서 제공하지 않는다. 개인 상태만 저장해 D1 읽기·쓰기 부하를 최소화한다.
- 계정 삭제 시 `user_likes`, `user_quotes`도 함께 삭제한다.
- 관리자 리소스의 Pages 배포 목록은 동일 Worker isolate에서 최대 5분간 캐시해 반복 새로고침 시 Cloudflare API 재조회량을 줄인다.

## v8.0 실배포 전/후 집중 확인
- 로그인 후 회원 버튼 → `내 정보` 진입/콘텐츠 복귀/로그아웃이 정상인지 확인한다.
- 상단 북마크·최근조회 팝업이 최대 10개만 보여주고 `내 정보에서 전체 보기`가 해당 탭으로 연결되는지 확인한다.
- Drive/POSTYPE 카드에서 좋아요 추가·취소 후 새로고침/재로그인해도 상태가 유지되는지 확인한다.
- 문장 선택 → 문장 이미지 편집 → `문장 저장` → 내 정보 `저장한 문장`에서 제목·작가·문장 확인, 복사·삭제를 확인한다.
- 모바일 문장 이미지 `클립보드 복사`는 실제 HTTPS 모바일 브라우저에서 붙여넣기까지 확인한다. 미지원 브라우저는 저장/공유 fallback 안내가 정상인지 확인한다.
- PC 페이지 모드 첫 클릭 컴팩트 전환과 두 번째 이후 페이지의 하단 위치가 동일한지 확인한다.
- 스크롤↔페이지 이어보기, 이어보기 안내 유지, 단편/연재 모드, 문장 이미지 수동 줄바꿈 보존을 회귀 확인한다.
- 관리자 포스타입/Drive 중복작품 필터와 리소스 Pages 월 배포 현황이 유지되는지 확인한다.

## v8.05 모바일 목록 기준
- 모바일 640px 이하 목록형에서 `인물조합`은 `CP`로 축약 표기한다.
- CP/형태 컬럼은 최소 폭으로 유지하고 제목 컬럼을 우선 확보한다.
- 제목은 말줄임표로 숨기지 않고 전체 노출한다. 실제 렌더가 3줄 이상이면 글자 크기를 단계적으로 줄여 밀도를 보정한다.
- 이 밀도 보정은 PC 목록/카드/뷰어 레이아웃에 전파하지 않는다.


## v8.06 회귀 방지 메모
- 모바일 이미지 클립보드는 클릭/탭 순간의 user activation을 잃지 않도록 clipboard write를 다른 UI 변경보다 먼저 시작함.
- Android/Chromium은 준비된 PNG Blob 직접 기록, WebKit/iOS는 ClipboardItem 내부 Promise 표현을 사용함.
- 로지/스카이/라벤더 테마는 미리보기 CSS뿐 아니라 저장 Canvas에도 서로 다른 시각 효과를 유지해야 함.

### 모바일 문장 이미지 클립보드 회귀 방지 (v8.07 기준)
- 검증 기준 경로는 `ClipboardItem({ "image/png": preparedBlob })` + `navigator.clipboard.write([item])` 직접 호출임.
- 클립보드 버튼의 실제 `click` 핸들러에서 write를 즉시 시작해야 하며, 그 전에 `await`, 캔버스 재렌더, 폰트 로드, 네트워크 요청, 모달 상태 변경 등 비동기 작업을 넣지 않음.
- iOS/WebKit이라고 별도 `Promise<Blob>` 분기를 추가하지 않음. 이 분기는 v8.06에서 다시 회귀 원인이 될 수 있어 제거함.
- PNG Blob은 문장 선택/편집 중 미리 생성하며, 준비되지 않았을 때만 사용자에게 준비 중 안내를 표시함.

### 뷰어 상단 액션 아이콘 기준 (v8.08)
- 다운로드/북마크/좋아요/닫기는 PC·모바일, 라이트·다크, 일반·컴팩트, 스크롤·페이지 모드에서 동일한 기하 규칙을 사용함.
- 버튼 외곽 크기와 SVG 박스뿐 아니라 실제 path의 시각 점유 면적까지 맞춰야 함.
- 컴팩트 모드에서 별도 아이콘 크기/transform을 추가하지 않음. 위치 보정이 필요하면 헤더 레이아웃만 조정함.
- v8.07에서 실기기 확인된 모바일 문장 이미지 클립보드 코드는 UI 패치에서 수정하지 않음.


### 모바일 문장 이미지 클립보드 회귀 방지 (v8.16)
- 실기기 검증된 클릭 시점 경로 `ClipboardItem({ "image/png": blob }) -> navigator.clipboard.write()`는 변경하지 않는다.
- 폰트/테마/Canvas 변경이 필요하면 클릭 핸들러가 아니라 사전 PNG 준비 단계에서만 처리한다.
- 클립보드용 Blob은 `image/png`, `size > 0`을 확인하고 가능한 경우 디코딩 후 새 Canvas로 재인코딩해 준비한다.
- 저장/공유용 export 렌더링과 클립보드용 준비 Blob을 섞어서 회귀시키지 않는다.

## v8.22 공개 콘텐츠 인덱스 기준
- 사용자 `/api/archive`는 `archive:public-index:v1` 단일 JSON 인덱스를 우선 읽어 Drive/POSTYPE/설정/오버라이드를 요청마다 재조합하지 않는다.
- Drive 원본 캐시는 `archive:data:v3`, POSTYPE 원본 캐시는 `postype:index:v1`을 계속 기준 데이터로 유지하며 공개 인덱스는 파생 캐시로 취급한다.
- 공개 인덱스가 없을 때만 기존 캐시에서 자동 복구하고, 정상 상태에서는 사용자 요청 중 Google Drive/Google Sheets 원본을 조회하지 않는다.
- 관리자에서 Drive/POSTYPE/오버라이드/설정이 실제 변경된 경우 공개 인덱스를 즉시 갱신한다. 새 수정 경로를 추가할 때도 사용자 목록 데이터에 영향을 주는 변경이라면 공개 인덱스 갱신을 함께 연결한다.
- Drive 동기화는 파일 ID와 메타데이터를 이전 캐시와 비교해 추가/수정/삭제를 계산하며, 변경이 없으면 Drive 캐시와 공개 인덱스를 다시 쓰지 않는다.
- 변경분 최적화를 위해 사용자 요청 시 원본 API를 다시 읽거나 작품별 KV key로 과도하게 분할하지 않는다. 사용자 목록은 단일 JSON 읽기 구조를 유지한다.


## v8.23 안정화 규칙
- Drive 마지막 동기화 결과는 `archive:last-drive-sync:v1`에 저장하며 관리자 화면에서 상시 표시한다.
- 관리자가 `중복 아님`으로 판정한 중복 의심 조합은 `archive:duplicate-dismissals:v1`에 저장하고 이후 자동 중복 판정에서 제외한다.
- Drive TXT와 POSTYPE는 출처 타입이 다르므로 서로 중복 후보로 비교하지 않는다.
- 도움말의 로그인 버튼은 비로그인 상태에서만 보인다. 상세 도움말은 로그인 여부와 무관하게 접근 가능해야 한다.

## v8.24 안정화 규칙
- 메인 도움말 팝업의 액션은 비로그인 PC에서 2개 버튼을 동일 비율로 유지하고, 로그인 PC에서 남는 `상세 도움말` 1개는 절반 너비로 가운데 배치한다. 모바일에서는 1열 전체 너비를 유지한다.
- 관리자 `Drive 작품형태 관리` 기본 목록은 Drive `createdTime` 최신순을 기준으로 한다. `createdTime`이 같거나 없으면 `modifiedTime` 최신순, 제목순으로 정렬한다.



## v8.25 히스토리 관리 기준
- `HISTORY.md`는 GitHub `main` 브랜치의 실제 커밋 날짜와 메시지를 원본으로 삼는다.
- 관리자 배포의 마지막 commit 단계에서 전체 GitHub 커밋 이력을 읽어 `HISTORY.md`를 같은 커밋에 자동 포함한다. 히스토리 갱신만을 위한 별도 커밋은 만들지 않는다.
- 현재 배포는 아직 SHA가 생성되기 전이므로 `HISTORY.md`에는 같은 배포의 커밋 메시지와 KST 시각을 기록하고, 다음 배포 때 GitHub 실제 기록을 다시 기준으로 재생성한다.
- 관리자 `히스토리` 탭은 v9.58부터 GitHub main의 실제 커밋 이력을 데이터 원본으로 사용하며 GitHub Token은 Worker 서버 안에서만 사용한다. HISTORY.md 자동 생성은 기존 관리자 배포 경로에서 유지한다.
- 월별 활동 그래프와 날짜별 타임라인은 표시용 파생 UI이며 별도 KV/D1 저장소를 만들지 않는다.
- GitHub 전체 이력은 관리자 배포의 최종 요청과 관리자 히스토리의 캐시 미스 시 조회한다. 기존 `per_page=100`, 최대 20페이지 범위를 유지하고 히스토리 반복 조회는 5분 캐시와 동시 요청 공유로 제한한다.
### 히스토리 화면 UI 기준 (v8.28+)
- 일별 상세 모달은 긴 버전 문자열을 상시 노출하지 않고 `N개 변경` 버튼으로 접어서 표시한다.
- 개발 활동 분포는 관리자 화면의 밝은 톤을 유지하며, 기본 집계 단위는 시간별이다.
- 일자별/주간별/월별 그래프는 컨테이너 폭 안에서 렌더링하고 가로 스크롤을 만들지 않는다.

## v8.34 성능 최적화 기준
- 이어보기 진행률은 동일 작품의 동일 좌표 payload가 이미 서버로 전송 중인 경우 중복 요청을 만들지 않는다.
- 일반 주기 저장과 `visibilitychange`/`pagehide` 종료 저장은 같은 payload 시그니처를 공유해 동일 위치의 Functions 호출·D1 write 중복을 억제한다.
- 진행률 최적화 시 60초 원격 동기화 간격, 스크롤/페이지/청크 좌표 계산, 종료 직전 최종 위치 저장은 회귀시키지 않는다.


## v8.43 문장 피드/공유 UI 기준
- 문장 저장이 성공하면 저장 완료 패널과 `문장 피드에 공유` 토글이 모바일/PC 편집 시트 안에서 바로 보이도록 해당 내부 스크롤 영역을 부드럽게 이동한다.
- 이 자동 이동은 저장 성공 시에만 실행하고, 페이지 전체가 이동하거나 뷰어 위치가 변하지 않도록 편집 시트의 내부 스크롤만 사용한다.
- `prefers-reduced-motion: reduce` 환경에서는 부드러운 스크롤 대신 즉시 이동한다.


## v8.44 기준 추가 원칙
- 마이페이지 저장문장 공개 스위치는 빠른 연속 입력을 마지막 의도 1건으로 합쳐 서버 write를 최소화한다.
- 새 일반 팝업은 가능하면 `.simple-modal-overlay` + `.simple-modal` 구조를 사용해 공통 닫기(바깥 터치/ESC/뒤로가기) 체계에 자동 포함한다. 리더/문장이미지 편집처럼 별도 상태 정리가 필요한 전체화면 오버레이는 전용 close 흐름을 유지한다.
- 목록 상단 보조정보는 결과 개수와 보조 진입 기능을 한 묶음으로 배치해 주요 콘텐츠 헤더보다 시각적 우선순위가 높아지지 않게 한다.


### v8.45 공통 모달 입력 안정화
- `.simple-modal-overlay` 바깥 영역 닫기는 pointerdown 시점에 모달을 숨기지 않고 click 완료 시점에 처리한다.
- 바깥 클릭 이벤트는 preventDefault/stopPropagation으로 종료하여 뒤 콘텐츠 클릭 관통을 막는다.

## v8.47 D1 운영 현황 기준
- 관리자 `리소스` 탭의 운영 요약은 사용자 수, `user_items` 행 수, 저장문장 수, 공유문장 수, D1 현재 용량, 오늘 Rows Written을 표시한다.
- 운영 요약을 위해 별도 API 호출이나 별도 D1/GraphQL 조회를 추가하지 않고 기존 `/api/admin/resources` 응답을 재사용한다.
- 상세 리소스/한도 화면은 유지하고 운영 요약은 빠른 상태 확인용으로만 사용한다.

## v8.48 전체 북마크순 정렬 기준
- `북마크순`은 로그인 사용자 개인 북마크 우선이 아니라 전체 사용자의 작품별 북마크 수 내림차순이다.
- 정렬을 위해 `user_items` 전체를 매번 집계하지 않는다. 작품별 집계는 `item_bookmark_counts(file_id, bookmark_count)`에 유지한다.
- 기존 데이터 마이그레이션은 `bookmark_counts_backfilled_v1` 메타 키를 사용해 최초 1회만 수행한다.
- 북마크 추가/해제, 전체 북마크 해제, 관리자 사용자 삭제는 집계 카운트와 원본 `user_items`가 함께 갱신되어야 한다.
- 동일 상태 재요청은 집계 write를 만들지 않는다.
- 순위 데이터는 기본 목록 로드에 추가하지 않고 사용자가 `북마크순`을 실제 선택했을 때 지연 조회한다. 클라이언트 재조회 간격은 기본 60초다.
- 집계수가 같은 항목은 제목순, 작가순으로 결정적 정렬을 유지한다.
## v8.49 문장 피드 좋아요 기준
- 좋아요는 로그인 사용자만 가능하며 `shared_quote_likes(user_id, quote_id)` 복합키로 사용자당 문장 1회만 저장한다.
- 문장별 누적 수는 `shared_quotes.like_count`에 유지하고 좋아요 INSERT/DELETE 트리거로만 증감한다. 피드 조회 시 전체 좋아요 테이블을 `COUNT/GROUP BY`하지 않는다.
- `최신순`은 `shared_at DESC, quote_id DESC`, `좋아요순`은 `like_count DESC, shared_at DESC, quote_id DESC`로 정렬한다. 각 정렬은 별도 커서를 사용해 18개씩 더보기한다.
- 공유 문장 삭제 시 연결된 좋아요 행도 자동 삭제한다. 비로그인 사용자는 좋아요 수는 볼 수 있지만 좋아요 동작 시 로그인 안내를 표시한다.
- 좋아요순에서 좋아요 수가 바뀌면 현재 첫 페이지를 다시 불러와 순서와 커서를 즉시 일치시킨다.



## v8.50~v8.51 리소스·피드 표시 기준
- 관리자 `DB 현재 용량`은 D1 파일 PRAGMA가 아니라 Cloudflare Analytics `databaseSizeBytes` 지표를 사용한다. 이 값 조회를 위해 리소스 새로고침 시 D1 저장용량 GraphQL 요청 1회가 추가된다.
- 콘텐츠 목록 상단의 결과 수(`콘텐츠 n개`)는 같은 행의 안내문구와 동일한 글자 크기로 유지한다.
- 문장피드 카드 좋아요 버튼은 카드 하단 우측에 배치하며, 위치 변경이 좋아요 클릭/취소나 카드 상세 열기 이벤트에 영향을 주지 않게 한다.

## v9.66 오프라인 저장 사용자 삭제

- 오프라인 저장 삭제는 `/body-sw.js`가 Cache Storage의 본문 캐시만 제거하며, D1/KV 사용자 기록이나 공개 원본에는 쓰기 작업을 하지 않는다.
- `offline-bodies-delete`와 `offline-bodies-clear` 메시지 처리 후 실제 캐시 ID를 다시 클라이언트에 전달해 목록·카드·내 서재 개수 표시를 동기화한다.
- 개별·선택·전체 삭제 UI는 내 서재의 기존 버튼/카드 디자인을 재사용하고, 모바일에서는 선택 체크 UI가 제목 폭을 불필요하게 줄이지 않도록 유지한다.


## v9.68 오프라인 저장공간 표시 기준

- 사용자에게 표시하는 오프라인 사용량은 Service Worker의 실제 본문 Cache Storage에 저장된 `x-content-bytes` 합계를 사용한다.
- 브라우저 전체 quota가 아니라 셩냥책 본문 캐시 자체 상한(32MiB) 대비 사용량을 표시한다.
- 저장 안내는 임시 저장, 최대 40개·32MiB, LRU 자동 정리, 브라우저 데이터 정리 시 소실 가능, 영구 다운로드 아님을 짧게 설명한다.
- 목록 렌더마다 Cache Storage 전체를 스캔하지 않고 기존 오프라인 ID 동기화 메시지 시점에 통계도 함께 전달한다.

- 관리자 디자인 시스템 v2부터 모바일/태블릿의 관리자 메뉴는 줄바꿈 없는 단일 가로 스크롤 레일을 기본으로 하며, 상단 소스 요약은 세로 누적 대신 가로 스와이프 스트립을 사용한다. 개별 관리자 기능에서 직접 베이지/보라/검정 UI 색을 추가하지 말고 `design-tokens.css`의 `--sy-control`, `--sy-table-head`, `--sy-row-hover`, `--sy-chip`, 상태색 토큰을 우선 사용한다. 동적으로 삽입되는 관리자 UI도 동일 토큰을 사용해야 한다.

- v9.71: 관리자 디자인 시스템 정합성 보강. 레거시 베이지/보라 팔레트를 공통 `--sy-*` 토큰으로 정리하고, 모바일 헤더·탭·버튼·패널 헤더 밀도를 낮췄으며 공개 문장 관리는 의견함에서 운영 탭으로 분리했습니다.

- v9.72: 모바일 관리자 탭 전환 시 화면을 상단으로 복귀시키고 선택 탭을 가로 메뉴 중앙에 맞춥니다. 운영 탭의 공개 문장 관리는 20개 단위 페이지 조회로 바꿔 100개 이상이어도 긴 단일 스크롤이 생기지 않도록 했습니다.


## v9.73 공통 디자인 시스템 전환 규칙

- 색상 source of truth는 `public/design-tokens.css`의 `--sy-*` 변수다. 관리자 화면의 새/수정 CSS와 동적 삽입 UI에는 개별 베이지·보라·검정 HEX/RGB 값을 다시 추가하지 않는다. 상태색도 `--sy-success`, `--sy-warning`, `--sy-danger`, `--sy-info` 및 soft/on-* 토큰을 사용한다.
- 선택 내비게이션은 `--sy-nav-active-bg/text/line`, 입력은 `--sy-field-*`, 모달·토스트·progress·neutral badge는 각각 전용 semantic token을 사용한다. `--bg`, `--panel`, `--ink`, `--muted`, `--line`, `--accent`, `--card`, `--text`는 `admin.css` 내부에만 남기는 레거시 호환 alias다. 공통 `design-tokens.css`에는 비접두사 alias를 두지 않아 사용자/뷰어에서 로드해도 기존 변수와 충돌하지 않게 한다.
- `admin.css`는 기능/구조 레이어, `admin-next.css`는 관리자 시각 adapter, `design-tokens.css`는 관리자·사용자·뷰어가 공유할 foundation으로 취급한다. 사용자 화면으로 확장할 때 `admin-next.css`를 재사용하지 말고 `design-tokens.css`만 먼저 로드한 뒤 사용자/뷰어 전용 adapter를 별도로 만든다.
- 사용자 페이지 테마 전환은 한 번에 기존 `style.css/theme.css`를 치환하지 않는다. (1) 토큰만 로드해 무변경 확인 → (2) 버튼·입력·모달·토스트 같은 공통 요소부터 adapter 적용 → (3) 목록/카드 → (4) 뷰어 순으로 단계적으로 전환하고 각 단계에서 light/dark/mobile을 확인한다.
- 공통 토큰은 관리자 화면을 위해 임의로 이름이나 의미를 바꾸지 않는다. 값 변경은 가능하지만 semantic name의 의미는 유지해 사용자/뷰어와 같은 계약을 공유한다.
- 관리자 테마 정합성 점검 시 `admin.css`, `admin-next.css`, 동적 `admin-app.js` 스타일에 구 팔레트 직접 색상값이 다시 생기지 않았는지, 사용 중인 `--sy-*` 변수가 `design-tokens.css`에 모두 정의되어 있는지 확인한다.

## v9.74 사용자 테마 미리보기 단계

- 사용자 새 디자인은 `public/user-next.css`에 두고 `html.user-design-next` 아래에서만 동작한다. 현재 미리보기 진입은 `?ui=next`이며 일반 사용자는 기존 `style.css/theme.css` 결과를 그대로 본다.
- 사용자 화면도 색상 source of truth는 `public/design-tokens.css`의 `--sy-*` 토큰을 사용한다. 새 adapter에 베이지/보라/검정 하드코딩 팔레트를 추가하지 않는다.
- 1차 전환 범위는 헤더·버튼·입력·필터·목록/카드·모달·토스트·배지 같은 공통 UI로 제한하며 reader 본문/페이지 모드/이어보기/검색/저장 시맨틱은 변경하지 않는다.
- 미리보기 승인 전에는 `user-design-next`를 기본 활성화하거나 기존 `theme.css`를 삭제·치환하지 않는다. 이후 단계도 목록/카드 보정 → 뷰어 순으로 진행한다.

### v9.75 사용자 테마 미리보기 규칙
- `html.user-design-next`는 기존 `style.css`/`theme.css`의 레거시 색상 변수(`--bg`, `--surface`, `--ink`, `--theme-*`)를 `--sy-*` 의미 토큰으로 연결한다.
- 새 사용자 테마에서는 베이지/보라 등 직접 색상을 컴포넌트별로 추가하지 말고 `neutral/info/success/warning/danger`, source, offline, like 의미 토큰을 사용한다.
- 사용자 테마 전환은 shell/components부터 진행하고 실제 reader body는 별도 단계에서 적용한다.
