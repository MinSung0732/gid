# Project Harmony Changelog

이 문서는 `games/harmony`의 사용자 체감 변경사항과 개발 기준 변경을 기록한다.

## 버전 정책

- **큰 패치**: 게임플레이 체계, 전투 시스템, 대규모 콘텐츠, 공통 FX 구조, UI 구조처럼 여러 기능에 영향을 주는 변경은 `GAME_VERSION`을 올리고 별도 버전 섹션으로 기록한다.
- **사소한 패치**: 버그 수정, 문구 정리, 단일 카드/몬스터 조정, 작은 CSS/VFX 보정, 캐시 갱신은 버전을 올리지 않고 `Unversioned Updates`에 날짜와 함께 기록한다.
- 큰 패치는 가능하면 기능 단위 테스트/브라우저 확인 후 버전을 올린다.
- 기존 정상 기능을 규칙 통일 목적으로만 일괄 리팩터링하지 않는다.

## Unversioned Updates

### 2026-09-22

- 적 비접촉 공격의 Anticipation 뒤에 공통 Release → Travel → Impact 연출을 추가했다. 별도 presentation 설정이 없으면 빠른 streak + 기본 impact를 사용하고, 단일/다중 타격 모두 실제 도착 시점에 기존 Shield/Break/Damage 피드백을 재사용한다.

### 2026-09-21

- 재생(Regeneration) Tick에 공통 Status Proc Presentation을 연결했다. 실제 회복량 확정 후 status metadata를 전달하고, 상태 chip의 짧은 색상 Pulse와 상태색 상승 입자를 먼저 보여준 뒤 기존 Player/Enemy Healing VFX와 회복량 표시를 그대로 재사용한다. Reduced Motion에서는 Scale을 제거하고 입자 수/이동을 줄인다.
- Trigger Focus의 전체 화면 Dim을 제거하고, 발동한 특성·유물 source element 자체가 공통 rarity 색상으로 약 1초 동안 Glow를 유지한 뒤 잔광 Fade Out 되도록 변경했다. 동일 source 연속 발동은 애니메이션을 재시작하지 않고 유지 시간을 연장하며, Reduced Motion에서는 Scale/연결 입자를 제거하되 Border·Glow 정보는 유지한다.
- 추가/보너스 피해가 특성·유물에서 발생할 때 sourceType/sourceId/parentSource/sourceMetadata를 일반 피해 피드백까지 유지하고 기존 Trigger Focus 큐로 연결했다. PC 오른쪽 증강 목록도 동일한 source dataset을 유지해 sourceId 기반 Focus lookup이 정상 동작하도록 수정했다.

### 2026-09-16

- 상태이상 전투 정체성을 개편했다. 출혈은 접촉 공격 적중 시 1스택을 소비해 직접 피해의 20%를 추가 피해로 주고, 연소는 비접촉 공격 적중 시 1스택을 소비해 10% 추가 피해를 주는 발동 소비형 상태로 변경했다. 두 상태는 더 이상 턴 종료 피해나 자연 감소를 사용하지 않는다.
- 중독은 턴 종료 시 스택만큼 방어막 무시 피해 후 1스택 감소하는 대표 시간형 DoT로 유지했다.
- 혼란은 카드/AP를 소비한 뒤 22.2% 확률로 카드 전체 효과가 취소되고 최대 HP 5%(최소 3)의 자해 피해를 받는 상태로, 방해는 스택당 10%(최대 50%) 확률로 카드의 기본 효과는 유지하면서 상태 부여·드로우·AP 환급 같은 부가효과만 실패하는 상태로 분리했다.
- 위축은 약화로 재조정해 제거하고, 향기 차단은 봉인의 노트 획득/하모니 봉인 옵션으로 통합했으며, 현재 전투 흐름에서 의미가 없던 노트 붕괴는 제거했다. 삭제된 상태가 남아 있는 기존 저장 데이터는 로드 시 약화/봉인으로 호환 변환하거나 안전하게 폐기한다.
- 상태 도감은 23종으로 정리하고 `duration / stackDecay / triggerConsume / persistent` 지속 방식을 표시하도록 개선했다. 출혈·연소 proc, 혼란/방해 실패는 별도 전투 피드백으로 표시한다.

### 2026-09-15

- Animation/VFX 개발 가이드 확정. 신규 애니메이션부터 Micro / Normal / Strong / Super 강도 체계, 의미 기반 색상, Layer 역할 분리, 신규 네이밍, 상태이상/Harmony Motion Language, Impact 중심 SFX 타이밍, Reduced Motion 기준을 적용한다.
- 기존 정상 카드/전투/접촉·비접촉/Super/Harmony FX는 유지하며, 중복 keyframe, transform 충돌, hotfix 의존 등 실제 문제가 확인된 부분만 점진적으로 이관한다.
- `ANIMATION_SPECS.md`를 추가해 신규 FX의 Trigger / Duration / Intensity / Color / Layer / Sound Timing / Reduced Motion / 구현 위치를 기능별로 기록하도록 했다.
- 게임 버전 값을 `version.js`로 중앙화했다. 이번 변경은 개발 기준/관리 체계 정리이므로 게임 버전은 `0.1.0`을 유지한다.
- 카드 상세 설명에서 의미 없는 자동 중복 문장만 제거하고, 비용/피해/방어 관련 최소값·최대값·조건·지속시간처럼 실제 규칙을 설명하는 문장은 유지하는 기준을 적용했다.

## v0.2.0 — Boss Signature Augments

- 보스 전용 증강을 일반 증강과 분리된 **Signature Pool**로 공식화했다.
- Signature 증강은 `signatureOnly: true`, 지정 보스는 `signatureReward`로 연결하며 유물/특성 모두 동일한 규칙을 사용한다.
- Signature 증강의 T1~T4는 성능/희소도 표기 전용이며 일반 티어 드랍 확률의 분모에는 포함하지 않는다.
- 일반 전투/보물/황금/엘리트/상점/특수 이벤트/일반 보스 랜덤 보상 후보에서는 Signature 증강을 제외한다.
- 지정된 해금 보스를 처치하면 일반 랜덤 보상과 별개로 연결된 Signature 증강을 확정 지급하는 기존 경로를 정책으로 고정했다.
- `signature-rewards.js`를 추가해 Signature 데이터 규칙을 공통 검증할 수 있게 했고, `test-harmony-signature-rewards.mjs`에서 보스 연결, 티어/종류, 일반 드랍/상점 격리를 검사하도록 했다.

## v0.1.0

초기 프로토타입 기준 버전.
