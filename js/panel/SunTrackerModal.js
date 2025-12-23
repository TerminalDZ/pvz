/**
 * Sun Tracker Modal - Real-time Sun Position Display
 * Shows coordinates of all uncollected suns on the game field
 * @version 1.0.0
 */

const SunTrackerModal = (function() {
    'use strict';

    // State
    let _isOpen = false;
    let _sunData = [];
    let _overlay = null;
    let _updateInterval = null;
    let _isDragging = false;
    let _dragOffsets = { x: 0, y: 0 };

    /**
     * Initialize the widget
     */
    function init() {
        _createWidget();
        _setupMessageListener();
        _setupDragAndDrop();
        console.log('[SunTrackerModal] Initialized');
    }

    /**
     * Create widget HTML structure
     */
    function _createWidget() {
        _overlay = document.createElement('div');
        _overlay.className = 'sun-tracker-overlay';
        _overlay.id = 'sunTrackerOverlay';
        
        _overlay.innerHTML = `
            <div class="sun-tracker-modal" id="sunTrackerModal">
                <div class="sun-tracker-header" id="sunTrackerHeader">
                    <h2>☀️ Sun Tracker <span class="sun-count-badge" id="sunCountBadge">0</span></h2>
                    <button class="sun-tracker-close" onclick="SunTrackerModal.close()" title="Close">✕</button>
                </div>
                <div class="sun-tracker-content" id="sunTrackerContent">
                    <div class="sun-loading">
                        <div class="sun-loading-spinner"></div>
                        <span>Scanning...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);
    }

    /**
     * Setup drag and drop
     */
    function _setupDragAndDrop() {
        const modal = document.getElementById('sunTrackerModal');
        const header = document.getElementById('sunTrackerHeader');
        
        if (!modal || !header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('sun-tracker-close')) return;
            
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
     * Setup message listener
     */
    function _setupMessageListener() {
        window.addEventListener('message', (e) => {
            if (e.data && e.data.action === 'sunTrackerUpdate') {
                _sunData = e.data.suns || [];
                
                if (_isOpen) {
                    _renderSunList();
                }

                // Update badge even when closed
                const badge = document.getElementById('sunCountBadge');
                if (badge) badge.textContent = _sunData.length;
            }

            // Show/hide based on game state
            if (e.data && e.data.action === 'sunTrackerVisibility') {
                _updateButtonVisibility(e.data.visible);
            }
        });
    }

    /**
     * Update button visibility
     */
    function _updateButtonVisibility(visible) {
        const btn = document.getElementById('sunTrackerBtn');
        if (btn) {
            btn.style.display = visible ? 'flex' : 'none';
        }
    }

    /**
     * Request fresh data
     */
    function _requestSunData() {
        const frame = document.getElementById('gameFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ action: 'requestSunTracker' }, '*');
        }
    }

    /**
     * Render the sun list
     */
    function _renderSunList() {
        const content = document.getElementById('sunTrackerContent');
        const badge = document.getElementById('sunCountBadge');
        
        if (!content) return;

        // Update badge
        if (badge) badge.textContent = _sunData.length;

        // No suns
        if (_sunData.length === 0) {
            content.innerHTML = `
                <div class="sun-empty-state">
                    <div class="sun-empty-icon">🌤️</div>
                    <span>No uncollected suns</span>
                </div>
            `;
            return;
        }

        // Build sun list
        let sunsHTML = _sunData.map((sun, index) => {
            const valueText = sun.value ? `(${sun.value})` : '';
            return `
                <div class="sun-item" onclick="SunTrackerModal.collectSun('${sun.id}')">
                    <div class="sun-icon">☀️</div>
                    <div class="sun-info">
                        <div class="sun-coords">X: ${sun.x} | Y: ${sun.y}</div>
                        <div class="sun-value">${valueText} ${sun.size || ''}</div>
                    </div>
                    <button class="sun-collect-btn" title="Collect">🖱️</button>
                </div>
            `;
        }).join('');

        // Total value
        const totalValue = _sunData.reduce((sum, s) => sum + (s.value || 25), 0);

        content.innerHTML = `
            <div class="sun-summary">
                <span class="sun-total-count">${_sunData.length} suns</span>
                <span class="sun-total-value">≈ ${totalValue} total</span>
            </div>
            <div class="sun-list">
                ${sunsHTML}
            </div>
            <button class="sun-collect-all-btn" onclick="SunTrackerModal.collectAll()">
                🌟 Collect All
            </button>
        `;
    }

    /**
     * Collect a specific sun
     */
    function collectSun(sunId) {
        const frame = document.getElementById('gameFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({
                action: 'collectSun',
                sunId: sunId
            }, '*');
        }
    }

    /**
     * Collect all suns
     */
    function collectAll() {
        const frame = document.getElementById('gameFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ action: 'collectAllSuns' }, '*');
        }
    }

    /**
     * Open the widget
     */
    function open() {
        if (_isOpen) return;
        
        _isOpen = true;
        _overlay.classList.add('active');
        
        _requestSunData();
        
        // Update frequently for real-time tracking
        _updateInterval = setInterval(() => {
            _requestSunData();
        }, 300);
    }

    /**
     * Close the widget
     */
    function close() {
        if (!_isOpen) return;
        
        _isOpen = false;
        _overlay.classList.remove('active');
        
        if (_updateInterval) {
            clearInterval(_updateInterval);
            _updateInterval = null;
        }
    }

    /**
     * Toggle the widget
     */
    function toggle() {
        _isOpen ? close() : open();
    }

    return {
        init,
        open,
        close,
        toggle,
        collectSun,
        collectAll
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    SunTrackerModal.init();
});
