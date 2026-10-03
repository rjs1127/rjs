# 셩냥책 Android App

웹사이트 루트 `README.md`와 분리된 Android 앱 전용 개발·배포 기록입니다.
웹 버전과 앱 버전은 서로 독립적으로 관리합니다.

## 운영 기준

- App ID: `hs.rjs.syungbook`
- 앱 이름: `셩냥책`
- APK 공개 경로: `public/downloads/`
- 최신 앱 버전 API: `functions/api/mobile-version.js`
- 앱 소스: `mobile/`
- Android 버전 기준: `mobile/android/app/build.gradle`
- 관리자 배포 탭의 **Android 앱 배포** 영역에서 APK 릴리즈를 처리합니다.
- 일반 소스 패치 ZIP은 `mobile/README.md`가 있으면 앱 패치로 인식합니다.
- 웹사이트 변경 기록은 루트 `README.md`, Android 앱 변경 기록은 이 파일에만 작성합니다.

## 앱 배포 흐름

1. Android 앱 소스 준비 및 APK 생성
2. 관리자 > 배포 > Android 앱 배포에서 APK 선택
3. APK 내부 versionName/versionCode 자동 확인
4. 업데이트 안내 문구 입력
5. **Android 앱 배포** 실행
6. 관리자에서 아래 항목을 한 번에 GitHub 커밋
   - `public/downloads/syungbook-vX.Y.apk`
   - `functions/api/mobile-version.js`
   - `mobile/android/app/build.gradle`
   - `mobile/README.md`
7. 같은 화면에서 Cloudflare Pages 배포 상태 확인

<!-- MOBILE_RELEASE_HISTORY -->

## v1.4 · build 5 · 준비 중

- 관리자 배포 탭에 Android 앱 전용 릴리즈 영역 추가
- APK 내부 versionName/versionCode 확인 후 배포 가능하도록 개선
- 앱 릴리즈 시 APK·mobile-version.js·build.gradle·mobile/README.md를 한 번에 반영
- ZIP 업로드에서 웹 / 앱 / 혼합 패치를 자동 판별하고 모바일 커밋 메시지를 분리
- 앱 업데이트 확인의 6시간 캐시 제거
- 앱을 열 때 최신 `/api/mobile-version`을 다시 확인하도록 변경
- 네이티브 APK 설치 플러그인 등록 및 외부 APK 설치 권한 구성 보완

## v1.3 · build 4

- Pages APK 직접 배포 경로 적용
- 앱 업데이트 APK 다운로드 후 Android 설치 화면으로 연결하는 네이티브 설치 기반 추가

## v1.2 · build 3

- 앱 업데이트 알림과 Pages APK 다운로드 흐름 적용
