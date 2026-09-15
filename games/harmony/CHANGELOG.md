# Project Harmony Changelog

이 문서는 `games/harmony`의 사용자 체감 변경사항과 개발 기준 변경을 기록한다.

## 버전 정책

- **큰 패치**: 게임플레이 체계, 전투 시스템, 대규모 콘텐츠, 공통 FX 구조, UI 구조처럼 여러 기능에 영향을 주는 변경은 `GAME_VERSION`을 올리고 별도 버전 섹션으로 기록한다.
- **사소한 패치**: 버그 수정, 문구 정리, 단일 카드/몬스터 조정, 작은 CSS/VFX 보정, 캐시 갱신은 버전을 올리지 않고 `Unversioned Updates`에 날짜와 함께 기록한다.
- 큰 패치는 가능하면 기능 단위 테스트/브라우저 확인 후 버전을 올린다.
- 기존 정상 기능을 규칙 통일 목적으로만 일괄 리팩터링하지 않는다.

## Unversioned Updates

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
