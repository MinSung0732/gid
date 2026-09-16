# 결이든 미니게임

결이든 브랜드의 향기 체험형 웹게임 모음입니다. 정적 HTML/CSS/JavaScript와 Node.js 로컬 서버를 중심으로 구성되어 있으며, Project Harmony는 로그인·Cloud Save를 위해 Supabase 클라이언트를 선택적으로 사용합니다.

## 현재 구성

게임 허브(`games/`)에서 다음 콘텐츠를 제공합니다.

- 향을 담는 돌: 30초 타이밍 게임
- 오늘의 향기 한마디: 데일리 향기 카드
- 향기의 기억: 카드 매칭 기억력 게임
- 결이든 오브제 2048: 머지 퍼즐
- 결이든 향기 공방: 클리커/공방 성장 게임
- Project Harmony: 조향 콘셉트의 덱빌딩 로그라이크

`향기 정원 키우기`, `마음의 온도 테스트`는 현재 준비 중입니다.

## 실행

Node.js가 설치된 환경에서 저장소 루트 기준으로 실행합니다.

```sh
npm start
```

로컬 주소:

- 메인: http://127.0.0.1:5173/
- 게임 목록: http://127.0.0.1:5173/games/
- Project Harmony: http://127.0.0.1:5173/games/harmony/

## 검사와 테스트

```sh
npm run check
npm test
```

Project Harmony만 확인할 때는 다음 명령을 사용할 수 있습니다.

```sh
npm run check:harmony
npm run test:harmony
```

Harmony 전용 검증은 핵심 전투/루트/저장 호환뿐 아니라 상태이상 체계, 보상 profile, 적 패턴, 불순물 주입, Signature 보상, Auth/Cloud Sync, 브라우저·사운드·저장 runtime 경계, VFX/UI 모듈, 전투·게임 액션 오케스트레이션까지 포함합니다.

## 프로젝트 구조

- `index.html`: 메인 게임인 `향을 담는 돌` 진입점
- `src/`: 메인 게임 공통 로직과 스타일
- `games/`: 게임 허브와 개별 미니게임
- `games/harmony/`: Project Harmony 전용 게임 코드, 데이터, UI, 저장/계정 연동 모듈
- `public/`: 이미지와 공용 정적 자산
- `scripts/`: 로컬 개발 서버와 자동화 테스트
- `AGENTS.md`: 저장소 작업 시 따르는 에이전트 개발 규칙
- `.agents/skills/luna-chat-coder/`: 웹채팅 기반 GitHub 개발 보조 규칙

## Project Harmony

Project Harmony는 향수의 `Top → Middle → Base` 노트 순서를 카드 전투의 핵심 콤보로 사용한 덱빌딩 로그라이크 프로토타입입니다.

현재 구현에는 무작위 12노드 여정, 3개 Act와 이후 무한 심연, 카드/특성/유물/저주, 적 인텐트와 가중치 패턴, 발동형·시간형 상태이상, 불순물, 숨은 아이템 시너지, 보스 Signature Augment, 도감·해금·메타 진행, 출처별 보상 profile, 전투 중 저장/이어하기, 효과음/VFX/모션 설정, 결과 이미지와 링크/카카오 공유가 포함됩니다.

게스트는 계정별 namespace가 분리된 브라우저 저장소를 기본으로 사용합니다. 로그인 사용자는 Kakao/Google OAuth를 통해 Supabase 계정에 연결할 수 있으며, 로컬 저장을 우선한 뒤 `player_state`에 비동기로 Cloud Save를 동기화합니다. 종료 런 기록은 로그인 사용자에 한해 `run_results`에 `verified: false` 상태로 기록됩니다.

Harmony의 내부 구조는 엔진 정책, 보상, 상태이상, 전투/VFX, UI, 저장, 브라우저 플랫폼, 사운드 runtime을 기능 단위 모듈로 분리하는 방향으로 정리되어 있습니다. 세부 게임 규칙과 현재 모듈 책임은 [`games/harmony/README.md`](games/harmony/README.md)를 기준으로 확인합니다.

## GitHub Pages

이 저장소는 별도 애플리케이션 빌드 없이 GitHub Pages에서 정적 파일을 제공할 수 있는 구조입니다. 배포 브랜치가 `main`으로 설정되어 있다면 `main`에 반영된 변경사항이 Pages 재배포 후 공개 페이지에 적용됩니다.

Project Harmony의 공유/OAuth 운영 URL은 다음 페이지를 기준으로 합니다.

`https://minsung0732.github.io/gid/games/harmony/`

Harmony의 Cloud Save와 런 기록은 계정 편의 기능입니다. 현재 클라이언트가 기록하는 런 결과는 `verified: false`이며 공식 랭킹이나 경품 검증용 서버 판정으로 취급하지 않습니다.

## 브랜드 색상

| 용도 | 이름 | 색상 |
| --- | --- | --- |
| 메인 | Forest Green | #235347 |
| 서브 1 | Sage Green | #8EB69B |
| 서브 2 | Butter Yellow | #F8E29A |
| 배경 | Warm Cream | #FAFAF5 |
| 글자 | Warm Charcoal | #333331 |
| 스티커 | Wispy Clouds | #f0efee |
