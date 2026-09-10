const absorb = (name, effects, upgrades) => ({
  name, cost: 1, tier: 2, maxCopies: 2, maxUpgrade: 2,
  note: "middle", category: "absorb", ...effects, upgrades,
});
export const ABSORB_TIER2_CARDS = {
  absorb_vacuum_distill: absorb("감압 분별 증류", {
    absorb: 12, searchDrawCard: "burst_spatial_diffusion",
  }, { absorb: [12, 15, 18] }),
  absorb_resonance_catalyst: absorb("공명 응축 촉매", {
    absorb: 6, absorbAmplifyThreshold: 20, absorbAmplifyRatio: 0.5,
  }, { absorb: [6, 8, 10], absorbAmplifyRatio: [0.5, 0.5, 0.6] }),
};
