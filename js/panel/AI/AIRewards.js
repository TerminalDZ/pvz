/**
 * AI Rewards - Professional Reward System for AI Training
 * Comprehensive rewards for kills, damage, strategic placement, economy, etc.
 * @version 1.0.0
 */

const AIRewards = (function() {
    'use strict';

    // ============================================
    // REWARD CONFIGURATION
    // ============================================

    const REWARDS = {
        // === VICTORY / DEFEAT ===
        WIN_GAME: 200,
        LOSE_GAME: -150,
        SURVIVE_WAVE: 30,

        // === ZOMBIE RELATED ===
        KILL_ZOMBIE: 15,
        KILL_ZOMBIE_BONUS: {
            'Buckethead': 25,
            'Conehead': 10,
            'Football': 35,
            'Gargantuar': 50,
            'Pole': 15,
            'Newspaper': 8,
            'Screen': 20,
            'Dancer': 30,
            'Jack': 25
        },
        DAMAGE_ZOMBIE: 2,
        ZOMBIE_REACH_PLANT: -10,
        ZOMBIE_ENTER_LAWN: -5,
        ZOMBIE_TOO_CLOSE: -8,  // Zombie reaches col 3 or less

        // === PLANT PLACEMENT - STRATEGIC ===
        PLACE_PLANT_BASE: 5,
        SUNFLOWER_BACK_ROW: 15,      // Cols 1-2
        SUNFLOWER_WRONG_POS: -8,     // Cols > 3
        ATTACK_PLANT_GOOD_ROW: 12,   // Row with zombies
        ATTACK_PLANT_EMPTY_ROW: -3,  // Row without zombies
        DEFENSE_FRONT: 18,           // Wall-nut in front
        DEFENSE_TOO_BACK: -5,        // Wall-nut in back (useless)
        INSTANT_KILL_MULTIPLE: 25,   // Cherry Bomb killing 3+
        INSTANT_WASTED: -15,         // Cherry Bomb killing 0
        MINE_GOOD_POSITION: 10,      // Potato Mine in path
        MINE_WASTED: -8,             // No zombie coming

        // === ECONOMY ===
        COLLECT_SUN: 3,
        MISS_SUN: -5,                // Sun expires uncollected
        SUN_EFFICIENCY: 2,           // Per sun collected quickly
        SAVE_SUN_WISELY: 5,          // Not overspending
        OVERSPEND: -10,              // Spending all sun with zombies coming

        // === TIMING ===
        WAIT_GOOD: 1,                // Waiting when no good actions
        WAIT_BAD: -3,                // Waiting when sun available
        WAIT_CRITICAL: -15,          // Waiting when zombies close
        EARLY_SUNFLOWER: 20,         // First 2 plants are sunflowers
        LATE_SUNFLOWER: -5,          // Sunflower when waves started

        // === LANE DEFENSE ===
        LANE_NO_DEFENSE: -20,        // No plant in lane with zombie
        LANE_GOOD_COVERAGE: 10,      // Multiple plants covering lane
        ALL_LANES_COVERED: 15,       // Every lane has shooter

        // === SPECIAL SITUATIONS ===
        EMERGENCY_SAVE: 30,          // Killing zombie about to eat brains
        PERFECT_TIMING: 15,          // Instant plant kills multiple
        COMBO_ATTACK: 8,             // Multiple shooters in lane
        SYNERGY_BONUS: 5             // Good plant combinations (slow + attack)
    };

    // State tracking for rewards
    let _prevZombieCount = 0;
    let _prevZombiePositions = [];
    let _prevPlantCount = 0;
    let _zombiesKilledThisTick = 0;
    let _sunsCollectedThisTick = 0;

    /**
     * Calculate comprehensive reward for current game state
     * @param {Object} prevState - Previous game state
     * @param {Object} currState - Current game state
     * @param {Object} action - Action that was taken
     * @returns {Object} Reward breakdown and total
     */
    function calculateReward(prevState, currState, action) {
        const breakdown = [];
        let total = 0;

        // Track zombie kills
        const zombieReward = _calcZombieRewards(prevState, currState);
        if (zombieReward.reward !== 0) {
            breakdown.push(zombieReward);
            total += zombieReward.reward;
        }

        // Track sun collection
        const sunReward = _calcSunRewards(prevState, currState);
        if (sunReward.reward !== 0) {
            breakdown.push(sunReward);
            total += sunReward.reward;
        }

        // Track strategic position
        const positionReward = _calcPositionRewards(currState);
        if (positionReward.reward !== 0) {
            breakdown.push(positionReward);
            total += positionReward.reward;
        }

        // Track timing rewards
        const timingReward = _calcTimingRewards(action, currState);
        if (timingReward.reward !== 0) {
            breakdown.push(timingReward);
            total += timingReward.reward;
        }

        return {
            total: total,
            breakdown: breakdown
        };
    }

    /**
     * Calculate rewards for placing a specific plant
     */
    function calculatePlantReward(plantName, row, col, gameState) {
        let reward = REWARDS.PLACE_PLANT_BASE;
        const reasons = [];

        const rowZombies = gameState.zombies.filter(z => z.row === row);
        const hasZombies = rowZombies.length > 0;
        const nearestZombie = hasZombies ? Math.min(...rowZombies.map(z => z.col)) : 10;

        // Sunflower placement
        if (plantName && (plantName.includes('Sun') || plantName.includes('Flower'))) {
            if (col <= 2) {
                reward += REWARDS.SUNFLOWER_BACK_ROW;
                reasons.push('☀️ Sunflower in safe column');
            } else if (col > 3) {
                reward += REWARDS.SUNFLOWER_WRONG_POS;
                reasons.push('⚠️ Sunflower too far forward');
            }

            // Early game bonus
            if (gameState.plants.length < 3) {
                reward += REWARDS.EARLY_SUNFLOWER;
                reasons.push('🌟 Early economy boost');
            }
        }

        // Attack plants
        else if (_isAttackPlant(plantName)) {
            if (hasZombies) {
                reward += REWARDS.ATTACK_PLANT_GOOD_ROW;
                reasons.push('🎯 Attack in zombie lane');

                // Bonus for multiple zombies
                reward += rowZombies.length * 3;
            } else {
                reward += REWARDS.ATTACK_PLANT_EMPTY_ROW;
                reasons.push('❓ Attack in empty lane');
            }

            // Check for synergy with slow plants
            const hasSlowPlant = gameState.plants.some(p => 
                p.row === row && p.name && (p.name.includes('Snow') || p.name.includes('Winter'))
            );
            if (hasSlowPlant) {
                reward += REWARDS.SYNERGY_BONUS;
                reasons.push('💫 Attack + Slow synergy');
            }
        }

        // Defense plants
        else if (_isDefensePlant(plantName)) {
            if (hasZombies && col < nearestZombie) {
                reward += REWARDS.DEFENSE_FRONT;
                reasons.push('🛡️ Wall protecting lane');
            } else if (col <= 2) {
                reward += REWARDS.DEFENSE_TOO_BACK;
                reasons.push('⚠️ Wall too far back');
            }
        }

        // Instant kill plants
        else if (_isInstantPlant(plantName)) {
            if (hasZombies && nearestZombie <= 6) {
                const zombiesInRange = rowZombies.filter(z => Math.abs(z.col - col) <= 2);
                if (zombiesInRange.length >= 3) {
                    reward += REWARDS.INSTANT_KILL_MULTIPLE;
                    reasons.push('💥 Multi-kill potential!');
                } else if (zombiesInRange.length === 0) {
                    reward += REWARDS.INSTANT_WASTED;
                    reasons.push('❌ Instant wasted');
                }
            } else {
                reward += REWARDS.INSTANT_WASTED;
                reasons.push('❌ No targets for instant');
            }
        }

        // Mine plants
        else if (_isMinePlant(plantName)) {
            if (hasZombies && nearestZombie <= 7 && nearestZombie > col) {
                reward += REWARDS.MINE_GOOD_POSITION;
                reasons.push('💣 Mine in zombie path');
            } else if (!hasZombies) {
                reward += REWARDS.MINE_WASTED * 0.5;
                reasons.push('⚠️ Mine with no target');
            }
        }

        // Lane coverage check
        const laneHasShooter = gameState.plants.some(p => 
            p.row === row && _isAttackPlant(p.name)
        );
        if (!laneHasShooter && _isAttackPlant(plantName)) {
            reward += REWARDS.LANE_GOOD_COVERAGE;
            reasons.push('✅ New lane coverage');
        }

        return {
            reward: reward,
            reasons: reasons
        };
    }

    /**
     * Calculate zombie-related rewards
     */
    function _calcZombieRewards(prevState, currState) {
        let reward = 0;
        const reasons = [];

        const prevCount = prevState.zombies ? prevState.zombies.length : 0;
        const currCount = currState.zombies ? currState.zombies.length : 0;

        // Zombies killed
        if (currCount < prevCount) {
            const killed = prevCount - currCount;
            reward += killed * REWARDS.KILL_ZOMBIE;
            reasons.push(`💀 Killed ${killed} zombies`);
            _zombiesKilledThisTick = killed;

            // Check for bonus zombies
            if (prevState.zombies) {
                prevState.zombies.forEach(z => {
                    const stillAlive = currState.zombies.some(cz => cz.id === z.id);
                    if (!stillAlive && z.name) {
                        for (const [type, bonus] of Object.entries(REWARDS.KILL_ZOMBIE_BONUS)) {
                            if (z.name.includes(type)) {
                                reward += bonus;
                                reasons.push(`⭐ Bonus: ${type}`);
                                break;
                            }
                        }
                    }
                });
            }
        }

        // Zombies getting too close
        if (currState.zombies) {
            currState.zombies.forEach(z => {
                if (z.col <= 2) {
                    reward += REWARDS.ZOMBIE_TOO_CLOSE;
                    reasons.push(`⚠️ Zombie critical at col ${z.col}`);
                } else if (z.col <= 3) {
                    reward += REWARDS.ZOMBIE_ENTER_LAWN * 0.5;
                }
            });
        }

        return { type: 'Zombie', reward, reasons };
    }

    /**
     * Calculate sun-related rewards
     */
    function _calcSunRewards(prevState, currState) {
        let reward = 0;
        const reasons = [];

        const prevSuns = prevState.suns ? prevState.suns.length : 0;
        const currSuns = currState.suns ? currState.suns.length : 0;

        // Sun collected
        if (currSuns < prevSuns) {
            const collected = prevSuns - currSuns;
            reward += collected * REWARDS.COLLECT_SUN;
            reasons.push(`☀️ Collected ${collected} suns`);
            _sunsCollectedThisTick = collected;
        }

        // Sun left uncollected for too long (simulate with count increase)
        if (currSuns > prevSuns + 3) {
            reward += REWARDS.MISS_SUN;
            reasons.push('⚠️ Too many suns on field');
        }

        return { type: 'Sun', reward, reasons };
    }

    /**
     * Calculate position-based rewards
     */
    function _calcPositionRewards(gameState) {
        let reward = 0;
        const reasons = [];

        // Check lane coverage
        let uncoveredLanes = 0;
        for (let row = 1; row <= 5; row++) {
            const hasZombie = gameState.zombies.some(z => z.row === row);
            const hasShooter = gameState.plants.some(p => 
                p.row === row && _isAttackPlant(p.name)
            );

            if (hasZombie && !hasShooter) {
                uncoveredLanes++;
                reward += REWARDS.LANE_NO_DEFENSE * 0.3;
            }
        }

        if (uncoveredLanes > 0) {
            reasons.push(`⚠️ ${uncoveredLanes} undefended lanes`);
        }

        // All lanes covered bonus
        const allCovered = [1,2,3,4,5].every(row => 
            gameState.plants.some(p => p.row === row && _isAttackPlant(p.name))
        );
        if (allCovered && gameState.zombies.length > 0) {
            reward += REWARDS.ALL_LANES_COVERED;
            reasons.push('✅ All lanes defended');
        }

        return { type: 'Position', reward, reasons };
    }

    /**
     * Calculate timing-based rewards
     */
    function _calcTimingRewards(action, gameState) {
        let reward = 0;
        const reasons = [];

        // Waiting analysis
        if (action === 99) { // Wait action
            const hasSuns = gameState.suns && gameState.suns.length > 0;
            const hasZombiesClose = gameState.zombies.some(z => z.col <= 4);
            const canAfford = gameState.cards.some(c => c.canAfford && !c.isCooldown);

            if (hasZombiesClose && canAfford) {
                reward += REWARDS.WAIT_CRITICAL;
                reasons.push('❌ Waiting during crisis');
            } else if (hasSuns) {
                reward += REWARDS.WAIT_BAD;
                reasons.push('⚠️ Waiting with suns available');
            } else if (!canAfford) {
                reward += REWARDS.WAIT_GOOD;
                reasons.push('✓ Waiting for sun');
            }
        }

        return { type: 'Timing', reward, reasons };
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function _isAttackPlant(name) {
        if (!name) return false;
        const attackPlants = ['Peashooter', 'Repeater', 'Threepeater', 'Gatling', 
            'Snow', 'Cactus', 'Starfruit', 'Chomper', 'Fume', 'Gloom'];
        return attackPlants.some(p => name.includes(p));
    }

    function _isDefensePlant(name) {
        if (!name) return false;
        return name.includes('Nut') || name.includes('Wall') || name.includes('Pumpkin');
    }

    function _isInstantPlant(name) {
        if (!name) return false;
        const instants = ['Cherry', 'Jalapeno', 'Squash', 'Doom', 'Tangle'];
        return instants.some(p => name.includes(p));
    }

    function _isMinePlant(name) {
        if (!name) return false;
        return name.includes('Potato') || name.includes('Mine');
    }

    /**
     * Get reward configuration (for display)
     */
    function getRewardConfig() {
        return REWARDS;
    }

    /**
     * Get last tick statistics
     */
    function getLastTickStats() {
        return {
            zombiesKilled: _zombiesKilledThisTick,
            sunsCollected: _sunsCollectedThisTick
        };
    }

    /**
     * Reset tick counters
     */
    function resetTickCounters() {
        _zombiesKilledThisTick = 0;
        _sunsCollectedThisTick = 0;
    }

    return {
        REWARDS,
        calculateReward,
        calculatePlantReward,
        getRewardConfig,
        getLastTickStats,
        resetTickCounters
    };
})();
