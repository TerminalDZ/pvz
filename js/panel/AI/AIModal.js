/**
 * AI Modal - Neural Network Visualization & Controls
 * Shows AI thinking process, decision logs, and statistics
 * @version 1.0.0
 */

const AIModal = (function() {
    'use strict';

    let _isOpen = false;
    let _isActive = false;
    let _overlay = null;
    let _updateInterval = null;
    let _isDragging = false;
    let _dragOffsets = { x: 0, y: 0 };

    /**
     * Initialize modal
     */
    function init() {
        _createWidget();
        _setupDragAndDrop();
        console.log('[AIModal] Initialized');
    }

    /**
     * Create modal HTML
     */
    function _createWidget() {
        _overlay = document.createElement('div');
        _overlay.className = 'ai-modal-overlay';
        _overlay.id = 'aiModalOverlay';

        _overlay.innerHTML = `
            <div class="ai-modal" id="aiModal">
                <div class="ai-modal-header" id="aiModalHeader">
                    <h2>🤖 AI Player <span class="ai-status-badge" id="aiStatusBadge">OFF</span></h2>
                    <button class="ai-modal-close" onclick="AIModal.close()">✕</button>
                </div>
                
                <div class="ai-modal-content">
                    <!-- Controls -->
                    <div class="ai-controls">
                        <button class="ai-btn ai-btn-start" id="aiStartBtn" onclick="AIModal.toggleAI()">
                            ▶️ Start AI
                        </button>
                        <button class="ai-btn" onclick="AIPlayer.togglePause()">⏸️</button>
                        <select class="ai-speed-select" onchange="AIPlayer.setSpeed(parseFloat(this.value))">
                            <option value="0.5">0.5x</option>
                            <option value="1" selected>1x</option>
                            <option value="2">2x</option>
                            <option value="4">4x</option>
                        </select>
                        <button class="ai-btn ai-btn-danger" onclick="AIModal.resetLearning()">🗑️ Reset</button>
                    </div>

                    <!-- Stats Grid Row 1 -->
                    <div class="ai-stats-grid" id="aiStatsGrid">
                        <div class="ai-stat ai-stat-win">
                            <div class="ai-stat-value" id="aiGamesWon">0</div>
                            <div class="ai-stat-label">🏆 Wins</div>
                        </div>
                        <div class="ai-stat ai-stat-lose">
                            <div class="ai-stat-value" id="aiGamesLost">0</div>
                            <div class="ai-stat-label">💀 Losses</div>
                        </div>
                        <div class="ai-stat">
                            <div class="ai-stat-value" id="aiWinRate">0%</div>
                            <div class="ai-stat-label">📈 Win Rate</div>
                        </div>
                        <div class="ai-stat">
                            <div class="ai-stat-value" id="aiEpsilon">90%</div>
                            <div class="ai-stat-label">🔍 Explore</div>
                        </div>
                    </div>
                    
                    <!-- Stats Grid Row 2 -->
                    <div class="ai-stats-grid ai-stats-row2">
                        <div class="ai-stat">
                            <div class="ai-stat-value" id="aiTotalKills">0</div>
                            <div class="ai-stat-label">☠️ Total Kills</div>
                        </div>
                        <div class="ai-stat">
                            <div class="ai-stat-value" id="aiWinStreak">0</div>
                            <div class="ai-stat-label">🔥 Streak</div>
                        </div>
                        <div class="ai-stat">
                            <div class="ai-stat-value" id="aiBestScore">0</div>
                            <div class="ai-stat-label">⭐ Best</div>
                        </div>
                        <div class="ai-stat">
                            <div class="ai-stat-value" id="aiExperiences">0</div>
                            <div class="ai-stat-label">🧠 Memories</div>
                        </div>
                    </div>

                    <!-- Current Thinking -->
                    <div class="ai-thinking-box">
                        <div class="ai-section-title">🧠 Current Thinking</div>
                        <div class="ai-thinking" id="aiThinking">Waiting to start...</div>
                    </div>

                    <!-- Loss Graph -->
                    <div class="ai-network-box">
                        <div class="ai-section-title">📉 Loss</div>
                        <canvas id="aiLossCanvas" width="300" height="80"></canvas>
                    </div>

                    <!-- Reward Graph -->
                    <div class="ai-network-box">
                        <div class="ai-section-title">🎁 Average Reward</div>
                        <canvas id="aiRewardCanvas" width="300" height="80"></canvas>
                    </div>

                    <!-- Q-Values Heatmap -->
                    <div class="ai-qvalues-box">
                        <div class="ai-section-title">📊 Action Values (Q)</div>
                        <div class="ai-qvalues" id="aiQValues"></div>
                    </div>

                    <!-- Decision Log -->
                    <div class="ai-log-box">
                        <div class="ai-section-title">📝 Action Log</div>
                        <div class="ai-log" id="aiLog"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);
    }

    /**
     * Setup drag functionality
     */
    function _setupDragAndDrop() {
        const modal = document.getElementById('aiModal');
        const header = document.getElementById('aiModalHeader');

        if (!modal || !header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('ai-modal-close')) return;
            _isDragging = true;
            _dragOffsets.x = e.clientX - modal.getBoundingClientRect().left;
            _dragOffsets.y = e.clientY - modal.getBoundingClientRect().top;
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
        });

        document.addEventListener('mousemove', (e) => {
            if (!_isDragging) return;
            modal.style.left = `${e.clientX - _dragOffsets.x}px`;
            modal.style.top = `${e.clientY - _dragOffsets.y}px`;
            modal.style.right = 'auto';
            modal.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (_isDragging) {
                _isDragging = false;
                document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'auto');
            }
        });
    }

    /**
     * Open modal
     */
    function open() {
        if (_isOpen) return;
        _isOpen = true;
        _overlay.classList.add('active');
        _updateStats();
        _drawGraphs();
    }

    /**
     * Close modal
     */
    function close() {
        if (!_isOpen) return;
        _isOpen = false;
        _overlay.classList.remove('active');
    }

    /**
     * Toggle modal
     */
    function toggle() {
        _isOpen ? close() : open();
    }

    /**
     * Toggle AI on/off
     */
    function toggleAI() {
        if (_isActive) {
            AIPlayer.stop();
        } else {
            AIPlayer.start();
        }
    }

    /**
     * Set AI active status
     */
    function setActive(active) {
        _isActive = active;
        
        const badge = document.getElementById('aiStatusBadge');
        const btn = document.getElementById('aiStartBtn');
        
        if (badge) {
            badge.textContent = active ? 'RUNNING' : 'OFF';
            badge.className = 'ai-status-badge ' + (active ? 'active' : '');
        }
        
        if (btn) {
            btn.innerHTML = active ? '⏹️ Stop AI' : '▶️ Start AI';
            btn.classList.toggle('ai-btn-stop', active);
        }
    }

    /**
     * Update display with new data
     */
    function update(data) {
        if (!_isOpen) return;

        // Stats
        if (data.stats) {
            const gamesWon = data.stats.gamesWon || 0;
            const gamesPlayed = data.stats.gamesPlayed || 0;
            const gamesLost = gamesPlayed - gamesWon;
            
            _setElement('aiGamesWon', gamesWon);
            _setElement('aiGamesLost', gamesLost);
            _setElement('aiWinRate', data.stats.winRate + '%');
            _setElement('aiEpsilon', Math.round((data.stats.epsilon || 0) * 100) + '%');
            _setElement('aiTotalKills', data.stats.totalZombiesKilled || 0);
            _setElement('aiWinStreak', data.stats.winStreak || 0);
            _setElement('aiBestScore', Math.round(data.stats.bestScore || 0));
            _setElement('aiExperiences', data.stats.experienceCount || 0);
            
            // Color code win rate
            const winRateEl = document.getElementById('aiWinRate');
            if (winRateEl) {
                const rate = parseFloat(data.stats.winRate) || 0;
                if (rate >= 50) winRateEl.style.color = '#4caf50';
                else if (rate >= 25) winRateEl.style.color = '#ffc107';
                else winRateEl.style.color = '#f44336';
            }

            // Color code win streak
            const streakEl = document.getElementById('aiWinStreak');
            if (streakEl) {
                const streak = data.stats.winStreak || 0;
                if (streak >= 3) streakEl.style.color = '#ff9800';
                else if (streak >= 1) streakEl.style.color = '#4caf50';
                else streakEl.style.color = '#c9d1d9';
            }
        }

        // Thinking
        if (data.thinking) {
            _setElement('aiThinking', data.thinking);
        }

        // Q-Values visualization
        if (data.qValues) {
            _renderQValues(data.qValues);
        }

        // Log
        if (data.log) {
            _renderLog(data.log);
        }

        // Network
        if (data.state) {
            _drawGraphs(data);
        }
    }

    /**
     * Helper to set element text
     */
    function _setElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /**
     * Update stats display
     */
    function _updateStats() {
        const stats = AIMemory.getStatistics();
        const gamesWon = stats.gamesWon || 0;
        const gamesPlayed = stats.gamesPlayed || 0;
        const gamesLost = gamesPlayed - gamesWon;
        
        _setElement('aiGamesWon', gamesWon);
        _setElement('aiGamesLost', gamesLost);
        _setElement('aiWinRate', stats.winRate + '%');
        _setElement('aiEpsilon', Math.round((stats.epsilon || 0) * 100) + '%');
        _setElement('aiTotalKills', stats.totalZombiesKilled || 0);
        _setElement('aiWinStreak', stats.winStreak || 0);
        _setElement('aiBestScore', Math.round(stats.bestScore || 0));
        _setElement('aiExperiences', stats.experienceCount || 0);
    }

    /**
     * Decode action index to human-readable description
     * Action space: 0-97 = plant (cardIndex * 9 + col-1), 98 = collect suns, 99 = wait
     */
    function _decodeAction(actionIndex) {
        if (actionIndex === 99) return 'Wait';
        if (actionIndex === 98) return 'Collect Suns';
        if (actionIndex >= 0 && actionIndex < 98) {
            const cardIndex = Math.floor(actionIndex / 9);
            const col = (actionIndex % 9) + 1;
            return `Plant ${cardIndex + 1} → Col ${col}`;
        }
        return 'Unknown';
    }

    /**
     * Render Q-values as heatmap
     */
    function _renderQValues(qValues) {
        const container = document.getElementById('aiQValues');
        if (!container || !qValues || qValues.length === 0) return;

        // Show top 5 actions
        const indexed = qValues.map((v, i) => ({ value: v, index: i }));
        indexed.sort((a, b) => b.value - a.value);
        const top = indexed.slice(0, 5);

        let html = '';
        for (const item of top) {
            const desc = _decodeAction(item.index);
            const width = Math.min(100, Math.max(10, (item.value + 50) * 1.5));
            const color = item.value > 0 ? '#4caf50' : '#f44336';
            
            html += `
                <div class="ai-qvalue-row">
                    <span class="ai-qvalue-label">${desc}</span>
                    <div class="ai-qvalue-bar" style="width: ${width}%; background: ${color}">
                        ${item.value.toFixed(1)}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Render action log
     */
    function _renderLog(log) {
        const container = document.getElementById('aiLog');
        if (!container) return;

        const recent = log.slice(-8).reverse();
        container.innerHTML = recent.map(entry => 
            `<div class="ai-log-entry"><span class="ai-log-time">${entry.time}</span> ${entry.message}</div>`
        ).join('');
    }

    // Historical data for graphs
    let _lossHistory = Array(50).fill(0);
    let _rewardHistory = Array(50).fill(0);

    /**
     * Draw real-time graphs
     */
    function _drawGraphs(data) {
        if (data && data.stats) {
            // Update history
            if (data.stats.loss !== undefined) {
                _lossHistory.push(data.stats.loss);
                if (_lossHistory.length > 50) _lossHistory.shift();
            }
            if (data.stats.lastReward !== undefined) {
                _rewardHistory.push(data.stats.lastReward);
                if (_rewardHistory.length > 50) _rewardHistory.shift();
            }
        }

        _drawGraph('aiLossCanvas', _lossHistory, '#f44336', 'Loss');
        _drawGraph('aiRewardCanvas', _rewardHistory, '#4caf50', 'Reward');
    }

    function _drawGraph(canvasId, data, color, label) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        // Background grid
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H/2);
        ctx.lineTo(W, H/2);
        ctx.stroke();

        // Data line
        const max = Math.max(...data, 1);
        const min = Math.min(...data, -1);
        const range = max - min || 1;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        data.forEach((val, i) => {
            const x = (i / (data.length - 1)) * W;
            // Normalize to canvas height (inverted Y)
            const y = H - ((val - min) / range) * (H - 10) - 5;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Last value label
        ctx.fillStyle = '#fff';
        ctx.font = '10px Inter';
        ctx.fillText(`${label}: ${data[data.length-1].toFixed(2)}`, 5, 15);
    }

    /**
     * Reset all learning
     */
    function resetLearning() {
        if (confirm('Reset all AI learning? This cannot be undone.')) {
            AIMemory.reset();
            _updateStats();
            console.log('[AIModal] Learning reset');
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init,
        open,
        close,
        toggle,
        toggleAI,
        setActive,
        update,
        resetLearning
    };
})();
