export function createGameActionOrchestrator({
  engine,
  enemyDefinitionFor,
  getRun,
  getMeta,
  setStarted,
  setCardAnimating,
  save,
  render,
  sleep,
  reducedCombatMotion,
  hideRestUpgradeComparison,
  confirmReplaceRun,
  openStartingDeckBuilder,
  sound,
  roomRelicPresentation,
  feedback,
}) {
  const {
    animateDiscardedCard,
    showImpurityOverflowQueue,
    showHarmonyFeedback,
    showEnemyHitQueue,
    showStatusDamageQueue,
    showStatusProcQueue,
    showStatusProcVfx,
    showPlayerDeath,
    waitForLethalHitEffects,
    showMonsterDeath,
    stageDrawFeedback,
    showShuffleFeedback,
    showDrawFeedback,
    showPlayerDamage,
    showPlayerHealing,
    showAbsorbLoss,
    showAbsorbGain,
    showShieldGain,
  } = feedback;

  const clearResourceFeedback = (run) => {
      if (!run) return;
      delete run._healingFeedback;
      delete run._absorbFeedback;
      delete run._absorbLossFeedback;
      delete run._shieldGainFeedback;
      delete run._playerDamageFeedback;
    },
    takeResourceFeedback = (run) => {
      const captured = {
        healing: run?._healingFeedback || 0,
        absorbGained: run?._absorbFeedback || 0,
        absorbLost: run?._absorbLossFeedback || 0,
        shieldGained: run?._shieldGainFeedback || 0,
        playerDamage: run?._playerDamageFeedback || 0,
      };
      clearResourceFeedback(run);
      return captured;
    };

  async function handleGameAction(button) {
    const action = button?.dataset?.action;
    if (!action) return false;

    roomRelicPresentation?.clear?.();

    let run = getRun();
    const meta = getMeta(),
      index = Number(button.dataset.index);

    if (action === "discard-choice") {
      if (run) {
        clearResourceFeedback(run);
        delete run._damageFeedback;
        delete run._statusProcFeedback;
        delete run._enemyHitFeedback;
        delete run._drawFeedback;
        delete run._shuffleFeedback;
      }
      if (run && engine.discardFromHand(run, index, meta)) {
        const resourceFeedback = takeResourceFeedback(run),
          statusHits = (run._damageFeedback || []).filter(
            (hit) => !hit.sourceImpactId,
          ),
          statusProcs = run._statusProcFeedback || [],
          enemyHits = run._enemyHitFeedback || [],
          drawn = run.phase === "battle" ? run._drawFeedback || 0 : 0,
          shuffled = run.phase === "battle" ? run._shuffleFeedback || 0 : 0;
        delete run._damageFeedback;
        delete run._statusProcFeedback;
        delete run._enemyHitFeedback;
        delete run._drawFeedback;
        delete run._shuffleFeedback;
        setCardAnimating(true);
        await animateDiscardedCard(button);
        save();
        render();
        if (resourceFeedback.playerDamage)
          showPlayerDamage(resourceFeedback.playerDamage);
        if (resourceFeedback.healing)
          showPlayerHealing(resourceFeedback.healing);
        if (resourceFeedback.shieldGained)
          showShieldGain(resourceFeedback.shieldGained, false);
        if (resourceFeedback.absorbLost)
          showAbsorbLoss(resourceFeedback.absorbLost);
        if (resourceFeedback.absorbGained)
          showAbsorbGain(resourceFeedback.absorbGained);
        await showEnemyHitQueue(enemyHits);
        if (statusProcs.length) await showStatusProcQueue(statusProcs);
        if (statusHits.length) await showStatusDamageQueue(statusHits);
        stageDrawFeedback(drawn);
        if (shuffled) await showShuffleFeedback(shuffled);
        if (drawn) await showDrawFeedback(drawn);
        setCardAnimating(false);
      }
      return true;
    }

    const beforeEnemies = run?.battle?.enemies.map((enemy) => ({
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        id: enemy.id,
        material: enemy.material || enemyDefinitionFor(enemy.id)?.material,
      })),
      beforePlayer = run?.hp ?? null,
      beforeShield = run?.battle?.shield || 0;

    if (action === "upgrade") {
      setCardAnimating(true);
      hideRestUpgradeComparison();
      button.closest(".rest-upgrade-option")?.classList.add("rest-upgrade-activating");
      await sleep(reducedCombatMotion() ? 180 : 720);
    }
    if (run) {
      clearResourceFeedback(run);
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._enemyHitFeedback;
      delete run._harmonyFeedback;
      delete run._drawFeedback;
      delete run._shuffleFeedback;
      delete run._roomRelicFeedback;
    }

    if (action === "new" || action === "test-new") {
      if (run && !run.finished && !confirmReplaceRun()) {
        setCardAnimating(false);
        return true;
      }
      openStartingDeckBuilder(action === "test-new");
      setCardAnimating(false);
      return true;
    }
    if (action === "resume") setStarted(true);
    else if (action === "home") setStarted(false);
    else if (run) {
      switch (action) {
        case "enter":
          engine.enter(run, meta);
          break;
        case "target":
          engine.selectTarget(run, Number(button.dataset.target));
          break;
        case "augment-recover-discard":
          engine.recoverAugmentDiscardedCard(
            run,
            Number(button.dataset.augmentInstance),
          );
          break;
        case "open":
          engine.openChest(run, meta);
          break;
        case "reward-claim":
          engine.claimReward(run, button.dataset.option, meta);
          break;
        case "reward-skip":
          engine.skipReward(run, meta);
          break;
        case "reward":
          engine.advance(run, button.dataset.card, null, meta);
          break;
        case "rest-heal":
          engine.rest(run, "heal");
          break;
        case "rest-upgrade-open":
          engine.rest(run, "openUpgrade");
          break;
        case "rest-upgrade-back":
          hideRestUpgradeComparison();
          engine.rest(run, "cancelUpgrade");
          break;
        case "upgrade":
          engine.rest(run, "upgrade", index);
          break;
        case "rest-leave":
          engine.leaveRest(run);
          break;
        case "buy":
          engine.shop(run, "potion");
          break;
        case "shop-offer":
          engine.shop(run, "offer", index, meta);
          break;
        case "shop-reroll":
          engine.shop(run, "reroll", null, meta);
          break;
        case "leave":
          engine.shop(run, "leave");
          break;
        case "special-curse":
          engine.chooseSpecialCurse(run, index, meta);
          break;
        case "special-safe":
        case "special-gamble":
        case "special-skip":
        case "special-heal":
        case "special-cleanse":
        case "special-reach":
        case "special-endure":
        case "special-flee":
        case "special-overload":
        case "special-purify":
        case "special-sacrifice":
        case "special-tribute":
        case "special-cleanse_card":
        case "special-reroll":
        case "special-charm":
        case "special-burn_two":
        case "special-flame_power":
        case "special-duplicate":
        case "special-gold_double":
        case "special-contraband":
        case "special-blood_trade":
        case "special-phase_lens":
        case "special-contaminated_essence":
          engine.chooseSpecial(run, action.replace("special-", ""), meta, index);
          break;
        case "lab-note":
          engine.chooseSpecial(run, "note", meta, index, button.dataset.note);
          break;
        case "lab-remove":
          engine.chooseSpecial(run, "remove", meta, index);
          break;
        case "special-leave":
          engine.leaveSpecial(run);
          break;
        case "potion":
          if (engine.potion(run)) sound.potion();
          break;
        case "loop":
          engine.nextLoop(run, meta, true);
          break;
        case "finish":
          engine.nextLoop(run, meta, false);
          break;
      }
    }

    run = getRun();
    engine.checkUnlocks(run, meta);

    const resourceFeedback = takeResourceFeedback(run),
      statusHits = run?._damageFeedback || [],
      statusProcs = run?._statusProcFeedback || [],
      impurityOverflowHits = statusHits.filter(
        (hit) => hit.statusId === "impurityOverflow",
      ),
      regularStatusHits = statusHits.filter(
        (hit) =>
          hit.statusId !== "impurityOverflow" && !hit.sourceImpactId,
      ),
      enemyHits = run?._enemyHitFeedback || [],
      statusPlayerDamage = statusHits
        .filter((hit) => hit.target === "player")
        .reduce((sum, hit) => sum + hit.amount, 0),
      regularStatusPlayerDamage = regularStatusHits
        .filter((hit) => hit.target === "player")
        .reduce((sum, hit) => sum + hit.amount, 0),
      playerDamage =
        resourceFeedback.playerDamage ||
        (beforePlayer !== null && run
          ? Math.max(0, beforePlayer - run.hp - statusPlayerDamage)
          : 0),
      shieldGained =
        resourceFeedback.shieldGained ||
        (run?.battle ? Math.max(0, run.battle.shield - beforeShield) : 0),
      healing = resourceFeedback.healing,
      absorbLost = resourceFeedback.absorbLost,
      absorbGained = resourceFeedback.absorbGained,
      harmonyTriggers = run?._harmonyFeedback || [],
      drawn = run?.phase === "battle" ? run._drawFeedback || 0 : 0,
      shuffled = run?.phase === "battle" ? run._shuffleFeedback || 0 : 0,
      roomRelicFeedback = run?._roomRelicFeedback || null,
      killedMonsters = (beforeEnemies || [])
        .map((enemy, enemyIndex) => ({ ...enemy, index: enemyIndex }))
        .filter(
          (enemy) =>
            enemy.hp > 0 && (run?.battle?.enemies[enemy.index]?.hp ?? 0) <= 0,
        ),
      killingBlow =
        killedMonsters.length > 0 &&
        run?.phase === "reward" &&
        (run.battle?.enemies || []).every((enemy) => enemy.hp <= 0),
      playerKilled =
        beforePlayer !== null &&
        beforePlayer > 0 &&
        (run?.hp ?? 0) <= 0 &&
        run?.phase === "result";
    const playedStatusProcs = new Set(),
      statusProcTasks = [],
      queueStatusProcsForHit = (hit) => {
        if (!Number.isInteger(hit?.impactId)) return;
        const linked = statusProcs.filter(
          (event) =>
            event.sourceImpactId === hit.impactId &&
            !playedStatusProcs.has(event),
        );
        linked.forEach((event) => playedStatusProcs.add(event));
        if (linked.length)
          statusProcTasks.push(
            (async () => {
              for (const event of linked) await showStatusProcVfx(event);
            })(),
          );
      },
      flushStatusProcs = async () => {
        await Promise.all(statusProcTasks);
        await showStatusProcQueue(
          statusProcs.filter((event) => !playedStatusProcs.has(event)),
        );
      };

    if (run) {
      clearResourceFeedback(run);
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._enemyHitFeedback;
      delete run._harmonyFeedback;
      delete run._drawFeedback;
      delete run._shuffleFeedback;
      delete run._roomRelicFeedback;
    }

    await showImpurityOverflowQueue(impurityOverflowHits);
    if (playerKilled) {
      setCardAnimating(true);
      showHarmonyFeedback(harmonyTriggers);
      await showEnemyHitQueue(enemyHits, false, queueStatusProcsForHit);
      await flushStatusProcs();
      await showStatusDamageQueue(regularStatusHits);
      await showPlayerDeath(
        playerDamage || regularStatusPlayerDamage || statusPlayerDamage,
      );
      save();
      render();
      roomRelicPresentation?.show?.(roomRelicFeedback);
      setCardAnimating(false);
      return true;
    }
    if (killingBlow) {
      setCardAnimating(true);
      showHarmonyFeedback(harmonyTriggers);
      await showEnemyHitQueue(enemyHits, false, queueStatusProcsForHit);
      await flushStatusProcs();
      await showStatusDamageQueue(regularStatusHits);
      await waitForLethalHitEffects(killedMonsters);
      await showMonsterDeath(killedMonsters);
      await sleep(120);
      save();
      render();
      roomRelicPresentation?.show?.(roomRelicFeedback);
      if (healing) showPlayerHealing(healing);
      if (shieldGained) showShieldGain(shieldGained, false);
      if (absorbLost) showAbsorbLoss(absorbLost);
      if (absorbGained) showAbsorbGain(absorbGained);
      setCardAnimating(false);
      return true;
    }

    save();
    render();
    roomRelicPresentation?.show?.(roomRelicFeedback);
    stageDrawFeedback(drawn);
    if (shuffled) await showShuffleFeedback(shuffled);
    if (drawn) {
      setCardAnimating(true);
      await showDrawFeedback(drawn);
    }
    showHarmonyFeedback(harmonyTriggers);
    await showEnemyHitQueue(enemyHits, false, queueStatusProcsForHit);
    await flushStatusProcs();
    if (playerDamage) showPlayerDamage(playerDamage);
    await showStatusDamageQueue(regularStatusHits);
    if (regularStatusPlayerDamage) sound.playerStatusHit();
    if (healing) showPlayerHealing(healing);
    if (shieldGained) showShieldGain(shieldGained, false);
    if (absorbLost) showAbsorbLoss(absorbLost);
    if (absorbGained) showAbsorbGain(absorbGained);
    setCardAnimating(false);
    return true;
  }

  return { handleGameAction };
}
