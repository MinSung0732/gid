import { createMultiHitPresentationScheduler, usesMultiHitPresentation } from "./multi-hit-presentation.js";

export function createCombatCardOrchestrator({
  engine,
  cards,
  enemyDefinitionFor,
  getRun,
  getMeta,
  setCardAnimating,
  save,
  render,
  sleep,
  startingCardCategory,
  sound,
  feedback,
}) {
  const {
    showApSpend,
    animateDiscardedCard,
    animateWeakContactAttack,
    animateStrongContactAttack,
    showStrongContactImpact,
    showWeakContactImpact,
    resolveMultiHitImpactPoint,
    showEnemyShieldBlock,
    updateEnemyHealthFeedback,
    showHitFeedback,
    animateNonContactCast,
    strongestAttackPower,
    showEnemyHitQueue,
    showBossPhase2Vfx = async () => {},
    collapseUsedCard,
    showImpurityOverflowQueue,
    showHarmonyFeedback,
    showHarmonyProgress = async () => {},
    showHarmonyProgressConsume = async () => {},
    showStackResourceChange = async () => false,
    showTriggerFocusQueue = async () => false,
    stageStatusDamageHealth,
    showStatusDamageQueue,
    showStatusProcQueue,
    showStatusProcVfx,
    showThornsRetaliationVfx = async () => {},
    showControlFeedback,
    showPlayerDeath,
    waitForLethalHitEffects,
    showMonsterDeath,
    stageDrawFeedback,
    showShuffleFeedback,
    showDrawFeedback,
    showPlayerDamage,
    showPlayerHealing,
    showPlayerCleanseVfx = async () => {},
    showAbsorbGain,
    showShieldGain,
    playPlayerStatusHit,
  } = feedback;

  const presentMultiHit = createMultiHitPresentationScheduler({
    sleep,
    resolveImpactPoint: resolveMultiHitImpactPoint,
  });

  async function handleCardPlay(button, index) {
    const run = getRun(),
      meta = getMeta();
    if (!run?.battle || !Number.isInteger(index)) return false;

    const playedCardInstance = run.battle.hand[index],
      playedCard = cards[playedCardInstance?.id];
    if (!playedCardInstance || !playedCard) return false;

    const beforeHandCards = [...run.battle.hand],
      beforeHandElements = [...document.querySelectorAll(".hand > .card")],
      playedCardRect = button?.getBoundingClientRect?.(),
      harmonySourcePoint = playedCardRect?.width
        ? {
            x: playedCardRect.left + playedCardRect.width / 2,
            y: playedCardRect.top + playedCardRect.height / 2,
          }
        : null,
      playedDefinition =
        typeof engine.cardDefinition === "function"
          ? engine.cardDefinition(playedCardInstance)
          : playedCard,
      effectivePattern =
        typeof engine.effectiveCardAttackPattern === "function"
          ? engine.effectiveCardAttackPattern(run, playedDefinition)
          : playedDefinition.attackPattern ||
            (playedDefinition.attack || playedDefinition.burst || playedDefinition.weight
              ? "contact"
              : null),
      contactAttackPlayed = Boolean(
        (playedDefinition.attack || playedDefinition.burst || playedDefinition.weight) &&
          effectivePattern === "contact",
      ),
      nonContactAttackPlayed = Boolean(
        (playedDefinition.attack || playedDefinition.burst || playedDefinition.weight) &&
          effectivePattern === "nonContact",
      ),
      playedTargetIndex = contactAttackPlayed ? run.battle.selectedTarget : null,
      beforeEnemies = run.battle.enemies.map((enemy) => ({
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        id: enemy.id,
        isBoss: Boolean(enemy.isBoss),
        phase2: Boolean(enemy.phase2),
        material: enemy.material || enemyDefinitionFor(enemy.id)?.material,
      })),
      beforePlayer = run.hp,
      beforeShield = run.battle.shield || 0,
      beforePlayerStatuses = Object.fromEntries(
        Object.entries(run.statuses || {}).map(([id, state]) => [
          id,
          Math.max(0, state?.stacks || 0),
        ]),
      );

    if (run) {
      delete run._healingFeedback;
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._thornsFeedback;
      delete run._enemyHitFeedback;
      delete run._bossPhaseFeedback;
      delete run._absorbFeedback;
      delete run._absorbLossFeedback;
      delete run._shieldGainFeedback;
      delete run._playerDamageFeedback;
      delete run._harmonyFeedback;
      delete run._harmonyProgressFeedback;
      delete run._stackResourceFeedback;
      delete run._drawFeedback;
      delete run._shuffleFeedback;
      delete run._controlFeedback;
      delete run._triggerFocusFeedback;
    }

    setCardAnimating(true);
    const spent = engine.cost(run, run.battle.hand[index]);
    if (playedCardInstance.id === "impurity") sound.impurity();
    else sound.cardPlay();
    if (startingCardCategory(playedCard) === "absorb") sound.absorbCard();
    showApSpend(button, spent);
    if (!contactAttackPlayed && !nonContactAttackPlayed) {
      button.classList.add("card-discarding");
      await sleep(260);
    }

    engine.play(run, index, meta);
    engine.checkUnlocks(run, meta);

    const randomlyDiscardedElements = run.battle
        ? beforeHandCards
            .map((card, cardIndex) =>
              card !== playedCardInstance &&
              !run.battle.hand.includes(card) &&
              run.battle.discard.includes(card)
                ? beforeHandElements[cardIndex]
                : null,
            )
            .filter(Boolean)
        : [],
      statusHits = run._damageFeedback || [],
      statusProcs = run._statusProcFeedback || [],
      thornsFeedback = run._thornsFeedback || [],
      impurityOverflowHits = statusHits.filter(
        (hit) => hit.statusId === "impurityOverflow",
      ),
      regularStatusHits = statusHits.filter(
        (hit) =>
          hit.statusId !== "impurityOverflow" && !hit.sourceImpactId,
      ),
      enemyHits = run._enemyHitFeedback || [],
      bossPhaseTriggered = Boolean(run._bossPhaseFeedback),
      bossPhaseTargetIndex = bossPhaseTriggered
        ? beforeEnemies.findIndex((before, enemyIndex) => {
            const after = run.battle?.enemies?.[enemyIndex];
            return (
              before.isBoss &&
              !before.phase2 &&
              Boolean(after?.phase2) &&
              (after?.hp || 0) > 0
            );
          })
        : -1,
      bossPhaseFeedback =
        bossPhaseTargetIndex >= 0
          ? {
              targetIndex: bossPhaseTargetIndex,
              alive: (run.battle?.enemies?.[bossPhaseTargetIndex]?.hp || 0) > 0,
            }
          : null,
      statusPlayerDamage = statusHits
        .filter((hit) => hit.target === "player")
        .reduce((sum, hit) => sum + hit.amount, 0),
      regularStatusPlayerDamage = regularStatusHits
        .filter((hit) => hit.target === "player")
        .reduce((sum, hit) => sum + hit.amount, 0),
      directPlayerDamage = run._playerDamageFeedback || 0,
      playerDamage =
        directPlayerDamage ||
        Math.max(0, beforePlayer - run.hp - statusPlayerDamage),
      shieldGainFeedback = run._shieldGainFeedback || 0,
      shieldGained =
        shieldGainFeedback ||
        (run.battle ? Math.max(0, run.battle.shield - beforeShield) : 0),
      healing = run._healingFeedback || 0,
      absorbGained = run._absorbFeedback || 0,
      harmonyTriggers = run._harmonyFeedback || [],
      harmonyProgressEvents = run._harmonyProgressFeedback || [],
      stackResourceChanges = run._stackResourceFeedback || [],
      triggerFocusEvents = run._triggerFocusFeedback || [],
      controlFeedback = run._controlFeedback || null,
      cleanseCandidateIds = [
        ...(playedDefinition.cleanseAilmentStacks
          ? ["burning", "corrosion", "poison", "bleed"]
          : []),
        ...(playedDefinition.cleanse ? Object.keys(beforePlayerStatuses) : []),
      ],
      playerCleanseChanges = [...new Set(cleanseCandidateIds)]
        .map((statusId) => ({
          statusId,
          stackBefore: beforePlayerStatuses[statusId] || 0,
          stackAfter: Math.max(0, run.statuses?.[statusId]?.stacks || 0),
        }))
        .filter((change) => change.stackAfter < change.stackBefore),
      drawn = run.phase === "battle" ? run._drawFeedback || 0 : 0,
      shuffled = run.phase === "battle" ? run._shuffleFeedback || 0 : 0,
      killedMonsters = beforeEnemies
        .map((enemy, enemyIndex) => ({ ...enemy, index: enemyIndex }))
        .filter(
          (enemy) =>
            enemy.hp > 0 && (run.battle?.enemies[enemy.index]?.hp ?? 0) <= 0,
        ),
      killingBlow =
        killedMonsters.length > 0 &&
        run.phase === "reward" &&
        (run.battle?.enemies || []).every((enemy) => enemy.hp <= 0),
      playerKilled =
        beforePlayer > 0 && run.hp <= 0 && run.phase === "result",
      shieldCardPlayed = startingCardCategory(playedCard) === "defense";

    const presentHarmonyFeedback = async () => {
      const progressEvent = harmonyProgressEvents.at(-1);
      if (progressEvent)
        await showHarmonyProgress(progressEvent, harmonySourcePoint);
      showHarmonyFeedback(harmonyTriggers);
      if (progressEvent?.completed)
        void showHarmonyProgressConsume(progressEvent);
    };

    delete run._healingFeedback;
    delete run._damageFeedback;
    delete run._statusProcFeedback;
    delete run._thornsFeedback;
    delete run._enemyHitFeedback;
    delete run._bossPhaseFeedback;
    delete run._absorbFeedback;
    delete run._shieldGainFeedback;
    delete run._playerDamageFeedback;
    delete run._harmonyFeedback;
    delete run._harmonyProgressFeedback;
    delete run._stackResourceFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
    delete run._controlFeedback;
    delete run._triggerFocusFeedback;

    await showTriggerFocusQueue(triggerFocusEvents);
    if (stackResourceChanges.length)
      void Promise.all(
        stackResourceChanges.map((event) =>
          showStackResourceChange(event, { sourcePoint: harmonySourcePoint }),
        ),
      );

    let weakContactAttackPlayed = false,
      enemyHitsForFeedback = enemyHits;
    const playedStatusProcs = new Set(),
      playedThornsFeedback = new Set(),
      statusProcTasks = [],
      thornsTasks = [],
      queueStatusProcsForHit = (hit, impactPoint = null) => {
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
              for (const event of linked)
                await showStatusProcVfx(event, { impactPoint });
            })(),
          );
      },
      queueThornsForHit = (hit) => {
        if (!Number.isInteger(hit?.impactId)) return;
        const linked = thornsFeedback.filter(
          (event) =>
            event.sourceImpactId === hit.impactId &&
            !playedThornsFeedback.has(event),
        );
        linked.forEach((event) => playedThornsFeedback.add(event));
        thornsTasks.push(
          ...linked.map((event) => showThornsRetaliationVfx(event)),
        );
      },
      flushThornsFeedback = async () => {
        const remaining = thornsFeedback.filter(
          (event) => !playedThornsFeedback.has(event),
        );
        remaining.forEach((event) => playedThornsFeedback.add(event));
        thornsTasks.push(
          ...remaining.map((event) => showThornsRetaliationVfx(event)),
        );
        await Promise.all(thornsTasks);
      };

    if (contactAttackPlayed) {
      const contactHits = enemyHits.filter(
          (hit) =>
            !hit.statusId &&
            hit.attackPattern === "contact" &&
            hit.damage + hit.blocked > 0,
        ),
        weakContactAttack =
          contactHits.length > 0 &&
          contactHits.every((hit) => hit.damage + hit.blocked <= 19),
        visualHp = beforeEnemies.map((enemy) => enemy.hp),
        showContactHit = (hit, presentation = null) => {
          if (!hit) return;
          const impactDamage = hit.damage + hit.blocked,
            power = hit.fx?.power || engine.combatFxPowerTier(impactDamage),
            strongHit = power !== "weak",
            superHit = power === "super";
          if (strongHit) showStrongContactImpact(hit.targetIndex, superHit, presentation);
          else showWeakContactImpact(hit.targetIndex, presentation);
          if (hit.blocked)
            showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage, hit);
          if (hit.damage) {
            visualHp[hit.targetIndex] = Math.max(
              0,
              visualHp[hit.targetIndex] - hit.damage,
            );
            updateEnemyHealthFeedback(
              hit.targetIndex,
              visualHp[hit.targetIndex],
              beforeEnemies[hit.targetIndex].maxHp,
            );
          }
          const impactPoint = showHitFeedback(
            hit.damage,
            hit.targetIndex,
            hit.attackPattern,
            strongHit,
            superHit,
            Boolean(hit.blocked),
            hit.fx,
            presentation,
          );
          queueStatusProcsForHit(hit, impactPoint);
          queueThornsForHit(hit);
        },
        multiContact = usesMultiHitPresentation(contactHits);

      weakContactAttackPlayed = weakContactAttack;
      if (weakContactAttack) {
        const impactHit = contactHits[0];
        let multiHitTask = null;
        await animateWeakContactAttack(
          button,
          impactHit?.targetIndex ?? playedTargetIndex,
          () => {
            if (multiContact) multiHitTask = presentMultiHit(contactHits, showContactHit);
            else showContactHit(impactHit);
          },
        );
        if (multiHitTask) await multiHitTask;
        enemyHitsForFeedback = enemyHits.filter(
          (hit) => !contactHits.includes(hit),
        );
        if (!multiContact) await sleep(170);
      } else if (contactHits.length) {
        const impactHit = contactHits[0];
        let multiHitTask = null;
        await animateStrongContactAttack(
          button,
          impactHit?.targetIndex ?? playedTargetIndex,
          impactHit.damage + impactHit.blocked >= 30,
          () => {
            if (multiContact) multiHitTask = presentMultiHit(contactHits, showContactHit);
            else showContactHit(impactHit);
          },
          impactHit.fx?.shieldBreak && impactHit.fx?.power === "super"
            ? () => sound.barrierBreakSuperContactFly()
            : null,
        );
        if (multiHitTask) await multiHitTask;
        enemyHitsForFeedback = enemyHits.filter(
          (hit) => !contactHits.includes(hit),
        );
        if (!multiContact) await sleep(240);
      } else {
        button.classList.add("card-discarding");
        await sleep(260);
      }
    }

    if (nonContactAttackPlayed) {
      const nonContactHits = enemyHits.filter(
          (hit) =>
            !hit.statusId &&
            hit.attackPattern === "nonContact" &&
            (hit.damage || hit.blocked),
        ),
        castPower = strongestAttackPower(nonContactHits, "nonContact"),
        castTargetIndex =
          nonContactHits.find((hit) => Number.isInteger(hit.targetIndex))
            ?.targetIndex ?? null;
      await animateNonContactCast(
        button,
        castPower,
        castTargetIndex,
        playedCard,
      );
      if (usesMultiHitPresentation(nonContactHits)) {
        const visualHp = beforeEnemies.map((enemy) => enemy.hp);
        await presentMultiHit(nonContactHits, (hit, presentation) => {
          if (hit.blocked)
            showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage, hit);
          if (hit.damage) {
            visualHp[hit.targetIndex] = Math.max(
              0,
              visualHp[hit.targetIndex] - hit.damage,
            );
            updateEnemyHealthFeedback(
              hit.targetIndex,
              visualHp[hit.targetIndex],
              beforeEnemies[hit.targetIndex].maxHp,
            );
          }
          const impactDamage = hit.damage + hit.blocked,
            power = hit.fx?.power || engine.combatFxPowerTier(impactDamage),
            impactPoint = showHitFeedback(
              hit.damage,
              hit.targetIndex,
              hit.attackPattern,
              power !== "weak",
              power === "super",
              Boolean(hit.blocked),
              hit.fx,
              presentation,
            );
          queueStatusProcsForHit(hit, impactPoint);
        });
        enemyHitsForFeedback = enemyHitsForFeedback.filter(
          (hit) => !nonContactHits.includes(hit),
        );
      }
    }

    const hitCounts = enemyHitsForFeedback.reduce((counts, hit) => {
        if (!hit.statusId && Number.isInteger(hit.targetIndex))
          counts.set(hit.targetIndex, (counts.get(hit.targetIndex) || 0) + 1);
        return counts;
      }, new Map()),
      stagedHits = enemyHitsForFeedback.filter(
        (hit) =>
          !hit.statusId &&
          Number.isInteger(hit.targetIndex) &&
          hitCounts.get(hit.targetIndex) > 1 &&
          (hit.damage || hit.blocked),
      );
    if (stagedHits.length) {
      const visualHp = beforeEnemies.map((enemy) => enemy.hp);
      for (let hitIndex = 0; hitIndex < stagedHits.length; hitIndex++) {
        const hit = stagedHits[hitIndex];
        if (hit.blocked)
          showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage, hit);
        if (hit.damage) {
          visualHp[hit.targetIndex] = Math.max(
            0,
            visualHp[hit.targetIndex] - hit.damage,
          );
          updateEnemyHealthFeedback(
            hit.targetIndex,
            visualHp[hit.targetIndex],
            beforeEnemies[hit.targetIndex].maxHp,
          );
          showHitFeedback(
            hit.damage,
            hit.targetIndex,
            hit.attackPattern,
            false,
            false,
            Boolean(hit.blocked),
            hit.fx,
          );
        } else if (hit.blocked && hit.attackPattern === "nonContact") {
          showHitFeedback(
            0,
            hit.targetIndex,
            hit.attackPattern,
            false,
            false,
            false,
            hit.fx,
          );
        }
        queueStatusProcsForHit(hit);
        if (hitIndex < stagedHits.length - 1) await sleep(150);
      }
      enemyHitsForFeedback = enemyHitsForFeedback.filter(
        (hit) => !stagedHits.includes(hit),
      );
      await sleep(280);
    }

    await showEnemyHitQueue(
      enemyHitsForFeedback,
      weakContactAttackPlayed || randomlyDiscardedElements.length > 0,
      queueStatusProcsForHit,
    );
    enemyHitsForFeedback = [];
    await Promise.all(statusProcTasks);
    await flushThornsFeedback();
    await showStatusProcQueue(
      statusProcs.filter((event) => !playedStatusProcs.has(event)),
    );
    if (bossPhaseFeedback)
      await showBossPhase2Vfx(bossPhaseFeedback);
    for (const discardedCard of randomlyDiscardedElements)
      await animateDiscardedCard(discardedCard);
    await collapseUsedCard(button);
    if (playerCleanseChanges.length)
      await showPlayerCleanseVfx(playerCleanseChanges);

    await showImpurityOverflowQueue(impurityOverflowHits);
    if (playerKilled) {
      await presentHarmonyFeedback();
      showControlFeedback?.(controlFeedback);
      await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
      await showStatusDamageQueue(regularStatusHits);
      await showPlayerDeath(
        playerDamage || regularStatusPlayerDamage || statusPlayerDamage,
      );
      save();
      render();
      setCardAnimating(false);
      return true;
    }

    if (killingBlow) {
      await presentHarmonyFeedback();
      showControlFeedback?.(controlFeedback);
      await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
      await showStatusDamageQueue(regularStatusHits);
      await waitForLethalHitEffects(killedMonsters);
      await showMonsterDeath(killedMonsters);
      await sleep(120);
      save();
      render();
      if (healing) showPlayerHealing(healing);
      if (absorbGained) showAbsorbGain(absorbGained);
      if (shieldGained) showShieldGain(shieldGained, shieldCardPlayed);
      setCardAnimating(false);
      return true;
    }

    if (killedMonsters.length) {
      await presentHarmonyFeedback();
      showControlFeedback?.(controlFeedback);
      await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
      await showStatusDamageQueue(regularStatusHits);
      await waitForLethalHitEffects(killedMonsters);
      await showMonsterDeath(killedMonsters);
      save();
      render();
      stageDrawFeedback(drawn);
      if (shuffled) await showShuffleFeedback(shuffled);
      if (drawn) await showDrawFeedback(drawn);
      if (playerDamage) showPlayerDamage(playerDamage);
      if (regularStatusPlayerDamage) playPlayerStatusHit();
      if (healing) showPlayerHealing(healing);
      if (absorbGained) showAbsorbGain(absorbGained);
      if (shieldGained) showShieldGain(shieldGained, shieldCardPlayed);
      setCardAnimating(false);
      return true;
    }

    save();
    render();
    stageStatusDamageHealth?.(statusHits);
    stageDrawFeedback(drawn);
    if (shuffled) await showShuffleFeedback(shuffled);
    if (drawn) await showDrawFeedback(drawn);
    await presentHarmonyFeedback();
    showControlFeedback?.(controlFeedback);
    await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
    if (playerDamage) showPlayerDamage(playerDamage);
    await showStatusDamageQueue(regularStatusHits);
    if (regularStatusPlayerDamage) playPlayerStatusHit();
    if (healing) showPlayerHealing(healing);
    if (absorbGained) showAbsorbGain(absorbGained);
    if (shieldGained) showShieldGain(shieldGained, shieldCardPlayed);
    setCardAnimating(false);
    return true;
  }

  return { handleCardPlay };
}
