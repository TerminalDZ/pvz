/**
 * Panel Bridge - Communication between game and parent panel
 * Handles requests for game stats and sends data to parent window
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Listen for requests from parent panel
    window.addEventListener('message', function(e) {
        if (!e.data) return;

        // Handle stats request from parent
        if (e.data.action === 'requestGameStats') {
            sendGameStats();
        }

        // Handle map request from parent
        if (e.data.action === 'requestGameMap') {
            sendGameMap();
        }

        // Handle plant placement request from parent
        if (e.data.action === 'placePlant') {
            placePlantAtCell(e.data.cardIndex, e.data.row, e.data.col);
        }

        // Handle shovel (plant removal) request from parent
        if (e.data.action === 'shovelPlant') {
            shovelPlantAtCell(e.data.row, e.data.col);
        }
    });

    /**
     * Collect and send current game stats to parent
     */
    function sendGameStats() {
        if (!window.parent) return;

        const stats = {
            action: 'gameStatsUpdate',
            sunCount: getSunCount(),
            uncollectedSun: getUncollectedSunCount(),
            cards: getSelectedCards(),
            isPlaying: isGamePlaying(),
            levelName: getLevelName(),
            isSunFree: isSunFreeLevel()
        };

        window.parent.postMessage(stats, '*');
    }

    /**
     * Check if current level doesn't use sun (Wall-nut Bowling, I Zombie, etc.)
     */
    function isSunFreeLevel() {
        if (typeof oS === 'undefined') return false;
        
        // ProduceSun = false means no sun production (I,Zombie, Vasebreaker, etc.)
        if (oS.ProduceSun === false) return true;
        
        // StaticCard = 0 means dynamic cards (Wall-nut Bowling style)
        if (oS.StaticCard === 0) return true;
        
        // CardKind = 1 means zombie cards (I, Zombie mode)
        if (oS.CardKind === 1) return true;
        
        // Check if sun counter is hidden (via DOM)
        const sunNumEl = document.getElementById('dSunNum');
        if (sunNumEl && (sunNumEl.style.display === 'none' || sunNumEl.style.visibility === 'hidden')) {
            return true;
        }
        
        return false;
    }

    /**
     * Get current sun count
     */
    function getSunCount() {
        // Try to get from oS object
        if (typeof oS !== 'undefined' && oS.SunNum !== undefined) {
            return oS.SunNum;
        }
        
        // Fallback: read from DOM
        const sunEl = document.getElementById('sSunNum');
        if (sunEl) {
            return parseInt(sunEl.textContent || sunEl.innerText || '0', 10);
        }
        
        return 0;
    }

    /**
     * Get uncollected sun count (sun floating on screen)
     * Detects: <img id="Sun0.xxx" src="images/interface/Sun.webp">
     */
    function getUncollectedSunCount() {
        let totalCount = 0;
        let totalValue = 0;

        // Method 1: Count from ArSun array (holds sun objects with value)
        if (typeof ArSun !== 'undefined' && Array.isArray(ArSun)) {
            for (let i = 0; i < ArSun.length; i++) {
                if (ArSun[i]) {
                    totalCount++;
                    // Sun value is typically 25 or 50
                    if (ArSun[i].Sun) {
                        totalValue += ArSun[i].Sun;
                    } else {
                        totalValue += 25; // Default sun value
                    }
                }
            }
        }

        // Method 2: Count from DOM - img elements with ID starting with "Sun"
        // Pattern: <img id="Sun0.3192810910074616" src="images/interface/Sun.webp">
        const sunElements = document.querySelectorAll('img[id^="Sun"]');
        if (sunElements.length > 0) {
            // If DOM count is higher, use that instead
            if (sunElements.length > totalCount) {
                totalCount = sunElements.length;
                totalValue = totalCount * 25; // Most sun is worth 25
            }
        }

        // Return object with both count and value
        return {
            count: totalCount,
            value: totalValue
        };
    }

    /**
     * Get selected cards info
     */
    function getSelectedCards() {
        const cards = [];
        
        // Try to get from ArCard array (game's card system)
        if (typeof ArCard !== 'undefined' && Array.isArray(ArCard)) {
            for (let i = 0; i < ArCard.length; i++) {
                const card = ArCard[i];
                if (!card) continue;

                const proto = card.PName ? card.PName.prototype : null;
                if (!proto) continue;

                // Check cooldown status
                let isCooldown = false;
                const cardEl = document.getElementById(card.DID);
                if (cardEl) {
                    const img = cardEl.querySelector('img');
                    if (img && img.style.filter && img.style.filter.includes('grayscale(1)')) {
                        // Original game uses grayscale for cooldown too, but we will trust
                        // our sun check for the affordability part.
                        // If we have enough sun but it's gray, it's cooldown.
                        // However, let's keep it simple: if the DOM says gray, it's unavailable.
                        // We will refine this by checking sun manually.
                        isCooldown = true; 
                    }
                }

                // Check affordability specifically
                const sunCost = proto.SunNum || 0;
                const currentSun = getSunCount();
                const canAfford = currentSun >= sunCost;

                // Refine cooldown: if we can afford it but it's disabled, it MUST be cooldown
                // If we can't afford it, it's definitely unaffordable, but might also be on cooldown.
                // For UI purposes:
                // - Unaffordable takes precedence for "Gray" look requested by user? 
                //   Actually user said: "change color depending on whether sun is sufficient ... gray or not"
                //   So Affordability is the key for the Grayscale look.
                
                cards.push({
                    name: proto.CName || proto.EName || 'Unknown',
                    image: proto.PicArr ? proto.PicArr[proto.CardGif || 0] : '',
                    cost: sunCost,
                    canAfford: canAfford,
                    isCooldown: isCooldown && canAfford // Only mark as cooldown if we can afford it (to distinguish states)
                });
            }
        } else {
            // Fallback: try to read from dCardList DOM
            const cardList = document.getElementById('dCardList');
            if (cardList) {
                const cardDivs = cardList.querySelectorAll('[id^="dCard"]');
                cardDivs.forEach(function(div) {
                    const img = div.querySelector('img');
                    const costSpan = div.querySelector('span[id^="sSunNum"]');
                    const sunCost = costSpan ? parseInt(costSpan.textContent || '0', 10) : 0;
                    const currentSun = getSunCount();
                    
                    if (img) {
                        const isGray = img.style.filter && img.style.filter.includes('grayscale(1)');
                        const canAfford = currentSun >= sunCost;
                        
                        cards.push({
                            name: div.id.replace('dCard', '').replace('o', ''),
                            image: img.src,
                            cost: sunCost,
                            canAfford: canAfford,
                            isCooldown: isGray && canAfford
                        });
                    }
                });
            }
        }

        return cards;
    }

    /**
     * Check if game is currently playing (not in menu)
     */
    function isGamePlaying() {
        // Check oS.Lvl - 0 means menu
        if (typeof oS !== 'undefined') {
            return oS.Lvl !== 0 && oS.Lvl !== '0';
        }
        return false;
    }

    /**
     * Get current level name
     */
    function getLevelName() {
        if (typeof oS !== 'undefined' && oS.LevelName) {
            return oS.LevelName;
        }
        return '';
    }

    // ============================================
    // PLANT PLACEMENT FUNCTIONS
    // ============================================

    /**
     * Place a plant at the specified cell from modal UI
     * @param {number} cardIndex - Index in ArCard array
     * @param {number} row - Grid row (1-5 typically)
     * @param {number} col - Grid column (1-9)
     */
    function placePlantAtCell(cardIndex, row, col) {
        console.log('[PanelBridge] placePlantAtCell called:', cardIndex, row, col);
        
        // Validate game state
        if (typeof ArCard === 'undefined' || typeof oS === 'undefined' || typeof oGd === 'undefined') {
            console.error('[PanelBridge] Game objects not available');
            sendPlacementResult(false, 'Game not ready');
            return;
        }
        
        // Get card info
        const card = ArCard[cardIndex];
        if (!card) {
            console.error('[PanelBridge] Invalid card index:', cardIndex);
            sendPlacementResult(false, 'Invalid card');
            return;
        }
        
        const plantConstructor = card.PName;
        const proto = plantConstructor.prototype;
        
        // Check affordability
        const sunCost = proto.SunNum || 0;
        const currentSun = getSunCount();
        const isSunFree = isSunFreeLevel();
        
        if (!isSunFree && currentSun < sunCost) {
            console.log('[PanelBridge] Not enough sun');
            sendPlacementResult(false, 'Not enough sun');
            return;
        }
        
        // Check cooldown (CDReady property on card)
        if (card.CDReady === 0) {
            console.log('[PanelBridge] Card on cooldown');
            sendPlacementResult(false, 'Card on cooldown');
            return;
        }
        
        // Get pixel coordinates
        const pixelX = getPixelX(col);
        const pixelY = getPixelY(row);
        
        if (!pixelX || !pixelY) {
            console.error('[PanelBridge] Invalid coordinates');
            sendPlacementResult(false, 'Invalid position');
            return;
        }
        
        // Get grid slot array for CanGrow check
        const gridSlots = [];
        for (let i = 0; i < 4; i++) {
            const slot = oGd.$[row + '_' + col + '_' + i];
            gridSlots.push(slot || null);
        }
        
        // Check if plant can grow here
        if (typeof proto.CanGrow === 'function' && !proto.CanGrow(gridSlots, row, col)) {
            console.log('[PanelBridge] Cannot grow here');
            sendPlacementResult(false, 'Cannot place here');
            return;
        }
        
        // Place the plant!
        try {
            // Get lane type for audio
            const laneType = oGd.$LF ? oGd.$LF[row] : 1;
            
            // Play placement sound
            if (typeof PlayAudio === 'function') {
                PlayAudio(laneType !== 2 ? 'plant' + Math.floor(1 + Math.random() * 2) : 'plant_water');
            }
            
            // Create the plant
            const plant = new plantConstructor();
            plant.Birth(pixelX, pixelY, row, col, gridSlots[0] || '');
            
            // Deduct sun (if not sun-free level)
            if (!isSunFree) {
                oS.SunNum -= sunCost;
                // Update sun display
                const sunEl = document.getElementById('sSunNum');
                if (sunEl) {
                    sunEl.textContent = oS.SunNum;
                    sunEl.innerText = oS.SunNum;
                }
            }
            
            // Start cooldown
            if (proto.coolTime && typeof DoCoolTimer === 'function') {
                card.CDReady = 0;
                DoCoolTimer(cardIndex, proto.coolTime);
            }
            
            // Show grow soil animation if available
            const growSoil = document.getElementById('imgGrowSoil');
            if (growSoil && typeof SetStyle === 'function' && typeof SetNone === 'function') {
                SetStyle(growSoil, {
                    left: (pixelX - 30) + 'px',
                    top: (pixelY - 40) + 'px',
                    zIndex: 3 * row,
                    visibility: 'visible'
                });
                setTimeout(() => SetNone(growSoil), 200);
            }
            
            console.log('[PanelBridge] Plant placed successfully!');
            sendPlacementResult(true, 'Plant placed');
            
            // Send updated stats after placement
            setTimeout(() => {
                sendGameStats();
                sendGameMap();
            }, 100);
            
        } catch (err) {
            console.error('[PanelBridge] Error placing plant:', err);
            sendPlacementResult(false, 'Placement error: ' + err.message);
        }
    }

    /**
     * Get pixel X coordinate for column
     */
    function getPixelX(col) {
        const mapping = { 1: 187, 2: 267, 3: 347, 4: 427, 5: 507, 6: 587, 7: 667, 8: 747, 9: 827 };
        return mapping[col] || null;
    }

    /**
     * Get pixel Y coordinate for row
     */
    function getPixelY(row) {
        const mapping = { 0: 75, 1: 175, 2: 270, 3: 380, 4: 470, 5: 575 };
        return mapping[row] || null;
    }

    /**
     * Send placement result back to parent
     */
    function sendPlacementResult(success, message) {
        if (window.parent) {
            window.parent.postMessage({
                action: 'plantPlacementResult',
                success: success,
                message: message
            }, '*');
        }
    }

    /**
     * Remove a plant at the specified cell (shovel feature)
     * @param {number} row - Grid row
     * @param {number} col - Grid column
     */
    function shovelPlantAtCell(row, col) {
        console.log('[PanelBridge] shovelPlantAtCell called:', row, col);
        
        // Validate game state
        if (typeof oGd === 'undefined' || typeof $P === 'undefined') {
            console.error('[PanelBridge] Game objects not available for shovel');
            return;
        }
        
        // Find plant at this position
        let plantToRemove = null;
        
        // Search in $P registry for plant at this row/col
        for (let key in $P) {
            const plant = $P[key];
            if (!plant || plant.R === undefined || plant.C === undefined) continue;
            
            // Skip lawnmowers and cleaners
            const ename = plant.EName || '';
            if (ename.includes('Cleaner') || ename.includes('LawnCleaner') || 
                ename.includes('PoolCleaner') || ename.includes('Brains')) {
                continue;
            }
            
            if (plant.R === row && plant.C === col) {
                plantToRemove = plant;
                break;
            }
        }
        
        if (!plantToRemove) {
            console.log('[PanelBridge] No plant found at position:', row, col);
            return;
        }
        
        try {
            // Play shovel sound
            if (typeof PlayAudio === 'function') {
                PlayAudio('plant2');
            }
            
            // Remove the plant by calling Die()
            if (typeof plantToRemove.Die === 'function') {
                plantToRemove.Die();
                console.log('[PanelBridge] Plant removed:', plantToRemove.EName || 'Unknown');
            } else {
                console.error('[PanelBridge] Plant does not have Die() method');
                return;
            }
            
            // Send updated map data after removal
            setTimeout(() => {
                sendGameStats();
                sendGameMap();
            }, 100);
            
        } catch (err) {
            console.error('[PanelBridge] Error shoveling plant:', err);
        }
    }

    // ============================================
    // MAP DATA FUNCTIONS
    // ============================================

    /**
     * Collect and send current game map data to parent
     */
    function sendGameMap() {
        if (!window.parent) return;

        const laneFlags = typeof oGd !== 'undefined' ? oGd.$LF : [];
        const rows = typeof oS !== 'undefined' ? oS.R : 5;
        const plants = getPlantPositions();
        const zombies = getZombiePositions();
        const lawnmowers = getLawnmowerPositions();

        const mapData = {
            action: 'gameMapUpdate',
            rows: rows,
            columns: 9,
            laneFlags: laneFlags,
            plants: plants,
            zombies: zombies,
            lawnmowers: lawnmowers,
            zombieCount: zombies.length,
            plantCount: plants.length
        };

        window.parent.postMessage(mapData, '*');
    }

    /**
     * Get all plant positions with their grid coordinates
     */
    function getPlantPositions() {
        const plants = [];

        // Method 1: Read from $P object (game's plant registry)
        if (typeof $P !== 'undefined') {
            
            for (let key in $P) {
                const plant = $P[key];
                if (!plant || plant.R === undefined || plant.C === undefined) continue;
                
                // Skip non-plant objects: lawnmowers, cleaners, and brains (I,Zombie target)
                const ename = plant.EName || '';
                if (ename.includes('Cleaner') || ename.includes('LawnCleaner') || 
                    ename.includes('PoolCleaner') || ename.includes('Brains')) {
                    continue;
                }

                // Try multiple methods to get image
                let imageSrc = '';
                const plantName = ename.startsWith('o') ? ename.substring(1) : ename;
                
                // Method 1: Direct EleBody.src (current displayed image)
                if (plant.EleBody && plant.EleBody.src) {
                    imageSrc = plant.EleBody.src;
                }
                
                // Method 2: Query from Ele DOM element
                if (!imageSrc && plant.Ele) {
                    const imgs = plant.Ele.querySelectorAll('img:not([src*="shadow"])');
                    if (imgs.length > 0) {
                        // Get the last non-shadow image (usually the main plant image)
                        imageSrc = imgs[imgs.length - 1].src;
                    }
                }
                
                // Method 3: Use PicArr if available (prototype array)
                if (!imageSrc && plant.PicArr && plant.PicArr.length > 0) {
                    // NormalGif index typically points to the animated GIF
                    const gifIndex = plant.NormalGif || 2;
                    if (plant.PicArr[gifIndex]) {
                        imageSrc = plant.PicArr[gifIndex];
                    } else if (plant.PicArr[2]) {
                        imageSrc = plant.PicArr[2];
                    } else if (plant.PicArr[1]) {
                        imageSrc = plant.PicArr[1];
                    }
                }
                
                // Method 4: Construct standard path from EName
                if (!imageSrc && plantName) {
                    imageSrc = `images/Plants/${plantName}/${plantName}.gif`;
                }

                // Get display name
                const displayName = plant.CName || (ename.startsWith('o') ? ename.substring(1) : ename) || 'Plant';

                plants.push({
                    row: plant.R,
                    col: plant.C,
                    name: displayName,
                    image: imageSrc
                });
            }
        }

        // Method 2: Fallback - scan DOM for plant elements
        if (plants.length === 0) {
            const plantElements = document.querySelectorAll('[id^="P_"]');
            plantElements.forEach(el => {
                // Skip lawnmowers
                const imgs = el.querySelectorAll('img');
                let isLawnmower = false;
                let plantImg = null;
                
                imgs.forEach(img => {
                    if (img.src.includes('LawnCleaner')) {
                        isLawnmower = true;
                    } else if (!img.src.includes('shadow')) {
                        plantImg = img;
                    }
                });

                if (isLawnmower || !plantImg) return;

                // Calculate grid position from pixel position
                const left = parseInt(el.style.left) || 0;
                const top = parseInt(el.style.top) || 0;

                const col = pixelToCol(left);
                const row = pixelToRow(top);

                if (col >= 1 && col <= 9 && row >= 1) {
                    plants.push({
                        row: row,
                        col: col,
                        name: extractPlantName(plantImg.src),
                        image: plantImg.src
                    });
                }
            });
        }

        return plants;
    }

    /**
     * Get all zombie positions with their grid coordinates
     */
    function getZombiePositions() {
        const zombies = [];

        // Read from $Z object (game's zombie registry)
        if (typeof $Z !== 'undefined') {
            for (let key in $Z) {
                const zombie = $Z[key];
                if (!zombie || zombie.R === undefined) continue;
                if (zombie.HP <= 0) continue; // Skip dead zombies

                // Calculate column from X position
                const x = zombie.X || zombie.ZX || 0;
                const col = pixelToCol(x);

                // Get zombie name
                const ename = zombie.EName || '';
                const zombieName = ename.startsWith('o') ? ename.substring(1) : (ename || 'Zombie');

                // Try multiple methods to get image
                let imageSrc = '';
                
                // Method 1a: Direct EleBody.src
                if (zombie.EleBody && zombie.EleBody.src) {
                    imageSrc = zombie.EleBody.src;
                }
                // Method 1b: Query from Ele
                if (!imageSrc && zombie.Ele && zombie.Ele.querySelector) {
                    const img = zombie.Ele.querySelector('img:not([src*="shadow"])');
                    if (img && img.src) imageSrc = img.src;
                }
                // Method 1c: Construct from EName
                if (!imageSrc && zombieName) {
                    imageSrc = `images/Zombies/${zombieName}/${zombieName}.gif`;
                }

                zombies.push({
                    row: zombie.R,
                    col: Math.max(0, Math.min(11, col)), // Clamp to valid range
                    name: zombieName,
                    image: imageSrc
                });
            }
        }

        // Method 2: Fallback - scan DOM for zombie elements
        if (zombies.length === 0) {
            const zombieElements = document.querySelectorAll('[id^="Z_"]');
            zombieElements.forEach(el => {
                if (el.style.display === 'none') return;

                const imgs = el.querySelectorAll('img:not([src*="shadow"])');
                const zombieImg = imgs.length > 0 ? imgs[imgs.length - 1] : null;
                if (!zombieImg) return;

                const left = parseInt(el.style.left) || 0;
                const top = parseInt(el.style.top) || 0;

                const col = pixelToCol(left);
                const row = pixelToRow(top);

                if (row >= 1) {
                    zombies.push({
                        row: row,
                        col: Math.max(0, Math.min(11, col)),
                        name: extractZombieName(zombieImg.src),
                        image: zombieImg.src
                    });
                }
            });
        }

        return zombies;
    }

    /**
     * Get lawnmower positions using $P registry (accurate row from R property)
     */
    function getLawnmowerPositions() {
        const lawnmowers = [];

        // Read directly from $P object (same registry as plants)
        if (typeof $P !== 'undefined') {
            for (let key in $P) {
                const item = $P[key];
                if (!item || item.R === undefined) continue;
                
                const ename = item.EName || '';
                if (ename.includes('LawnCleaner') || ename.includes('PoolCleaner') || ename.includes('Cleaner')) {
                    lawnmowers.push({ row: item.R });
                }
            }
        }

        return lawnmowers;
    }

    /**
     * Get total zombie count
     */
    function getZombieCount() {
        if (typeof $Z !== 'undefined') {
            return Object.keys($Z).filter(k => $Z[k] && $Z[k].HP > 0).length;
        }
        return document.querySelectorAll('[id^="Z_"]:not([style*="display: none"])').length;
    }

    /**
     * Get total plant count (excluding lawnmowers)
     */
    function getPlantCount() {
        if (typeof $P !== 'undefined') {
            return Object.keys($P).filter(k => {
                const p = $P[k];
                return p && !(p.EName && (p.EName.includes('Cleaner') || p.EName.includes('LawnCleaner')));
            }).length;
        }
        return 0;
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Convert pixel X to grid column
     */
    function pixelToCol(x) {
        // Column pixel mappings
        const cols = [
            { col: -2, x: -50 }, { col: -1, x: 100 }, { col: 0, x: 140 },
            { col: 1, x: 187 }, { col: 2, x: 267 }, { col: 3, x: 347 },
            { col: 4, x: 427 }, { col: 5, x: 507 }, { col: 6, x: 587 },
            { col: 7, x: 667 }, { col: 8, x: 747 }, { col: 9, x: 827 },
            { col: 10, x: 865 }, { col: 11, x: 950 }
        ];

        // Find closest column
        let closest = cols[0];
        let minDist = Math.abs(x - cols[0].x);

        for (let i = 1; i < cols.length; i++) {
            const dist = Math.abs(x - cols[i].x);
            if (dist < minDist) {
                minDist = dist;
                closest = cols[i];
            }
        }

        return closest.col;
    }

    /**
     * Convert pixel Y to grid row
     * Based on GetY from Cfunction.js:
     * Row 1: Y=175, Row 2: Y=270, Row 3: Y=380, Row 4: Y=470, Row 5: Y=575
     * (Row 0 at Y=75 is typically unused header area)
     */
    function pixelToRow(y) {
        // Active game rows (1-based, matching game's GetY)
        const rows = [
            { row: 1, y: 175 },
            { row: 2, y: 270 },
            { row: 3, y: 380 },
            { row: 4, y: 470 },
            { row: 5, y: 575 },
            { row: 6, y: 670 } // For 6-row pool levels
        ];

        let closest = rows[0];
        let minDist = Math.abs(y - rows[0].y);

        for (let i = 1; i < rows.length; i++) {
            const dist = Math.abs(y - rows[i].y);
            if (dist < minDist) {
                minDist = dist;
                closest = rows[i];
            }
        }

        return closest.row;
    }

    /**
     * Extract plant name from image path
     */
    function extractPlantName(src) {
        const match = src.match(/Plants\/([^\/]+)\//);
        return match ? match[1] : 'Plant';
    }

    /**
     * Extract zombie name from image path
     */
    function extractZombieName(src) {
        const match = src.match(/Zombies\/([^\/]+)\//);
        return match ? match[1] : 'Zombie';
    }

    /**
     * Auto-send stats periodically when playing
     */
    function startAutoSend() {
        setInterval(function() {
            if (isGamePlaying() && window.parent) {
                sendGameStats();
            }
        }, 500); // Update every 500ms
    }

    // Start auto-send when game loads
    if (document.readyState === 'complete') {
        startAutoSend();
    } else {
        window.addEventListener('load', startAutoSend);
    }

    // Expose for debugging
    window.PanelBridge = {
        sendGameStats: sendGameStats,
        sendGameMap: sendGameMap,
        getSunCount: getSunCount,
        getUncollectedSunCount: getUncollectedSunCount,
        getSelectedCards: getSelectedCards,
        isGamePlaying: isGamePlaying,
        getPlantPositions: getPlantPositions,
        getZombiePositions: getZombiePositions
    };
})();
