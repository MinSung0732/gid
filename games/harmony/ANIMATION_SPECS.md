# Project Harmony Animation Specs

신규 애니메이션/VFX를 추가할 때 이 문서에 스펙을 기록한다. 기존 정상 애니메이션은 일괄 등록하지 않으며, 수정 또는 점진 이관 시점부터 추가한다.

## Spec Template

```md
### hmy-target-action-intensity

- Name: hmy-target-action-intensity
- Trigger: 실제 발생 조건
- Duration: 000ms
- Intensity: Micro | Normal | Strong | Super
- Color: 의미 기반 팔레트 또는 statuses.js color
- Layer: Stage | Actor | Status | FX | Text
- Sound Timing: Impact | Break | Tick | Connect | Complete | None
- Reduced Motion: 축소/대체 동작
- Implementation: 관련 JS/CSS 파일
- Notes: 실제 사건과 시각 피드백의 연결 설명
```

## 신규 FX 우선순위

### Priority 1

- Harmony Top → Middle → Base 진행
- Harmony 실패/초기화
- Burning Tick
- Poison Tick
- Bleed Tick
- Corrosion Tick
- Thorns 반격
- Stun / 행동 취소
- Multi-hit 타격 리듬
- 적 행동 준비: 접촉 / 비접촉 / 방어 / 디버프

### Priority 2

- Regeneration Tick
- Cleanse
- Resonance
- Concentration 소비
- Absorb 25 / 50 / 75 / 100 단계
- Burst 활성화
- 광역 공격
- 특성/유물 발동
- 보스 등장
- 보스 특수 행동
- 재질별 사망: Glass / Liquid / Gas / Spirit / Stone

현재 이 문서를 만든 시점에는 기존 런타임 애니메이션을 신규 규칙으로 일괄 변경하지 않았다.
