# 셩냥책 Android App

웹사이트 루트 `README.md`와 분리된 Android 앱 전용 개발·배포 기록입니다.
웹 버전과 Android 앱 버전은 서로 독립적으로 관리합니다.

## 운영 기준

- App ID: `hs.rjs.syungbook`
- 앱 이름: `셩냥책`
- 앱 소스: `mobile/`
- Android 버전 기준: `mobile/android/app/build.gradle`
- APK 공개 경로: `public/downloads/`
- 최신 앱 버전 API: `functions/api/mobile-version.js`
- 앱 패치 ZIP은 `mobile/README.md`를 기준으로 앱 커밋 메시지를 생성합니다.
- 웹 변경 기록은 루트 `README.md`, 앱 변경 기록은 이 파일에만 작성합니다.
- `mobile/node_modules/`, `mobile/www/`, Android build 결과물, 서명키/keystore, `local.properties`는 배포 대상에서 제외합니다.

## 로컬 앱 빌드

```powershell
cd C:\Users\USER\Desktop\dev\rjs\mobile

node .\prepare-web.cjs
node .\patch-offline.cjs
node .\patch-offline-ui.cjs
node .\patch-native-share.cjs
node .\patch-app-update.cjs
node .\patch-native-apk-install.cjs
npx cap sync android
```

`patch-native-apk-install.cjs`는 네이티브 APK 설치 화면 연결과 함께 앱 업데이트 확인의 6시간 캐시를 제거합니다.
따라서 앱 실행 시 최신 `/api/mobile-version`을 다시 확인합니다.

## 앱 릴리즈

관리자 > 배포 > **Android 앱 배포**에서 아래 흐름으로 처리합니다.

1. 현재 배포 앱 버전/build 및 GitHub Android 소스 버전 확인
2. Android Studio에서 생성한 APK 선택
3. 새 앱 버전과 build 확인
4. 업데이트 안내 문구 입력
5. **Android 앱 배포** 실행
6. 아래 파일을 한 커밋으로 자동 반영
   - `public/downloads/syungbook-vX.Y.apk`
   - `functions/api/mobile-version.js`
   - `mobile/android/app/build.gradle`
   - `mobile/README.md`
7. 같은 배포 탭의 상태 카드에서 GitHub 커밋과 Cloudflare Pages 배포 상태 확인

일반 ZIP 업로드는 자동으로 `웹 패치 / Android 앱 패치 / 웹+앱 혼합 패치`를 구분합니다.

<!-- MOBILE_RELEASE_HISTORY -->

## v1.4 · build 5 · 2026-10-03

- 앱 업데이트와 배포 방식을 개선했어요.
- 관리자 배포 탭에 Android 앱 전용 릴리즈 영역 추가
- 현재 배포 버전/build와 GitHub Android 소스 버전을 한 화면에서 확인
- APK·업데이트 문구·버전/build를 관리자에서 한 번에 배포
- APK·`mobile-version.js`·`build.gradle`·`mobile/README.md`를 한 커밋으로 자동 반영
- ZIP 업로드 시 웹 / 앱 / 혼합 패치를 자동 판별
- 앱 패치 커밋 메시지를 `mobile/README.md` 기준 `app vX.Y: ...` 형식으로 분리
- 앱 업데이트 확인의 6시간 캐시 제거
- APK 다운로드 완료 후 Android 설치 화면을 바로 여는 네이티브 업데이트 흐름 유지

## v1.3 · build 4

- Pages APK 직접 배포 경로 적용
- 앱 업데이트 APK 다운로드 후 Android 설치 화면으로 연결하는 네이티브 설치 기반 추가

## v1.2 · build 3

- 앱 업데이트 알림과 Pages APK 다운로드 흐름 적용
