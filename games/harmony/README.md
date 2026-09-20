# Project Harmony

결이든의 조향 세계관을 카드 전투로 풀어낸 덱빌딩 로그라이크 프로토타입입니다.

핵심 아이디어는 향수의 노트 순서인 `Top → Middle → Base`를 카드 플레이 순서로 사용하고, 순서를 완성하면 `HARMONY!` 추가 효과가 발동하도록 만든 것입니다.

현재 게임 버전은 `version.js`의 `v0.3.0`입니다. 최신 사용자 패치 요약은 인게임 `patch-notes-ui.js`가 제공하며, 기존 버전 정책과 과거 개발 기록은 [`CHANGELOG.md`](CHANGELOG.md)를 참고합니다.

전역 밸런스 수치는 [`editor/README.md`](editor/README.md)의 안내에 따라 `editor/` 폴더에서 조정합니다. 이 폴더는 브라우저 UI가 아니라 소스에서 공통 숫자를 한곳에 관리하기 위한 설정 계층입니다.

## 실행

저장소 루트에서:

```sh
npm start
```

브라우저에서 다음 주소로 접속합니다.

`http://127.0.0.1:5173/games/harmony/`

게임 진행은 **로컬 저장 우선(local-first)** 구조입니다. 비회원도 그대로 플레이할 수 있고, 로그인 사용자는 Supabase Auth와 Cloud Save를 추가로 사용할 수 있습니다.

## 캠페인과 여정

기본 여정은 12개 방 흐름을 사용하며 일반 새 런은 항상 Act 1에서 시작합니다. 메타 해금은 새 런의 시작 지점을 건너뛰게 하지 않고, 런이 더 먼 캠페인 구간으로 이어질 수 있게 확장합니다.

현재 캠페인은 다음 단계로 구성됩니다.

1. Act 1 — 버려진 공방
2. Act 2 — 농축 증류실
3. Act 3 — 공명의 심연
4. Act 4 — 변질된 조향실
5. Act 5 — 살아 움직이는 조향 생태계
6. Act 6 — 붕괴 직전의 대연금 시설
7. Act 7 — 플레이 성향에 따라 세 경로 중 하나로 분기
   - 7-1 — 육체화된 향
   - 7-2 — 초고온 향류
   - 7-3 — 공명 의식
8. Act 7 이후 — 심연(Abyss)

`campaign-progression.js`가 후반 캠페인 해금과 분기를 관리합니다. 메타 진행 기준으로 Act 3 클리어 후 Act 4, Act 4 클리어 후 Act 5/6, Act 6 클리어 후 Act 7, 첫 Act 7 경로 클리어 후 심연 접근이 열립니다.

Act 6에서는 카드 플레이 경향을 추적해 Act 7 경로를 결정합니다. 접촉 공격은 육체, 비접촉/연소 성향은 열, 노트/Harmony 사용은 공명 신호에 반영됩니다.

후반 캠페인 데이터와 전용 전투 처리는 `campaign-progression.js`, `late-game-content.js`, `late-game-runtime.js`, `late-game-boss-phase.js`, `campaign-ui.js` 등으로 분리되어 있습니다.

## 전투 기본 규칙

공통 전투/플레이어 수치는 `editor/` 설정에서 관리합니다. 현재 기본값은 다음과 같습니다.

- 시작 최대 체력: 80
- 시작 AP / 기본 턴 AP: 3
- AP 기본 상한: 8
- 첫 턴 드로우: 5장
- 이후 기본 드로우: 턴당 3장
- 기본 손패 한도: 7장
- 시작 덱: 10장
- 기본 덱 한도: 20장
- 최소 덱 크기: 5장
- 시작 포션: 1개
- 포션 기본 한도: 3개
- 포션 기본 회복량: 20
- 전투 UI가 지원하는 최대 동시 적 수: 3

카드 사용, AP/비용 처리, 타격/상태 피드백, 적 행동, 승리/사망 분기는 엔진 규칙과 오케스트레이터 계층에서 분리해 처리합니다.

## 상태이상 체계

2026-09-16 기준 상태이상 전투 정체성이 재정리되었습니다. 상태별로 `duration`, `stackDecay`, `triggerConsume`, `persistent`와 같은 지속 방식을 구분하며 도감에서는 현재 23종의 상태를 기준으로 표시합니다.

주요 전투 규칙은 다음과 같습니다.

- **출혈**: 접촉 공격이 적중하면 1스택을 소비하고 해당 직접 피해의 20%를 추가 피해로 줍니다. 턴 종료 피해나 자연 감소는 사용하지 않습니다.
- **연소**: 비접촉 공격이 적중하면 1스택을 소비하고 해당 직접 피해의 10%를 추가 피해로 줍니다. 턴 종료 피해나 자연 감소는 사용하지 않습니다.
- **중독**: 턴 종료 시 스택만큼 방어막 무시 피해를 주고 1스택 감소하는 시간형 DoT입니다.
- **혼란**: 카드와 AP를 소비한 뒤 22.2% 확률로 카드 전체 효과가 취소되고 최대 HP의 5%(최소 3)만큼 자해 피해를 받습니다.
- **방해**: 스택당 10%, 최대 50% 확률로 카드의 기본 효과는 유지하면서 상태 부여, 드로우, AP 환급 같은 부가효과만 실패할 수 있습니다.

기존 `위축`, `향기 차단`, `노트 붕괴`는 현재 규칙에 맞춰 제거·통합되었습니다. 이전 저장에 남은 값은 `persistence.js`에서 약화/봉인으로 호환 변환하거나 안전하게 폐기합니다. 출혈·연소 발동과 혼란/방해 실패는 별도 전투 피드백/VFX로 표시합니다.

## 적 패턴과 후반 전투

적 행동 선택은 `enemy-patterns.js`와 엔진 연결 계층에서 공통 처리합니다.

- `loopPattern: true`인 적은 패턴을 순서대로 반복합니다.
- 순차 구간이 끝난 뒤에는 패턴별 가중치에 따라 행동을 선택합니다.
- 같은 행동 반복에는 감쇠를 적용할 수 있으며 몬스터 정의에서 고정 턴, 반복 감쇠, 행동별 가중치와 `patternKey`를 개별 조정할 수 있습니다.

Act 4~7과 심연은 기존 1~3막 규칙을 단순 복제하지 않고 후반 전용 콘텐츠 모듈을 사용합니다. 소환, 지원, 충전, 분석, 다단 공격, 강한 제어, 보스 단계 같은 전용 기믹이 포함되며 생존 적 기준 슬롯 계산과 인텐트 표시가 현재 UI 규칙에 맞춰 처리됩니다.

`engine-enemy-patterns.js`는 실제 전투 규칙을 가진 `engine-core.js`와 패턴 정책을 연결합니다.

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

덱이 가득 찬 상태에서 카드 보상을 받을 때는 `deck-replacement-ui.js`가 교체할 기존 카드를 고르는 흐름을 담당합니다. 보상 규칙 자체는 기존 엔진/보상 계층에 남아 있습니다.

## 카드, mechanic metadata와 성장

카드는 접촉, 비접촉, 방어, 흡수, 회복, Burst 계열로 나뉘며 여러 티어와 강화 단계를 가집니다.

`v0.3.0`부터 카드의 실제 기믹 판정, 요약 뱃지, 내부 태그, 덱 필터가 공통 mechanic metadata를 기준으로 정리되었습니다.

- 공식 액티브카드 134종의 상태이상/기믹 뱃지를 전수 점검
- 직접 부여뿐 아니라 참조, 소비, 조건, 조작에 쓰이는 상태도 뱃지에 반영
- 실제 방어막 관통 카드는 공통 `shieldPierce` mechanic과 관통 뱃지를 사용
- 상세 툴팁, 도감, 손패 요약이 공통 의미 색상과 상태 정의를 공유
- 카드 설명의 중복 문구는 줄이되 실제 수치/조건/지속시간 정보는 유지

관련 책임은 `card-presentation.js`, `card-presentation-base.js`, `card-mechanics.js`, `card-semantic-text.js`, `card-copy-policy.js`, `card-copy-overrides.js` 등에 분리되어 있습니다.

아이템은 능력치, 특성, 유물, 저주와 증강으로 구성되며 특정 조합은 시너지 효과를 활성화합니다.

### Boss Signature Augment

보스 전용 Signature 증강은 일반 랜덤 보상 풀과 분리되어 있습니다.

- Signature 증강은 `signatureOnly: true`로 구분
- 지정 보스와 `signatureReward`로 연결
- 일반 전투/상점/이벤트의 일반 랜덤 후보에서는 제외
- 연결된 보스 처치 시 일반 보상과 별개로 지정 Signature 지급

관련 정책과 검증은 `signature-rewards.js`, `signature-relic-runtime.js`와 전용 테스트가 담당합니다.

### 추가 공식 증강 팩

`augment-pack-20260918.js`에는 2026-09-18 설계 시트에서 승격한 공식 증강 팩이 별도 registry로 유지됩니다. 기존 staged augment registry와 계약을 섞지 않고 카드/아이템 획득 조건과 runtime 효과를 별도 테스트합니다.

도감/메타 진행에는 총 런 수, 최고 점수, 최고 진행도, 발견 카드/아이템/몬스터/시너지와 캠페인 클리어 정보가 저장됩니다. 도감 달성률에 따라 시작 골드, 시작 포션, 상점 리롤, 첫 턴 AP 같은 영구 보너스가 단계적으로 열립니다.

## 시작 덱, LOCAL CARD LAB과 특수 선택 UI

일반 시작 덱 빌더와 LOCAL CARD LAB은 같은 카드 mechanic 데이터를 재사용하지만 필터 상태와 접근 목적은 분리합니다.

- 일반 시작 덱: 1티어 카드 기반 필터, 10장 기본 편성, 카드별 복사 제한, 추천 덱
- LOCAL CARD LAB: 카드와 증강을 실제 데이터 기반으로 상세 필터링
- PC: 필터 popover
- 모바일: bottom sheet
- 일반 시작 모드와 LOCAL 테스트 모드의 필터 상태 분리
- 필터를 바꿔도 이미 선택한 카드/증강은 유지

LOCAL 접근은 `local-feature-access.js`가 공통 관리합니다. LOCAL CARD LAB에서는 테스트 덱/증강을 유지한 채 Act 1~7의 각 경로와 심연 시작 지점을 선택할 수 있으며 정상 캠페인의 시작/해금 규칙과는 분리된 테스트 경로입니다.

특수 방의 게임 규칙은 엔진에 유지하고 선택 UI는 별도 모듈로 분리합니다.

- `special-deck-picker-ui.js`: 실험실 노트 재지정, 카드 제거, 피 제단 정화, 거울 복제 등 덱 대상 선택
- `rest-upgrade-ui.js`: 휴식방 회복/강화 UI와 강화 전후 비교
- `deck-replacement-ui.js`: 덱 한도에 도달한 카드 보상의 교체 선택
- `starting-deck-builder-ui.js`: 일반/LOCAL 시작 덱 선택과 검증

## 상점과 전역 밸런스 설정

전역 공통 수치는 `editor/` 모듈에서 중앙 관리합니다.

- `editor/deck.js`: 시작 덱, 기본 덱 한도, 최소 덱
- `editor/player.js`: HP, AP, 손패, 드로우, 포션, 불순물 손패 규칙
- `editor/economy.js`: 포션/연구실 기본 가격
- `editor/rewards.js`: 보상 후보 소진 시 대체 골드
- `editor/campaign.js`: 도감 진행 보너스 해금률/지급량
- `editor/combat.js`: 전투 공통 제한
- `editor/index.js`: 설정 export와 상호 제약 검증

현재 기본 포션 가격은 25G, 연구실 카드 제거 기본 가격은 20G입니다. 실제 최종 가격은 런의 할인/할증 효과를 반영하며 `economy-pricing.js`가 계산하고 `economy-ui.js`가 표시합니다.

카드, 증강, 몬스터 하나에만 적용되는 값은 기존 데이터 파일에서 계속 관리합니다. 방 구성/순서는 `data.js`, 보상 후보 수는 `reward-system.js`, 아틀리에 가격은 전용 모듈이 원본입니다.

밸런스 검증에는 최소 덱 ≤ 시작 덱 ≤ 기본 덱 한도, 기본 AP ≤ AP 상한, 드로우 ≤ 손패 한도, 최대 적 수 3 이하, 가격/보상 음수 금지, 도감 해금률 범위/순서 등이 포함됩니다.

## 도전과제와 로비

`v0.3.0`에는 상단 메뉴의 도전과제 모달과 Supabase 기반 통계/기록 구조가 추가되었습니다.

- 달성/미달성, 희귀도 기준으로 도전과제 기록 확인
- `achievement-service.js`가 Supabase RPC로 요약 통계 조회
- Supabase migration에 도전과제 catalog, 사용자 달성 기록, 통계/인덱스 구조 포함

현재 로비는 Hero → Harmony Record → 기능 안내 순으로 구성됩니다. 진행 중인 런이 있으면 이어하기가 우선 CTA가 되며, `meta.totalRuns`, `meta.highScore`, `meta.highestLoop`를 Harmony Record 패널의 원본 데이터로 사용합니다.

새 여정/LOCAL 진입 확인은 브라우저 `confirm` 대신 `harmony-confirm-ui.js`의 공용 `<dialog>` 모달을 사용합니다. 취소 시 현재 런 상태를 유지하며 새 런이 실제 생성될 때만 기존 런을 포기합니다.

## 저장, 계정과 Cloud Save

저장 데이터 스키마와 정규화는 `persistence.js`에서 관리하며 현재 스키마는 v2입니다. 브라우저 런타임의 실제 저장 동작은 `persistence-runtime.js`가 담당합니다.

### 로컬 저장

- 기본 저장, 백업 저장, 임시 저장을 구분합니다.
- 이전 v1 저장을 호환 대상으로 처리합니다.
- 카드, 아이템, 상태, 적, 방, 런 상태를 불러올 때 검증/정규화합니다.
- 삭제·통합된 상태이상은 현재 상태 체계에 맞춰 호환 변환하거나 제거합니다.
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

## PC와 모바일 UI

PC 프레임과 모바일 전투 화면은 별도 표현 계층을 사용합니다.

- `pc-frame-ui.js`: 데스크톱 프레임, 빌드 분석, 사이드 정보
- `mobile-battle-ui.js`: 모바일 전투 HUD, Harmony 진행 표시, 메뉴/정보 drawer
- `mobile-run-detail.js`, `mobile-run-detail-ui.js`: 모바일 런 상세
- `enemy-status-ui.js`: 적 상태/방어/인텐트 표현
- `room-relic-presentation.js`: 방/유물 표현 계층

모바일 전투 UI는 HP, Gold, Potion, 방 진행도, Harmony `TOP → MID → BASE`, 빌드/시너지, 덱/런 정보, 전투 로그, 도감, 설정, 저장 후 홈 진입을 작은 화면에 맞춰 재배치합니다.

## 브라우저 / 사운드 Runtime 경계

브라우저 플랫폼 의존 동작과 사운드 생성/저장 접근도 별도 runtime 모듈로 분리되어 있습니다.

- `browser-runtime.js`: storage 접근, URL/history/reload, 안전한 random ID/seed, custom event, 온라인 복귀 hook, Reduced Motion preference, `HarmonyRuntime` global 접근
- `sound-runtime.js`: SFX 설정 저장소 접근과 `Audio` 생성 경계
- `sound.js`: 사운드 매핑, 재생/중첩 규칙, heartbeat mix, mute/volume 정책과 공개 `SFX` API

이 분리는 기존 게임/사운드 동작을 바꾸기보다 브라우저 API 직접 접근을 한곳에 모아 테스트 가능한 경계를 만드는 리팩터링입니다.

## 공유, 사운드와 설정

현재 구현에는 다음 기능이 포함됩니다.

- 결과 이미지 생성/저장
- 결과 텍스트와 공개 게임 링크 복사
- 카카오톡 결과 공유
- 카드 드로우/사용/셔플 효과음
- 접촉/비접촉 타격음
- 몬스터 재질별 사망음
- Harmony, 흡수, 방어, 회복, 포션, 피격 등 주요 효과음
- 출혈/연소 발동 등 상태이상 전용 피드백
- 전투 FX 사용 여부 설정
- SFX 켜기/끄기 및 볼륨 조절 — 전투 중 변경도 즉시 반영
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

## 패치노트

상단 버전 UI와 설정에서 인게임 패치노트를 열 수 있습니다. `patch-notes-ui.js`는 현재 `v0.3.0`, `v0.2.0`, `v0.1.0` 기록을 유지합니다.

`v0.3.0` 패치노트에는 mechanic/status badge 통합, 카드 가독성, 적 패널/소환/인텐트 수정, 실시간 SFX 설정, 덱 필터/LOCAL 기능, 도전과제와 Supabase 연동이 정리되어 있습니다.

`CHANGELOG.md`는 버전 정책과 기존 개발 기록을 위한 문서이며, 현재 사용자에게 노출되는 최신 릴리스 요약은 인게임 패치노트를 기준으로 확인하는 편이 정확합니다.

## 현재 코드 구조

Harmony는 큰 `main.js` / `engine.js` 하나에 책임을 모으는 구조에서 기능 경계를 분리하는 방향으로 계속 정리되어 있습니다.

### 게임 규칙 / 캠페인 / 정책

- `data.js`: 카드/아이템/몬스터/방 데이터 조립
- `engine-core.js`: 런/전투/방/Harmony/보상 핵심 규칙
- `engine.js`: 공개 엔진 API와 정책 연결
- `campaign-progression.js`: Act 4~7/Abyss 해금, Act 7 분기
- `late-game-content.js`: 후반 캠페인 적/콘텐츠
- `late-game-runtime.js`, `late-game-boss-phase.js`: 후반 전투 runtime/보스 단계
- `enemy-patterns.js`: 적 행동 패턴 정책
- `impurity-injection.js`: 불순물 배치 정책
- `reward-system.js`: 보상 profile
- `editor/`: 공통 밸런스 설정/검증

### 카드 / 증강 / 전투 오케스트레이션

- `card-mechanics.js`: 카드 mechanic metadata
- `card-presentation*.js`, `card-copy-*.js`: 카드 문구/표현
- `signature-rewards.js`, `signature-relic-runtime.js`: Signature 정책/runtime
- `augment-pack-20260918.js`, `augment-event-runtime.js`: 추가 공식 증강과 획득 runtime
- `combat-turn-orchestrator.js`: 턴/적 행동/라운드 순서
- `combat-card-orchestrator.js`: 카드 사용과 피드백 순서
- `game-action-orchestrator.js`: 방/보상/상점/포션/캠페인 액션 순서

### UI / 기록

- `starting-deck-builder-ui.js`, `local-deck-filter-registry.js`: 시작 덱/LOCAL 필터
- `achievement-ui.js`, `achievement-service.js`: 도전과제 UI/통계 조회
- `patch-notes-ui.js`: 인게임 버전별 패치노트
- `harmony-confirm-ui.js`: 공용 확인 dialog
- `mobile-battle-ui.js`, `mobile-run-detail*.js`: 모바일 전투/런 상세
- `pc-frame-ui.js`: PC 프레임/빌드 분석
- `codex-ui.js`, `reward-ui.js`, `run-summary-ui.js`: 도감/보상/런 요약

### 저장 / 계정 / 플랫폼

- `persistence.js`, `persistence-runtime.js`: 저장 스키마와 runtime 경계
- `browser-runtime.js`: 브라우저 플랫폼 API
- `scoped-storage.js`: Guest/회원 namespace
- `auth.js`, `supabase-client.js`, `bootstrap.js`: Auth 초기화
- `cloud-sync.js`: `player_state` Cloud Save
- `run-history.js`: `run_results` 기록
- `sound-runtime.js`, `sound.js`: 사운드 runtime/재생 정책

## 검증

저장소 루트에서 Harmony만 검사할 때:

```sh
npm run check:harmony
npm run test:harmony
```

`precheck:harmony` / `pretest:harmony`가 `editor/` 밸런스 설정과 `test-harmony-balance-config.mjs`를 먼저 검증합니다.

전체 프로젝트 검사:

```sh
npm run check
npm test
```

현재 Harmony 전용 테스트는 다음 영역을 포함합니다.

- 핵심 전투/루트/저장 호환
- Act 4~7/Abyss 캠페인과 저장 호환
- 상태이상/적 패턴/불순물/Signature/추가 증강
- 보상/경제/밸런스 설정
- 카드 mechanic/presentation/copy policy
- 도감/도전과제/LOCAL 기능/덱 필터
- PC 프레임/모바일 UI/적 상태/로비/확인 모달
- 전투/VFX/사운드와 각 오케스트레이터
- Auth/Cloud Save와 browser/persistence/sound runtime 경계

## 현재 프로토타입 상태

- 현재 게임 버전은 `v0.3.0`입니다.
- 일반 새 런은 Act 1에서 시작하며 캠페인은 Act 7 분기와 이후 심연까지 확장되어 있습니다.
- 보스 Signature Augment와 추가 공식 증강 팩이 일반 보상 정책과 연결되어 있습니다.
- 카드 mechanic metadata가 뱃지, 요약, 덱 필터의 공통 기준으로 사용됩니다.
- 도전과제 UI와 Supabase 통계/기록 구조가 추가되어 있습니다.
- LOCAL CARD LAB은 일반 진행과 분리된 테스트 덱/증강/막 시작 기능을 제공합니다.
- PC와 모바일 전투 UI가 별도 표현 계층으로 분리되어 있습니다.
- 전역 밸런스 숫자는 `editor/`에서 중앙 관리/검증합니다.
- Kakao/Google OAuth, 계정별 저장 격리, local-first Cloud Save, 비회원 플레이를 지원합니다.
- 결과 이미지/링크/카카오 공유와 전투/효과음/모션 설정이 구현되어 있습니다.
- 실제 플레이 시간과 수치 밸런스는 계속 조정 중인 프로토타입입니다.
- 일부 적/아이템은 전용 일러스트 대신 기호 또는 기존 자산을 사용합니다.
- `run_results`는 현재 `verified: false`이므로 공식 서버 검증 랭킹은 아닙니다.

