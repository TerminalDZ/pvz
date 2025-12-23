/**
 * AI Brain - Helper for Action Decoding and Initialization
 * @version 1.0.0
 */

const AIBrain = (function() {
    'use strict';

    /**
     * Initialize AIBrain
     */
    function init() {
        console.log('[AIBrain] Initialized');
        // AIPlayer handles the agent initialization, so we don't need to do much here
        // unless we want to coordinate something.
    }

    /**
     * Decode action index into human readable string
     * @param {number} action - Action index (0-99)
     * @returns {string} Description
     */
    function decodeAction(action) {
        if (action === 98) return 'Collect Suns';
        if (action === 99) return 'Wait';

        // 9 columns, so every 9 actions is a new card index
        // action = cardIndex * 9 + (col - 1)
        const cardIndex = Math.floor(action / 9);
        const col = (action % 9) + 1;

        return `Plant #${cardIndex + 1} at Col ${col}`;
    }

    return {
        init,
        decodeAction
    };
})();
