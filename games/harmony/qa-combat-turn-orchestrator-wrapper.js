import { createCombatTurnOrchestrator as createProductionCombatTurnOrchestrator } from "./combat-turn-orchestrator.js?qa-production-original";

export function createCombatTurnOrchestrator(options) {
  const originalShowPlayerHealing = options.feedback.showPlayerHealing;
  const feedback = {
    ...options.feedback,
    showPlayerHealing(amount, presentationOptions = {}) {
      if (presentationOptions?.waitForPresentation) {
        window.__productionQaRoundResources = {
          healing: amount,
          waitForPresentation: true,
          capturedAt: performance.now(),
        };
      }
      return originalShowPlayerHealing(amount, presentationOptions);
    },
  };
  return createProductionCombatTurnOrchestrator({
    ...options,
    feedback,
  });
}
