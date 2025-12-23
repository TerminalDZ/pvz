/**
 * Deep Q-Network Agent
 * Professional AI brain using TensorFlow.js
 * Implements DQN with Experience Replay and Target Networks
 * @version 2.0.0
 */

class DQNAgent {
    constructor(inputSize, outputSize, config = {}) {
        this.inputSize = inputSize;
        this.outputSize = outputSize;

        // Hyperparameters
        this.gamma = config.gamma || 0.99;            // Discount factor
        this.epsilon = config.epsilon || 1.0;         // Exploration rate
        this.epsilonMin = config.epsilonMin || 0.05;  // Minimum exploration
        this.epsilonDecay = config.epsilonDecay || 0.995;
        this.learningRate = config.learningRate || 0.001;
        this.batchSize = config.batchSize || 64;

        // Memory (Experience Replay)
        this.memory = [];
        this.maxMemory = config.maxMemory || 10000;

        // Networks
        this.model = null;        // Prediction network
        this.targetModel = null;  // Target network (stable)

        // Initialization
        this.initialized = false;
    }

    /**
     * Initialize the agent and models
     */
    async init() {
        if (typeof tf === 'undefined') {
            console.error('TensorFlow.js not loaded!');
            return;
        }

        this.model = this._createModel();
        this.targetModel = this._createModel();

        // Compile models
        const optimizer = tf.train.adam(this.learningRate);
        this.model.compile({
            optimizer: optimizer,
            loss: 'meanSquaredError'
        });
        // Target model doesn't need compilation for training, just weight updates

        this.initialized = true;
        console.log(`[DQNAgent] Initialized with input=${this.inputSize}, output=${this.outputSize}`);
    }

    /**
     * Create the Neural Network architecture
     */
    _createModel() {
        const model = tf.sequential();

        // Input Layer + Hidden 1
        model.add(tf.layers.dense({
            units: 128,
            inputShape: [this.inputSize],
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }));

        // Hidden 2
        model.add(tf.layers.dense({
            units: 128,
            activation: 'relu',
            kernelInitializer: 'heNormal'
        }));

        // Output Layer (Linear activation for Q-values)
        model.add(tf.layers.dense({
            units: this.outputSize,
            activation: 'linear'
        }));

        return model;
    }

    /**
     * Save model to local storage or file
     */
    async save(name = 'pvz-dqn-model') {
        if (!this.initialized) return;
        await this.model.save(`localstorage://${name}`);
        console.log('[DQNAgent] Model saved');
    }

    /**
     * Load model
     */
    async load(name = 'pvz-dqn-model') {
        try {
            const loadedModel = await tf.loadLayersModel(`localstorage://${name}`);
            this.model = loadedModel;
            // Compile loaded model
            this.model.compile({
                optimizer: tf.train.adam(this.learningRate),
                loss: 'meanSquaredError'
            });
            // Update target model
            this.updateTargetModel();
            console.log('[DQNAgent] Model loaded successfully');

            // Lower exploration if loading a trained model
            this.epsilon = 0.3;
        } catch (e) {
            console.warn('[DQNAgent] No saved model found, starting fresh');
        }
    }

    /**
     * Update target model weights
     */
    updateTargetModel() {
        if (!this.initialized) return;
        this.targetModel.setWeights(this.model.getWeights());
    }

    /**
     * Store experience in replay memory
     */
    remember(state, action, reward, nextState, done) {
        if (this.memory.length >= this.maxMemory) {
            this.memory.shift();
        }
        this.memory.push({ state, action, reward, nextState, done });
    }

    /**
     * Predict action for a given state
     * @returns {number} Action index
     */
    predict(state, validActions = []) {
        if (!this.initialized) return 0;

        // Exploration (Random Action)
        if (Math.random() <= this.epsilon) {
            if (validActions.length > 0) {
                return validActions[Math.floor(Math.random() * validActions.length)];
            }
            return Math.floor(Math.random() * this.outputSize);
        }

        // Exploitation (Model Prediction)
        return tf.tidy(() => {
            const input = tf.tensor2d([state], [1, this.inputSize]);
            const output = this.model.predict(input);
            const values = output.dataSync(); // Sync retrieval is okay for 1 item

            // If validActions provided, mask invalid ones
            if (validActions.length > 0) {
                let bestAction = validActions[0];
                let bestValue = -Infinity;

                for (const action of validActions) {
                    if (values[action] > bestValue) {
                        bestValue = values[action];
                        bestAction = action;
                    }
                }
                return bestAction;
            }

            return output.argMax(1).dataSync()[0];
        });
    }

    /**
     * Get Q-values for visualization
     */
    getQValues(state) {
        if (!this.initialized) return [];
        return tf.tidy(() => {
            const input = tf.tensor2d([state], [1, this.inputSize]);
            return Array.from(this.model.predict(input).dataSync());
        });
    }

    /**
     * Train the model using a batch from memory
     * @returns {number} Loss value
     */
    async train() {
        if (this.memory.length < this.batchSize || !this.initialized) return 0;

        // Sample batch
        const batch = [];
        for (let i = 0; i < this.batchSize; i++) {
            const index = Math.floor(Math.random() * this.memory.length);
            batch.push(this.memory[index]);
        }

        // Convert to tensors
        const states = tf.tensor2d(batch.map(exp => exp.state));
        const nextStates = tf.tensor2d(batch.map(exp => exp.nextState));

        // Calculate Target Q-Values (Double DQN Logic could be implemented here, using simple DQN for now)
        const targetQs = this.targetModel.predict(nextStates);
        const targetQValues = targetQs.dataSync();

        // Create target arrays
        const currentQs = this.model.predict(states);
        const currentQData = currentQs.arraySync(); // Get as JS array to modify

        for (let i = 0; i < this.batchSize; i++) {
            const { action, reward, done } = batch[i];

            // Bellman Equation: Q(s,a) = r + gamma * max(Q(s', a'))
            let target = reward;
            if (!done) {
                // Find max Q for next state
                let maxNextQ = -Infinity;
                const startIdx = i * this.outputSize;
                for (let j = 0; j < this.outputSize; j++) {
                    const val = targetQValues[startIdx + j];
                    if (val > maxNextQ) maxNextQ = val;
                }
                target += this.gamma * maxNextQ;
            }

            // Update just the executed action in the target vector
            currentQData[i][action] = target;
        }

        const targetTensor = tf.tensor2d(currentQData);

        // Train
        const h = await this.model.fit(states, targetTensor, {
            batchSize: this.batchSize,
            epochs: 1,
            verbose: 0
        });

        const loss = h.history.loss[0];

        // Cleanup tensors
        states.dispose();
        nextStates.dispose();
        targetQs.dispose();
        currentQs.dispose();
        targetTensor.dispose();

        // Decay epsilon
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }

        return loss;
    }
}
