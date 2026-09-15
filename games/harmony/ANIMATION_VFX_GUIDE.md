# Project Harmony Animation / VFX Guide

이 문서는 Project Harmony의 신규 애니메이션/VFX 개발 기준이다. 기존에 정상 작동하는 카드/전투/접촉·비접촉/Super/Harmony FX는 일괄 리팩터링하지 않는다. 신규 애니메이션부터 이 규칙을 적용하고, 기존 코드는 중복 keyframe, transform 충돌, hotfix 의존 등 실제 문제가 확인된 부분만 기능 테스트 후 점진적으로 이관한다.

## 1. 안정성 우선 원칙

- Harmony는 캐릭터 스프라이트 중심이 아니라 CSS Keyframe + JS 기반 카드/UI/전투 VFX 구조다.
- 기존 정상 기능의 DOM 구조, timing, class, keyframe 이름을 규칙 통일만을 이유로 바꾸지 않는다.
- 신규 기능에서 충돌 위험이 있을 때부터 Layer 분리를 우선 적용한다.
- 기존 FX 수정은 재현 가능한 문제와 테스트 케이스가 있을 때만 진행한다.
- 전면 공통 FX 통합은 충분히 안정화된 이후 별도 큰 패치로 검토한다.

## 2. 애니메이션 강도 체계

| Intensity | Duration | 용도 | Screen Shake |
| --- | --- | --- | --- |
| Micro | 120~200ms | Hover, 상태 아이콘 변화, 숫자 변화 | 없음 |
| Normal | 250~450ms | 일반 공격, 회복, 방어, 상태이상 발동 | 원칙적으로 없음, 필요 시 0~1px |
| Strong | 500~900ms | 강공격, 방어막 파괴, 강한 패시브 | 2~5px 허용 |
| Super | 1100~1500ms | Burst, 강력한 카드, 보스 필살기, 핵심 Harmony | 6~10px 허용 |

현재 구현된 Super 공격의 약 1350ms 충전 연출은 Super 단계의 기준점으로 유지한다.

## 3. 효과 색상 규칙

- 공격: Red / Orange / White
- 방어: Blue / Cyan
- 흡수: Purple
- 회복: Green / Mint
- Harmony: Gold / Ivory / White
- 상태이상: `statuses.js`의 기존 `color` 값을 최우선 사용

카드별 임의 색상보다 효과 의미 기반 색상을 우선한다.

## 4. 공격 애니메이션 기본 구조

신규 공격은 기본적으로 다음 순서를 따른다.

`Anticipation → Impact → Reaction → Recovery`

- Anticipation: 공격 준비
- Impact: 실제 사건 발생 시점. 가장 짧고 강한 구간
- Reaction: 대상 피격 반응
- Recovery: 원래 상태로 복귀

일반 공격은 대상 오브젝트 중심으로 반응시키고, Strong 이상부터 Stage Shake를 허용한다.

## 5. 화면 Shake 규칙

- Micro: 0px
- Normal: 0~1px
- Strong: 2~5px
- Super: 6~10px

일반 공격마다 화면 전체를 흔들지 않는다. 강도가 높아질수록 화면 반응도 커져야 한다.

## 6. Layer 역할 분리

가능하면 한 DOM 요소에서 여러 애니메이션이 동시에 `transform`을 제어하지 않도록 역할을 분리한다.

권장 역할:

- Stage: 화면 Shake / 전체 전투 화면 효과
- Actor: 이동 / 공격 / 피격
- Status Layer: 독, 화상, 출혈 등 상태이상
- FX Layer: 파티클, 광선, 폭발
- Text Layer: 피해량, 회복량, 상태 알림

예시 구조:

- `enemy-visual`: 이동 / 피격
- `enemy-status-layer`: 상태이상
- `enemy-impact-layer`: 타격 FX
- `enemy-number-layer`: 피해/회복 숫자

기존 DOM을 강제로 변경하지 않는다. 신규 기능 또는 충돌이 확인된 부분에서 우선 적용한다.

## 7. 신규 애니메이션 네이밍

신규 keyframe/class는 가능하면 `hmy-{target}-{action}-{intensity}` 규칙을 사용한다.

예:

- `hmy-enemy-hit-normal`
- `hmy-enemy-hit-strong`
- `hmy-enemy-hit-super`
- `hmy-player-poison-tick`
- `hmy-card-draw`
- `hmy-harmony-connect`
- `hmy-harmony-complete`
- `hmy-harmony-break`
- `hmy-boss-enter`

기존 이름은 일괄 변경하지 않는다.

## 8. 상태이상 Motion Language

상태이상은 같은 Smoke에 색상만 바꾸기보다 움직임 자체로 구분한다.

- Burning: 타오름
- Poison: 스며듦
- Bleed: 떨어짐
- Corrosion: 녹아내림
- Bind: 조임
- Stun: 멈춤
- Confusion: 흔들림
- Silence: 꺼짐

목표는 색상을 보지 않아도 상태 종류를 어느 정도 구분할 수 있게 하는 것이다.

## 9. Harmony 전용 Motion Language

Harmony는 일반 공격과 다른 문법을 사용한다. 핵심 키워드는 `연결 / 공명 / 완성`이다.

진행:

- Top → Top 점등
- Top + Middle → 두 노드가 빛으로 연결
- Top + Middle + Base → 세 노드 연결 완료 → 빛이 중앙으로 수렴 → HARMONY 발동

실패/초기화:

- 연결선 단절
- 빛 감소
- 입자 분산

기본 팔레트는 Gold / Ivory / White이며, 연결선, 공명, 파동, 빛의 수렴을 우선 사용한다.

## 10. 사운드 타이밍

사운드는 애니메이션 시작이 아니라 실제 사건이 발생하는 프레임에 맞춘다.

- 공격: Impact
- 방어막 파괴: Break
- 상태 피해: Tick
- Harmony: 연결 완료 또는 실제 발동 순간

`준비 → 준비 → HIT + SFX → 반동 → 복귀`의 구조를 기본으로 한다.

## 11. UX 원칙

신규 애니메이션은 아래 세 가지가 읽혀야 한다.

1. 무엇이 발생했는가
2. 왜 발생했는가
3. 얼마나 강한 효과인가

예:

- 출혈: 출혈 FX → 피해 숫자 → HP 감소
- 가시 반격: 가시 발동 → 적 반격 FX → 피해 숫자
- Harmony: Top → Middle → Base → 연결 완료 → HARMONY → 실제 효과 발동

효과는 발생했지만 원인을 알 수 없는 연출은 피한다.

## 12. 신규 Animation Spec 기록

신규 애니메이션은 가능하면 아래 메타를 함께 기록한다.

- Name
- Trigger
- Duration
- Intensity
- Color
- Layer
- Sound Timing
- Reduced Motion 대응

필요하면 구현 파일 상단 주석 또는 별도 spec 문서에 기록한다.

## 13. Reduced Motion

신규 FX는 `prefers-reduced-motion: reduce` 또는 기존 게임 설정과 충돌하지 않도록 대응한다.

- 필수 정보 전달은 유지한다.
- 장시간 이동, 큰 Shake, 반복 파티클은 축소 또는 제거한다.
- 피해/회복 숫자, 상태 결과, Harmony 완료 여부 같은 핵심 피드백은 사라지지 않게 한다.

## 14. 적용 순서

1. 이 규칙을 개발 기준으로 사용
2. 기존 정상 기능 유지
3. 신규 애니메이션부터 신규 규칙 적용
4. 중복 keyframe / transform 충돌 / hotfix 의존 점검
5. 실제 문제가 있는 부분만 점진 수정
6. 충분히 안정된 후 공통 FX 구조 통합 검토

## 15. 우선순위

### Priority 1

- Harmony Top → Middle → Base 진행 연출
- Harmony 실패/초기화 연출
- Burning Tick
- Poison Tick
- Bleed Tick
- Corrosion Tick
- Thorns 반격
- Stun / 행동 취소
- Multi-hit 타격 리듬
- 적 행동 타입별 준비 동작 구분: 접촉 / 비접촉 / 방어 / 디버프

### Priority 2

- Regeneration Tick
- Cleanse
- Resonance
- Concentration 소비
- Absorb 25 / 50 / 75 / 100 단계 연출
- Burst 활성화
- 광역 공격
- 특성/유물 발동
- 보스 등장
- 보스 특수 행동
- 몬스터 재질별 사망 연출

재질별 사망 예:

- Glass: 산산조각
- Liquid: 흘러내림
- Gas: 증발
- Spirit: 빛 입자로 소멸
- Stone: 균열 후 붕괴

최종 목표는 애니메이션 수를 늘리는 것이 아니라 게임 규칙과 전투 결과를 눈으로 명확하게 읽히게 만드는 것이다.
