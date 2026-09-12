# 결이든 미니게임

결이든 브랜드의 향기 체험형 웹게임 모음입니다. 별도 프레임워크나 외부 패키지 설치 없이 정적 HTML/CSS/JavaScript와 Node.js 로컬 서버로 실행합니다.

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

## 프로젝트 구조

- `index.html`: 메인 게임인 `향을 담는 돌` 진입점
- `src/`: 메인 게임 공통 로직과 스타일
- `games/`: 게임 허브와 개별 미니게임
- `games/harmony/`: Project Harmony 전용 코드와 데이터
- `public/`: 이미지와 공용 정적 자산
- `scripts/`: 로컬 개발 서버와 자동화 테스트
- `AGENTS.md`: 저장소 작업 시 따르는 에이전트 개발 규칙
- `.agents/skills/luna-chat-coder/`: 웹채팅 기반 GitHub 개발 보조 규칙

## Project Harmony

Project Harmony는 향수의 `Top → Middle → Base` 노트 순서를 카드 전투의 핵심 콤보로 사용한 덱빌딩 로그라이크 프로토타입입니다.

현재 구현에는 무작위 12노드 여정, 3개 Act와 이후 무한 심연, 카드/특성/유물/저주, 적 인텐트, 다양한 상태이상, 숨은 아이템 시너지, 도감·해금·메타 진행, 전투 중 저장/이어하기, 효과음, 결과 이미지와 링크/카카오 공유가 포함됩니다.

세부 구현과 현재 규칙은 [`games/harmony/README.md`](games/harmony/README.md)를 기준으로 확인합니다.

## GitHub Pages

이 저장소는 별도 빌드 과정 없이 GitHub Pages에서 정적 파일을 제공할 수 있는 구조입니다. 배포 브랜치가 `main`으로 설정되어 있다면 `main`에 반영된 변경사항이 Pages 재배포 후 공개 페이지에 적용됩니다.

Project Harmony의 공유 기능은 다음 공개 페이지를 기준으로 동작합니다.

`https://minsung0732.github.io/gid/games/harmony/`

게임 기록과 공유 데이터는 브라우저/URL 기반으로 동작하며 공식 랭킹이나 경품 검증용 서버 데이터가 아닙니다.

## 브랜드 색상

| 용도 | 이름 | 색상 |
| --- | --- | --- |
| 메인 | Forest Green | #235347 |
| 서브 1 | Sage Green | #8EB69B |
| 서브 2 | Butter Yellow | #F8E29A |
| 배경 | Warm Cream | #FAFAF5 |
| 글자 | Warm Charcoal | #333331 |
| 스티커 | Wispy Clouds | #f0efee |
