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

                    <!-- Neural Network Visualization -->
                    <div class="ai-network-box">
                        <div class="ai-section-title">🔮 Neural Network</div>
                        <canvas id="aiNetworkCanvas" width="300" height="120"></canvas>
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
        _drawNetwork();
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
            _drawNetwork(data.state);
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
            const desc = AIBrain.decodeAction(item.index);
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

    /**
     * Draw neural network visualization
     */
    function _drawNetwork(state = []) {
        const canvas = document.getElementById('aiNetworkCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        // Network layers
        const layers = [
            { nodes: 8, x: 40, label: 'Input' },     // Show 8 input nodes
            { nodes: 6, x: 130, label: 'Hidden' },   // Show 6 hidden nodes
            { nodes: 4, x: 220, label: 'Output' }    // Show 4 output nodes
        ];

        // Draw connections (simplified)
        ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.lineWidth = 1;

        for (let l = 0; l < layers.length - 1; l++) {
            const layer1 = layers[l];
            const layer2 = layers[l + 1];

            for (let i = 0; i < layer1.nodes; i++) {
                for (let j = 0; j < layer2.nodes; j++) {
                    const y1 = (H / (layer1.nodes + 1)) * (i + 1);
                    const y2 = (H / (layer2.nodes + 1)) * (j + 1);

                    ctx.beginPath();
                    ctx.moveTo(layer1.x, y1);
                    ctx.lineTo(layer2.x, y2);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        for (const layer of layers) {
            for (let i = 0; i < layer.nodes; i++) {
                const y = (H / (layer.nodes + 1)) * (i + 1);
                
                // Node activation (from state if input layer)
                let activation = 0.5;
                if (layer.label === 'Input' && state[i] !== undefined) {
                    activation = state[i];
                }

                const green = Math.round(100 + activation * 155);
                ctx.fillStyle = `rgb(50, ${green}, 50)`;
                
                ctx.beginPath();
                ctx.arc(layer.x, y, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#4caf50';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = '#8b949e';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(layer.label, layer.x, H - 5);
        }
    }

    /**
     * Reset all learning
     */
    function resetLearning() {
        if (confirm('Reset all AI learning? This cannot be undone.')) {
            AIMemory.reset();
            AIBrain.init();
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
