/**
 * AI Memory - Experience Replay Storage
 * Stores game experiences for learning and improvement
 * @version 1.0.0
 */

const AIMemory = (function() {
    'use strict';

    const STORAGE_KEY = 'PVZ_AI_MEMORY';
    const MAX_EXPERIENCES = 1000;
    const MAX_EPISODES = 100;

    // Memory structure
    let _experiences = [];
    let _episodeHistory = [];
    let _statistics = {
        gamesPlayed: 0,
        gamesWon: 0,
        totalReward: 0,
        bestScore: 0,
        learningRate: 0.1,
        epsilon: 0.9
    };

    /**
     * Initialize memory from localStorage
     */
    function init() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                _experiences = data.experiences || [];
                _episodeHistory = data.episodes || [];
                _statistics = { ..._statistics, ...data.statistics };
                console.log('[AIMemory] Loaded', _experiences.length, 'experiences');
            }
        } catch (e) {
            console.error('[AIMemory] Load error:', e);
        }
    }

    /**
     * Save memory to localStorage
     */
    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                experiences: _experiences.slice(-MAX_EXPERIENCES),
                episodes: _episodeHistory.slice(-MAX_EPISODES),
                statistics: _statistics
            }));
        } catch (e) {
            console.error('[AIMemory] Save error:', e);
        }
    }

    /**
     * Store an experience tuple (state, action, reward, nextState, done)
     */
    function storeExperience(state, action, reward, nextState, done) {
        _experiences.push({
            state: state,
            action: action,
            reward: reward,
            nextState: nextState,
            done: done,
            timestamp: Date.now()
        });

        // Trim old experiences
        if (_experiences.length > MAX_EXPERIENCES) {
            _experiences = _experiences.slice(-MAX_EXPERIENCES);
        }

        _statistics.totalReward += reward;
    }

    /**
     * Sample random batch for training
     */
    function sampleBatch(batchSize = 32) {
        if (_experiences.length < batchSize) {
            return _experiences.slice();
        }
        
        const batch = [];
        const indices = new Set();
        
        while (indices.size < batchSize) {
            indices.add(Math.floor(Math.random() * _experiences.length));
        }
        
        indices.forEach(i => batch.push(_experiences[i]));
        return batch;
    }

    /**
     * Record episode result with detailed statistics
     */
    function recordEpisode(won, score, zombiesKilled, plantsPlaced, extraStats = {}) {
        _statistics.gamesPlayed++;
        if (won) _statistics.gamesWon++;
        if (score > _statistics.bestScore) _statistics.bestScore = score;

        // Track total zombies killed
        if (!_statistics.totalZombiesKilled) _statistics.totalZombiesKilled = 0;
        _statistics.totalZombiesKilled += zombiesKilled;

        const episode = {
            won: won,
            score: score,
            zombiesKilled: zombiesKilled,
            plantsPlaced: plantsPlaced,
            level: extraStats.level || 0,
            sunCollected: extraStats.sunCollected || 0,
            finalSun: extraStats.finalSun || 0,
            timestamp: Date.now()
        };

        _episodeHistory.push(episode);

        // Track best winning strategy
        if (won && episode.score > (_statistics.bestWinScore || 0)) {
            _statistics.bestWinScore = episode.score;
            _statistics.bestWinZombies = zombiesKilled;
            _statistics.bestWinLevel = episode.level;
        }

        // Calculate win streak
        const recent = _episodeHistory.slice(-10);
        _statistics.recentWins = recent.filter(e => e.won).length;
        _statistics.winStreak = 0;
        for (let i = _episodeHistory.length - 1; i >= 0; i--) {
            if (_episodeHistory[i].won) {
                _statistics.winStreak++;
            } else {
                break;
            }
        }

        // Decay epsilon (explore less as we learn more)
        _statistics.epsilon = Math.max(0.1, _statistics.epsilon * 0.995);

        save();
        console.log(`[AIMemory] Episode recorded: ${won ? 'WIN' : 'LOSS'}, Score: ${score}, Zombies: ${zombiesKilled}`);
    }

    /**
     * Get win rate
     */
    function getWinRate() {
        if (_statistics.gamesPlayed === 0) return 0;
        return (_statistics.gamesWon / _statistics.gamesPlayed * 100).toFixed(1);
    }

    /**
     * Get statistics
     */
    function getStatistics() {
        return {
            ..._statistics,
            winRate: getWinRate(),
            experienceCount: _experiences.length,
            episodeCount: _episodeHistory.length
        };
    }

    /**
     * Get recent episodes
     */
    function getRecentEpisodes(count = 10) {
        return _episodeHistory.slice(-count);
    }

    /**
     * Reset all memory
     */
    function reset() {
        _experiences = [];
        _episodeHistory = [];
        _statistics = {
            gamesPlayed: 0,
            gamesWon: 0,
            totalReward: 0,
            bestScore: 0,
            learningRate: 0.1,
            epsilon: 0.9
        };
        save();
        console.log('[AIMemory] Memory reset');
    }

    // Initialize on load
    init();

    return {
        storeExperience,
        sampleBatch,
        recordEpisode,
        getStatistics,
        getRecentEpisodes,
        reset,
        save
    };
})();
