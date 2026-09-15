# Project Harmony

결이든의 조향 세계관을 카드 전투로 풀어낸 덱빌딩 로그라이크 프로토타입입니다.

핵심 아이디어는 향수의 노트 순서인 `Top → Middle → Base`를 카드 플레이 순서로 사용하고, 순서를 완성하면 `HARMONY!` 추가 효과가 발동하도록 만든 것입니다.

현재 게임 버전은 `games/harmony/version.js`의 `v0.2.0`을 기준으로 관리합니다. 사용자 체감 변경사항과 개발 기준 변경은 [`CHANGELOG.md`](CHANGELOG.md)에 기록합니다.

## 실행

저장소 루트에서:

```sh
npm start
```

브라우저에서 다음 주소로 접속합니다.

`http://127.0.0.1:5173/games/harmony/`

외부 서버 DB 없이 브라우저 저장소를 사용합니다.

## 현재 게임 흐름

한 여정은 12개의 노드로 구성되며 런 시작 시 전투, 엘리트, 보물, 상점/휴식, 보스 카테고리가 무작위로 배치됩니다. 마지막 12번째 노드는 보스입니다.

진행 단계는 다음과 같습니다.

1. Act 1 — 버려진 공방
2. Act 2 — 농축 증류실
3. Act 3 — 공명의 심연
4. 이후 — 무한 심연

다음 Act로 넘어가면 현재 덱과 아이템을 유지한 채 적 체력과 공격력이 상승합니다.

## 전투 기본 규칙

- 시작 체력: 80
- 시작 AP: 3
- AP 기본 상한: 8
- 첫 턴 손패: 5장
- 이후 기본 드로우: 턴당 3장
- 기본 손패 한도: 7장
- 시작 덱: 10장
- 기본 덱 한도: 20장
- 흡수 상한: 100
- 사용하지 않은 카드는 기본적으로 손패에 유지
- 일반/엘리트 전투는 15턴부터, 보스 전투는 20턴부터 폭주 피해 발생

적은 다음 행동을 `인텐트`로 미리 보여주며 전투는 접촉/비접촉 공격, 방어막, 흡수, 회복, 상태이상, 불순물 카드와 여러 패시브 조합을 중심으로 진행됩니다.

## 적 패턴 시스템

적 행동 선택은 `enemy-patterns.js`에서 공통 처리합니다.

- `loopPattern: true`인 적은 기존처럼 패턴을 순서대로 반복합니다.
- 별도 설정이 없는 일반 적은 정의된 패턴 길이만큼, 엘리트는 기본 3턴, 보스는 기본 8턴까지 순차 패턴을 사용합니다.
- 순차 구간이 끝난 뒤에는 패턴별 가중치에 따라 행동을 선택합니다.
- 같은 행동이 반복되면 기본 반복 감쇠값 `0.55`가 적용되어 연속 반복 확률이 낮아집니다.
- 몬스터 정의에서 `patternFixedTurns`, `patternRepeatDecay`, 행동별 `weight`, `repeatDecay`, `patternKey`로 개별 조정할 수 있습니다.

이 구조는 적마다 별도 분기 코드를 추가하지 않고 몬스터 데이터에서 패턴 성격을 조정하기 위한 정책입니다.

## 불순물 주입 규칙

적이 생성하는 불순물 카드는 `impurity-injection.js`에서 주입 위치를 공통 관리합니다.

기본 정책은 불순물을 **뽑을 카드 더미의 무작위 위치**에 넣는 것입니다. 적 인텐트가 별도 규칙을 가지면 다음 위치를 지정할 수 있습니다.

- 뽑을 카드 더미: 무작위 / 맨 위 / 맨 아래 배치
- 손패: 손패 한도를 확인해 직접 주입
- 버린 카드 더미: 즉시 버린 카드 더미에 추가

손패에 공간이 없을 때는 정의된 fallback 위치로 보내며, 기존 버린 카드 더미의 다른 카드는 건드리지 않고 새로 생성된 불순물만 이동합니다.

## Harmony 시스템

카드에는 `top`, `middle`, `base` 노트가 붙을 수 있습니다.

```text
Top → Middle → Base → HARMONY!
```

세 노트를 순서대로 완성하면 마지막 Base 카드의 역할에 따라 추가 효과가 달라집니다.

- 공격 카드: 공격력 기반 추가 피해
- 방어 카드: 방어력 기반 추가 방어막
- 흡수 카드: 해당 카드의 흡수량을 반영한 추가 흡수
- 회복 카드: 해당 카드의 회복량을 반영한 추가 회복

특성, 유물, 숨은 시너지 중에는 Harmony 발동 자체를 강화하거나 Harmony 이후 추가 효과를 발생시키는 빌드도 존재합니다.

## 주요 빌드 축

- 접촉 공격: 연타, 출혈, 방어막 파괴, 접촉 콤보
- 비접촉 공격: 연소, 중독, 잔향, 부식, 원거리 연계
- 흡수/Burst: 흡수를 모아 강력한 카드로 소비
- 방어: 방어막, 보존, 가시, 방어막 비례 공격
- 회복: 직접 회복, 재생, 초과 회복의 방어막 전환
- 오일: 오일 카드 사용에 반응하는 특성/유물 조합
- Harmony: 노트 순서 완성과 Harmony 발동을 중심으로 구성

## 방과 이벤트

전투 외에도 여러 보물/이벤트 방이 존재합니다.

- 채집방
- 황금상자방
- 봉인된 유리 금고
- 달빛 머금은 고대 온실
- 어둠의 침전물 웅덩이
- 연금술 변이 실험대
- 금기된 수은 증류기
- 검은 조향사의 피 제단
- 향나무 주사위 제단
- 타오르는 정제의 화로
- 도플갱어의 향기 거울
- 방랑하는 암시장 밀수꾼
- 아틀리에 / 휴식방

실제 등장 확률과 세부 규칙은 `data.js`, `engine-core.js`, `engine.js`에 정의되어 있습니다.

## 카드와 성장

카드는 접촉, 비접촉, 방어, 흡수, 회복, Burst 계열로 나뉘며 여러 티어와 강화 단계를 가집니다.

아이템은 능력치, 특성, 유물, 저주 등의 종류로 구성되어 있고 특정 아이템 조합을 동시에 보유하면 숨은 시너지 효과가 활성화됩니다.

### Boss Signature Augment

`v0.2.0`부터 보스 전용 증강은 일반 증강과 분리된 Signature Pool로 관리합니다.

- Signature 증강은 `signatureOnly: true`로 표시합니다.
- 지정 보스는 `signatureReward`로 자신의 Signature 증강과 연결됩니다.
- Signature 증강의 T1~T4는 성능/희소도 표기이며 일반 티어 드랍 확률 계산에는 포함하지 않습니다.
- 일반 전투, 보물, 황금상자, 엘리트, 상점, 특수 이벤트 및 일반 랜덤 보상 후보에서는 Signature 증강을 제외합니다.
- 연결된 해금 보스를 처치하면 일반 랜덤 보상과 별개로 해당 Signature 증강을 확정 지급합니다.
- `signature-rewards.js`와 전용 테스트에서 보스 연결, 티어/종류, 일반 드랍/상점 격리를 검증합니다.

도감/메타 진행에는 다음 정보가 저장됩니다.

- 총 런 수
- 최고 점수
- 최고 심연
- 발견 카드/아이템/몬스터
- 발견한 시너지
- 업적 기반 해금

도감 달성률이 높아지면 시작 골드, 시작 포션, 상점 리롤, 첫 턴 AP 등의 영구 보너스가 단계적으로 열립니다.

## 상점과 경제 계산

상점과 일부 이벤트 가격 계산은 `economy-pricing.js`로 분리되어 있습니다.

- 실험실 카드 제거 기본 가격: 20G
- 포션 기본 가격: 25G
- 전체 상점 할인/할증
- 카드 추가 할인
- 상점 가격 배율 및 특수 가격 배율

실제 최종 가격은 현재 런의 특성/유물/효과를 반영해 계산하며, UI는 기본 가격과 최종 가격 차이를 함께 표시할 수 있습니다.

## 저장

저장 시스템은 `persistence.js`에서 관리하며 현재 스키마는 v2입니다.

브라우저 저장소에는 기본 저장, 백업 저장, 임시 저장을 구분해 사용하고 이전 v1 저장도 호환 대상으로 처리합니다. 불러올 때 카드, 아이템, 상태, 적, 방, 런 상태를 검증하고 정규화합니다.

## 공유, 사운드와 설정

현재 구현에는 다음 기능이 포함됩니다.

- 결과 이미지 생성/저장
- 결과 텍스트와 공개 게임 링크 복사
- 카카오톡 결과 공유
- 카드 드로우/사용/셔플 효과음
- 접촉/비접촉 타격음
- 몬스터 재질별 사망음
- Harmony, 흡수, 방어, 회복, 포션, 피격 등 주요 효과음
- 전투 FX 사용 여부 설정
- SFX 켜기/끄기 및 볼륨 조절
- BGM 사용 여부 설정 상태
- 현재 게임 버전 표시

운영체제/브라우저의 `prefers-reduced-motion: reduce`가 감지되면 런타임에 Reduced Motion 상태를 표시하고 턴 전환, 강화, 보상, 전투 애니메이션을 축소하는 기준을 사용합니다.

공개 Harmony 페이지:

`https://minsung0732.github.io/gid/games/harmony/`

## Animation / VFX 개발 기준

신규 애니메이션과 VFX는 [`ANIMATION_VFX_GUIDE.md`](ANIMATION_VFX_GUIDE.md)를 기준으로 추가합니다.

- 강도: Micro / Normal / Strong / Super
- 공격 흐름: Anticipation → Impact → Reaction → Recovery
- 의미 기반 색상 사용
- Stage / Actor / Status / FX / Text Layer 역할 분리
- 상태이상 및 Harmony 전용 Motion Language
- Impact 중심 SFX 타이밍
- Reduced Motion 대체 동작 정의

기존 정상 FX는 규칙 통일만을 이유로 일괄 리팩터링하지 않습니다. 신규 FX 또는 실제 충돌이 확인된 기존 FX부터 점진적으로 적용합니다.

신규 애니메이션 스펙은 [`ANIMATION_SPECS.md`](ANIMATION_SPECS.md)에 Trigger, Duration, Intensity, Color, Layer, Sound Timing, Reduced Motion, 구현 위치를 기록합니다.

## 주요 파일

### 게임 규칙과 데이터

- `data.js`: 카드/아이템/몬스터/방 데이터 조립 계층
- `engine-core.js`: 런 생성, 전투, 방/보상, Harmony, 해금과 진행의 핵심 규칙
- `engine.js`: `engine-core.js`를 감싸며 적 패턴과 불순물 주입 정책을 연결하는 호환 계층
- `enemy-patterns.js`: 순차/가중치 적 행동 선택과 반복 감쇠 규칙
- `impurity-injection.js`: 불순물 생성 후 draw/hand/discard 배치 정책
- `economy-pricing.js`: 상점/실험실 가격과 할인·할증 계산
- `signature-rewards.js`: 보스 Signature 증강 정책 검증
- `statuses.js`: 상태이상 공통 규칙
- `synergies.js`: 숨은 세트 시너지
- `*-cards.js`: 카드 계열별 정의
- `*-items.js`, `*-traits.js`, `official-relics.js`: 아이템/특성/유물 데이터
- `act1-monsters.js`, `act2-monsters.js`, `act3-monsters.js`: Act별 적 데이터

### UI와 사용자 기능

- `index.html`: Harmony 페이지 뼈대와 공통 dialog
- `main.js`: UI 렌더링, 입력, 도감/가이드, 전투 화면 연결
- `card-picker-ui.js`, `card-picker-polish.js`: 카드 선택/보상 UI
- `economy-ui.js`: 가격과 경제 효과 UI 동기화
- `harmony-core-ui.js`: Top → Middle → Base 진행 표시
- `impurity-ui.js`: 불순물 상태와 주입 피드백
- `player-support-ui.js`: 플레이어 지원 상태 UI
- `run-summary-filter.js`: 런 결과/요약 카드 표시 보정
- `settings-ui.js`: 설정 화면, SFX/FX, 버전, Reduced Motion 상태
- `pc-frame-ui.js`, `special-room-pc.css`: 데스크톱 프레임과 특수 방 레이아웃
- `combat-*.js`, `combat-*.css`: 전투 레이아웃, 부유 텍스트, Super FX 등 전투 표현 계층
- `styles.css`와 전용 CSS 모듈: Harmony 전체 UI와 반응형/상태별 스타일

### 저장, 공유와 개발 문서

- `persistence.js`: 저장/복구와 구버전 호환
- `share.js`: 결과 이미지, 링크, 카카오 공유
- `sound.js`: 효과음 재생 관리
- `version.js`: 게임 버전 단일 기준
- `CHANGELOG.md`: 버전/비버전 사용자 체감 변경 기록
- `ANIMATION_VFX_GUIDE.md`: 신규 애니메이션/VFX 개발 기준
- `ANIMATION_SPECS.md`: 신규 FX 스펙 기록

현재 핵심 로직은 기존 단일 `engine.js`에서 `engine-core.js`와 정책 모듈로 분리되었습니다. 다만 `main.js`, `engine-core.js`, `styles.css`에는 여전히 많은 기능이 누적되어 있으므로 이후 구조 리팩터링도 기능 변경과 분리해 단계적으로 진행하는 것이 안전합니다.

## 검증

저장소 루트에서:

```sh
npm run check:harmony
npm run test:harmony
```

전체 프로젝트 검사에서는 다음을 실행합니다.

```sh
npm run check
npm test
```

현재 `npm run test:harmony`는 다음 검증을 묶어 실행합니다.

- `scripts/test-harmony-runner.mjs`: 기존 Harmony 핵심 동작 테스트를 현재 규칙에 맞춰 실행하고 전투 FX 메타데이터도 확인
- `scripts/test-harmony-economy.mjs`: 가격/할인/할증 계산
- `scripts/test-harmony-enemy-patterns.mjs`: 적 순차/가중치 패턴과 반복 감쇠
- `scripts/test-harmony-impurity-injection.mjs`: 불순물 주입 위치와 fallback
- `scripts/test-harmony-signature-rewards.mjs`: 보스 Signature 보상 격리와 연결 규칙

`check:harmony`는 위 모듈과 주요 Harmony 소스의 JavaScript 문법 검사도 함께 수행합니다.

## 현재 프로토타입 상태

- 현재 게임 버전은 `v0.2.0`입니다.
- 게임 허브에 Project Harmony가 등록되어 있습니다.
- 결과 이미지/링크/카카오 공유가 구현되어 있습니다.
- 경로는 고정형이 아니라 런마다 생성되는 12노드 구조입니다.
- 3개 Act 이후 무한 심연으로 이어집니다.
- 보스 전용 Signature Augment가 일반 보상 풀과 분리되어 있습니다.
- 적 패턴, 불순물 주입, 가격 계산이 전용 정책 모듈로 분리되어 있습니다.
- 전투/카드 선택/설정/데스크톱 UI와 Animation/VFX 계층이 별도 모듈로 확장되어 있습니다.
- 실제 플레이 시간과 수치 밸런스는 계속 조정이 필요한 프로토타입 단계입니다.
- 일부 적/아이템은 전용 일러스트 대신 기호 또는 기존 자산을 사용합니다.
- 서버 기반 공식 랭킹/계정/검증 시스템은 없습니다.
