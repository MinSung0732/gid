# Project Harmony

결이든의 조향 세계관을 카드 전투로 풀어낸 덱빌딩 로그라이크 프로토타입입니다.

핵심 아이디어는 향수의 노트 순서인 `Top → Middle → Base`를 카드 플레이 순서로 사용하고, 순서를 완성하면 `HARMONY!` 추가 효과가 발동하도록 만든 것입니다.

현재 게임 버전은 `version.js`의 `v0.2.0`을 기준으로 관리합니다. 사용자 체감 변경사항과 개발 기준 변경은 [`CHANGELOG.md`](CHANGELOG.md)에 기록합니다.

## 실행

저장소 루트에서:

```sh
npm start
```

브라우저에서 다음 주소로 접속합니다.

`http://127.0.0.1:5173/games/harmony/`

게임 진행은 **로컬 저장 우선(local-first)** 구조입니다. 비회원도 그대로 플레이할 수 있고, 로그인 사용자는 Supabase Auth와 Cloud Save를 추가로 사용할 수 있습니다.

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

적 행동 선택은 `enemy-patterns.js`와 엔진 연결 계층에서 공통 처리합니다.

- `loopPattern: true`인 적은 패턴을 순서대로 반복합니다.
- 별도 설정이 없는 일반 적은 정의된 패턴 길이만큼, 엘리트는 기본 3턴, 보스는 기본 8턴까지 순차 패턴을 사용합니다.
- 순차 구간이 끝난 뒤에는 패턴별 가중치에 따라 행동을 선택합니다.
- 같은 행동이 반복되면 기본 반복 감쇠값 `0.55`가 적용되어 연속 반복 확률이 낮아집니다.
- 몬스터 정의에서 `patternFixedTurns`, `patternRepeatDecay`, 행동별 `weight`, `repeatDecay`, `patternKey`로 개별 조정할 수 있습니다.

엔진 연결 책임은 `engine-enemy-patterns.js`로 분리되어 있으며, 실제 전투 규칙을 가진 `engine-core.js`와 패턴 정책을 이어주는 역할을 합니다.

## 불순물 주입 규칙

적이 생성하는 불순물 카드는 `impurity-injection.js`에서 배치 정책을 관리하고, `engine-impurity-policy.js`가 이를 전투 엔진에 연결합니다.

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

실제 등장 확률과 세부 규칙은 `data.js`, `engine-core.js`, `reward-system.js`와 관련 정책 모듈에 정의되어 있습니다.

## 보상 시스템

보상 선택 규칙은 `reward-system.js`에 모여 있습니다. 전투/방/상점에서 직접 보상 확률을 흩어 정의하지 않고, 보상 출처별 profile을 사용합니다.

기본 구조는 다음과 같습니다.

- 일반 전투: 액티브 카드 3개 선택지 중 1개 선택, 건너뛰기 가능
- 채집방: 능력치 아이템 1개
- 황금상자방: 능력치/특성/유물 풀에서 1개
- 엘리트: 특성/유물 중심 보상 1개
- 보스: 상위 특성/유물 중심 보상 1개
- Signature Boss: 지정된 Signature 증강 1개
- 상점: 카드/특성/유물 슬롯별 전용 profile 사용
- 특수 방: 금고, 저주 계열 이벤트, 밀수꾼, 주사위 제단 등이 각자의 명시적인 reward profile 또는 outcome table을 사용

보상 modifier는 출처별 `optionCount`, `pickCount` 등을 조정할 수 있으며, UI는 `reward-ui.js`에서 현재 보상 그룹과 선택 상태를 렌더링합니다.

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

실제 최종 가격은 현재 런의 특성/유물/효과를 반영해 계산하며, `economy-ui.js`가 화면 표시를 담당합니다.

## 저장, 계정과 Cloud Save

저장 데이터 스키마와 정규화는 `persistence.js`에서 관리하며 현재 스키마는 v2입니다. 브라우저 런타임의 실제 저장 동작은 `persistence-runtime.js`가 담당합니다.

### 로컬 저장

- 기본 저장, 백업 저장, 임시 저장을 구분합니다.
- 이전 v1 저장을 호환 대상으로 처리합니다.
- 카드, 아이템, 상태, 적, 방, 런 상태를 불러올 때 검증/정규화합니다.
- `persistence-runtime.js`가 현재 runtime storage를 선택하고 local revision을 소유합니다.
- 저장은 로컬에 먼저 완료한 뒤 Cloud Sync와 종료 런 기록 같은 선택적 side effect를 실행합니다.
- 다른 탭에서 변경된 저장을 다시 읽는 경로도 동일한 runtime persistence 경계를 사용합니다.

### 계정 분리

저장 namespace는 다음처럼 분리됩니다.

```text
Guest  → harmony:guest:*
Member → harmony:<auth.users.id>:*
```

기존 namespace 없는 Harmony 저장이 있으면 Guest namespace에 저장이 없을 때 Guest 영역으로 복사합니다. Guest와 각 회원은 서로 다른 storage adapter를 사용하므로 다른 계정의 로컬 저장을 읽지 않습니다.

### Supabase Auth

- Kakao / Google OAuth 로그인 지원
- 회원 식별자는 Supabase `auth.users.id` / `user.id` 사용
- `profiles`는 표시 정보 조회용이며 저장 권한 식별자로 사용하지 않음
- `bootstrap.js`가 세션과 storage scope를 결정한 뒤 게임 모듈을 로드
- 운영 환경과 로컬 환경에 맞는 OAuth redirect URL 사용

### Cloud Save

Cloud Save는 **localStorage first / Cloud Sync second** 원칙을 사용합니다.

```text
Harmony save
→ 계정별 localStorage 즉시 저장
→ debounce 후 player_state 비동기 동기화
```

- 게임 진행은 Supabase 응답을 기다리지 않습니다.
- 네트워크/Cloud Sync 실패가 로컬 저장 성공을 되돌리지 않습니다.
- `user_id + expected cloud_revision` 조건으로 Optimistic Locking을 사용합니다.
- Local과 Cloud 저장 내용이 다르면 자동 병합하지 않고 사용자가 선택합니다.
- 다른 기기에서 먼저 저장해 revision 충돌이 발생하면 최신 Cloud 상태를 다시 확인합니다.
- 온라인 복귀 시 대기 중인 Cloud Sync를 재시도할 수 있습니다.

### 종료 런 기록

로그인 사용자의 종료 런은 `run-history.js`를 통해 `run_results`에 비동기로 기록됩니다.

- 새 런은 UUID `runId`를 사용합니다.
- 동일 `runId` 중복 전송을 클라이언트에서 억제합니다.
- DB의 고유 제약을 최종 중복 방지 장치로 사용합니다.
- 클라이언트가 생성하는 결과는 `verified: false`입니다.

따라서 현재 `run_results`는 계정별 런 기록용이며 서버 검증이 완료된 공식 랭킹 판정으로 취급하지 않습니다.

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
- 모션 모드: 시스템 설정 따르기 / 기본 모션 / 모션 줄이기
- 현재 게임 버전 표시

모션 설정은 운영체제/브라우저의 `prefers-reduced-motion`을 따를 수도 있고, 사용자가 Harmony 내부 설정에서 기본 모션 또는 모션 줄이기를 강제로 선택할 수도 있습니다.

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

## 현재 코드 구조

Harmony는 초기의 큰 `main.js` / `engine.js` 중심 구조에서 기능 경계를 나누는 방향으로 단계적으로 모듈화되고 있습니다. 현재까지 완료된 분리는 기존 게임 규칙을 바꾸기 위한 것이 아니라 책임과 테스트 경계를 명확하게 만드는 리팩터링입니다.

### 게임 규칙과 정책

- `data.js`: 카드/아이템/몬스터/방 데이터 조립 계층
- `engine-core.js`: 런 생성, 전투, 방/보상, Harmony, 해금과 진행의 핵심 규칙
- `engine.js`: `engine-core.js`를 공개 API로 노출하고 엔진 정책 모듈을 연결하는 얇은 bridge
- `engine-enemy-patterns.js`: 적 패턴 준비/상태를 엔진에 연결
- `engine-impurity-policy.js`: 적 불순물 생성 결과를 주입 정책에 연결
- `enemy-patterns.js`: 순차/가중치 행동 선택과 반복 감쇠
- `impurity-injection.js`: 불순물 draw/hand/discard 배치 정책
- `reward-system.js`: 전투/방/상점/특수 이벤트 보상 profile과 선택 규칙
- `economy-pricing.js`: 상점/실험실 가격과 할인·할증 계산
- `signature-rewards.js`: 보스 Signature 증강 정책 검증
- `statuses.js`: 상태이상 공통 규칙
- `synergies.js`: 숨은 세트 시너지

### 전투와 게임 액션 오케스트레이션

- `combat-turn-orchestrator.js`: 턴 종료, 적 행동, 라운드 종료의 순서와 피드백 조율
- `combat-card-orchestrator.js`: 카드 사용, AP/비용, 공격 애니메이션, 상태/불순물 피드백, 사망/승리 분기 조율
- `game-action-orchestrator.js`: 방 입장, 보상, 휴식, 상점, 특수 방, 포션, 루프/결과 등 비카드 액션 조율

전투 수치 계산과 규칙 자체는 엔진 계층에 남아 있고, 오케스트레이터는 기존 렌더/사운드/VFX/저장 callback을 연결해 실행 순서를 관리합니다.

### UI와 VFX

- `main.js`: 게임 전체 상태와 각 모듈을 연결하는 상위 UI/입력 진입점
- `codex-ui.js`: 도감 탭, 발견 상태, 컬렉션 진행률, 용어/상태 가이드
- `reward-ui.js`: 보상 카드/아이템/골드와 보상 그룹 UI
- `run-summary-ui.js`: 런 요약, 덱/아이템 필터와 상세 표시
- `starting-deck-builder-ui.js`: 시작 덱/테스트 덱 선택과 검증 UI
- `player-vfx-anchor.js`: 플레이어 피격/회복 VFX 기준 좌표
- `battle-overlay.js`: 전투 overlay와 shield overlay 배치
- `combat-feedback-vfx.js`: 피격, 회복, 상태 피해/연기 등 공통 피드백
- `attack-feedback-vfx.js`: 접촉/비접촉 공격 impact, shield break, 피해 숫자, 관련 SFX
- `card-picker-ui.js`, `card-picker-polish.js`: 카드 선택/보상 카드 UI
- `harmony-core-ui.js`: Top → Middle → Base 진행 표시
- `impurity-ui.js`: 불순물 상태와 주입 피드백
- `player-support-ui.js`: 플레이어 지원 상태 UI
- `pc-frame-ui.js`: 데스크톱 프레임/사이드 정보 표시
- `settings-ui.js`: FX/SFX/BGM/모션/버전 설정
- `styles.css`와 전용 CSS 모듈: Harmony 전체 UI와 반응형/상태별 스타일

### 저장, 계정과 외부 연동

- `persistence.js`: 저장 스키마, 정규화, 복구와 구버전 호환
- `persistence-runtime.js`: runtime storage 선택, revision, save side effect와 cross-tab reload 경계
- `scoped-storage.js`: Guest/회원별 localStorage namespace adapter
- `supabase-client.js`: Supabase browser client 생성
- `auth.js`: 세션, OAuth 로그인/로그아웃, profile 조회
- `bootstrap.js`: Auth/Cloud/Storage 초기화 후 게임 모듈 시작
- `cloud-sync.js`: `player_state` 비동기 동기화, debounce, Optimistic Locking, 충돌 처리
- `run-history.js`: 로그인 사용자의 종료 런 `run_results` 기록
- `account-ui.js`: 계정/Cloud Save 상태 UI
- `share.js`: 결과 이미지, 링크, 카카오 공유
- `sound.js`: 효과음 재생 관리
- `version.js`: 게임 버전 단일 기준

### 데이터와 문서

- `*-cards.js`: 카드 계열별 정의
- `*-items.js`, `*-traits.js`, `official-relics.js`: 아이템/특성/유물 데이터
- `act1-monsters.js`, `act2-monsters.js`, `act3-monsters.js`: Act별 적 데이터
- `CHANGELOG.md`: 버전/비버전 사용자 체감 변경 기록
- `ANIMATION_VFX_GUIDE.md`: 신규 Animation/VFX 개발 기준
- `ANIMATION_SPECS.md`: 신규 FX 스펙 기록

`main.js`와 `engine.js`에서 많은 책임이 이미 별도 모듈로 이동했지만, 구조 변경은 계속 기능 단위로 분리해 회귀 테스트와 함께 진행하는 것을 원칙으로 합니다.

## 검증

저장소 루트에서 Harmony만 검사할 때:

```sh
npm run check:harmony
npm run test:harmony
```

전체 프로젝트 검사에서는 다음을 사용합니다.

```sh
npm run check
npm test
```

현재 Harmony 테스트는 다음 영역을 각각 전용 테스트로 검증합니다.

- 핵심 전투/루트/저장 호환: `test-harmony-runner.mjs`
- 경제 가격: `test-harmony-economy.mjs`
- 적 패턴: `test-harmony-enemy-patterns.mjs`
- 불순물 주입: `test-harmony-impurity-injection.mjs`
- Signature 보상: `test-harmony-signature-rewards.mjs`
- 보상 profile/특수 방/클리어 보상: `test-harmony-reward-system.mjs`, `test-harmony-special-rooms.mjs`, `test-harmony-clear-rewards.mjs`
- Auth/Cloud Save: `test-harmony-auth-sync.mjs`
- 플레이어 VFX anchor / battle overlay / 전투 feedback: 관련 `test-harmony-*-vfx.mjs`, `test-harmony-battle-overlay.mjs`
- 도감/보상/런 요약/시작 덱 UI: 각 전용 UI 테스트
- 전투 턴/카드/게임 액션 오케스트레이션: 각 orchestrator 전용 테스트
- runtime persistence 경계: `test-harmony-persistence-runtime.mjs`

최근 모듈화 작업은 `npm run check:harmony`, `npm run test:harmony`, `npm test`를 통과한 상태로 병합되었습니다. 저장소 전체 `npm run check`는 Harmony와 무관한 기존 `games/scent-workshop/share.js` 누락 때문에 별도로 막혀 있는 상태가 기록되어 있습니다.

## 현재 프로토타입 상태

- 현재 게임 버전은 `v0.2.0`입니다.
- 게임 허브에 Project Harmony가 등록되어 있습니다.
- 경로는 런마다 생성되는 12노드 구조이며 3개 Act 이후 무한 심연으로 이어집니다.
- 보스 전용 Signature Augment가 일반 보상 풀과 분리되어 있습니다.
- 보상 시스템은 출처별 profile을 사용하는 공통 모듈로 분리되어 있습니다.
- 적 패턴, 불순물 주입, 가격 계산과 엔진 연결 정책이 전용 모듈로 분리되어 있습니다.
- 전투 VFX/UI와 도감/보상/런 요약/시작 덱 UI가 별도 모듈로 분리되어 있습니다.
- 전투 턴, 카드 사용, 일반 게임 액션 실행 순서가 오케스트레이터로 분리되어 있습니다.
- 로컬 저장은 `persistence-runtime.js` 경계를 통해 처리되며 로그인 사용자는 비동기 Cloud Save를 추가로 사용합니다.
- Kakao/Google OAuth, 계정별 저장 격리, Cloud Save 충돌 선택, 비회원 플레이를 지원합니다.
- 결과 이미지/링크/카카오 공유와 전투/효과음/모션 설정이 구현되어 있습니다.
- 실제 플레이 시간과 수치 밸런스는 계속 조정이 필요한 프로토타입 단계입니다.
- 일부 적/아이템은 전용 일러스트 대신 기호 또는 기존 자산을 사용합니다.
- `run_results`는 현재 클라이언트가 `verified: false`로 기록하므로 공식 서버 검증 랭킹은 아닙니다.
