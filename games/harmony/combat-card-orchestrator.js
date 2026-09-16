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
    showEnemyShieldBlock,
    updateEnemyHealthFeedback,
    showHitFeedback,
    animateNonContactCast,
    strongestAttackPower,
    showEnemyHitQueue,
    collapseUsedCard,
    showImpurityOverflowQueue,
    showHarmonyFeedback,
    showStatusDamageQueue,
    showControlFeedback,
    showPlayerDeath,
    waitForLethalHitEffects,
    showMonsterDeath,
    stageDrawFeedback,
    showShuffleFeedback,
    showDrawFeedback,
    showPlayerDamage,
    showPlayerHealing,
    showAbsorbGain,
    showShieldGain,
    playPlayerStatusHit,
  } = feedback;

  async function handleCardPlay(button, index) {
    const run = getRun(),
      meta = getMeta();
    if (!run?.battle || !Number.isInteger(index)) return false;

    const playedCardInstance = run.battle.hand[index],
      playedCard = cards[playedCardInstance?.id];
    if (!playedCardInstance || !playedCard) return false;

    const beforeHandCards = [...run.battle.hand],
      beforeHandElements = [...document.querySelectorAll(".hand > .card")],
      contactAttackPlayed = Boolean(
        (playedCard.attack || playedCard.burst || playedCard.weight) &&
          (playedCard.attackPattern || "contact") === "contact",
      ),
      nonContactAttackPlayed = Boolean(
        (playedCard.attack || playedCard.burst || playedCard.weight) &&
          playedCard.attackPattern === "nonContact",
      ),
      playedTargetIndex = contactAttackPlayed ? run.battle.selectedTarget : null,
      beforeEnemies = run.battle.enemies.map((enemy) => ({
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        id: enemy.id,
        material: enemy.material || enemyDefinitionFor(enemy.id)?.material,
      })),
      beforePlayer = run.hp,
      beforeShield = run.battle.shield || 0;

    if (run) {
      delete run._healingFeedback;
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._enemyHitFeedback;
      delete run._absorbFeedback;
      delete run._absorbLossFeedback;
      delete run._harmonyFeedback;
      delete run._drawFeedback;
      delete run._shuffleFeedback;
      delete run._controlFeedback;
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
      impurityOverflowHits = statusHits.filter(
        (hit) => hit.statusId === "impurityOverflow",
      ),
      regularStatusHits = statusHits.filter(
        (hit) => hit.statusId !== "impurityOverflow",
      ),
      enemyHits = run._enemyHitFeedback || [],
      statusPlayerDamage = statusHits
        .filter((hit) => hit.target === "player")
        .reduce((sum, hit) => sum + hit.amount, 0),
      regularStatusPlayerDamage = regularStatusHits
        .filter((hit) => hit.target === "player")
        .reduce((sum, hit) => sum + hit.amount, 0),
      playerDamage = Math.max(0, beforePlayer - run.hp - statusPlayerDamage),
      shieldGained = run.battle ? Math.max(0, run.battle.shield - beforeShield) : 0,
      healing = run._healingFeedback || 0,
      absorbGained = run._absorbFeedback || 0,
      harmonyTriggers = run._harmonyFeedback || [],
      controlFeedback = run._controlFeedback || null,
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


    delete run._healingFeedback;
    delete run._damageFeedback;
    delete run._statusProcFeedback;
    delete run._enemyHitFeedback;
    delete run._absorbFeedback;
    delete run._harmonyFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
    delete run._controlFeedback;

    let weakContactAttackPlayed = false,
      enemyHitsForFeedback = enemyHits;

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
        showContactHit = (hit) => {
          const impactDamage = hit.damage + hit.blocked,
            power = hit.fx?.power || engine.combatFxPowerTier(impactDamage),
            strongHit = power !== "weak",
            superHit = power === "super";
          if (strongHit) showStrongContactImpact(hit.targetIndex, superHit);
          else showWeakContactImpact(hit.targetIndex);
          if (hit.blocked)
            showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
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
              strongHit,
              superHit,
              Boolean(hit.blocked),
              hit.fx,
            );
          }
        };

      weakContactAttackPlayed = weakContactAttack;
      if (weakContactAttack) {
        const impactHit = contactHits[0];
        await animateWeakContactAttack(
          button,
          impactHit?.targetIndex ?? playedTargetIndex,
          () => showContactHit(impactHit),
        );
        for (const hit of contactHits.slice(1)) {
          await sleep(150);
          showContactHit(hit);
        }
        enemyHitsForFeedback = enemyHits.filter(
          (hit) => !contactHits.includes(hit),
        );
        await sleep(contactHits.length > 1 ? 280 : 170);
      } else if (contactHits.length) {
        const impactHit = contactHits[0];
        await animateStrongContactAttack(
          button,
          impactHit?.targetIndex ?? playedTargetIndex,
          impactHit.damage + impactHit.blocked >= 30,
          () => showContactHit(impactHit),
          impactHit.fx?.shieldBreak && impactHit.fx?.power === "super"
            ? () => sound.barrierBreakSuperContactFly()
            : null,
        );
        for (const hit of contactHits.slice(1)) {
          await sleep(190);
          showContactHit(hit);
        }
        enemyHitsForFeedback = enemyHits.filter(
          (hit) => !contactHits.includes(hit),
        );
        await sleep(contactHits.length > 1 ? 360 : 240);
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
          showEnemyShieldBlock(hit.blocked, hit.targetIndex, !hit.damage);
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
    );
    enemyHitsForFeedback = [];
    for (const discardedCard of randomlyDiscardedElements)
      await animateDiscardedCard(discardedCard);
    await collapseUsedCard(button);

    await showImpurityOverflowQueue(impurityOverflowHits);
    if (playerKilled) {
      showHarmonyFeedback(harmonyTriggers);
      showControlFeedback?.(controlFeedback);
      await showEnemyHitQueue(enemyHitsForFeedback, weakContactAttackPlayed);
      await showStatusDamageQueue(regularStatusHits);
      await showPlayerDeath(playerDamage || regularStatusPlayerDamage);
      save();
      render();
      setCardAnimating(false);
      return true;
    }

    if (killingBlow) {
      showHarmonyFeedback(harmonyTriggers);
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

    save();
    render();
    stageDrawFeedback(drawn);
    if (shuffled) await showShuffleFeedback(shuffled);
    if (drawn) await showDrawFeedback(drawn);
    showHarmonyFeedback(harmonyTriggers);
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
