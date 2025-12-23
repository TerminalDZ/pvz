/**
 * AI Knowledge Base - Game Fundamentals & Plant/Zombie Properties
 * Pre-loaded knowledge to help AI make better initial decisions
 * @version 1.0.0
 */

const AIKnowledge = (function() {
    'use strict';

    // ============================================
    // GAME FUNDAMENTALS
    // ============================================

    const GAME_RULES = {
        // Game objective
        objective: 'Prevent zombies from reaching the left side of the lawn',
        loseCondition: 'Zombie eats brain (reaches left edge)',
        winCondition: 'Survive all zombie waves',

        // Sun economy
        startingSun: 50,
        sunValue: 25,        // Each sun pickup
        sunfallInterval: 10, // Seconds between natural sun drops

        // Grid
        rows: 5,
        cols: 9,
        
        // Strategy basics
        priorities: [
            '1. Build economy first (sunflowers)',
            '2. Cover all lanes with shooters',
            '3. Use defenses when zombies get close',
            '4. Use instant kills for emergencies',
            '5. Collect sun ASAP before it disappears'
        ]
    };

    // ============================================
    // PLANT KNOWLEDGE - Basic Plants
    // ============================================

    const PLANTS = {
        // === ECONOMY PLANT ===
        'oSunFlower': {
            name: 'Sunflower',
            cost: 50,
            role: 'economy',
            damage: 0,
            health: 300,
            cooldown: 7.5,
            produces: 25,         // Sun every 24 seconds
            productionRate: 24,
            
            // Strategy guide
            strategy: {
                placement: 'Place in columns 1-2 (back rows)',
                priority: 'HIGHEST - Build 5-6 sunflowers early',
                timing: 'First 2-3 plants should be sunflowers',
                avoid: 'Never place in columns 5-9 (too close to zombies)'
            },
            
            // Best practices
            tips: [
                'Plant 5-6 sunflowers before first zombie wave',
                'Each sunflower pays for itself in 48 seconds',
                'Protect with Wall-nuts when under attack',
                'One sunflower per row in early game'
            ]
        },

        // === BASIC ATTACK PLANT ===
        'oPeashooter': {
            name: 'Peashooter',
            cost: 100,
            role: 'attack',
            damage: 20,           // Per pea
            health: 300,
            cooldown: 7.5,
            fireRate: 1.5,        // Shots per second (approx)
            range: 'horizontal',  // Full row
            
            strategy: {
                placement: 'Place in columns 3-5 (mid-field)',
                priority: 'MEDIUM - Basic lane defense',
                timing: 'After 1-2 sunflowers',
                synergy: 'Works great with Snow Pea (slow + damage)'
            },
            
            tips: [
                'One per lane ensures basic coverage',
                'Stack 2 per lane for tough zombies',
                'Place behind Wall-nuts for protection',
                'Kills normal zombie in ~7 seconds'
            ],
            
            // Damage calculations
            killTime: {
                normalZombie: 7,      // seconds
                coneheadZombie: 14,
                bucketheadZombie: 35
            }
        },

        // === INSTANT KILL PLANT ===
        'oCherryBomb': {
            name: 'Cherry Bomb',
            cost: 150,
            role: 'instant',
            damage: 1800,          // MASSIVE - kills almost anything
            health: 0,             // Dies on use
            cooldown: 50,          // Long cooldown
            radius: 1,             // 3x3 area
            
            strategy: {
                placement: 'Place directly ON zombie groups',
                priority: 'EMERGENCY - Use when overwhelmed',
                timing: 'Save for large groups (3+ zombies)',
                avoid: 'Do NOT waste on single normal zombies'
            },
            
            tips: [
                'Wait for zombies to group up',
                'Excellent for killing tough zombies cheaply',
                'Can save a lane in emergency',
                'Long cooldown - use wisely'
            ],
            
            // Best use cases
            idealTargets: [
                'Group of 3+ zombies',
                'Gargantuar',
                'Emergency lane defense'
            ]
        }
    };

    // ============================================
    // ZOMBIE KNOWLEDGE - Basic Zombies
    // ============================================

    const ZOMBIES = {
        // === BASIC ZOMBIE ===
        'oZombie': {
            name: 'Zombie',
            health: 270,
            speed: 1.6,
            damage: 100,           // Per bite
            biteInterval: 1,       // Seconds
            threatLevel: 1,        // 1-10 scale
            
            strategy: {
                counter: 'Single Peashooter',
                priority: 'LOW',
                weakness: 'Very weak to any damage'
            },
            
            tips: [
                'Dies to ~14 peas',
                'Any attack plant can handle it',
                'No special abilities'
            ]
        },

        'oZombie2': {
            name: 'Zombie (Variant)',
            health: 270,
            speed: 1.6,
            damage: 100,
            biteInterval: 1,
            threatLevel: 1,
            
            strategy: {
                counter: 'Single Peashooter',
                priority: 'LOW',
                note: 'Same as normal zombie, different sprite'
            }
        },

        'oZombie3': {
            name: 'Zombie (Variant 2)',
            health: 270,
            speed: 1.6,
            damage: 100,
            biteInterval: 1,
            threatLevel: 1,
            
            strategy: {
                counter: 'Single Peashooter',
                priority: 'LOW',
                note: 'Same stats as normal zombie'
            }
        },

        // === CONEHEAD ZOMBIE ===
        'oConeheadZombie': {
            name: 'Conehead Zombie',
            health: 640,           // 270 base + 370 cone
            speed: 1.6,
            damage: 100,
            biteInterval: 1,
            threatLevel: 3,
            ornament: 'Cone',
            ornamentHP: 370,
            
            strategy: {
                counter: '2 Peashooters or Snow Pea + Peashooter',
                priority: 'MEDIUM',
                weakness: 'Cone falls off after taking ~18 peas'
            },
            
            tips: [
                'Takes ~2.4x damage of normal zombie',
                'Consider using Wall-nut to slow',
                'Snow Pea is very effective',
                'After cone falls, treat as normal zombie'
            ]
        }
    };

    // ============================================
    // STRATEGIC KNOWLEDGE
    // ============================================

    const STRATEGIES = {
        // Opening strategy
        opening: [
            { action: 'Plant sunflower', col: 1, priority: 1 },
            { action: 'Plant sunflower', col: 1, priority: 2 },
            { action: 'Plant peashooter in threatened lane', col: 3, priority: 3 },
            { action: 'Plant sunflower', col: 1, priority: 4 },
            { action: 'Cover all lanes with peashooters', priority: 5 }
        ],

        // Column priorities
        columnPriorities: {
            1: 'sunflower',       // Best for economy
            2: 'sunflower',       // Good for economy
            3: 'attack',          // Main attack lane
            4: 'attack',          // Secondary attack
            5: 'defense',         // Wall-nut position
            6: 'emergency',       // Potato Mine, Squash
            7: 'emergency',       // Last resort
            8: 'instant',         // Cherry Bomb zone
            9: 'danger'           // Too close
        },

        // When to use each plant type
        timing: {
            sunflower: {
                early: true,      // First 2-3 minutes
                when: 'Always first, aim for 5-6 total',
                stopWhen: 'Have 6 sunflowers OR heavy zombie pressure'
            },
            peashooter: {
                early: true,
                when: 'After 1-2 sunflowers',
                aim: 'One per lane minimum'
            },
            cherryBomb: {
                early: false,
                when: 'EMERGENCY: Multiple zombies about to eat plants',
                save: 'Until truly needed'
            }
        }
    };

    // ============================================
    // DECISION HELPER FUNCTIONS
    // ============================================

    /**
     * Get recommended action based on game state
     */
    function getRecommendation(gameState) {
        const { sun, plants, zombies, cards } = gameState;
        
        // Count sunflowers
        const sunflowers = plants.filter(p => 
            p.name && (p.name.includes('Sun') || p.name.includes('Flower'))
        ).length;

        // Check lane coverage
        const coveredLanes = new Set(plants.filter(p => 
            p.name && !p.name.includes('Sun')
        ).map(p => p.row));

        // Find threatened lanes
        const threatenedLanes = zombies.filter(z => z.col <= 5)
            .map(z => z.row);

        // Decision logic
        if (sunflowers < 5 && sun >= 50 && threatenedLanes.length === 0) {
            return {
                action: 'plant',
                plant: 'oSunFlower',
                col: 1,
                reason: 'Need more economy'
            };
        }

        if (threatenedLanes.length > 0) {
            const uncoveredThreat = threatenedLanes.find(r => !coveredLanes.has(r));
            if (uncoveredThreat && sun >= 100) {
                return {
                    action: 'plant',
                    plant: 'oPeashooter',
                    row: uncoveredThreat,
                    col: 3,
                    reason: 'Defend threatened lane'
                };
            }
        }

        if (coveredLanes.size < 5 && sun >= 100) {
            const uncoveredRow = [1,2,3,4,5].find(r => !coveredLanes.has(r));
            return {
                action: 'plant',
                plant: 'oPeashooter',
                row: uncoveredRow,
                col: 3,
                reason: 'Cover empty lane'
            };
        }

        return {
            action: 'wait',
            reason: 'Saving sun / waiting for opportunity'
        };
    }

    /**
     * Get plant info by name
     */
    function getPlant(name) {
        return PLANTS[name] || null;
    }

    /**
     * Get zombie info by name
     */
    function getZombie(name) {
        return ZOMBIES[name] || null;
    }

    /**
     * Get ideal column for plant type
     */
    function getIdealColumn(plantRole) {
        switch(plantRole) {
            case 'economy': return 1;
            case 'attack': return 3;
            case 'defense': return 5;
            case 'instant': return 6;
            default: return 3;
        }
    }

    /**
     * Estimate time to kill zombie with given plants
     */
    function estimateKillTime(zombie, plantsInLane) {
        const zombieHP = ZOMBIES[zombie]?.health || 270;
        let totalDPS = 0;

        plantsInLane.forEach(p => {
            const plant = PLANTS[p.name];
            if (plant && plant.damage > 0) {
                totalDPS += plant.damage * (plant.fireRate || 1);
            }
        });

        return totalDPS > 0 ? zombieHP / totalDPS : Infinity;
    }

    /**
     * Get all known plants
     */
    function getAllPlants() {
        return PLANTS;
    }

    /**
     * Get all known zombies
     */
    function getAllZombies() {
        return ZOMBIES;
    }

    /**
     * Get game rules
     */
    function getRules() {
        return GAME_RULES;
    }

    /**
     * Get strategies
     */
    function getStrategies() {
        return STRATEGIES;
    }

    console.log('[AIKnowledge] Knowledge base loaded');

    return {
        PLANTS,
        ZOMBIES,
        GAME_RULES,
        STRATEGIES,
        getRecommendation,
        getPlant,
        getZombie,
        getIdealColumn,
        estimateKillTime,
        getAllPlants,
        getAllZombies,
        getRules,
        getStrategies
    };
})();
