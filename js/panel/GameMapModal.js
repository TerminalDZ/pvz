/**
 * Game Map Widget - Real-time Grid View
 * Displays a compact, draggable grid map of the current level
 * @version 2.0.0
 */

const GameMapModal = (function() {
    'use strict';

    // State
    let _isOpen = false;
    let _mapData = {
        rows: 5,
        columns: 9,
        laneFlags: [],
        plants: [],
        zombies: [],
        lawnmowers: [],
        zombieCount: 0,
        plantCount: 0
    };
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
        console.log('[GameMapWidget] Initialized');
    }

    /**
     * Create widget HTML structure
     */
    function _createWidget() {
        _overlay = document.createElement('div');
        _overlay.className = 'game-map-overlay';
        _overlay.id = 'gameMapOverlay';
        
        _overlay.innerHTML = `
            <div class="game-map-modal" id="gameMapModal">
                <div class="game-map-header" id="gameMapHeader">
                    <h2>🗺️ Map <span class="plant-badge" id="mapPlantCount">0🌱</span> <span class="stats-badge" id="mapZombieCount">0🧟</span></h2>
                    <button class="game-map-close" onclick="GameMapModal.close()" title="Close">✕</button>
                </div>
                <div class="game-map-content" id="gameMapContent">
                    <div class="map-loading">
                        <div class="map-loading-spinner"></div>
                        <span>Loading...</span>
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
        const modal = document.getElementById('gameMapModal');
        const header = document.getElementById('gameMapHeader');
        
        if (!modal || !header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('game-map-close')) return;
            
            _isDragging = true;
            _dragOffsets.x = e.clientX - modal.getBoundingClientRect().left;
            _dragOffsets.y = e.clientY - modal.getBoundingClientRect().top;
            
            document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
        });

        document.addEventListener('mousemove', (e) => {
            if (!_isDragging) return;

            modal.style.left = `${e.clientX - _dragOffsets.x}px`;
            modal.style.top = `${e.clientY - _dragOffsets.y}px`;
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
            if (e.data && e.data.action === 'gameMapUpdate') {
                _mapData = {
                    rows: e.data.rows || 5,
                    columns: e.data.columns || 9,
                    laneFlags: e.data.laneFlags || [],
                    plants: e.data.plants || [],
                    zombies: e.data.zombies || [],
                    lawnmowers: e.data.lawnmowers || [],
                    zombieCount: e.data.zombieCount || 0,
                    plantCount: e.data.plantCount || 0
                };
                
                if (_isOpen) {
                    _renderMap();
                }
            }

            // Level start
            if (e.data && e.data.action === 'levelStart') {
                _updateButtonVisibility(true);
            }

            // Menu visibility
            if (e.data && e.data.action === 'toggleSaveButton') {
                _updateButtonVisibility(!e.data.visible);
            }
        });
    }

    /**
     * Update button visibility
     */
    function _updateButtonVisibility(isPlaying) {
        const btn = document.getElementById('gamePanelBtn');
        if (btn) {
            btn.style.display = isPlaying ? 'flex' : 'none';
        }
    }

    /**
     * Request fresh data
     */
    function _requestMapData() {
        const frame = document.getElementById('gameFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({ action: 'requestGameMap' }, '*');
        }
    }

    /**
     * Render the grid map
     */
    function _renderMap() {
        const content = document.getElementById('gameMapContent');
        const zombieCountBadge = document.getElementById('mapZombieCount');
        const plantCountBadge = document.getElementById('mapPlantCount');
        
        if (!content) return;

        // Update badges
        if (zombieCountBadge) zombieCountBadge.textContent = `${_mapData.zombieCount}🧟`;
        if (plantCountBadge) plantCountBadge.textContent = `${_mapData.plantCount}🌱`;

        // Get lane flags and find active rows
        const lf = _mapData.laneFlags || [];
        
        // Find which rows are active (LF[row] !== 0)
        // LF array format: [0,0,1,1,1,0] means rows 2,3,4 are active (1=land, 2=water)
        const activeRows = [];
        for (let i = 1; i < lf.length; i++) {
            if (lf[i] !== 0 && lf[i] !== undefined) {
                activeRows.push(i);
            }
        }
        
        // If no LF data, default to rows 1-5
        const minRow = activeRows.length > 0 ? Math.min(...activeRows) : 1;
        const maxRow = activeRows.length > 0 ? Math.max(...activeRows) : 5;
        
        console.log('[GameMapModal] Active rows:', activeRows.join(',') || 'Default 1-5', `(min:${minRow}, max:${maxRow})`);

        // Column headers
        let colHeaderHTML = '<div class="map-grid-header"><div class="map-col-label"></div>';
        for (let col = 0; col <= 11; col++) {
            let colClass = '';
            let label = col.toString();
            if (col === 0) { colClass = 'house'; label = '🏠'; }
            else if (col >= 10) { colClass = 'spawn'; label = '💀'; }
            
            colHeaderHTML += `<div class="map-col-label ${colClass}">${label}</div>`;
        }
        colHeaderHTML += '</div>';

        // Grid rows - only show active rows
        let rowsHTML = '';
        for (let row = minRow; row <= maxRow; row++) {
            const laneType = lf[row];
            // Skip rows with LF = 0 (blocked/unused)
            if (laneType === 0 || laneType === undefined) continue;
            
            let laneClass = 'land';
            let laneIcon = '🌿';
            if (laneType === 2) { laneClass = 'water'; laneIcon = '🌊'; }
            else if (laneType === 3) { laneClass = 'land'; laneIcon = '🪴'; }

            rowsHTML += `<div class="map-grid-row">`;
            rowsHTML += `<div class="map-row-label ${laneClass}">${laneIcon}R${row}</div>`;

            for (let col = 0; col <= 11; col++) {
                let cellClass = laneClass;
                if (col === 0) cellClass = 'house';
                else if (col >= 10) cellClass = 'spawn';
                
                // Find entities
                const plantsHere = _mapData.plants.filter(p => p.row === row && p.col === col);
                const zombiesHere = _mapData.zombies.filter(z => z.row === row && z.col === col);
                const lawnmowerHere = _mapData.lawnmowers.find(l => l.row === row);

                let cellContent = '';
                
                // Lawnmower at column 0
                if (col === 0 && lawnmowerHere) {
                    cellClass = 'lawnmower';
                    cellContent = `<img class="map-entity" src="images/interface/LawnCleaner.png" alt="LM">`;
                }

                // Plants
                if (plantsHere.length === 1) {
                    const p = plantsHere[0];
                    const imgSrc = p.image || `images/Plants/${p.name}/${p.name}.gif`;
                    cellContent += `<img class="map-entity plant" src="${imgSrc}" alt="${p.name}" title="${p.name}" onerror="this.style.display='none'">`;
                } else if (plantsHere.length > 1) {
                    cellContent += `<span class="entity-count" style="background:rgba(76,175,80,0.8);">${plantsHere.length}🌱</span>`;
                }

                // Zombies
                if (zombiesHere.length === 1) {
                    const z = zombiesHere[0];
                    const imgSrc = z.image || `images/Zombies/${z.name}/${z.name}.gif`;
                    cellContent += `<img class="map-entity zombie" src="${imgSrc}" alt="${z.name}" title="${z.name}" onerror="this.style.display='none'">`;
                } else if (zombiesHere.length > 1) {
                    cellContent += `<span class="entity-count" style="background:rgba(139,92,246,0.8);">${zombiesHere.length}🧟</span>`;
                }

                rowsHTML += `<div class="map-cell ${cellClass}">${cellContent}</div>`;
            }

            rowsHTML += `</div>`;
        }

        // Legend
        const legendHTML = `
            <div class="map-legend">
                <div class="legend-item"><div class="legend-color land"></div>Land</div>
                <div class="legend-item"><div class="legend-color water"></div>Water</div>
                <div class="legend-item"><div class="legend-color house"></div>House</div>
                <div class="legend-item"><div class="legend-color spawn"></div>Spawn</div>
            </div>
        `;

        content.innerHTML = `
            <div class="map-grid-container">
                ${colHeaderHTML}
                ${rowsHTML}
            </div>
            ${legendHTML}
        `;
    }

    /**
     * Open the widget
     */
    function open() {
        if (_isOpen) return;
        
        _isOpen = true;
        _overlay.classList.add('active');
        
        _requestMapData();
        
        _updateInterval = setInterval(() => {
            _requestMapData();
        }, 400);
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
        toggle
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    GameMapModal.init();
});
