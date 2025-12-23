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
        plantCount: 0,
        shovelAvailable: false // Track if shovel is available in level
    };
    let _overlay = null;
    let _updateInterval = null;
    let _isDragging = false;
    let _dragOffsets = { x: 0, y: 0 };
    let _isPlantingMode = false; // Whether a card is selected for placement
    let _isShovelMode = false; // Whether shovel mode is active

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
                    <div class="map-header-actions">
                        <button class="map-shovel-btn" id="mapShovelBtn" onclick="GameMapModal.toggleShovel()" title="Shovel - Remove Plants">🪏</button>
                        <button class="game-map-close" onclick="GameMapModal.close()" title="Close">✕</button>
                    </div>
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

                // Add planting mode class and click handler for valid cells (land/water, col 1-9)
                const isPlantable = (cellClass === 'land' || cellClass === 'water') && col >= 1 && col <= 9;
                const hasPlant = plantsHere.length > 0;
                
                // Determine cell mode classes
                let modeClass = '';
                if (_isShovelMode && hasPlant) {
                    modeClass = 'shovelable';
                } else if (_isPlantingMode && isPlantable) {
                    modeClass = 'plantable';
                }
                
                const clickHandler = isPlantable ? `onclick="GameMapModal.onCellClick(${row}, ${col}, event)"` : '';
                
                rowsHTML += `<div class="map-cell ${cellClass} ${modeClass}" data-row="${row}" data-col="${col}" ${clickHandler}>${cellContent}</div>`;
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

    /**
     * Set planting mode (called by GameStatsModal when card is selected)
     */
    function setPlantingMode(enabled) {
        _isPlantingMode = enabled;
        if (_isOpen) {
            _renderMap(); // Re-render to update cell styles
        }
    }

    /**
     * Handle cell click for plant placement or shovel
     */
    function onCellClick(row, col, event) {
        // Handle shovel mode
        if (_isShovelMode) {
            console.log('[GameMapModal] Shoveling at row:', row, 'col:', col);
            
            // Send message to game iframe to remove the plant
            const frame = document.getElementById('gameFrame');
            if (frame && frame.contentWindow) {
                frame.contentWindow.postMessage({
                    action: 'shovelPlant',
                    row: row,
                    col: col
                }, '*');
            }
            return;
        }
        
        // Handle planting mode
        if (!_isPlantingMode) {
            console.log('[GameMapModal] Not in planting mode');
            return;
        }
        
        // Get selected card from GameStatsModal
        if (typeof GameStatsModal === 'undefined' || !GameStatsModal.getSelectedCard) {
            console.error('[GameMapModal] GameStatsModal not available');
            return;
        }
        
        const selection = GameStatsModal.getSelectedCard();
        if (!selection) {
            console.log('[GameMapModal] No card selected');
            return;
        }
        
        console.log('[GameMapModal] Placing plant:', selection.card.name, 'at row:', row, 'col:', col);
        
        // Send message to game iframe to place the plant
        const frame = document.getElementById('gameFrame');
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage({
                action: 'placePlant',
                cardIndex: selection.index,
                row: row,
                col: col
            }, '*');
        }
        
        // Clear the selection after attempting placement
        GameStatsModal.clearSelection();
    }

    /**
     * Toggle shovel mode
     */
    function toggleShovel() {
        _isShovelMode = !_isShovelMode;
        
        // Update button visual
        const btn = document.getElementById('mapShovelBtn');
        if (btn) {
            btn.classList.toggle('active', _isShovelMode);
        }
        
        // Clear planting mode if enabling shovel
        if (_isShovelMode && _isPlantingMode) {
            _isPlantingMode = false;
            if (typeof GameStatsModal !== 'undefined' && GameStatsModal.clearSelection) {
                GameStatsModal.clearSelection();
            }
        }
        
        console.log('[GameMapModal] Shovel mode:', _isShovelMode ? 'ON' : 'OFF');
        
        // Re-render map to update cell styles
        if (_isOpen) {
            _renderMap();
        }
    }

    /**
     * Disable shovel mode (called externally)
     */
    function disableShovel() {
        if (_isShovelMode) {
            _isShovelMode = false;
            const btn = document.getElementById('mapShovelBtn');
            if (btn) btn.classList.remove('active');
            if (_isOpen) _renderMap();
        }
    }

    return {
        init,
        open,
        close,
        toggle,
        setPlantingMode,
        onCellClick,
        toggleShovel,
        disableShovel
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    GameMapModal.init();
});
