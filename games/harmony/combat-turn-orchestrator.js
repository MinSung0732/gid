export function createCombatTurnOrchestrator({
  engine,
  enemyDefinitionFor,
  getRun,
  getMeta,
  getCardAnimating,
  setCardAnimating,
  save,
  render,
  sleep,
  feedback,
}) {
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
    },
    showResourceGains = async (
      captured,
      { waitForHealingPresentation = false } = {},
    ) => {
      const healingPresentation = captured.healing
        ? waitForHealingPresentation
          ? feedback.showPlayerHealing(captured.healing, {
              waitForPresentation: true,
            })
          : feedback.showPlayerHealing(captured.healing)
        : null;
      if (captured.shieldGained)
        feedback.showShieldGain(captured.shieldGained, false);
      if (captured.absorbLost) {
        feedback.showAbsorbLoss(captured.absorbLost);
        await sleep(180);
      }
      if (captured.absorbGained) feedback.showAbsorbGain(captured.absorbGained);
      if (
        waitForHealingPresentation &&
        healingPresentation &&
        typeof healingPresentation.then === "function"
      )
        await healingPresentation;
    },
    snapshotLivingEnemies = (run) =>
      (run?.battle?.enemies || []).map((enemy, index) => ({
        index,
        hp: enemy.hp,
        material: enemy.material || enemyDefinitionFor(enemy.id)?.material,
      })),
    killedEnemiesSince = (before, run) =>
      before.filter(
        (enemy) =>
          enemy.hp > 0 &&
          (run?.battle?.enemies?.[enemy.index]?.hp ?? 0) <= 0,
      );

  async function handleEndTurn() {
    const run = getRun();
    if (getCardAnimating() || run?.phase !== "battle" || run.battle.enemyPhase)
      return;
    setCardAnimating(true);
    const turnEndHarmonyNotes = (run.battle.notes || [])
        .slice(-3)
        .map((played) => played?.note)
        .filter(Boolean),
      turnEndHarmonyAnchor = turnEndHarmonyNotes.length
        ? feedback.getHarmonyProgressRect?.() || null
        : null,
      turnEndHarmonyResetFeedback = turnEndHarmonyNotes.length
        ? {
            notes: turnEndHarmonyNotes,
            reason: "turnStart",
            anchorRect: turnEndHarmonyAnchor,
          }
        : null;
    const presentHarmonyReset = async (resetFeedback) => {
      if (
        !resetFeedback?.notes?.length ||
        feedback.combatEffectsEnabled?.() === false
      )
        return;
      await sleep(90);
      await feedback.showHarmonyResetVfx?.(resetFeedback);
      await sleep(90);
    };
    let playerTookStatusDamage = false;
    clearResourceFeedback(run);
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    delete run._statusProcFeedback;
    delete run._thornsFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
    const beforePlayerTurnEndEnemies = snapshotLivingEnemies(run);
    if (!engine.executePlayerTurnEnd(run, getMeta())) {
      setCardAnimating(false);
      return;
    }
    const endTurnResources = takeResourceFeedback(run),
      endTurnEnemyHits = run._enemyHitFeedback || [],
      endTurnTimelineHits = run._damageFeedback || [],
      endTurnStatusHits = endTurnTimelineHits.filter(
        (hit) => !hit.sourceImpactId,
      ),
      endTurnStatusProcs = run._statusProcFeedback || [],
      endTurnKilledMonsters = killedEnemiesSince(
        beforePlayerTurnEndEnemies,
        run,
      ),
      showEndTurnDamageFeedback = async () => {
        if (endTurnEnemyHits.length)
          await feedback.showEnemyHitQueue(endTurnEnemyHits);
        if (endTurnStatusProcs.length)
          await feedback.showStatusProcQueue(endTurnStatusProcs);
        if (endTurnStatusHits.length)
          await feedback.showStatusDamageQueue(endTurnStatusHits);
      };
    delete run._damageFeedback;
    delete run._enemyHitFeedback;
    delete run._statusProcFeedback;
    delete run._thornsFeedback;
    if (endTurnKilledMonsters.length) {
      await showEndTurnDamageFeedback();
      await feedback.waitForLethalHitEffects?.(endTurnKilledMonsters);
      await feedback.showMonsterDeath(endTurnKilledMonsters);
      save();
      render();
    } else {
      await showEndTurnDamageFeedback();
      save();
      render();
    }
    if (endTurnResources.playerDamage)
      feedback.showPlayerDamage(endTurnResources.playerDamage);
    await showResourceGains(endTurnResources);
    await sleep(180);
    for (let index = 0; index < run.battle.enemies.length; index++) {
      if (run.battle.enemies[index].hp <= 0) continue;
      run.battle.actingEnemy = index;
      render();
      await sleep(140);
      const enemyBoxBeforeAction = feedback.getEnemyElement(index),
        beforeEnemyActionEnemies = snapshotLivingEnemies(run),
        playerHpBeforeAction = run.hp,
        playerShieldBeforeAction = run.battle.shield;
      clearResourceFeedback(run);
      delete run._damageFeedback;
      delete run._enemyHitFeedback;
      delete run._statusProcFeedback;
      delete run._thornsFeedback;
      const outcome = engine.executeSingleEnemyAction(run, index, getMeta());
      if (!outcome) break;
      const enemyActionResources = takeResourceFeedback(run),
        actionKilledMonsters = killedEnemiesSince(
          beforeEnemyActionEnemies,
          run,
        ),
        statusProcs = run._statusProcFeedback || [],
        thornsFeedback = run._thornsFeedback || [],
        playedStatusProcs = new Set(),
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
                  await feedback.showStatusProcVfx(event, { impactPoint });
              })(),
            );
        },
        flushStatusProcs = async () => {
          await Promise.all(statusProcTasks);
          const remaining = statusProcs.filter(
            (event) => !playedStatusProcs.has(event),
          );
          remaining.forEach((event) => playedStatusProcs.add(event));
          await feedback.showStatusProcQueue(remaining);
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
            ...linked.map((event) =>
              Promise.resolve(feedback.showThornsRetaliationVfx?.(event)),
            ),
          );
        },
        flushThornsFeedback = async () => {
          const remaining = thornsFeedback.filter(
            (event) => !playedThornsFeedback.has(event),
          );
          remaining.forEach((event) => playedThornsFeedback.add(event));
          thornsTasks.push(
            ...remaining.map((event) =>
              Promise.resolve(feedback.showThornsRetaliationVfx?.(event)),
            ),
          );
          await Promise.all(thornsTasks);
        };
      delete run._thornsFeedback;
      let enemyAttackAnimated = false;
      if (
        outcome.type === "attack" &&
        outcome.attackPattern === "contact" &&
        outcome.hits.length
      ) {
        const strongAttack = outcome.hits.some(
            (hit) => hit.damage + hit.blocked >= 20,
          ),
          visualPlayer = {
            hp: playerHpBeforeAction,
            shield: playerShieldBeforeAction,
          },
          showEnemyStrike = (
            hit,
            impactPoint = feedback.getPlayerImpactPoint(),
          ) => {
            const impactDamage = hit.damage + hit.blocked,
              strongHit = impactDamage >= 20;
            visualPlayer.shield = Math.max(0, visualPlayer.shield - hit.blocked);
            visualPlayer.hp = Math.max(0, visualPlayer.hp - hit.damage);
            feedback.updatePlayerHealthFeedback(
              visualPlayer.hp,
              run.maxHp,
              visualPlayer.shield,
            );
            feedback.showPlayerContactImpact(strongHit, impactPoint);
            if (hit.blocked) {
              feedback.showShieldBlock(hit.blocked, !hit.damage);
              feedback.showPlayerImpactShieldBlock(
                hit.blocked,
                impactPoint,
                !hit.damage,
              );
            }
            if (hit.shieldBreak)
              feedback.showPlayerShieldBreakVfx?.(hit, impactPoint);
            if (hit.damage)
              feedback.showPlayerDamage(
                hit.damage,
                outcome.attackPattern,
                strongHit,
                impactDamage >= 30,
              );
            queueStatusProcsForHit(hit, impactPoint);
            queueThornsForHit(hit);
          };
        await feedback.animateEnemyContactAttack(
          enemyBoxBeforeAction,
          strongAttack,
          outcome.hits[0].damage + outcome.hits[0].blocked >= 30,
          (impactPoint) => showEnemyStrike(outcome.hits[0], impactPoint),
        );
        for (const hit of outcome.hits.slice(1)) {
          await sleep(hit.damage + hit.blocked >= 20 ? 190 : 150);
          showEnemyStrike(hit);
        }
        await sleep(outcome.hits.length > 1 ? 300 : strongAttack ? 240 : 170);
        enemyAttackAnimated = true;
      }
      await flushThornsFeedback();
      if (run.phase !== "battle" || outcome.playerDied) {
        if (!enemyAttackAnimated) {
          if (outcome.type === "attack") {
            if (outcome.blocked)
              feedback.showShieldBlock(outcome.blocked, !outcome.damage);
            for (const hit of outcome.hits)
              if (hit.shieldBreak)
                feedback.showPlayerShieldBreakVfx?.(hit, feedback.getPlayerImpactPoint());
          }
          for (let hitIndex = 0; hitIndex < outcome.hits.length; hitIndex++) {
            queueStatusProcsForHit(
              outcome.hits[hitIndex],
              feedback.getPlayerImpactPoint(),
            );
            if (hitIndex < outcome.hits.length - 1) await sleep(150);
          }
        }
        await flushStatusProcs();
        const lethalThornsHits = (run._damageFeedback || []).filter(
          (hit) => hit.statusId === "thorns" && !hit.sourceImpactId,
        );
        if (lethalThornsHits.length)
          await feedback.showStatusDamageQueue(lethalThornsHits);
        await showResourceGains(enemyActionResources);
        if (!enemyAttackAnimated && outcome.hits.some((hit) => hit.shieldBreak))
          await sleep(60);
        if (outcome.playerDied)
          await feedback.showPlayerDeath(
            enemyAttackAnimated ? 0 : outcome.damage,
          );
        save();
        render();
        setCardAnimating(false);
        return;
      }
      run.battle.actingEnemy = index;
      if (!actionKilledMonsters.length) {
        render();
        feedback.stageStatusDamageHealth?.(run._damageFeedback || []);
      }
      if (outcome.regenerationRestored > 0)
        feedback.showEnemyHealing(outcome.regenerationRestored, index);
      const enemyBox = feedback.getEnemyElement(index);
      if (outcome.type === "attack") {
        if (!enemyAttackAnimated && feedback.combatEffectsEnabled())
          enemyBox?.classList.add("enemy-attack-lunge");
        feedback.showEnemyActionPopup(
          index,
          outcome.damage
            ? `공격! -${outcome.damage}`
            : `방어됨 ${outcome.blocked}`,
          "attack-popup",
        );
        if (outcome.blocked && !enemyAttackAnimated)
          feedback.showShieldBlock(outcome.blocked, !outcome.damage);
        if (!enemyAttackAnimated)
          for (const hit of outcome.hits)
            if (hit.shieldBreak)
              feedback.showPlayerShieldBreakVfx?.(hit, feedback.getPlayerImpactPoint());
        if (outcome.damage && !enemyAttackAnimated)
          feedback.showPlayerDamage(outcome.damage, outcome.attackPattern);
        if (!enemyAttackAnimated) {
          for (let hitIndex = 0; hitIndex < outcome.hits.length; hitIndex++) {
            queueStatusProcsForHit(
              outcome.hits[hitIndex],
              feedback.getPlayerImpactPoint(),
            );
            if (hitIndex < outcome.hits.length - 1) await sleep(150);
          }
        }
      } else if (outcome.type === "guard") {
        enemyBox?.classList.add("enemy-guard-pulse");
        feedback.showEnemyActionPopup(
          index,
          `방어막 +${outcome.shieldGained}`,
          "guard-popup",
        );
      } else if (outcome.type === "pollute") {
        feedback.showEnemyActionPopup(
          index,
          `불순물 +${outcome.impurities}${outcome.shieldGained ? ` · 방어막 +${outcome.shieldGained}` : ""}`,
          "pollute-popup",
        );
      } else if (outcome.type === "debuff") {
        feedback.showEnemyActionPopup(index, "상태이상 부여", "control-popup");
      } else {
        feedback.showEnemyActionPopup(
          index,
          outcome.type === "stun" ? "기절! 행동 불가" : "무장 해제! 행동 불가",
          "control-popup",
        );
      }
      feedback.showEnemyDebuffSmoke(outcome.playerDebuffs);
      const statusHits = run._damageFeedback || [],
        enemyHits = run._enemyHitFeedback || [];
      if (
        statusHits.some(
          (hit) =>
            hit.target === "player" && hit.amount > 0 && !hit.sourceImpactId,
        )
      )
        playerTookStatusDamage = true;
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._thornsFeedback;
      delete run._enemyHitFeedback;
      for (const hit of enemyHits) {
        if (hit.blocked)
          feedback.showEnemyShieldBlock(
            hit.blocked,
            hit.targetIndex,
            !hit.damage,
            hit,
          );
        if (hit.damage && !hit.statusId)
          feedback.showHitFeedback(
            hit.damage,
            hit.targetIndex,
            hit.attackPattern,
            false,
            false,
            Boolean(hit.blocked),
            hit.fx,
          );
      }
      await flushStatusProcs();
      await feedback.showStatusDamageQueue(
        statusHits.filter((hit) => !hit.sourceImpactId),
      );
      if (actionKilledMonsters.length) {
        await feedback.waitForLethalHitEffects?.(actionKilledMonsters);
        await feedback.showMonsterDeath(actionKilledMonsters);
        render();
      }
      await showResourceGains(enemyActionResources);
      await sleep(420);
      if (run.phase !== "battle") break;
      run.battle.actingEnemy = null;
      save();
    }
    if (run.phase === "battle") {
      clearResourceFeedback(run);
      delete run._damageFeedback;
      delete run._enemyHitFeedback;
      delete run._statusProcFeedback;
      delete run._thornsFeedback;
      const beforeRoundHp = run.hp,
        beforeRoundEnemies = run.battle.enemies.map((enemy, index) => ({
          index,
          hp: enemy.hp,
          material: enemy.material || enemyDefinitionFor(enemy.id)?.material,
        }));
      delete run._harmonyResetFeedback;
      engine.executeRoundEnd(run, getMeta());
      const engineHarmonyResetFeedback = run._harmonyResetFeedback || null,
        harmonyResetFeedback = engineHarmonyResetFeedback
          ? {
              ...engineHarmonyResetFeedback,
              anchorRect:
                engineHarmonyResetFeedback.anchorRect ||
                turnEndHarmonyResetFeedback?.anchorRect ||
                null,
            }
          : turnEndHarmonyResetFeedback,
        augmentTurnFeedback = run._augmentTurnFeedback || null;
      delete run._harmonyResetFeedback;
      delete run._augmentTurnFeedback;
      const roundResources = takeResourceFeedback(run),
        statusHits = run._damageFeedback || [],
        impurityOverflowHits = statusHits.filter(
          (hit) => hit.statusId === "impurityOverflow",
        ),
        roundTimelineHits = statusHits.filter(
          (hit) => hit.statusId !== "impurityOverflow",
        ),
        regularStatusHits = roundTimelineHits.filter(
          (hit) => !hit.sourceImpactId,
        ),
        enemyHits = run._enemyHitFeedback || [],
        roundStatusProcs = run._statusProcFeedback || [],
        enrageHit = run._enrageFeedback?.damage || 0,
        drawn = run.phase === "battle" ? run._drawFeedback || 0 : 0,
        shuffled = run.phase === "battle" ? run._shuffleFeedback || 0 : 0,
        roundKilledMonsters = beforeRoundEnemies.filter(
          (enemy) =>
            enemy.hp > 0 &&
            (run.battle?.enemies[enemy.index]?.hp ?? 0) <= 0,
        );
      if (
        regularStatusHits.some(
          (hit) => hit.target === "player" && hit.amount > 0,
        )
      )
        playerTookStatusDamage = true;
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._thornsFeedback;
      delete run._enemyHitFeedback;
      delete run._enrageFeedback;
      delete run._drawFeedback;
      delete run._shuffleFeedback;
      await feedback.showImpurityOverflowQueue(impurityOverflowHits);
      if (beforeRoundHp > 0 && run.hp <= 0 && run.phase === "result") {
        if (roundResources.playerDamage)
          feedback.showPlayerDamage(roundResources.playerDamage);
        if (roundStatusProcs.length)
          await feedback.showStatusProcQueue(roundStatusProcs);
        await feedback.showStatusDamageQueue(regularStatusHits);
        await feedback.showPlayerDeath(
          roundResources.playerDamage
            ? 0
            : regularStatusHits
                .filter((hit) => hit.target === "player")
                .reduce((sum, hit) => sum + hit.amount, 0) || enrageHit,
        );
        save();
        render();
        setCardAnimating(false);
        return;
      }
      const roundWon =
        roundKilledMonsters.length > 0 &&
        run.phase === "reward" &&
        run.battle.enemies.every((enemy) => enemy.hp <= 0);
      if (roundKilledMonsters.length) {
        if (roundResources.playerDamage)
          feedback.showPlayerDamage(roundResources.playerDamage);
        await feedback.showEnemyHitQueue(enemyHits);
        if (roundStatusProcs.length)
          await feedback.showStatusProcQueue(roundStatusProcs);
        await feedback.showStatusDamageQueue(regularStatusHits);
        await feedback.waitForLethalHitEffects?.(roundKilledMonsters);
        await feedback.showMonsterDeath(roundKilledMonsters);
        if (roundWon)
          await showResourceGains(roundResources, {
            waitForHealingPresentation: true,
          });
        save();
        if (harmonyResetFeedback)
          await presentHarmonyReset(harmonyResetFeedback);
        render();
        if (roundWon) {
          setCardAnimating(false);
          return;
        }
        feedback.stageDrawFeedback(drawn);
        if (shuffled) await feedback.showShuffleFeedback(shuffled);
        if (drawn) await feedback.showDrawFeedback(drawn);
        if (augmentTurnFeedback)
          feedback.showControlFeedback?.({
            statusId: "augment",
            title: augmentTurnFeedback.title,
            detail: augmentTurnFeedback.detail,
          });
        if (playerTookStatusDamage) feedback.playPlayerStatusHit();
        if (enrageHit) feedback.showEnrageDamage(enrageHit);
        await showResourceGains(roundResources);
        setCardAnimating(false);
        return;
      }
      if (roundResources.playerDamage)
        feedback.showPlayerDamage(roundResources.playerDamage);
      for (const hit of enemyHits) {
        if (hit.blocked)
          feedback.showEnemyShieldBlock(
            hit.blocked,
            hit.targetIndex,
            !hit.damage,
            hit,
          );
        if (hit.damage && !hit.statusId)
          feedback.showHitFeedback(
            hit.damage,
            hit.targetIndex,
            hit.attackPattern,
            false,
            false,
            Boolean(hit.blocked),
            hit.fx,
          );
      }
      if (roundStatusProcs.length)
        await feedback.showStatusProcQueue(roundStatusProcs);
      await feedback.showStatusDamageQueue(regularStatusHits);
      if (playerTookStatusDamage) feedback.playPlayerStatusHit();
      if (enrageHit) feedback.showEnrageDamage(enrageHit);
      save();
      if (harmonyResetFeedback)
        await presentHarmonyReset(harmonyResetFeedback);
      render();
      feedback.stageDrawFeedback(drawn);
      if (shuffled) await feedback.showShuffleFeedback(shuffled);
      if (drawn) await feedback.showDrawFeedback(drawn);
      if (augmentTurnFeedback)
        feedback.showControlFeedback?.({
          statusId: "augment",
          title: augmentTurnFeedback.title,
          detail: augmentTurnFeedback.detail,
        });
      await showResourceGains(roundResources);
    }
    setCardAnimating(false);
  }

  return { handleEndTurn };
}
