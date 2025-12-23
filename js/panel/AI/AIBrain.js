/**
 * AI Brain - Neural Network with Q-Learning
 * Decision making engine for the AI player
 * @version 1.0.0
 */

const AIBrain = (function() {
    'use strict';

    // Network configuration
    const INPUT_SIZE = 50;   // State features
    const HIDDEN_SIZE = 64;  // Hidden layer neurons
    const OUTPUT_SIZE = 100; // Possible actions (10 cards × 9 cols + collect + wait)

    // Learning parameters
    const GAMMA = 0.95;      // Discount factor
    const LEARNING_RATE = 0.001;

    // Network weights (randomly initialized)
    let _weightsIH = [];  // Input → Hidden
    let _weightsHO = [];  // Hidden → Output
    let _biasH = [];
    let _biasO = [];

    // Decision log for visualization
    let _decisionLog = [];
    let _currentQValues = [];
    let _lastThinking = '';

    /**
     * Initialize neural network weights
     */
    function init() {
        // Xavier initialization
        const initWeight = (rows, cols) => {
            const scale = Math.sqrt(2 / (rows + cols));
            return Array(rows).fill(0).map(() => 
                Array(cols).fill(0).map(() => (Math.random() * 2 - 1) * scale)
            );
        };

        _weightsIH = initWeight(INPUT_SIZE, HIDDEN_SIZE);
        _weightsHO = initWeight(HIDDEN_SIZE, OUTPUT_SIZE);
        _biasH = Array(HIDDEN_SIZE).fill(0).map(() => Math.random() * 0.1);
        _biasO = Array(OUTPUT_SIZE).fill(0).map(() => Math.random() * 0.1);

        console.log('[AIBrain] Neural network initialized');
    }

    /**
     * ReLU activation
     */
    function relu(x) {
        return Math.max(0, x);
    }

    /**
     * Forward pass through network
     */
    function forward(state) {
        // Ensure state is correct size
        const input = Array(INPUT_SIZE).fill(0);
        for (let i = 0; i < Math.min(state.length, INPUT_SIZE); i++) {
            input[i] = state[i] || 0;
        }

        // Hidden layer
        const hidden = _biasH.map((b, j) => {
            let sum = b;
            for (let i = 0; i < INPUT_SIZE; i++) {
                sum += input[i] * _weightsIH[i][j];
            }
            return relu(sum);
        });

        // Output layer (Q-values)
        const output = _biasO.map((b, k) => {
            let sum = b;
            for (let j = 0; j < HIDDEN_SIZE; j++) {
                sum += hidden[j] * _weightsHO[j][k];
            }
            return sum;
        });

        _currentQValues = output;
        return output;
    }

    /**
     * Select action using epsilon-greedy
     */
    function selectAction(state, epsilon = 0.1, validActions = []) {
        const qValues = forward(state);
        
        // Exploration
        if (Math.random() < epsilon) {
            if (validActions.length > 0) {
                const action = validActions[Math.floor(Math.random() * validActions.length)];
                logDecision('EXPLORE', action, qValues[action]);
                return action;
            }
            const action = Math.floor(Math.random() * OUTPUT_SIZE);
            logDecision('EXPLORE', action, qValues[action]);
            return action;
        }

        // Exploitation - find best valid action
        let bestAction = 0;
        let bestValue = -Infinity;

        const searchActions = validActions.length > 0 ? validActions : Array.from({length: OUTPUT_SIZE}, (_, i) => i);
        
        for (const action of searchActions) {
            if (qValues[action] > bestValue) {
                bestValue = qValues[action];
                bestAction = action;
            }
        }

        logDecision('EXPLOIT', bestAction, bestValue);
        return bestAction;
    }

    /**
     * Train on batch of experiences
     */
    function train(experiences) {
        if (experiences.length === 0) return 0;

        let totalLoss = 0;

        for (const exp of experiences) {
            // Current Q-values
            const currentQ = forward(exp.state);
            
            // Target Q-value
            let targetQ = exp.reward;
            if (!exp.done) {
                const nextQ = forward(exp.nextState);
                targetQ += GAMMA * Math.max(...nextQ);
            }

            // Error
            const error = targetQ - currentQ[exp.action];
            totalLoss += error * error;

            // Simple gradient update (backprop)
            updateWeights(exp.state, exp.action, error);
        }

        return totalLoss / experiences.length;
    }

    /**
     * Update weights via gradient descent
     */
    function updateWeights(state, action, error) {
        const input = Array(INPUT_SIZE).fill(0);
        for (let i = 0; i < Math.min(state.length, INPUT_SIZE); i++) {
            input[i] = state[i] || 0;
        }

        // Compute hidden activations
        const hidden = _biasH.map((b, j) => {
            let sum = b;
            for (let i = 0; i < INPUT_SIZE; i++) {
                sum += input[i] * _weightsIH[i][j];
            }
            return relu(sum);
        });

        // Update output weights for this action
        for (let j = 0; j < HIDDEN_SIZE; j++) {
            _weightsHO[j][action] += LEARNING_RATE * error * hidden[j];
        }
        _biasO[action] += LEARNING_RATE * error;

        // Update hidden weights (simplified)
        for (let j = 0; j < HIDDEN_SIZE; j++) {
            if (hidden[j] > 0) { // ReLU gradient
                const grad = error * _weightsHO[j][action];
                for (let i = 0; i < INPUT_SIZE; i++) {
                    _weightsIH[i][j] += LEARNING_RATE * grad * input[i] * 0.1;
                }
                _biasH[j] += LEARNING_RATE * grad * 0.1;
            }
        }
    }

    /**
     * Log decision for visualization
     */
    function logDecision(type, action, value) {
        const actionDesc = decodeAction(action);
        _lastThinking = `${type}: ${actionDesc} (Q=${value.toFixed(2)})`;
        
        _decisionLog.push({
            type: type,
            action: action,
            actionDesc: actionDesc,
            qValue: value,
            timestamp: Date.now()
        });

        // Keep log manageable
        if (_decisionLog.length > 100) {
            _decisionLog = _decisionLog.slice(-100);
        }
    }

    /**
     * Decode action index to description
     */
    function decodeAction(action) {
        if (action === 98) return 'COLLECT_SUNS';
        if (action === 99) return 'WAIT';
        
        const cardIndex = Math.floor(action / 9);
        const col = (action % 9) + 1;
        return `Plant card ${cardIndex} at col ${col}`;
    }

    /**
     * Encode action from parameters
     */
    function encodeAction(type, cardIndex = 0, row = 1, col = 1) {
        if (type === 'collect') return 98;
        if (type === 'wait') return 99;
        if (type === 'plant') return cardIndex * 9 + (col - 1);
        return 99; // Default wait
    }

    /**
     * Get current Q-values for visualization
     */
    function getQValues() {
        return _currentQValues;
    }

    /**
     * Get decision log
     */
    function getDecisionLog() {
        return _decisionLog;
    }

    /**
     * Get last thinking string
     */
    function getLastThinking() {
        return _lastThinking;
    }

    /**
     * Get network weights for visualization
     */
    function getNetworkInfo() {
        return {
            inputSize: INPUT_SIZE,
            hiddenSize: HIDDEN_SIZE,
            outputSize: OUTPUT_SIZE,
            weightsIH: _weightsIH,
            weightsHO: _weightsHO
        };
    }

    // Initialize
    init();

    return {
        forward,
        selectAction,
        train,
        encodeAction,
        decodeAction,
        getQValues,
        getDecisionLog,
        getLastThinking,
        getNetworkInfo,
        init
    };
})();
