/**
 * AI Player - Main Controller
 * Observes game state, makes decisions, and controls the game
 * @version 1.0.0
 */

const AIPlayer = (function() {
    'use strict';

    // State
    let _isActive = false;
    let _isPaused = false;
    let _gameFrame = null;
    let _updateInterval = null;
    let _actionInterval = null;
    let _currentState = null;
    let _lastAction = null;
    let _episodeReward = 0;
    let _plantsPlaced = 0;
    let _zombiesKilled = 0;
    let _actionLog = [];
    let _speed = 1; // 1 = normal, 2 = fast, 0.5 = slow
    let _prevGameState = null; // For reward calculation
    let _lastThinking = '';

    // DQN Agent
    let _agent = null;
    const STATE_SIZE = 145; // 5x9x3 (135) + 10 global features

    // Game state cache
    let _gameState = {
        sun: 0,
        cards: [],
        plants: [],
        zombies: [],
        suns: [],
        rows: 5,
        isPlaying: false,
        isSunFree: false
    };

    // Plant knowledge base (enhanced by AIKnowledge)
    const PLANT_ROLES = {
        'SunFlower': { role: 'economy', priority: 1, idealCol: 1 },
        'TwinSunflower': { role: 'economy', priority: 1, idealCol: 1 },
        'Peashooter': { role: 'attack', priority: 2, idealCol: 3 },
        'Repeater': { role: 'attack', priority: 3, idealCol: 3 },
        'GatlingPea': { role: 'attack', priority: 4, idealCol: 3 },
        'SnowPea': { role: 'slow', priority: 3, idealCol: 3 },
        'WallNut': { role: 'defense', priority: 2, idealCol: 5 },
        'TallNut': { role: 'defense', priority: 3, idealCol: 5 },
        'CherryBomb': { role: 'instant', priority: 5, idealCol: 6 },
        'PotatoMine': { role: 'delay', priority: 2, idealCol: 4 },
        'Chomper': { role: 'attack', priority: 3, idealCol: 4 },
        'Squash': { role: 'instant', priority: 4, idealCol: 5 },
        'Jalapeno': { role: 'instant', priority: 5, idealCol: 5 }
    };

    /**
     * Use knowledge-based recommendation when AI has low experience
     */
    function _useKnowledgeRecommendation() {
        if (typeof AIKnowledge === 'undefined') return null;
        
        const stats = AIMemory.getStatistics();
        
        // Use knowledge more when AI has few experiences
        const useKnowledge = stats.experienceCount < 500 && Math.random() < 0.3;
        
        if (useKnowledge) {
            const recommendation = AIKnowledge.getRecommendation(_gameState);
            if (recommendation && recommendation.action === 'plant') {
                log(`💡 Knowledge: ${recommendation.reason}`);
                return recommendation;
            }
        }
        
        return null;
    }

    /**
     * Initialize AI Player
     */
    function init() {
        _gameFrame = document.getElementById('gameFrame');
        _setupMessageListener();

        // Initialize DQN Agent
        if (typeof DQNAgent !== 'undefined') {
            _agent = new DQNAgent(STATE_SIZE, 100); // Keeping original output size for compatibility first
            _agent.init();
        } else {
            console.error('[AIPlayer] DQNAgent class not found!');
        }

        console.log('[AIPlayer] Initialized');
    }

    /**
     * Setup message listener for game updates
     */
    function _setupMessageListener() {
        window.addEventListener('message', (e) => {
            if (!e.data) return;

            // Game stats update
            if (e.data.action === 'gameStatsUpdate') {
                _gameState.sun = e.data.sunCount || 0;
                _gameState.cards = e.data.cards || [];
                _gameState.isPlaying = e.data.isPlaying;
                _gameState.isSunFree = e.data.isSunFree || false;
            }

            // Map update
            if (e.data.action === 'gameMapUpdate') {
                _gameState.plants = e.data.plants || [];
                _gameState.zombies = e.data.zombies || [];
                _gameState.rows = e.data.rows || 5;
            }

            // Sun tracker update
            if (e.data.action === 'sunTrackerUpdate') {
                _gameState.suns = e.data.suns || [];
            }

            // Game end
            if (e.data.action === 'gameEnd') {
                _onGameEnd(e.data.won, e.data.stats);
            }
        });
    }

    /**
     * Start AI playing
     */
    function start() {
        if (_isActive) return;
        
        _isActive = true;
        _isPaused = false;
        _episodeReward = 0;
        _plantsPlaced = 0;
        _zombiesKilled = 0;
        _actionLog = [];
        _prevGameState = null;

        log('🤖 AI Player Started');

        // Request initial state
        _requestGameState();

        // Main update loop
        _updateInterval = setInterval(() => {
            _requestGameState();
        }, 200);

        // Action loop
        _actionInterval = setInterval(() => {
            if (!_isPaused && _gameState.isPlaying) {
                _think();
            }
        }, 500 / _speed);

        // Update modal
        if (typeof AIModal !== 'undefined') {
            AIModal.setActive(true);
        }
    }

    /**
     * Stop AI
     */
    function stop() {
        _isActive = false;
        clearInterval(_updateInterval);
        clearInterval(_actionInterval);
        log('🛑 AI Player Stopped');

        if (typeof AIModal !== 'undefined') {
            AIModal.setActive(false);
        }
    }

    /**
     * Pause/Resume
     */
    function togglePause() {
        _isPaused = !_isPaused;
        log(_isPaused ? '⏸️ Paused' : '▶️ Resumed');
    }

    /**
     * Set speed multiplier
     */
    function setSpeed(speed) {
        _speed = speed;
        if (_isActive) {
            clearInterval(_actionInterval);
            _actionInterval = setInterval(() => {
                if (!_isPaused && _gameState.isPlaying) {
                    _think();
                }
            }, 500 / _speed);
        }
    }

    /**
     * Toggle Hyper-Training Mode
     */
    function toggleTrainingMode(enabled) {
        if (!_gameFrame || !_gameFrame.contentWindow) return;

        // Send command to game to adjust speed/rendering
        _gameFrame.contentWindow.postMessage({
            action: 'setGameSpeed',
            speed: enabled ? 100 : 1, // 100x speed vs normal
            headless: enabled // Disable rendering
        }, '*');

        if (enabled) {
            setSpeed(100); // AI thinks faster too
            log('🚀 Hyper-Training Mode ENABLED');
        } else {
            setSpeed(1);
            log('🐢 Training Mode DISABLED');
        }
    }

    /**
     * Request game state from iframe
     */
    function _requestGameState() {
        if (!_gameFrame || !_gameFrame.contentWindow) return;

        _gameFrame.contentWindow.postMessage({ action: 'requestGameStats' }, '*');
        _gameFrame.contentWindow.postMessage({ action: 'requestGameMap' }, '*');
        _gameFrame.contentWindow.postMessage({ action: 'requestSunTracker' }, '*');
    }

    /**
     * Main thinking loop
     */
    function _think() {
        // Build state vector
        const state = _buildStateVector();
        _currentState = state;

        // Get valid actions
        const validActions = _getValidActions();

        // Check for knowledge-based recommendation (for new AI)
        let action;
        const knowledgeRec = _useKnowledgeRecommendation();
        
        if (knowledgeRec) {
            // Use knowledge recommendation
            const cardIndex = _findCardByType(knowledgeRec.plant);
            if (cardIndex >= 0) {
                action = cardIndex * 9 + (knowledgeRec.col - 1);
            } else {
                // Fall back to brain
                action = _agent.predict(state, validActions);
            }
        } else {
            // Use neural network
            action = _agent.predict(state, validActions);
        }

        // Execute action and get action-specific reward
        const actionReward = _executeAction(action);

        // Calculate comprehensive reward using AIRewards
        let totalReward = actionReward;
        if (_prevGameState && typeof AIRewards !== 'undefined') {
            const stateReward = AIRewards.calculateReward(_prevGameState, _gameState, action);
            totalReward += stateReward.total;
            
            // Log significant rewards
            stateReward.breakdown.forEach(item => {
                if (item.reward !== 0 && item.reasons.length > 0) {
                    log(`${item.type}: ${item.reasons.join(', ')} (${item.reward > 0 ? '+' : ''}${item.reward})`);
                }
            });

            // Track kills
            const tickStats = AIRewards.getLastTickStats();
            _zombiesKilled += tickStats.zombiesKilled;
            AIRewards.resetTickCounters();
        }

        // Store experience
        if (_lastAction !== null) {
            _agent.remember(_lastAction.state, _lastAction.action, totalReward, state, false);
        }

        _lastAction = { state: state, action: action };
        _prevGameState = JSON.parse(JSON.stringify(_gameState)); // Deep copy
        _episodeReward += totalReward;

        // Train periodically
        if (Math.random() < 0.1) {
            _agent.train().then(loss => {
                if (loss > 0) log(`📚 Training loss: ${loss.toFixed(4)}`);
            });
        }

        // Update Target Network periodically
        if (_gameFrame && Math.random() < 0.01) {
            _agent.updateTargetModel();
        }

        // Update modal
        _updateModal();
    }

    /**
     * Build state vector from game state (Professional Grid Representation)
     * State dimensions: 145
     * - 5x9 Grid (45 cells) x 3 layers = 135 inputs
     *   - Layer 1: Plant Type ID (0=None, 1=Sun, 2=Atk, 3=Wall, 4=Mine, 5=Instant)
     *   - Layer 2: Zombie Density/Danger (Sum of HP/1000)
     *   - Layer 3: Projectiles/Special Items (Boolean)
     * - Global Features (10 inputs)
     *   - Sun (1)
     *   - Card Availability (9 slots)
     */
    function _buildStateVector() {
        // Initialize layers
        const plantGrid = Array(5).fill(0).map(() => Array(9).fill(0));
        const zombieGrid = Array(5).fill(0).map(() => Array(9).fill(0));
        const specialGrid = Array(5).fill(0).map(() => Array(9).fill(0));

        // Populate Plant Grid
        if (_gameState.plants) {
            _gameState.plants.forEach(p => {
                if (p.row >= 1 && p.row <= 5 && p.col >= 1 && p.col <= 9) {
                    let typeId = 0;
                    const name = p.name || '';
                    if (name.includes('Sun') || name.includes('Flower')) typeId = 0.2;
                    else if (name.includes('Pea') || name.includes('Snow') || name.includes('Gatling')) typeId = 0.4;
                    else if (name.includes('Wall') || name.includes('Nut') || name.includes('Pumpkin')) typeId = 0.6;
                    else if (name.includes('Potato') || name.includes('Mine')) typeId = 0.8;
                    else typeId = 1.0; // Instants/Others

                    plantGrid[p.row - 1][p.col - 1] = typeId;
                }
            });
        }

        // Populate Zombie Grid (Danger Map)
        if (_gameState.zombies) {
            _gameState.zombies.forEach(z => {
                if (z.row >= 1 && z.row <= 5) {
                    // Zombies move smoothly, map to nearest column bucket
                    const col = Math.max(1, Math.min(9, Math.floor(z.col)));
                    // Danger value based on HP (normalized approx)
                    const danger = (z.hp || 200) / 1000;
                    zombieGrid[z.row - 1][col - 1] += danger;
                }
            });
        }

        // Populate Special Grid (Sun drops)
        if (_gameState.suns) {
            _gameState.suns.forEach(s => {
                // Map screen coordinates to grid approx
                // 80px width per col, start ~250px?
                // Simplified: just count total uncollected for now in global
            });
        }

        // Flatten Grids
        const state = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 9; c++) {
                state.push(plantGrid[r][c]);
            }
        }
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 9; c++) {
                state.push(Math.min(zombieGrid[r][c], 1)); // Cap danger at 1
            }
        }
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 9; c++) {
                state.push(specialGrid[r][c]); // Reserved/Sparse
            }
        }

        // Global Features
        state.push(Math.min(_gameState.sun / 1000, 1)); // Normalized Sun

        // Card States (Cooldown/Affordability)
        // Only tracking first 9 cards to match action space
        for (let i = 0; i < 9; i++) {
            const card = _gameState.cards[i];
            if (card && card.canAfford && !card.isCooldown) {
                state.push(1);
            } else {
                state.push(0);
            }
        }

        // Total vector length = 45 + 45 + 45 + 1 + 9 = 145
        return state;
    }

    /**
     * Find card index by plant type name
     */
    function _findCardByType(plantType) {
        for (let i = 0; i < _gameState.cards.length; i++) {
            const card = _gameState.cards[i];
            if (card && card.name && card.canAfford && !card.isCooldown) {
                // Match by name (e.g., 'oSunFlower' matches 'Sunflower' or 'Sun')
                if (card.name.toLowerCase().includes(plantType.replace('o', '').toLowerCase())) {
                    return i;
                }
            }
        }
        return -1;
    }

    /**
     * Get valid actions based on current state
     */
    function _getValidActions() {
        const valid = [];

        // Plant actions (for each affordable card)
        _gameState.cards.forEach((card, cardIndex) => {
            if (card.canAfford && !card.isCooldown) {
                for (let col = 1; col <= 9; col++) {
                    const actionCode = cardIndex * 9 + (col - 1);
                    if (actionCode < 98) {
                        valid.push(actionCode);
                    }
                }
            }
        });

        // Collect suns (if any)
        if (_gameState.suns.length > 0) {
            valid.push(98);
        }

        // Wait is always valid
        valid.push(99);

        return valid;
    }

    /**
     * Execute the selected action
     */
    function _executeAction(action) {
        let reward = 0;

        // Collect suns
        if (action === 98) {
            if (_gameState.suns.length > 0) {
                _gameFrame.contentWindow.postMessage({ action: 'collectAllSuns' }, '*');
                reward = _gameState.suns.length * 2;
                log(`☀️ Collected ${_gameState.suns.length} suns (+${reward})`);
            }
            return reward;
        }

        // Wait
        if (action === 99) {
            log('⏳ Waiting...');
            return -1; // Small penalty for waiting
        }

        // Plant action
        const cardIndex = Math.floor(action / 9);
        const col = (action % 9) + 1;
        const card = _gameState.cards[cardIndex];

        if (!card) {
            return -5; // Invalid card
        }

        // Find best row for this plant
        const row = _selectBestRow(card, col);

        if (row > 0) {
            // Place plant
            _gameFrame.contentWindow.postMessage({
                action: 'placePlant',
                cardIndex: cardIndex,
                row: row,
                col: col
            }, '*');

            _plantsPlaced++;
            
            // Calculate comprehensive plant reward
            if (typeof AIRewards !== 'undefined') {
                const plantReward = AIRewards.calculatePlantReward(card.name, row, col, _gameState);
                reward = plantReward.reward;
                log(`🌱 Placed ${card.name} at (${row}, ${col})`);
                plantReward.reasons.forEach(r => log(`   ${r}`));
            } else {
                reward = _calculatePlantReward(card, row, col);
                log(`🌱 Placed ${card.name} at (${row}, ${col}) (+${reward})`);
            }
        } else {
            reward = -2; // Couldn't place
        }

        return reward;
    }

    /**
     * Select best row to place plant
     */
    function _selectBestRow(card, col) {
        const rows = [1, 2, 3, 4, 5];
        let bestRow = 0;
        let bestScore = -Infinity;

        for (const row of rows) {
            // Check if cell is empty
            const hasPlant = _gameState.plants.some(p => p.row === row && p.col === col);
            if (hasPlant) continue;

            let score = 0;

            // Prioritize rows with zombies for attack plants
            const rowZombies = _gameState.zombies.filter(z => z.row === row);
            if (rowZombies.length > 0 && card.name && !card.name.includes('Sun')) {
                score += rowZombies.length * 10;
            }

            // Prioritize rows without sunflowers for sunflower placement
            if (card.name && card.name.includes('Sun') && col <= 2) {
                const hasSunflower = _gameState.plants.some(p => 
                    p.row === row && p.name && p.name.includes('Sun')
                );
                if (!hasSunflower) score += 20;
            }

            // Prioritize front rows for defense
            if (card.name && (card.name.includes('Nut') || card.name.includes('Wall'))) {
                score += (9 - col) * 2;
            }

            if (score > bestScore) {
                bestScore = score;
                bestRow = row;
            }
        }

        // Default to first empty row
        if (bestRow === 0) {
            for (const row of rows) {
                const hasPlant = _gameState.plants.some(p => p.row === row && p.col === col);
                if (!hasPlant) {
                    bestRow = row;
                    break;
                }
            }
        }

        return bestRow;
    }

    /**
     * Calculate reward for placing a plant
     */
    function _calculatePlantReward(card, row, col) {
        let reward = 5; // Base reward

        // Sunflower in back = good
        if (card.name && card.name.includes('Sun') && col <= 2) {
            reward += 10;
        }

        // Attack plant in row with zombies = good
        const rowZombies = _gameState.zombies.filter(z => z.row === row);
        if (rowZombies.length > 0 && card.name && !card.name.includes('Sun')) {
            reward += rowZombies.length * 5;
        }

        // Defense in front of zombies = good
        if (card.name && card.name.includes('Nut')) {
            const nearestZombie = Math.min(...rowZombies.map(z => z.col), 10);
            if (col < nearestZombie) reward += 15;
        }

        return reward;
    }

    /**
     * Handle game end
     */
    function _onGameEnd(won, stats) {
        log(won ? '🎉 VICTORY!' : '💀 DEFEAT');

        // Use detailed stats from game if available
        const gameStats = stats || {};
        const zombiesKilledTotal = gameStats.zombiesKilled || _zombiesKilled;
        const plantsPlacedTotal = gameStats.plantsPlaced || _plantsPlaced;
        const level = gameStats.level || 0;

        log(`📊 Stats: Level ${level}, Zombies killed: ${zombiesKilledTotal}, Plants: ${plantsPlacedTotal}`);

        // Final experience with game outcome reward
        if (_lastAction) {
            const finalReward = won ? AIRewards.REWARDS.WIN_GAME : AIRewards.REWARDS.LOSE_GAME;
            AIMemory.storeExperience(_lastAction.state, _lastAction.action, finalReward, [], true);
            log(`🏆 Final reward: ${finalReward}`);
        }

        // Record detailed episode
        AIMemory.recordEpisode(won, _episodeReward, zombiesKilledTotal, plantsPlacedTotal, {
            level: level,
            sunCollected: gameStats.sunCollected || 0,
            finalSun: gameStats.finalSun || 0
        });

        // Train on episode experience
        _agent.train().then(loss => {
            log(`📚 Post-game training, loss: ${loss.toFixed(4)}`);
            _agent.save(); // Auto-save after game
        });

        _updateModal();
        
        // Handle post-game behavior
        if (won) {
            // Stop AI on victory (level complete)
            log('✅ Level complete! AI stopping.');
            stop();
        } else if (_isActive) {
            // Auto-restart on defeat if AI is still active
            log('🔄 Retrying level in 3 seconds...');
            setTimeout(() => {
                if (_isActive) {
                    // Reset episode counters
                    _episodeReward = 0;
                    _plantsPlaced = 0;
                    _zombiesKilled = 0;
                    _lastAction = null;
                    _prevGameState = null;
                    
                    // Trigger level restart via game
                    _gameFrame.contentWindow.postMessage({ action: 'restartLevel' }, '*');
                }
            }, 3000);
        }
    }

    /**
     * Log message
     */
    function log(message) {
        const entry = {
            time: new Date().toLocaleTimeString(),
            message: message
        };
        _actionLog.push(entry);
        
        if (_actionLog.length > 50) {
            _actionLog = _actionLog.slice(-50);
        }

        console.log(`[AIPlayer] ${message}`);
    }

    /**
     * Update modal display
     */
    function _updateModal() {
        if (typeof AIModal !== 'undefined' && _agent) {
            AIModal.update({
                state: _currentState,
                qValues: _agent.getQValues(_currentState),
                thinking: _lastThinking || 'Thinking...',
                log: _actionLog,
                stats: {
                    epsilon: _agent.epsilon,
                    experienceCount: _agent.memory.length
                },
                gameState: _gameState
            });
        }
    }

    /**
     * Get current status
     */
    function getStatus() {
        return {
            isActive: _isActive,
            isPaused: _isPaused,
            episodeReward: _episodeReward,
            plantsPlaced: _plantsPlaced
        };
    }

    /**
     * Get action log
     */
    function getLog() {
        return _actionLog;
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init,
        start,
        stop,
        togglePause,
        setSpeed,
        getStatus,
        getLog
    };
})();
