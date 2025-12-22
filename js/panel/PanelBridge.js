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
            levelName: getLevelName()
        };

        window.parent.postMessage(stats, '*');
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

        // === DEBUG LOGS ===
        console.group('[PanelBridge] Map Data Update');
        console.log('📊 oS.R (rows):', rows);
        console.log('📊 Lane Flags (oGd.$LF):', JSON.stringify(laneFlags));
        console.log('🌱 Plants found:', plants.length);
        if (plants.length > 0) {
            console.table(plants.map(p => ({ name: p.name, row: p.row, col: p.col, image: p.image ? '✅' : '❌' })));
        }
        console.log('🧟 Zombies found:', zombies.length);
        if (zombies.length > 0) {
            console.table(zombies.map(z => ({ name: z.name, row: z.row, col: z.col, image: z.image ? '✅' : '❌' })));
        }
        console.log('🚜 Lawnmowers:', lawnmowers.map(l => `R${l.row}`).join(', ') || 'None');
        console.groupEnd();
        // === END DEBUG ===

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
            console.log('[PanelBridge] 🌱 $P keys:', Object.keys($P).length);
            
            for (let key in $P) {
                const plant = $P[key];
                if (!plant || plant.R === undefined || plant.C === undefined) continue;
                
                // Skip lawnmowers and cleaners
                const ename = plant.EName || '';
                if (ename.includes('Cleaner') || ename.includes('LawnCleaner') || ename.includes('PoolCleaner')) {
                    console.log(`[Plant] Skipping cleaner: ${ename}`);
                    continue;
                }

                // Try multiple methods to get image
                let imageSrc = '';
                
                // Method 1a: Direct EleBody.src
                if (plant.EleBody && plant.EleBody.src) {
                    imageSrc = plant.EleBody.src;
                }
                // Method 1b: Query from Ele
                if (!imageSrc && plant.Ele && plant.Ele.querySelector) {
                    const img = plant.Ele.querySelector('img:not([src*="shadow"])');
                    if (img && img.src) imageSrc = img.src;
                }
                // Method 1c: Construct from EName (oSunFlower -> SunFlower)
                if (!imageSrc && ename) {
                    const plantName = ename.startsWith('o') ? ename.substring(1) : ename;
                    imageSrc = `images/Plants/${plantName}/${plantName}.gif`;
                }

                // DEBUG: Show raw plant data
                const displayName = plant.CName || (ename.startsWith('o') ? ename.substring(1) : ename) || 'Plant';
                console.log(`[Plant] ${displayName}: R=${plant.R}, C=${plant.C}, Image=${imageSrc ? '✅' : '❌'}`);

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
            console.log('[PanelBridge] 🧟 $Z keys:', Object.keys($Z).length);
            
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

                // DEBUG: Show raw zombie data
                console.log(`[Zombie] ${zombieName}: X=${x.toFixed(0)}px → Col ${col}, R=${zombie.R}, HP=${zombie.HP}`);

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
                    console.log(`[Lawnmower] ${ename}: R=${item.R} (from $P)`);
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

    console.log('[PanelBridge] Initialized - Ready to communicate with parent panel');
})();
