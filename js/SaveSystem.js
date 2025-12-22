/**
 * PVZ Save System - Professional Game Save Manager
 * Supports: Multiple users, Auto-save, JSON import/export
 * @version 2.0.0
 */

const PVZSaveSystem = (function() {
    'use strict';

    // Storage keys
    const STORAGE_KEY = 'PVZ_GAME_SAVES';
    const CURRENT_USER_KEY = 'PVZ_CURRENT_USER';
    const SETTINGS_KEY = 'PVZ_GLOBAL_SETTINGS';

    // Default save structure
    const DEFAULT_SAVE = {
        version: '2.0.0',
        createdAt: null,
        updatedAt: null,
        profile: {
            username: 'Player',
            avatar: 1,
            playTime: 0
        },
        progress: {
            currentLevel: 1,
            highestLevel: 1,
            completedLevels: [],
            unlockedMiniGames: [],
            achievements: []
        },
        plants: {
            unlocked: ['oPeashooter', 'oSunFlower'],
            upgrades: {}
        },
        currency: {
            sun: 0,
            coins: 0,
            diamonds: 0
        },
        statistics: {
            zombiesKilled: 0,
            plantsPlanted: 0,
            sunCollected: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalPlayTime: 0
        },
        settings: {
            autoCollectSun: false,
            musicVolume: 100,
            sfxVolume: 100,
            muteAll: false,
            gameSpeed: 1,
            language: 'en'
        }
    };

    // Private state
    let _currentUser = null;
    let _saves = {};
    let _autoSaveInterval = null;
    let _sessionStartTime = Date.now();

    /**
     * Initialize the save system
     */
    function init() {
        _loadAllSaves();
        _loadCurrentUser();
        _startAutoSave();
        _trackPlayTime();
        console.log('[PVZ Save System] Initialized successfully');
        return true;
    }

    /**
     * Load all saves from localStorage
     */
    function _loadAllSaves() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            _saves = data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('[PVZ Save System] Error loading saves:', e);
            _saves = {};
        }
    }

    /**
     * Load current user from localStorage
     */
    function _loadCurrentUser() {
        try {
            _currentUser = localStorage.getItem(CURRENT_USER_KEY) || null;
            if (_currentUser && !_saves[_currentUser]) {
                _currentUser = null;
                localStorage.removeItem(CURRENT_USER_KEY);
            }
        } catch (e) {
            console.error('[PVZ Save System] Error loading current user:', e);
            _currentUser = null;
        }
    }

    /**
     * Save all data to localStorage
     */
    function _persistSaves() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_saves));
            return true;
        } catch (e) {
            console.error('[PVZ Save System] Error saving data:', e);
            return false;
        }
    }

    /**
     * Start auto-save interval (every 30 seconds)
     */
    function _startAutoSave() {
        if (_autoSaveInterval) clearInterval(_autoSaveInterval);
        _autoSaveInterval = setInterval(() => {
            if (_currentUser) {
                autoSave();
            }
        }, 30000);
    }

    /**
     * Track play time
     */
    function _trackPlayTime() {
        setInterval(() => {
            if (_currentUser && _saves[_currentUser]) {
                _saves[_currentUser].statistics.totalPlayTime += 1;
                _saves[_currentUser].profile.playTime += 1;
            }
        }, 1000);
    }

    /**
     * Deep merge objects
     */
    function _deepMerge(target, source) {
        const output = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                output[key] = _deepMerge(target[key] || {}, source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    }

    /**
     * Create a new user profile
     * @param {string} username - The username for the new profile
     * @returns {boolean} Success status
     */
    function createUser(username) {
        if (!username || typeof username !== 'string') {
            console.error('[PVZ Save System] Invalid username');
            return false;
        }
        
        const userId = username.toLowerCase().replace(/\s+/g, '_');
        
        if (_saves[userId]) {
            console.warn('[PVZ Save System] User already exists');
            return false;
        }

        const newSave = _deepMerge({}, DEFAULT_SAVE);
        newSave.profile.username = username;
        newSave.createdAt = new Date().toISOString();
        newSave.updatedAt = new Date().toISOString();

        _saves[userId] = newSave;
        _persistSaves();
        
        console.log('[PVZ Save System] User created:', username);
        return true;
    }

    /**
     * Switch to a different user
     * @param {string} username - The username to switch to
     * @returns {boolean} Success status
     */
    function switchUser(username) {
        const userId = username.toLowerCase().replace(/\s+/g, '_');
        
        if (!_saves[userId]) {
            console.error('[PVZ Save System] User not found');
            return false;
        }

        _currentUser = userId;
        localStorage.setItem(CURRENT_USER_KEY, userId);
        _applySettings();
        
        console.log('[PVZ Save System] Switched to user:', username);
        return true;
    }

    /**
     * Delete a user profile
     * @param {string} username - The username to delete
     * @returns {boolean} Success status
     */
    function deleteUser(username) {
        const userId = username.toLowerCase().replace(/\s+/g, '_');
        
        if (!_saves[userId]) {
            console.error('[PVZ Save System] User not found');
            return false;
        }

        delete _saves[userId];
        _persistSaves();

        if (_currentUser === userId) {
            _currentUser = null;
            localStorage.removeItem(CURRENT_USER_KEY);
        }

        console.log('[PVZ Save System] User deleted:', username);
        return true;
    }

    /**
     * Get all users
     * @returns {Array} Array of user objects
     */
    function getAllUsers() {
        return Object.keys(_saves).map(userId => ({
            id: userId,
            username: _saves[userId].profile.username,
            level: _saves[userId].progress.highestLevel,
            playTime: _saves[userId].profile.playTime,
            lastPlayed: _saves[userId].updatedAt
        }));
    }

    /**
     * Get current user data
     * @returns {Object|null} Current user save data
     */
    function getCurrentUser() {
        return _currentUser ? _saves[_currentUser] : null;
    }

    /**
     * Get current username
     * @returns {string|null} Current username
     */
    function getCurrentUsername() {
        return _currentUser ? _saves[_currentUser].profile.username : null;
    }

    /**
     * Apply saved settings to the game
     */
    function _applySettings() {
        if (!_currentUser) return;
        
        const settings = _saves[_currentUser].settings;
        
        // Apply to game variables
        if (typeof oS !== 'undefined') {
            oS.AutoSun = settings.autoCollectSun ? 1 : 0;
        }
        
        // Update checkbox if exists
        const autoSunCheckbox = document.getElementById('cAutoSun');
        if (autoSunCheckbox) {
            autoSunCheckbox.checked = settings.autoCollectSun;
        }

        const silenceCheckbox = document.getElementById('cSilence');
        if (silenceCheckbox) {
            silenceCheckbox.checked = settings.muteAll;
        }
    }

    /**
     * Save current game progress
     * @returns {boolean} Success status
     */
    function saveProgress() {
        if (!_currentUser) {
            console.warn('[PVZ Save System] No user logged in');
            return false;
        }

        const save = _saves[_currentUser];
        
        // Get current level from game
        if (typeof oS !== 'undefined') {
            save.progress.currentLevel = oS.Lvl || 1;
            if (save.progress.currentLevel > save.progress.highestLevel) {
                save.progress.highestLevel = save.progress.currentLevel;
            }
            
            // Save settings
            save.settings.autoCollectSun = oS.AutoSun === 1;
        }

        save.updatedAt = new Date().toISOString();
        _persistSaves();
        
        console.log('[PVZ Save System] Progress saved');
        return true;
    }

    /**
     * Auto-save current progress (silent)
     */
    function autoSave() {
        if (!_currentUser) return false;
        
        const save = _saves[_currentUser];
        if (typeof oS !== 'undefined' && oS.Lvl) {
            save.progress.currentLevel = oS.Lvl;
            if (save.progress.currentLevel > save.progress.highestLevel) {
                save.progress.highestLevel = save.progress.currentLevel;
            }
        }
        save.updatedAt = new Date().toISOString();
        _persistSaves();
        
        return true;
    }

    /**
     * Called when a level is completed successfully
     * @param {number|string} levelId - The completed level ID
     * @param {Object} stats - Level completion stats
     */
    function onLevelComplete(levelId, stats = {}) {
        if (!_currentUser) return false;

        const save = _saves[_currentUser];
        
        // Mark level as completed
        if (!save.progress.completedLevels.includes(levelId)) {
            save.progress.completedLevels.push(levelId);
        }

        // Update highest level
        const numericLevel = parseInt(levelId);
        if (!isNaN(numericLevel) && numericLevel >= save.progress.highestLevel) {
            save.progress.highestLevel = numericLevel + 1;
            save.progress.currentLevel = numericLevel + 1;
        }

        // Update statistics
        save.statistics.gamesWon++;
        save.statistics.gamesPlayed++;
        if (stats.zombiesKilled) save.statistics.zombiesKilled += stats.zombiesKilled;
        if (stats.sunCollected) save.statistics.sunCollected += stats.sunCollected;

        // Add coins reward
        save.currency.coins += stats.coinsEarned || 50;

        save.updatedAt = new Date().toISOString();
        _persistSaves();

        console.log('[PVZ Save System] Level completed and saved:', levelId);
        return true;
    }

    /**
     * Called when a level is failed
     */
    function onLevelFailed() {
        if (!_currentUser) return false;

        const save = _saves[_currentUser];
        save.statistics.gamesLost++;
        save.statistics.gamesPlayed++;
        save.updatedAt = new Date().toISOString();
        _persistSaves();

        return true;
    }

    /**
     * Unlock a new plant
     * @param {string} plantName - The plant EName to unlock
     */
    function unlockPlant(plantName) {
        if (!_currentUser) return false;

        const save = _saves[_currentUser];
        if (!save.plants.unlocked.includes(plantName)) {
            save.plants.unlocked.push(plantName);
            save.updatedAt = new Date().toISOString();
            _persistSaves();
            console.log('[PVZ Save System] Plant unlocked:', plantName);
        }
        return true;
    }

    /**
     * Check if a plant is unlocked
     * @param {string} plantName - The plant EName to check
     * @returns {boolean}
     */
    function isPlantUnlocked(plantName) {
        if (!_currentUser) return true; // Allow all if no user
        return _saves[_currentUser].plants.unlocked.includes(plantName);
    }

    /**
     * Get unlocked plants list
     * @returns {Array}
     */
    function getUnlockedPlants() {
        if (!_currentUser) return [];
        return _saves[_currentUser].plants.unlocked;
    }

    /**
     * Add currency
     * @param {string} type - 'sun', 'coins', or 'diamonds'
     * @param {number} amount - Amount to add
     */
    function addCurrency(type, amount) {
        if (!_currentUser) return false;
        if (!['sun', 'coins', 'diamonds'].includes(type)) return false;

        _saves[_currentUser].currency[type] += amount;
        _persistSaves();
        return true;
    }

    /**
     * Spend currency
     * @param {string} type - 'sun', 'coins', or 'diamonds'
     * @param {number} amount - Amount to spend
     * @returns {boolean} Whether the transaction was successful
     */
    function spendCurrency(type, amount) {
        if (!_currentUser) return false;
        if (!['sun', 'coins', 'diamonds'].includes(type)) return false;

        if (_saves[_currentUser].currency[type] >= amount) {
            _saves[_currentUser].currency[type] -= amount;
            _persistSaves();
            return true;
        }
        return false;
    }

    /**
     * Get currency amount
     * @param {string} type - 'sun', 'coins', or 'diamonds'
     * @returns {number}
     */
    function getCurrency(type) {
        if (!_currentUser) return 0;
        return _saves[_currentUser].currency[type] || 0;
    }

    /**
     * Update a setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    function updateSetting(key, value) {
        if (!_currentUser) return false;
        
        if (_saves[_currentUser].settings.hasOwnProperty(key)) {
            _saves[_currentUser].settings[key] = value;
            _persistSaves();
            _applySettings();
            return true;
        }
        return false;
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {*}
     */
    function getSetting(key) {
        if (!_currentUser) return null;
        return _saves[_currentUser].settings[key];
    }

    /**
     * Export user save to JSON file
     * @param {string} username - Optional specific user to export
     */
    function exportSave(username = null) {
        const userId = username 
            ? username.toLowerCase().replace(/\s+/g, '_')
            : _currentUser;

        if (!userId || !_saves[userId]) {
            console.error('[PVZ Save System] No save to export');
            return false;
        }

        const exportData = {
            exportVersion: '2.0.0',
            exportDate: new Date().toISOString(),
            gameVersion: typeof oS !== 'undefined' ? oS.Version : 'unknown',
            saveData: _saves[userId]
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `PVZ_Save_${_saves[userId].profile.username}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[PVZ Save System] Save exported successfully');
        return true;
    }

    /**
     * Import save from JSON file
     * @returns {Promise<boolean>}
     */
    function importSave() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject('No file selected');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importData = JSON.parse(event.target.result);
                        
                        // Validate import data
                        if (!importData.saveData || !importData.saveData.profile) {
                            throw new Error('Invalid save file format');
                        }

                        // Merge with defaults to ensure all fields exist
                        const saveData = _deepMerge(DEFAULT_SAVE, importData.saveData);
                        const userId = saveData.profile.username.toLowerCase().replace(/\s+/g, '_');

                        // Check for existing user
                        if (_saves[userId]) {
                            if (!confirm(`User "${saveData.profile.username}" already exists. Overwrite?`)) {
                                resolve(false);
                                return;
                            }
                        }

                        _saves[userId] = saveData;
                        _persistSaves();

                        console.log('[PVZ Save System] Save imported successfully');
                        alert('Save imported successfully! You can now switch to this profile.');
                        resolve(true);
                    } catch (error) {
                        console.error('[PVZ Save System] Import error:', error);
                        alert('Failed to import save: ' + error.message);
                        reject(error);
                    }
                };

                reader.onerror = () => {
                    reject('Failed to read file');
                };

                reader.readAsText(file);
            };

            input.click();
        });
    }

    /**
     * Export all saves
     */
    function exportAllSaves() {
        const exportData = {
            exportVersion: '2.0.0',
            exportDate: new Date().toISOString(),
            gameVersion: typeof oS !== 'undefined' ? oS.Version : 'unknown',
            allSaves: _saves
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `PVZ_AllSaves_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[PVZ Save System] All saves exported');
        return true;
    }

    /**
     * Reset current user progress
     * @param {boolean} keepSettings - Whether to keep settings
     */
    function resetProgress(keepSettings = true) {
        if (!_currentUser) return false;

        const settings = keepSettings ? { ..._saves[_currentUser].settings } : null;
        const profile = { ..._saves[_currentUser].profile };
        
        _saves[_currentUser] = _deepMerge({}, DEFAULT_SAVE);
        _saves[_currentUser].profile = profile;
        _saves[_currentUser].createdAt = new Date().toISOString();
        _saves[_currentUser].updatedAt = new Date().toISOString();
        
        if (settings) {
            _saves[_currentUser].settings = settings;
        }

        _persistSaves();
        console.log('[PVZ Save System] Progress reset');
        return true;
    }

    /**
     * Get save statistics
     * @returns {Object}
     */
    function getStatistics() {
        if (!_currentUser) return null;
        return { ..._saves[_currentUser].statistics };
    }

    /**
     * Add an achievement
     * @param {string} achievementId
     */
    function unlockAchievement(achievementId) {
        if (!_currentUser) return false;
        
        if (!_saves[_currentUser].progress.achievements.includes(achievementId)) {
            _saves[_currentUser].progress.achievements.push(achievementId);
            _persistSaves();
            console.log('[PVZ Save System] Achievement unlocked:', achievementId);
            return true;
        }
        return false;
    }

    /**
     * Check if achievement is unlocked
     * @param {string} achievementId
     * @returns {boolean}
     */
    function hasAchievement(achievementId) {
        if (!_currentUser) return false;
        return _saves[_currentUser].progress.achievements.includes(achievementId);
    }

    // Pending game callback for after profile creation
    let _pendingGameCallback = null;

    /**
     * Show profile creation prompt (for first-time users)
     * @param {Function} callback - Called after profile is created
     */
    function showProfileCreationPrompt(callback) {
        _pendingGameCallback = callback;
        
        // Remove existing prompt
        const existingPrompt = document.getElementById('pvz-profile-prompt');
        if (existingPrompt) existingPrompt.remove();

        const promptHTML = `
            <div id="pvz-profile-prompt" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
            ">
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.85);
                "></div>
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: linear-gradient(180deg, #4a3728 0%, #2d1f15 100%);
                    border: 4px solid #ffd700;
                    border-radius: 20px;
                    padding: 40px;
                    z-index: 10000;
                    min-width: 450px;
                    box-shadow: 0 0 50px rgba(255,215,0,0.3);
                    font-family: 'Comic Sans MS', cursive, sans-serif;
                    color: #fff;
                    text-align: center;
                ">
                    <div style="margin-bottom: 25px;">
                        <h2 style="margin: 0 0 10px 0; color: #ffd700; text-shadow: 2px 2px 4px #000; font-size: 28px;">
                            🌻 Welcome to PVZ! 🧟
                        </h2>
                        <p style="margin: 0; color: #aaa; font-size: 14px;">
                            Create a profile to save your progress
                        </p>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <input type="text" id="pvz-first-profile-name" placeholder="Enter your name..." 
                            maxlength="20"
                            style="
                                width: 100%;
                                padding: 15px;
                                border: 3px solid #8b6914;
                                border-radius: 10px;
                                background: #1a1a1a;
                                color: #fff;
                                font-size: 18px;
                                text-align: center;
                                box-sizing: border-box;
                            "
                            onkeypress="if(event.key === 'Enter') document.getElementById('pvz-create-profile-btn').click();"
                        >
                    </div>

                    <button id="pvz-create-profile-btn" onclick="PVZSaveSystem.createFirstProfile()" style="
                        width: 100%;
                        padding: 15px 30px;
                        background: linear-gradient(180deg, #4caf50, #2e7d32);
                        border: 3px solid #1b5e20;
                        border-radius: 10px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 18px;
                        text-shadow: 1px 1px 2px #000;
                        transition: transform 0.1s;
                    " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        🎮 Start Playing!
                    </button>

                    <p style="margin: 20px 0 0 0; color: #666; font-size: 11px;">
                        Your progress will be saved automatically
                    </p>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', promptHTML);
        
        // Focus on input
        setTimeout(() => {
            const input = document.getElementById('pvz-first-profile-name');
            if (input) input.focus();
        }, 100);
    }

    /**
     * Create the first profile (called from prompt)
     */
    function createFirstProfile() {
        const input = document.getElementById('pvz-first-profile-name');
        const name = input ? input.value.trim() : '';
        
        if (!name || name.length < 2) {
            input.style.borderColor = '#f44336';
            input.placeholder = 'Please enter a name (min 2 chars)';
            return false;
        }

        // Create and switch to user
        if (createUser(name)) {
            switchUser(name);
            
            // Remove prompt
            const prompt = document.getElementById('pvz-profile-prompt');
            if (prompt) prompt.remove();
            
            console.log('[PVZ Save System] First profile created:', name);
            
            // Execute pending callback
            if (_pendingGameCallback) {
                _pendingGameCallback();
                _pendingGameCallback = null;
            }
            
            return true;
        } else {
            input.style.borderColor = '#f44336';
            input.placeholder = 'Name already exists, try another';
            input.value = '';
            return false;
        }
    }

    /**
     * Check if a profile exists, prompt to create if not
     * @param {Function} callback - Called if profile exists or after creation
     * @returns {boolean} True if profile exists and user is logged in
     */
    function requireProfile(callback) {
        const users = getAllUsers();
        
        // Profile exists and user selected
        if (users.length > 0 && _currentUser) {
            return true;
        }
        
        // Profiles exist but none selected - show save menu
        if (users.length > 0 && !_currentUser) {
            alert('Please select a profile to continue.');
            showSaveMenu();
            return false;
        }
        
        // No profiles exist - show creation prompt
        showProfileCreationPrompt(callback);
        return false;
    }

    /**
     * Show save menu UI
     */
    function showSaveMenu() {
        // Remove existing menu
        const existingMenu = document.getElementById('pvz-save-menu');
        if (existingMenu) existingMenu.remove();

        const users = getAllUsers();
        const currentUser = getCurrentUser();

        const menuHTML = `
            <div id="pvz-save-menu" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
            ">
                <div onclick="document.getElementById('pvz-save-menu').remove()" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.7);
                "></div>
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: linear-gradient(180deg, #4a3728 0%, #2d1f15 100%);
                    border: 4px solid #8b6914;
                    border-radius: 15px;
                    padding: 30px;
                    z-index: 10000;
                    min-width: 500px;
                    max-width: 600px;
                    box-shadow: 0 0 30px rgba(0,0,0,0.8);
                    font-family: 'Comic Sans MS', cursive, sans-serif;
                    color: #fff;
                ">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #ffd700; text-shadow: 2px 2px 4px #000;">
                        🌻 Save Manager 🧟
                    </h2>
                </div>

                <div style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 10px;">
                    <div style="font-size: 14px; color: #8fdf8f;">Current Profile:</div>
                    <div style="font-size: 20px; font-weight: bold; color: #ffd700;">
                        ${currentUser ? currentUser.profile.username : 'No Profile Selected'}
                    </div>
                    ${currentUser ? `
                        <div style="font-size: 12px; color: #aaa; margin-top: 5px;">
                            Level: ${currentUser.progress.highestLevel} | 
                            Coins: ${currentUser.currency.coins} | 
                            Play Time: ${Math.floor(currentUser.profile.playTime / 60)}min
                        </div>
                    ` : ''}
                </div>

                <div style="margin-bottom: 15px;">
                    <input type="text" id="pvz-new-username" placeholder="Enter new profile name..." style="
                        width: calc(100% - 80px);
                        padding: 10px;
                        border: 2px solid #8b6914;
                        border-radius: 8px;
                        background: #1a1a1a;
                        color: #fff;
                        font-size: 14px;
                    ">
                    <button onclick="PVZSaveSystem.createUser(document.getElementById('pvz-new-username').value) && PVZSaveSystem.showSaveMenu()" style="
                        padding: 10px 15px;
                        background: linear-gradient(180deg, #4caf50, #2e7d32);
                        border: 2px solid #1b5e20;
                        border-radius: 8px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                    ">+ Add</button>
                </div>

                <div style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
                    ${users.length > 0 ? users.map(user => `
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 10px;
                            margin: 5px 0;
                            background: ${_currentUser === user.id ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)'};
                            border-radius: 8px;
                            border: 2px solid ${_currentUser === user.id ? '#4caf50' : 'transparent'};
                        ">
                            <div>
                                <div style="font-weight: bold;">${user.username}</div>
                                <div style="font-size: 11px; color: #aaa;">
                                    Level ${user.level} • ${Math.floor(user.playTime / 60)}min played
                                </div>
                            </div>
                            <div>
                                <button onclick="PVZSaveSystem.switchUser('${user.username}'); PVZSaveSystem.showSaveMenu();" style="
                                    padding: 5px 10px;
                                    background: #2196f3;
                                    border: none;
                                    border-radius: 5px;
                                    color: #fff;
                                    cursor: pointer;
                                    margin-right: 5px;
                                ">Select</button>
                                <button onclick="if(confirm('Delete ${user.username}?')) { PVZSaveSystem.deleteUser('${user.username}'); PVZSaveSystem.showSaveMenu(); }" style="
                                    padding: 5px 10px;
                                    background: #f44336;
                                    border: none;
                                    border-radius: 5px;
                                    color: #fff;
                                    cursor: pointer;
                                ">🗑</button>
                            </div>
                        </div>
                    `).join('') : '<div style="text-align: center; color: #888; padding: 20px;">No profiles yet. Create one above!</div>'}
                </div>

                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="PVZSaveSystem.exportSave()" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(180deg, #ff9800, #f57c00);
                        border: 2px solid #e65100;
                        border-radius: 8px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                    ">📤 Export</button>
                    <button onclick="PVZSaveSystem.importSave()" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(180deg, #9c27b0, #7b1fa2);
                        border: 2px solid #4a148c;
                        border-radius: 8px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                    ">📥 Import</button>
                    <button onclick="PVZSaveSystem.saveProgress(); alert('Saved!')" style="
                        flex: 1;
                        padding: 12px;
                        background: linear-gradient(180deg, #4caf50, #388e3c);
                        border: 2px solid #1b5e20;
                        border-radius: 8px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                    ">💾 Save Now</button>
                </div>

                <button onclick="document.getElementById('pvz-save-menu').remove()" style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #f44336;
                    border: none;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    color: #fff;
                    font-size: 16px;
                    cursor: pointer;
                ">✕</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', menuHTML);
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        init,
        createUser,
        switchUser,
        deleteUser,
        getAllUsers,
        getCurrentUser,
        getCurrentUsername,
        saveProgress,
        autoSave,
        onLevelComplete,
        onLevelFailed,
        unlockPlant,
        isPlantUnlocked,
        getUnlockedPlants,
        addCurrency,
        spendCurrency,
        getCurrency,
        updateSetting,
        getSetting,
        exportSave,
        importSave,
        exportAllSaves,
        resetProgress,
        getStatistics,
        unlockAchievement,
        hasAchievement,
        showSaveMenu,
        requireProfile,
        createFirstProfile,
        showProfileCreationPrompt
    };
})();

// Global shortcut
window.SaveGame = PVZSaveSystem;
