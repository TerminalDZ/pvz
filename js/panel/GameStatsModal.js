/**
 * Game Stats Widget - Panel Enhancement
 * Shows real-time game stats from the iframe non-intrusively
 * @version 1.2.0
 */

const GameStatsModal = (function() {
    'use strict';

    // State
    let _isOpen = false;
    let _gameData = {
        sunCount: 0,
        uncollectedSun: { count: 0, value: 0 },
        cards: [],
        isPlaying: false,
        levelName: ''
    };
    let _overlay = null;
    let _dragOffsets = { x: 0, y: 0 };
    let _isDragging = false;

    /**
     * Initialize the widget system
     */
    function init() {
        _createWidget();
        _setupMessageListener();
        _setupDragAndDrop();
        console.log('[GameStatsWidget] Initialized');
    }

    /**
     * Create the widget HTML structure
     */
    function _createWidget() {
        // Create container (pass-through overlay)
        _overlay = document.createElement('div');
        _overlay.className = 'game-stats-overlay';
        _overlay.id = 'gameStatsOverlay';
        
        // The widget itself
        _overlay.innerHTML = `
            <div class="game-stats-modal" id="gameStatsModal">
                <div class="game-stats-header" id="gameStatsHeader">
                    <h2>📊 Status</h2>
                    <button class="game-stats-close" onclick="GameStatsModal.close()" title="Close">✕</button>
                </div>
                <div class="game-stats-content" id="gameStatsContent">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <span>Syncing...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);
    }

    /**
     * Setup drag and drop functionality for the widget
     */
    function _setupDragAndDrop() {
        const modal = document.getElementById('gameStatsModal');
        const header = document.getElementById('gameStatsHeader');
        
        if (!modal || !header) return;

        header.addEventListener('mousedown', (e) => {
            _isDragging = true;
            _dragOffsets.x = e.clientX - modal.getBoundingClientRect().left;
            _dragOffsets.y = e.clientY - modal.getBoundingClientRect().top;
            
            // Allow dragging over iframes by temporarily disabling pointer events on them
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
        });

        document.addEventListener('mousemove', (e) => {
            if (!_isDragging) return;

            const x = e.clientX - _dragOffsets.x;
            const y = e.clientY - _dragOffsets.y;

            // Reset bottom/right to auto so top/left take over
            modal.style.bottom = 'auto';
            modal.style.right = 'auto';
            modal.style.left = `${x}px`;
            modal.style.top = `${y}px`;
        });

        document.addEventListener('mouseup', () => {
            if (_isDragging) {
                _isDragging = false;
                // Re-enable iframe interaction
                document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'auto');
            }
        });
    }

    /**
     * Setup message listener to receive game data from iframe
     */
    function _setupMessageListener() {
        window.addEventListener('message', (e) => {
            if (e.data && e.data.action === 'gameStatsUpdate') {
                _gameData = {
                    sunCount: e.data.sunCount || 0,
                    uncollectedSun: e.data.uncollectedSun || { count: 0, value: 0 },
                    cards: e.data.cards || [],
                    isPlaying: e.data.isPlaying || false,
                    levelName: e.data.levelName || ''
                };
                
                if (_isOpen) {
                    _renderContent();
                }

                // Show/hide button based on playing state
                _updateButtonVisibility(e.data.isPlaying);
            }

            // Handle level start/end
            if (e.data && e.data.action === 'levelStart') {
                _updateButtonVisibility(true);
            }

            if (e.data && e.data.action === 'toggleSaveButton') {
                // When menu is visible, hide game stats button
                // But keep visible if we are technically 'playing' but just paused/saved?
                // Actually 'toggleSaveButton' usually means "Manage Profiles" menu open
                _updateButtonVisibility(!e.data.visible);
            }
        });
    }

    /**
     * Update button visibility (Top Bar unified button)
     */
    function _updateButtonVisibility(isPlaying) {
        const btn = document.getElementById('gamePanelBtn');
        if (btn) {
            btn.style.display = isPlaying ? 'flex' : 'none';
        }
    }

    /**
     * Request fresh data from the game iframe
     */
    function _requestGameData() {
        const frame = document.getElementById('gameFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ action: 'requestGameStats' }, '*');
        }
    }

    /**
     * Render the widget content
     */
    function _renderContent() {
        const content = document.getElementById('gameStatsContent');
        if (!content) return;

        // Check if we have valid data
        if (!_gameData.isPlaying && _gameData.cards.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-text">Start a level...</div>
                </div>
            `;
            return;
        }

        // Build cards HTML (Compact)
        let cardsHTML = '';
        if (_gameData.cards.length > 0) {
            cardsHTML = _gameData.cards.map(card => {
                let statusClass = '';
                
                // Determine class based on state
                // Priority: Unaffordable gets Grayscale (as requested)
                // Cooldown gets Darkened
                
                if (!card.canAfford) {
                    statusClass = 'unaffordable'; // Gray
                } else if (card.isCooldown) {
                    statusClass = 'cooldown'; // Dark
                }

                return `
                <div class="card-item ${statusClass}">
                    <img src="${card.image}" alt="${card.name}" title="${card.name} (${card.cost})">
                    <div class="card-cost">${card.cost}</div>
                </div>
                `;
            }).join('');
        } else {
            cardsHTML = `<div class="empty-state-text" style="font-size:10px; opacity:0.6;">No cards</div>`;
        }

        const stats = _gameData.uncollectedSun || { count: 0, value: 0 };
        const totalPotential = _gameData.sunCount + (stats.value || 0);

        content.innerHTML = `
            <!-- Compact Sun Stats Grid -->
            <div class="sun-stats-section">
                <div class="sun-stats-grid">
                    <div class="sun-stat-item">
                        <div class="sun-stat-value">${_gameData.sunCount}</div>
                        <div class="sun-stat-label">Current</div>
                    </div>
                    <div class="sun-stat-item">
                        <div class="sun-stat-value">${stats.count}</div>
                        <div class="sun-stat-label">Uncollected ☀️</div>
                    </div>
                    <div class="sun-stat-item">
                        <div class="sun-stat-value">${stats.value}</div>
                        <div class="sun-stat-label">Worth</div>
                    </div>
                    <div class="sun-stat-item">
                        <div class="sun-stat-value">${totalPotential}</div>
                        <div class="sun-stat-label">Total Potential</div>
                    </div>
                </div>
            </div>

            <!-- Cards ScrollView -->
            <div class="cards-section">
                <div class="cards-section-header">
                    <h3>Plants (${_gameData.cards.length})</h3>
                </div>
                <div class="cards-grid">
                    ${cardsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Open the widget
     */
    function open() {
        if (_isOpen) return;
        
        _isOpen = true;
        _overlay.classList.add('active');
        
        // Request fresh data
        _requestGameData();
        
        // Render immediately if we have data, otherwise loading
        _renderContent();
    }

    /**
     * Close the widget
     */
    function close() {
        if (!_isOpen) return;
        
        _isOpen = false;
        _overlay.classList.remove('active');
    }

    /**
     * Toggle the widget
     */
    function toggle() {
        _isOpen ? close() : open();
    }

    // Public API
    return {
        init,
        open,
        close,
        toggle
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GameStatsModal.init();
});
