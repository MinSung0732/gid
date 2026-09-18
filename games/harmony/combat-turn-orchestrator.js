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
  };

  const takeResourceFeedback = (run) => {
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

  const presentResourceFeedback = (captured, { includeDamage = true } = {}) => {
    if (!captured) return;
    if (includeDamage && captured.playerDamage)
      feedback.showPlayerDamage(captured.playerDamage);
    if (captured.healing) feedback.showPlayerHealing(captured.healing);
    if (captured.shieldGained)
      feedback.showShieldGain(captured.shieldGained, false);
    if (captured.absorbLost) feedback.showAbsorbLoss(captured.absorbLost);
    if (captured.absorbGained) feedback.showAbsorbGain(captured.absorbGained);
  };

  async function handleEndTurn() {
    const run = getRun();
    if (getCardAnimating() || run?.phase !== "battle" || run.battle.enemyPhase)
      return;
    setCardAnimating(true);
    let playerTookStatusDamage = false;
    delete run._enemyHitFeedback;
    delete run._statusProcFeedback;
    delete run._damageFeedback;
    delete run._drawFeedback;
    delete run._shuffleFeedback;
    clearResourceFeedback(run);
    if (!engine.executePlayerTurnEnd(run, getMeta())) {
      setCardAnimating(false);
      return;
    }
    const turnEndStatusHits = run._damageFeedback || [],
      turnEndStatusProcs = run._statusProcFeedback || [],
      turnEndEnemyHits = run._enemyHitFeedback || [],
      turnEndResource = takeResourceFeedback(run);
    delete run._damageFeedback;
    delete run._statusProcFeedback;
    delete run._enemyHitFeedback;
    save();
    render();
    await feedback.showEnemyHitQueue(turnEndEnemyHits);
    await feedback.showStatusProcQueue(turnEndStatusProcs);
    await feedback.showStatusDamageQueue(
      turnEndStatusHits.filter((hit) => !hit.sourceImpactId),
    );
    presentResourceFeedback(turnEndResource);
    if (
      turnEndEnemyHits.length ||
      turnEndStatusHits.length ||
      turnEndStatusProcs.length ||
      turnEndResource.playerDamage ||
      turnEndResource.healing ||
      turnEndResource.shieldGained ||
      turnEndResource.absorbLost ||
      turnEndResource.absorbGained
    )
      await sleep(180);
    for (let index = 0; index < run.battle.enemies.length; index++) {
      if (run.battle.enemies[index].hp <= 0) continue;
      run.battle.actingEnemy = index;
      render();
      await sleep(140);
      const enemyBoxBeforeAction = feedback.getEnemyElement(index),
        playerHpBeforeAction = run.hp,
        playerShieldBeforeAction = run.battle.shield;
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._enemyHitFeedback;
      clearResourceFeedback(run);
      const outcome = engine.executeSingleEnemyAction(run, index, getMeta());
      if (!outcome) break;
      const actionResource = takeResourceFeedback(run),
        statusProcs = run._statusProcFeedback || [],
        playedStatusProcs = new Set(),
        statusProcTasks = [],
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
        };
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
            if (hit.damage)
              feedback.showPlayerDamage(
                hit.damage,
                outcome.attackPattern,
                strongHit,
                impactDamage >= 30,
              );
            queueStatusProcsForHit(hit, impactPoint);
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
      if (run.phase !== "battle" || outcome.playerDied) {
        if (!enemyAttackAnimated) {
          for (let hitIndex = 0; hitIndex < outcome.hits.length; hitIndex++) {
            queueStatusProcsForHit(
              outcome.hits[hitIndex],
              feedback.getPlayerImpactPoint(),
            );
            if (hitIndex < outcome.hits.length - 1) await sleep(150);
          }
        }
        await flushStatusProcs();
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
      render();
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
      delete run._enemyHitFeedback;
      for (const hit of enemyHits) {
        if (hit.blocked)
          feedback.showEnemyShieldBlock(
            hit.blocked,
            hit.targetIndex,
            !hit.damage,
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
      presentResourceFeedback(actionResource, { includeDamage: false });
      await sleep(420);
      if (run.phase !== "battle") break;
      run.battle.actingEnemy = null;
      save();
    }
    if (run.phase === "battle") {
      const beforeRoundHp = run.hp,
        beforeRoundEnemies = run.battle.enemies.map((enemy, index) => ({
          index,
          hp: enemy.hp,
          material: enemy.material || enemyDefinitionFor(enemy.id)?.material,
        }));
      delete run._damageFeedback;
      delete run._statusProcFeedback;
      delete run._enemyHitFeedback;
      clearResourceFeedback(run);
      engine.executeRoundEnd(run, getMeta());
      const roundResource = takeResourceFeedback(run),
        statusHits = run._damageFeedback || [],
        impurityOverflowHits = statusHits.filter(
          (hit) => hit.statusId === "impurityOverflow",
        ),
        regularStatusHits = statusHits.filter(
          (hit) => hit.statusId !== "impurityOverflow",
        ),
        enemyHits = run._enemyHitFeedback || [],
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
      delete run._enemyHitFeedback;
      delete run._enrageFeedback;
      delete run._drawFeedback;
      delete run._shuffleFeedback;
      await feedback.showImpurityOverflowQueue(impurityOverflowHits);
      if (beforeRoundHp > 0 && run.hp <= 0 && run.phase === "result") {
        await feedback.showStatusDamageQueue(regularStatusHits);
        await feedback.showPlayerDeath(
          regularStatusHits
            .filter((hit) => hit.target === "player")
            .reduce((sum, hit) => sum + hit.amount, 0) || enrageHit,
        );
        save();
        render();
        setCardAnimating(false);
        return;
      }
      if (
        roundKilledMonsters.length &&
        run.phase === "reward" &&
        run.battle.enemies.every((enemy) => enemy.hp <= 0)
      ) {
        await feedback.showEnemyHitQueue(enemyHits);
        if (roundResource.playerDamage)
          feedback.showPlayerDamage(roundResource.playerDamage);
        await feedback.showStatusDamageQueue(regularStatusHits);
        await feedback.showMonsterDeath(roundKilledMonsters);
        if (roundResource.healing)
          feedback.showPlayerHealing(roundResource.healing);
        if (roundResource.shieldGained)
          feedback.showShieldGain(roundResource.shieldGained, false);
        if (roundResource.absorbLost)
          feedback.showAbsorbLoss(roundResource.absorbLost);
        if (roundResource.absorbGained)
          feedback.showAbsorbGain(roundResource.absorbGained);
        save();
        render();
        setCardAnimating(false);
        return;
      }
      save();
      render();
      presentResourceFeedback(roundResource);
      feedback.stageDrawFeedback(drawn);
      if (shuffled) await feedback.showShuffleFeedback(shuffled);
      if (drawn) await feedback.showDrawFeedback(drawn);
      for (const hit of enemyHits) {
        if (hit.blocked)
          feedback.showEnemyShieldBlock(
            hit.blocked,
            hit.targetIndex,
            !hit.damage,
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
      await feedback.showStatusDamageQueue(regularStatusHits);
      if (playerTookStatusDamage) feedback.playPlayerStatusHit();
      if (enrageHit) feedback.showEnrageDamage(enrageHit);
    }
    setCardAnimating(false);
  }

  return { handleEndTurn };
}
