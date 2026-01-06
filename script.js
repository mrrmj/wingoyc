// Wingo Lottery Analysis Assistant - Main Script File

// API Service Class - Get Real Draw Data
class ApiService {
    constructor() {
        this.baseUrl = 'https://api.example.com/history'; // Replace with actual URL
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
        this.lastPeriodNumber = null;
        this.storageKey = 'wingo_history_data';
    }

    // Get historical draw data
    async getHistoryData() {
        const cacheKey = 'historyData';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            console.log('Fetching historical draw data...');
            const timestamp = Date.now();
            const url = `${this.baseUrl}/draw_history.json?ts=${timestamp}`;
            
            // Try multiple request methods
            const response = await this.fetchWithFallback(url);
            const data = await response.json();
            console.log('API response data:', data);

            // Process API data format
            const processedData = this.processHistoryData(data);
            
            // Cache data
            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
            // Return simulated data as backup
            return this.getFallbackData();
        }
    }

    // Multiple request methods
    async fetchWithFallback(url) {
        const methods = [
            () => fetch(url, { method: 'GET', mode: 'cors' }),
            () => fetch(url, { method: 'GET', mode: 'no-cors' }),
            () => fetch(url, { method: 'GET' })
        ];

        for (const method of methods) {
            try {
                const response = await method();
                if (response.ok || response.status === 0) { // status 0 for no-cors
                    return response;
                }
            } catch (error) {
                console.warn('Request method failed, trying next:', error.message);
            }
        }

        throw new Error('All request methods failed');
    }

    // Process API returned data format
    processHistoryData(apiData) {
        try {
            const historyList = [];
            
            // Process data based on actual API response format
            if (apiData && apiData.data && apiData.data.list && Array.isArray(apiData.data.list)) {
                apiData.data.list.forEach((item, index) => {
                    const processedItem = this.processHistoryItem(item, index);
                    if (processedItem) {
                        historyList.push(processedItem);
                    }
                });
            } else {
                console.warn('API data format unexpected, using backup data');
                return this.getFallbackData();
            }

            console.log(`Successfully processed ${historyList.length} historical records`);
            return historyList.length > 0 ? historyList : this.getFallbackData();
        } catch (error) {
            console.error('Error processing historical data:', error);
            return this.getFallbackData();
        }
    }

    // Process single historical record
    processHistoryItem(item, index) {
        try {
            const period = item.issueNumber || item.id || `2025${String(1000 + index).slice(-4)}`;
            const number = this.extractNumber(item);
            const time = this.extractTime(item, index);
            
            // Get color based on game rules
            const color = this.getNumberColor(number);
            
            // Check if big/small based on rules
            const big = number >= 5; // 0-4: Small, 5-9: Big
            
            // Check if odd/even
            const odd = number % 2 === 1;

            return {
                period: String(period),
                time: time,
                number: number,
                big: big,
                odd: odd,
                color: color,
                patterns: this.generatePatterns(number, color)
            };
        } catch (error) {
            console.error('Error processing single history record:', error);
            return null;
        }
    }

    // Extract number - try multiple possible fields
    extractNumber(item) {
        // Common number field names
        const numberFields = ['number', 'result', 'winNumber', 'draw', 'drawResult', 'num', 'value', 'lottery'];
        
        for (const field of numberFields) {
            if (item[field] !== undefined) {
                const num = parseInt(item[field]);
                if (!isNaN(num) && num >= 0 && num <= 9) {
                    return num;
                }
            }
        }

        // Try to find number in entire object
        const allValues = Object.values(item);
        for (const value of allValues) {
            if (typeof value === 'number' && value >= 0 && value <= 9) {
                return value;
            }
            if (typeof value === 'string') {
                const num = parseInt(value);
                if (!isNaN(num) && num >= 0 && num <= 9) {
                    return num;
                }
            }
        }

        // Generate random number as last backup
        return Math.floor(Math.random() * 10);
    }

    // Extract time
    extractTime(item, index) {
        const timeFields = ['time', 'createTime', 'drawTime', 'timestamp', 'date', 'issueTime'];
        
        for (const field of timeFields) {
            if (item[field]) {
                const time = new Date(item[field]);
                if (!isNaN(time.getTime())) {
                    return time;
                }
            }
        }

        // If no time field, generate reasonable time
        return new Date(Date.now() - index * 5 * 60 * 1000); // Every 5 minutes
    }

    // Get number color based on game rules
    getNumberColor(number) {
        // Game rules:
        // 0: Small, Red/Violet
        // 1: Small, Green
        // 2: Small, Red
        // 3: Small, Green
        // 4: Small, Red
        // 5: Big, Green/Violet
        // 6: Big, Red
        // 7: Big, Green
        // 8: Big, Red
        // 9: Big, Green
        
        if (number === 0) return 'purple'; // Red/Violet
        if (number === 1) return 'green';
        if (number === 2) return 'red';
        if (number === 3) return 'green';
        if (number === 4) return 'red';
        if (number === 5) return 'purple'; // Green/Violet
        if (number === 6) return 'red';
        if (number === 7) return 'green';
        if (number === 8) return 'red';
        if (number === 9) return 'green';
        
        return 'red'; // Default
    }

    // Generate number patterns
    generatePatterns(number, color) {
        const patterns = [];
        
        // Size pattern
        patterns.push(number >= 5 ? 'Big' : 'Small');
        
        // Parity pattern
        patterns.push(number % 2 === 1 ? 'Odd' : 'Even');
        
        // Color pattern
        if (color === 'red') patterns.push('Red');
        else if (color === 'green') patterns.push('Green');
        else if (color === 'purple') patterns.push('Purple');
        
        return patterns;
    }

    // Backup data - used when API unavailable
    getFallbackData() {
        console.log('Using backup simulation data');
        const fallbackData = [];
        const now = new Date();
        
        for (let i = 0; i < 50; i++) {
            const number = Math.floor(Math.random() * 10);
            const time = new Date(now.getTime() - i * 5 * 60 * 1000);
            const color = this.getNumberColor(number);
            
            fallbackData.push({
                period: `2025${String(1000 + i)}`,
                time: time,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: color,
                patterns: this.generatePatterns(number, color)
            });
        }
        
        return fallbackData;
    }

    // Get current period information
    getCurrentPeriodInfo() {
        const now = new Date();
        const periodNumber = `2025${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(Math.floor(now.getMinutes() / 5) + 1).padStart(2, '0')}`;
        
        return {
            period: periodNumber,
            nextDrawTime: this.getNextDrawTime()
        };
    }

    // Calculate next draw time
    getNextDrawTime() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // Calculate time to next 5-minute interval
        const nextMinute = Math.ceil((minutes * 60 + seconds) / 300) * 5;
        const nextDraw = new Date(now);
        
        if (nextMinute >= 60) {
            nextDraw.setHours(now.getHours() + 1);
            nextDraw.setMinutes(nextMinute - 60);
        } else {
            nextDraw.setMinutes(nextMinute);
        }
        
        nextDraw.setSeconds(0);
        nextDraw.setMilliseconds(0);
        
        return nextDraw;
    }

    // Check for new data every 2 seconds
    startDataPolling(callback) {
        // Initial check
        this.checkForNewData(callback);
        
        // Set interval for every 2 seconds
        setInterval(() => {
            this.checkForNewData(callback);
        }, 2000);
    }

    // Check for new data
    async checkForNewData(callback) {
        try {
            const newData = await this.getHistoryData();
            if (newData && newData.length > 0) {
                const latestPeriod = newData[0].period;
                
                // Check if this is new data
                if (this.lastPeriodNumber !== latestPeriod) {
                    this.lastPeriodNumber = latestPeriod;
                    
                    // Save to storage
                    this.saveToStorage(newData);
                    
                    // Callback to update UI
                    if (callback) {
                        callback(newData);
                    }
                    
                    console.log('New data arrived:', latestPeriod);
                }
            }
        } catch (error) {
            console.error('Error checking for new data:', error);
        }
    }

    // Save data to localStorage
    saveToStorage(data) {
        try {
            // Get existing data
            const existingData = this.getFromStorage() || [];
            
            // Combine and remove duplicates
            const combinedData = [...data, ...existingData];
            const uniqueData = this.removeDuplicates(combinedData);
            
            // Sort by period number (descending)
            uniqueData.sort((a, b) => {
                return b.period.localeCompare(a.period);
            });
            
            // Keep only last 100 records
            const trimmedData = uniqueData.slice(0, 100);
            
            // Save to localStorage
            localStorage.setItem(this.storageKey, JSON.stringify(trimmedData));
            
            console.log('Data saved to storage:', trimmedData.length, 'records');
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    // Get data from localStorage
    getFromStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error getting from storage:', error);
            return null;
        }
    }

    // Remove duplicate records based on period number
    removeDuplicates(data) {
        const seen = new Set();
        return data.filter(item => {
            if (seen.has(item.period)) {
                return false;
            }
            seen.add(item.period);
            return true;
        });
    }

    // Initial data load - get 10 records on first run
    async initializeFirstLoad() {
        try {
            const data = await this.getHistoryData();
            if (data && data.length > 0) {
                // Take first 10 records
                const initialData = data.slice(0, 10);
                
                // Save to storage
                this.saveToStorage(initialData);
                
                // Set last period number
                if (initialData.length > 0) {
                    this.lastPeriodNumber = initialData[0].period;
                }
                
                console.log('Initial data loaded:', initialData.length, 'records');
                return initialData;
            }
        } catch (error) {
            console.error('Error in initial data load:', error);
            return this.getFallbackData().slice(0, 10);
        }
    }
}

// Application constants definition
const APP_CONSTANTS = {
    PAGES: {
        HOME: 'home',
        PREDICT: 'predict',
        TREND: 'trend', 
        PATTERN: 'pattern',
        STRATEGY: 'strategy',
        HISTORY: 'history'
    },
    SELECTORS: {
        NAV_ITEMS: '.nav-item',
        FEATURE_CARDS: '.feature-card',
        BACK_BUTTONS: '.back-btn',
        PAGES: '.page'
    },
    API: {
        HISTORY_URL: 'https://api.example.com/history/draw_history.json',
        TIMEOUT: 10000,
        CACHE_DURATION: 60000
    },
    NUMBER_COLORS: {
        RED: [2, 4, 6, 8],
        GREEN: [1, 3, 7, 9],
        PURPLE: [0, 5]
    },
    DEFAULTS: {
        BASE_AMOUNT: 10,
        MAX_PREDICTION_HISTORY: 100,
        COUNTDOWN_TIME: 300000, // 5 minutes
        CHART_DEFAULT_PERIODS: 50
    }
};

// Utility class - extract common functionality
class AppUtils {
    // DOM query optimization - cache common elements
    static elementCache = new Map();
    
    static getElement(selector, useCache = true) {
        if (useCache && this.elementCache.has(selector)) {
            return this.elementCache.get(selector);
        }
        
        const element = document.querySelector(selector);
        if (useCache && element) {
            this.elementCache.set(selector, element);
        }
        return element;
    }
    
    static getElements(selector) {
        return document.querySelectorAll(selector);
    }
    
    // Error handling wrapper
    static safeExecute(fn, context = null, ...args) {
        try {
            return context ? fn.call(context, ...args) : fn(...args);
        } catch (error) {
            console.error('Execution error:', error);
            return null;
        }
    }
    
    // Debounce function
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Format time
    static formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    }
    
    // Get number color based on game rules
    static getNumberColor(number) {
        if (number === 0) return 'purple';
        if (number === 1) return 'green';
        if (number === 2) return 'red';
        if (number === 3) return 'green';
        if (number === 4) return 'red';
        if (number === 5) return 'purple';
        if (number === 6) return 'red';
        if (number === 7) return 'green';
        if (number === 8) return 'red';
        if (number === 9) return 'green';
        return 'red'; // Default
    }
    
    // Random integer generation
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Array shuffle
    static shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    
    // Format date
    static formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    // Get time ago description
    static getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
}

// Data management class
class DataManager {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
    }
    
    // Set data
    set(key, value) {
        const oldValue = this.cache.get(key);
        this.cache.set(key, value);
        
        // Notify observers
        if (this.observers.has(key)) {
            this.observers.get(key).forEach(callback => {
                AppUtils.safeExecute(callback, null, value, oldValue);
            });
        }
    }
    
    // Get data
    get(key, defaultValue = null) {
        return this.cache.get(key) ?? defaultValue;
    }
    
    // Subscribe to data changes
    subscribe(key, callback) {
        if (!this.observers.has(key)) {
            this.observers.set(key, []);
        }
        this.observers.get(key).push(callback);
    }
    
    // Unsubscribe
    unsubscribe(key, callback) {
        if (this.observers.has(key)) {
            const callbacks = this.observers.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}

// Main application class
class WingoApp {
    constructor() {
        // Basic state
        this.currentPage = APP_CONSTANTS.PAGES.HOME;
        this.isLoading = true;
        this.countdownInterval = null;
        this.dataPollingInterval = null;
        
        // API service
        this.apiService = new ApiService();
        
        // Data management
        this.dataManager = new DataManager();
        this.predictionHistory = [];
        this.trendData = [];
        this.patternData = [];
        this.strategyData = {};
        
        // Historical data management
        this.historyData = [];
        this.filteredHistoryData = [];
        this.historyCurrentPage = 1;
        this.historyPageSize = 20;
        
        // Real-time data state
        this.isDataLoading = false;
        this.lastDataUpdate = null;
        
        // Configuration
        this.config = {
            baseAmount: APP_CONSTANTS.DEFAULTS.BASE_AMOUNT,
            maxHistory: APP_CONSTANTS.DEFAULTS.MAX_PREDICTION_HISTORY,
            countdownTime: APP_CONSTANTS.DEFAULTS.COUNTDOWN_TIME
        };
        
        // Initialize language manager
        this.setupLanguageManager();
        
        // Error handling
        this.setupErrorHandling();
    }

    // Error handling setup
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showToast('System error occurred, please refresh page');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise rejection:', event.reason);
            event.preventDefault();
        });
    }

    async init() {
        console.log('Starting application initialization...');
        
        try {
            // Ensure basic data structure exists
            this.historyData = this.historyData || [];
            this.trendData = this.trendData || [];
            this.patternData = this.patternData || [];
            
            console.log('Setting up basic event listeners...');
            // Basic event listeners
            this.setupBasicEventListeners();
            
            console.log('Generating basic data...');
            // Asynchronous basic data generation - with error handling
            try {
                await this.generateBasicData();
                console.log('Basic data generation complete');
            } catch (dataError) {
                console.error('Basic data generation failed, using default data:', dataError);
                // Ensure at least some default data
                this.generateFallbackHistoryData();
                this.updateStats();
                this.generateHotNumbers();
                this.updateRecentHistory();
            }
            
            console.log('Starting timers...');
            // Start timers
            this.startCountdown();
            this.startDataPolling();
            
            // Delayed initialization of other features
            setTimeout(() => {
                try {
                    console.log('Setting up advanced features...');
                    this.setupAdvancedFeatures();
                    console.log('Advanced features setup complete');
                } catch (error) {
                    console.error('Advanced features setup failed:', error);
                }
            }, 100);
            
            // Delayed hide loading screen
            setTimeout(() => {
                try {
                    console.log('Hiding loading screen...');
                    this.hideLoader();
                    console.log('Application initialization complete');
                    
                    // Show initialization success message
                    setTimeout(() => {
                        if (this.showToast) {
                            this.showToast('Application loaded successfully', 'success');
                        }
                    }, 500);
                } catch (error) {
                    console.error('Failed to hide loading screen:', error);
                    // Force hide loading screen
                    const loader = document.querySelector('.loader-screen');
                    if (loader) {
                        loader.style.display = 'none';
                    }
                }
            }, 1500);
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showError('Application initialization failed, please refresh page');
            
            // Even if initialization fails, hide loading screen
            setTimeout(() => {
                const loader = document.querySelector('.loader-screen');
                if (loader) {
                    loader.style.display = 'none';
                }
            }, 2000);
        }
    }

    // Start data polling for new draws
    startDataPolling() {
        // Start polling for new data every 2 seconds
        this.apiService.startDataPolling((newData) => {
            this.onNewDataReceived(newData);
        });
    }

    // Handle new data received
    onNewDataReceived(newData) {
        console.log('New data received:', newData.length, 'records');
        
        // Update history data
        this.historyData = newData;
        
        // Update UI if on home page
        if (this.currentPage === APP_CONSTANTS.PAGES.HOME) {
            this.updateRecentHistory();
            this.updateHomeStats();
            this.updateHotNumbers();
        }
        
        // Update last update time
        this.lastDataUpdate = new Date();
        
        // Show notification for new draw
        if (newData.length > 0) {
            const latestDraw = newData[0];
            this.showToast(`New draw: Period ${latestDraw.period}, Number ${latestDraw.number}`, 'info');
        }
    }

    // Basic event listener setup
    setupBasicEventListeners() {
        console.log('Setting up basic event listeners...');
        
        // Bottom navigation
        const navItems = AppUtils.getElements(APP_CONSTANTS.SELECTORS.NAV_ITEMS);
        console.log('Found navigation items:', navItems.length);
        navItems.forEach(item => {
            item.addEventListener('click', AppUtils.throttle((e) => {
                const page = item.getAttribute('data-page');
                this.navigateToPage(page);
            }, 300));
        });

        // Feature cards click
        const featureCards = AppUtils.getElements(APP_CONSTANTS.SELECTORS.FEATURE_CARDS);
        console.log('Found feature cards:', featureCards.length);
        featureCards.forEach(card => {
            card.addEventListener('click', AppUtils.throttle((e) => {
                const page = card.getAttribute('data-page');
                if (page) this.navigateToPage(page);
            }, 300));
        });

        // Back buttons
        const backButtons = AppUtils.getElements(APP_CONSTANTS.SELECTORS.BACK_BUTTONS);
        console.log('Found back buttons:', backButtons.length);
        backButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigateToPage(APP_CONSTANTS.PAGES.HOME);
            });
        });

        // Refresh stats button
        const refreshStatsBtn = AppUtils.getElement('#refreshStatsBtn');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', AppUtils.debounce(async () => {
                await this.refreshStats();
            }, 1000));
        } else {
            console.warn('Refresh stats button not found');
        }

        // "View all" buttons
        const viewAllBtns = AppUtils.getElements('.view-all-btn');
        viewAllBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.getAttribute('data-page');
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });

        // Stat cards click event
        const statCards = AppUtils.getElements('.stat-card');
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.getAttribute('data-stat');
                this.showStatDetail(statType);
            });
        });

        // Pull to refresh support
        this.setupPullToRefresh();

        // Language buttons
        this.setupLanguageEvents();
    }

    // Generate basic data - updated to async method
    async generateBasicData() {
        console.log('Generating basic data...');
        
        // Only generate data necessary for home page
        await AppUtils.safeExecute(async () => {
            // Initialize with first 10 records
            const initialData = await this.apiService.initializeFirstLoad();
            this.historyData = initialData || [];
            
            // Generate other data based on real data
            this.generateHotNumbers();
            this.updateStats();
            
            // Update recent draw history on home page
            this.updateRecentHistory();
            
            // Update current period info
            this.updateCurrentPeriodInfo();
        }, this);
    }

    // Delayed setup of advanced features
    setupAdvancedFeatures() {
        console.log('Setting up advanced features...');
        
        AppUtils.safeExecute(() => {
            // Event delegation
            this.setupDelegatedEvents();
            
            // Prediction related buttons
            this.setupPredictionButtons();
            
            // Parameter sliders
            this.setupParameterSliders();
            
            // Touch feedback
            this.setupTouchFeedback();
            
            // Enhanced history event listeners
            this.setupEnhancedHistoryEvents();
            
            // Quick preview button
            const quickPreviewBtn = AppUtils.getElement('.quick-preview-btn');
            if (quickPreviewBtn) {
                quickPreviewBtn.addEventListener('click', () => {
                    this.showQuickPreview();
                });
            }
            
            // Generate other page data (lazy loading)
            this.generateTrendData();
            this.generatePatternData();
            this.generateStrategyData();
            
            console.log('Advanced features setup complete');
        }, this);
    }

    setupEventListeners() {
        // Keep original method, called during page specific initialization
        console.log('Setting up complete event listeners...');
        
        // Trend page events
        this.setupTrendPageEvents();
        
        // Pattern page events
        this.setupPatternPageEvents();

        // Strategy page events
        this.setupStrategyPageEvents();
    }

    setupDelegatedEvents() {
        document.addEventListener('click', (e) => {
            // Handle various click events
            if (e.target.matches('.tab-item')) {
                this.handleTabClick(e);
            } else if (e.target.matches('.pattern-tab')) {
                this.handlePatternTabClick(e);
            } else if (e.target.matches('.strategy-item')) {
                this.handleStrategyClick(e);
            } else if (e.target.matches('.amount-btn')) {
                this.handleAmountClick(e);
            }
        });
    }
    
    // Tab click handling
    handleTabClick(e) {
        const chartType = e.target.getAttribute('data-chart');
        if (chartType) {
            AppUtils.safeExecute(() => this.switchChart(chartType), this);
        }
    }
    
    // Pattern tab click handling
    handlePatternTabClick(e) {
        const patternType = e.target.getAttribute('data-pattern');
        if (patternType) {
            AppUtils.safeExecute(() => this.switchPatternChart(patternType), this);
        }
    }
    
    // Strategy click handling
    handleStrategyClick(e) {
        const strategy = e.target.closest('.strategy-item')?.getAttribute('data-strategy');
        if (strategy) {
            AppUtils.safeExecute(() => this.switchStrategy(strategy), this);
        }
    }
    
    // Amount button click handling
    handleAmountClick(e) {
        const amount = parseInt(e.target.getAttribute('data-amount'));
        if (amount) {
            AppUtils.safeExecute(() => this.selectAmount(amount), this);
        }
    }

    setupPredictionButtons() {
        // Refresh prediction button
        const refreshBtn = AppUtils.getElement('.action-btn.primary');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.generateNewPrediction();
            });
        }

        // Detailed analysis button
        const analyzeBtn = AppUtils.getElement('.action-btn.secondary');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.showDetailedAnalysis();
            });
        }

        // Reset parameters button
        const resetBtn = AppUtils.getElement('.reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetParameters();
            });
        }

        // Clear history button
        const clearHistoryBtn = AppUtils.getElement('.clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                this.clearPredictionHistory();
            });
        }
    }

    setupParameterSliders() {
        const sliders = AppUtils.getElements('.parameter-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', AppUtils.debounce((e) => {
                const value = e.target.value;
                const valueDisplay = e.target.parentElement.querySelector('.parameter-value');
                if (valueDisplay) {
                    valueDisplay.textContent = value;
                }
            }, 100));
        });
    }

    setupTouchFeedback() {
        const clickableElements = AppUtils.getElements(
            'button, .feature-card, .nav-item, .action-btn, .stat-card, .number-item'
        );

        clickableElements.forEach(element => {
            element.addEventListener('touchstart', AppUtils.throttle(() => {
                element.style.transform = 'scale(0.95)';
            }, 50));

            element.addEventListener('touchend', () => {
                element.style.transform = '';
            });

            element.addEventListener('touchcancel', () => {
                element.style.transform = '';
            });
        });
    }

    navigateToPage(pageId) {
        AppUtils.safeExecute(() => {
            // Remove active class from all pages
            AppUtils.getElements(APP_CONSTANTS.SELECTORS.PAGES).forEach(page => {
                page.classList.remove('active');
            });

            // Remove active class from all navigation items
            AppUtils.getElements(APP_CONSTANTS.SELECTORS.NAV_ITEMS).forEach(item => {
                item.classList.remove('active');
            });

            // Activate target page
            const targetPage = AppUtils.getElement(`#${pageId}`);
            if (targetPage) {
                targetPage.classList.add('active');
                this.currentPage = pageId;
            }

            // Activate corresponding navigation item
            const targetNavItem = AppUtils.getElement(`[data-page="${pageId}"]`);
            if (targetNavItem && targetNavItem.classList.contains('nav-item')) {
                targetNavItem.classList.add('active');
            }

            // Page specific initialization
            this.initializePage(pageId);
        }, this);
    }

    initializePage(pageId) {
        const initMethods = {
            [APP_CONSTANTS.PAGES.PREDICT]: () => this.initializePredictPage(),
            [APP_CONSTANTS.PAGES.TREND]: () => this.initializeTrendPage(),
            [APP_CONSTANTS.PAGES.PATTERN]: () => this.initializePatternPage(),
            [APP_CONSTANTS.PAGES.STRATEGY]: () => this.initializeStrategyPage(),
            [APP_CONSTANTS.PAGES.HISTORY]: () => this.initializeHistoryPage(),
            [APP_CONSTANTS.PAGES.HOME]: () => this.refreshHomeData()
        };

        const initMethod = initMethods[pageId];
        if (initMethod) {
            AppUtils.safeExecute(initMethod, this);
        }
    }

    initializePredictPage() {
        // Ensure prediction page has data
        if (!this.predictionHistory.length) {
            this.generateNewPrediction();
        }
        this.updatePredictionHistory();
    }

    initializeTrendPage() {
        console.log('Initializing trend page...');
        this.setupNewTrendPageEvents();
    }

    // Initialize pattern page
    initializePatternPage() {
        console.log('Initializing pattern page...');
        AppUtils.safeExecute(() => {
            this.setupPatternPageEvents();
            this.generatePatternData();
        }, this);
    }

    // Initialize strategy page
    initializeStrategyPage() {
        console.log('Initializing strategy page...');
        AppUtils.safeExecute(() => {
            this.setupStrategyPageEvents();
            this.generateStrategyData();
        }, this);
    }

    setupNewTrendPageEvents() {
        const container = AppUtils.getElement('#trend');
        if (!container) return;

        // Chart switching events
        container.addEventListener('click', (e) => {
            if (e.target.matches('.chart-tab') || e.target.closest('.chart-tab')) {
                const tabBtn = e.target.closest('.chart-tab');
                const chartType = tabBtn.dataset.chart;
                this.switchTrendChart(chartType);
            }

            // Missing data type switching
            if (e.target.matches('.missing-tab')) {
                const tabBtn = e.target;
                const missingType = tabBtn.dataset.type;
                this.switchMissingType(missingType);
            }

            // Refresh button
            if (e.target.matches('.chart-refresh-btn') || e.target.closest('.chart-refresh-btn')) {
                this.refreshCurrentChart();
            }

            // Frequency item click
            if (e.target.closest('.frequency-item')) {
                const item = e.target.closest('.frequency-item');
                const number = item.dataset.number;
                this.showNumberDetailModal(number);
            }

            // Missing item click
            if (e.target.closest('.missing-item')) {
                const item = e.target.closest('.missing-item');
                const data = item.dataset;
                this.showMissingDetailModal(data);
            }
        });

        // Global period selector
        const periodSelect = AppUtils.getElement('#globalPeriodSelect');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                this.updateTrendPeriod(periodSelect.value);
            });
        }

        // Comparison period selector
        const comparisonSelect = AppUtils.getElement('#comparisonPeriod');
        if (comparisonSelect) {
            comparisonSelect.addEventListener('change', () => {
                this.updateComparisonPeriod(comparisonSelect.value);
            });
        }

        // Add touch-friendly interactions
        this.setupTouchInteractions();
    }

    initializeResponsiveLayout() {
        // Detect screen size and adjust layout
        const handleResize = () => {
            const container = AppUtils.getElement('#trend');
            if (!container) return;

            const width = window.innerWidth;
            
            // Mobile optimization
            if (width <= 768) {
                this.optimizeForMobile();
            } else {
                this.optimizeForDesktop();
            }
        };

        window.addEventListener('resize', AppUtils.debounce(handleResize, 250));
        handleResize(); // Execute once on initialization
    }

    optimizeForMobile() {
        const statusOverview = AppUtils.getElement('.status-overview');
        if (statusOverview) {
            statusOverview.style.gridTemplateColumns = 'repeat(2, 1fr)';
        }

        const chartTabs = AppUtils.getElement('.chart-tabs');
        if (chartTabs) {
            chartTabs.style.gridTemplateColumns = 'repeat(2, 1fr)';
        }
    }

    optimizeForDesktop() {
        const statusOverview = AppUtils.getElement('.status-overview');
        if (statusOverview) {
            statusOverview.style.gridTemplateColumns = 'repeat(4, 1fr)';
        }

        const chartTabs = AppUtils.getElement('.chart-tabs');
        if (chartTabs) {
            chartTabs.style.gridTemplateColumns = 'repeat(4, 1fr)';
        }
    }

    setupTouchInteractions() {
        // Add better interaction experience for touch devices
        const touchElements = document.querySelectorAll('.frequency-item, .missing-item, .chart-tab, .metric-item');
        
        touchElements.forEach(element => {
            element.addEventListener('touchstart', (e) => {
                element.style.transform = 'scale(0.95)';
            }, { passive: true });

            element.addEventListener('touchend', (e) => {
                setTimeout(() => {
                    element.style.transform = '';
                }, 150);
            }, { passive: true });
        });
    }

    generateComprehensiveTrendData() {
        const periods = 200;
        this.trendData = {
            history: [],
            frequencies: {},
            patterns: {
                size: [],
                parity: [],
                color: []
            },
            missing: {
                numbers: {},
                patterns: {}
            },
            analysis: {
                hot: [],
                cold: [],
                trends: []
            }
        };

        // Generate historical data
        for (let i = 0; i < periods; i++) {
            const number = AppUtils.randomInt(0, 9);
            const timestamp = Date.now() - (periods - i) * 3 * 60 * 1000; // Every 3 minutes
            
            const result = {
                period: `2025${String(i + 1).padStart(4, '0')}`,
                number: number,
                timestamp: timestamp,
                size: number >= 5 ? 'big' : 'small',
                parity: number % 2 === 0 ? 'even' : 'odd',
                color: AppUtils.getNumberColor(number)
            };

            this.trendData.history.push(result);
        }

        // Calculate frequency statistics
        for (let num = 0; num <= 9; num++) {
            const count = this.trendData.history.filter(item => item.number === num).length;
            this.trendData.frequencies[num] = {
                count: count,
                percentage: (count / periods * 100).toFixed(1),
                lastAppear: this.getLastAppearance(num),
                missing: this.calculateMissing(num)
            };
        }

        // Analyze hot/cold numbers
        this.analyzeHotColdNumbers();
        
        // Calculate pattern statistics
        this.calculatePatternStats();
        
        // Calculate missing data
        this.calculateMissingData();
    }

    analyzeHotColdNumbers() {
        const frequencies = Object.entries(this.trendData.frequencies)
            .map(([number, data]) => ({ number: parseInt(number), ...data }))
            .sort((a, b) => b.count - a.count);

        this.trendData.analysis.hot = frequencies.slice(0, 3);
        this.trendData.analysis.cold = frequencies.slice(-3).reverse();
        
        // Calculate trends
        this.trendData.analysis.trends = this.analyzeTrends();
    }

    analyzeTrends() {
        const recent = this.trendData.history.slice(-20);
        const trends = [];

        // Big number trend
        const bigCount = recent.filter(item => item.size === 'big').length;
        if (bigCount > 12) {
            trends.push({ type: 'size', trend: 'big', strength: 'strong', count: bigCount });
        } else if (bigCount < 8) {
            trends.push({ type: 'size', trend: 'small', strength: 'strong', count: 20 - bigCount });
        }

        // Odd number trend
        const oddCount = recent.filter(item => item.parity === 'odd').length;
        if (oddCount > 12) {
            trends.push({ type: 'parity', trend: 'odd', strength: 'strong', count: oddCount });
        } else if (oddCount < 8) {
            trends.push({ type: 'parity', trend: 'even', strength: 'strong', count: 20 - oddCount });
        }

        return trends;
    }

    calculatePatternStats() {
        const history = this.trendData.history;
        
        // Size statistics
        const bigCount = history.filter(item => item.size === 'big').length;
        const smallCount = history.length - bigCount;
        
        // Parity statistics
        const oddCount = history.filter(item => item.parity === 'odd').length;
        const evenCount = history.length - oddCount;
        
        // Color statistics
        const colorCounts = {
            red: history.filter(item => item.color === 'red').length,
            green: history.filter(item => item.color === 'green').length,
            purple: history.filter(item => item.color === 'purple').length
        };

        this.trendData.patterns = {
            size: {
                big: { count: bigCount, percentage: (bigCount / history.length * 100).toFixed(1) },
                small: { count: smallCount, percentage: (smallCount / history.length * 100).toFixed(1) }
            },
            parity: {
                odd: { count: oddCount, percentage: (oddCount / history.length * 100).toFixed(1) },
                even: { count: evenCount, percentage: (evenCount / history.length * 100).toFixed(1) }
            },
            color: {
                red: { count: colorCounts.red, percentage: (colorCounts.red / history.length * 100).toFixed(1) },
                green: { count: colorCounts.green, percentage: (colorCounts.green / history.length * 100).toFixed(1) },
                purple: { count: colorCounts.purple, percentage: (colorCounts.purple / history.length * 100).toFixed(1) }
            }
        };
    }

    calculateMissingData() {
        const history = this.trendData.history;
        
        // Number missing
        for (let num = 0; num <= 9; num++) {
            let missing = 0;
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].number === num) break;
                missing++;
            }
            this.trendData.missing.numbers[num] = missing;
        }

        // Pattern missing
        const patterns = ['big', 'small', 'odd', 'even', 'red', 'green', 'purple'];
        this.trendData.missing.patterns = {};
        
        patterns.forEach(pattern => {
            let missing = 0;
            for (let i = history.length - 1; i >= 0; i--) {
                const item = history[i];
                if (item.size === pattern || item.parity === pattern || item.color === pattern) break;
                missing++;
            }
            this.trendData.missing.patterns[pattern] = missing;
        });
    }

    renderTrendStatusCard() {
        const totalDraws = this.trendData.history.length;
        const hotNumber = this.trendData.analysis.hot[0]?.number || '-';
        const coldNumber = this.trendData.analysis.cold[0]?.number || '-';
        
        // Calculate volatility
        const recent20 = this.trendData.history.slice(-20);
        const variance = this.calculateVariance(recent20.map(item => item.number));
        
        AppUtils.safeExecute(() => {
            AppUtils.getElement('#trendTotalDraws').textContent = totalDraws;
            AppUtils.getElement('#trendHotNumber').textContent = hotNumber;
            AppUtils.getElement('#trendColdNumber').textContent = coldNumber;
            AppUtils.getElement('#trendVariance').textContent = `${variance.toFixed(1)}%`;
        });
    }

    calculateVariance(numbers) {
        const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
        return Math.sqrt(variance) / mean * 100;
    }

    switchTrendChart(chartType) {
        // Update tab state
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        
        const activeTab = document.querySelector(`[data-chart="${chartType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }

        // Switch chart display
        document.querySelectorAll('.trend-chart').forEach(chart => {
            chart.classList.remove('active');
        });
        
        const activeChart = AppUtils.getElement(`#${chartType}-chart`);
        if (activeChart) {
            activeChart.classList.add('active');
            this.renderChart(chartType);
        }
    }

    renderInitialChart() {
        this.renderChart('number');
    }

    renderChart(chartType) {
        switch (chartType) {
            case 'number':
                this.renderNumberFrequencyChart();
                this.renderNumberTimeline();
                break;
            case 'size':
                this.renderSizeChart();
                break;
            case 'parity':
                this.renderParityChart();
                break;
            case 'color':
                this.renderColorChart();
                break;
        }
    }

    renderNumberFrequencyChart() {
        const container = AppUtils.getElement('#numberFrequencyGrid');
        if (!container) return;

        const frequencies = this.trendData.frequencies;
        let html = '';

        for (let num = 0; num <= 9; num++) {
            const data = frequencies[num];
            const hotClass = data.count > 25 ? 'hot' : data.count < 15 ? 'cold' : '';
            
            html += `
                <div class="frequency-item ${hotClass}" data-number="${num}">
                    <div class="frequency-number">${num}</div>
                    <div class="frequency-count">Appeared ${data.count} times</div>
                    <div class="frequency-percent">${data.percentage}%</div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderNumberTimeline() {
        const container = AppUtils.getElement('#numberTimeline .timeline-content');
        if (!container) return;

        const recent30 = this.trendData.history.slice(-30);
        let html = '';

        recent30.forEach(item => {
            const colorClass = item.color;
            html += `
                <div class="timeline-item ${colorClass}" title="Period: ${item.period}, Number: ${item.number}">
                    ${item.number}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    renderSizeChart() {
        this.renderPatternBars('size');
        this.updateSizeMetrics();
    }

    renderParityChart() {
        this.renderPatternBars('parity');
        this.updateParityMetrics();
    }

    renderPatternBars(type) {
        const containerClass = type === 'size' ? '#sizeBarsChart' : '#parityBarsChart';
        const container = AppUtils.getElement(containerClass);
        if (!container) return;

        const recent20 = this.trendData.history.slice(-20);
        let html = '';

        recent20.forEach((item, index) => {
            const value = type === 'size' ? item.size : item.parity;
            const height = AppUtils.randomInt(30, 100);
            
            html += `
                <div class="pattern-bar ${value}" 
                     style="height: ${height}%" 
                     title="Period: ${item.period}, ${type === 'size' ? 'Size' : 'Parity'}: ${value}">
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateSizeMetrics() {
        const patterns = this.trendData.patterns.size;
        const recent = this.trendData.history.slice(-10);
        const currentStreak = this.calculateCurrentStreak(recent, 'size');
        const balance = this.calculateBalance(patterns.big.percentage, patterns.small.percentage);

        AppUtils.safeExecute(() => {
            AppUtils.getElement('#bigRatio').textContent = `${patterns.big.percentage}%`;
            AppUtils.getElement('#sizeStreak').textContent = currentStreak;
            AppUtils.getElement('#sizeBalance').textContent = balance;
        });
    }

    updateParityMetrics() {
        const patterns = this.trendData.patterns.parity;
        const recent = this.trendData.history.slice(-10);
        const currentStreak = this.calculateCurrentStreak(recent, 'parity');
        const balance = this.calculateBalance(patterns.odd.percentage, patterns.even.percentage);

        AppUtils.safeExecute(() => {
            AppUtils.getElement('#oddRatio').textContent = `${patterns.odd.percentage}%`;
            AppUtils.getElement('#parityStreak').textContent = currentStreak;
            AppUtils.getElement('#parityBalance').textContent = balance;
        });
    }

    calculateCurrentStreak(recent, type) {
        if (recent.length === 0) return 'No streak';
        
        const lastValue = type === 'size' ? recent[recent.length - 1].size : recent[recent.length - 1].parity;
        let streak = 1;
        
        for (let i = recent.length - 2; i >= 0; i--) {
            const currentValue = type === 'size' ? recent[i].size : recent[i].parity;
            if (currentValue === lastValue) {
                streak++;
            } else {
                break;
            }
        }
        
        const typeMap = {
            'big': 'Big', 'small': 'Small',
            'odd': 'Odd', 'even': 'Even'
        };
        
        return `${streak} ${typeMap[lastValue] || lastValue}`;
    }

    calculateBalance(value1, value2) {
        const diff = Math.abs(parseFloat(value1) - parseFloat(value2));
        if (diff < 5) return 'Balanced';
        if (diff < 10) return 'Slightly biased';
        return parseFloat(value1) > parseFloat(value2) ? 'Clearly big biased' : 'Clearly small biased';
    }

    renderColorChart() {
        this.renderColorPieChart();
        this.renderColorTimeline();
        this.updateColorMetrics();
    }

    renderColorPieChart() {
        const container = AppUtils.getElement('#colorPieChart');
        if (!container) return;

        const patterns = this.trendData.patterns.color;
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 8px;">📊</div>
                <div>Color Distribution Chart</div>
                <div style="font-size: 12px; margin-top: 8px;">
                    Red ${patterns.red.percentage}% | 
                    Green ${patterns.green.percentage}% | 
                    Purple ${patterns.purple.percentage}%
                </div>
            </div>
        `;
    }

    renderColorTimeline() {
        const container = AppUtils.getElement('#colorTimeline');
        if (!container) return;

        const recent50 = this.trendData.history.slice(-50);
        let html = '';

        recent50.forEach(item => {
            html += `
                <div class="color-dot ${item.color}" title="Period: ${item.period}, Number: ${item.number}">
                    ${item.number}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateColorMetrics() {
        const patterns = this.trendData.patterns.color;
        
        AppUtils.safeExecute(() => {
            AppUtils.getElement('#redRatio').textContent = `${patterns.red.percentage}%`;
            AppUtils.getElement('#greenRatio').textContent = `${patterns.green.percentage}%`;
            AppUtils.getElement('#purpleRatio').textContent = `${patterns.purple.percentage}%`;
        });
    }

    updateSmartAnalysis() {
        const insights = this.generateSmartInsights();
        const container = AppUtils.getElement('#trendInsights');
        if (!container) return;

        let html = '';
        insights.forEach((insight, index) => {
            html += `
                <div class="insight-item">
                    <div class="insight-icon">
                        <span class="material-icons-round">${insight.icon}</span>
                    </div>
                    <div class="insight-text">${insight.text}</div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Update next period prediction
        const prediction = this.generateNextPeriodPrediction();
        AppUtils.safeExecute(() => {
            AppUtils.getElement('#nextTrendPrediction').textContent = prediction;
        });
    }

    generateSmartInsights() {
        const insights = [];
        const analysis = this.trendData.analysis;

        // Hot number analysis
        if (analysis.hot.length > 0) {
            const hotNumber = analysis.hot[0];
            insights.push({
                icon: 'local_fire_department',
                text: `Number ${hotNumber.number} is currently hottest, appeared ${hotNumber.count} times, frequency ${hotNumber.percentage}%`
            });
        }

        // Cold number analysis
        if (analysis.cold.length > 0) {
            const coldNumber = analysis.cold[0];
            insights.push({
                icon: 'ac_unit',
                text: `Number ${coldNumber.number} is currently coldest, only appeared ${coldNumber.count} times, watch for comeback`
            });
        }

        // Trend analysis
        analysis.trends.forEach(trend => {
            const trendMap = {
                'big': 'Big numbers', 'small': 'Small numbers',
                'odd': 'Odd numbers', 'even': 'Even numbers'
            };
            insights.push({
                icon: 'trending_up',
                text: `${trendMap[trend.trend]} showing strong trend, appeared ${trend.count} times in last 20 draws`
            });
        });

        return insights;
    }

    generateNextPeriodPrediction() {
        const recent = this.trendData.history.slice(-10);
        const trends = this.trendData.analysis.trends;

        if (trends.length > 0) {
            const mainTrend = trends[0];
            const trendMap = {
                'big': 'Big numbers dominant', 'small': 'Small numbers dominant',
                'odd': 'Odd numbers dominant', 'even': 'Even numbers dominant'
            };
            return trendMap[mainTrend.trend] || 'Balanced development';
        }

        return 'Balanced development';
    }

    renderMissingAnalysis() {
        this.renderNumberMissing();
        this.renderPatternMissing();
        this.updateMissingSummary();
    }

    renderNumberMissing() {
        const container = AppUtils.getElement('#numberMissingGrid');
        if (!container) return;

        const missing = this.trendData.missing.numbers;
        let html = '';

        for (let num = 0; num <= 9; num++) {
            const missingCount = missing[num];
            const level = missingCount > 10 ? 'high' : missingCount > 5 ? 'medium' : 'low';
            
            html += `
                <div class="missing-item" data-number="${num}" data-missing="${missingCount}">
                    <div class="missing-number">${num}</div>
                    <div class="missing-count">Missing ${missingCount} draws</div>
                    <div class="missing-days ${level}">${this.getMissingLevel(missingCount)}</div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderPatternMissing() {
        const container = AppUtils.getElement('#patternMissingGrid');
        if (!container) return;

        const missing = this.trendData.missing.patterns;
        const patterns = [
            { key: 'big', name: 'Big' },
            { key: 'small', name: 'Small' },
            { key: 'odd', name: 'Odd' },
            { key: 'even', name: 'Even' },
            { key: 'red', name: 'Red' },
            { key: 'green', name: 'Green' },
            { key: 'purple', name: 'Purple' }
        ];

        let html = '';
        patterns.forEach(pattern => {
            const missingCount = missing[pattern.key] || 0;
            
            html += `
                <div class="missing-item" data-pattern="${pattern.key}" data-missing="${missingCount}">
                    <div class="missing-number">${pattern.name}</div>
                    <div class="missing-count">Missing ${missingCount} draws</div>
                    <div class="missing-days">${this.getMissingLevel(missingCount)}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    getMissingLevel(count) {
        if (count > 15) return 'Very high';
        if (count > 10) return 'High';
        if (count > 5) return 'Medium';
        return 'Normal';
    }

    updateMissingSummary() {
        const missing = this.trendData.missing.numbers;
        const missingValues = Object.values(missing);
        
        const maxMissing = Math.max(...missingValues);
        const avgMissing = (missingValues.reduce((sum, val) => sum + val, 0) / missingValues.length).toFixed(1);
        const returnNumbers = missingValues.filter(val => val > 10).length;

        AppUtils.safeExecute(() => {
            AppUtils.getElement('#maxMissing').textContent = `${maxMissing} draws`;
            AppUtils.getElement('#avgMissing').textContent = `${avgMissing} draws`;
            AppUtils.getElement('#returnNumbers').textContent = `${returnNumbers} numbers`;
        });
    }

    switchMissingType(type) {
        // Update tab status
        document.querySelectorAll('.missing-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-type="${type}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Switch content display
        document.querySelectorAll('.missing-grid').forEach(grid => {
            grid.classList.remove('active');
        });
        
        const activeGrid = AppUtils.getElement(`#${type}MissingGrid`);
        if (activeGrid) {
            activeGrid.classList.add('active');
        }
    }

    renderComparisonAnalysis() {
        const container = AppUtils.getElement('#comparisonChart');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                <div style="font-size: 18px; margin-bottom: 8px;">Historical Comparison Chart</div>
                <div style="font-size: 14px;">Showing data comparison trends across different periods</div>
            </div>
        `;
    }

    updateTrendPeriod(period) {
        // Regenerate data for specified period
        this.generateComprehensiveTrendData();
        this.renderTrendStatusCard();
        this.refreshCurrentChart();
        this.updateSmartAnalysis();
        this.renderMissingAnalysis();
        
        this.showToast(`Switched to last ${period} draws analysis`);
    }

    updateComparisonPeriod(period) {
        this.renderComparisonAnalysis();
        this.showToast(`Switched to ${period} comparison analysis`);
    }

    refreshCurrentChart() {
        const activeChart = document.querySelector('.trend-chart.active');
        if (!activeChart) return;

        const chartType = activeChart.id.replace('-chart', '');
        this.renderChart(chartType);
        this.showToast('Chart data refreshed');
    }

    showNumberDetailModal(number) {
        const data = this.trendData.frequencies[number];
        if (!data) return;

        const modal = document.createElement('div');
        modal.className = 'trend-detail-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Number ${number} Detailed Analysis</h3>
                    <button class="modal-close" onclick="this.closest('.trend-detail-modal').remove()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="detail-stats">
                        <div class="stat-item">
                            <div class="stat-label">Appearance Count</div>
                            <div class="stat-value">${data.count} times</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Appearance Frequency</div>
                            <div class="stat-value">${data.percentage}%</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Current Missing</div>
                            <div class="stat-value">${data.missing} draws</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Last Appeared</div>
                            <div class="stat-value">${data.lastAppear || 'Unknown'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    }

    showMissingDetailModal(data) {
        const { number, pattern, missing } = data;
        const title = number ? `Number ${number}` : `Pattern ${pattern}`;
        
        const modal = document.createElement('div');
        modal.className = 'trend-detail-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title} Missing Analysis</h3>
                    <button class="modal-close" onclick="this.closest('.trend-detail-modal').remove()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="missing-detail">
                        <div class="missing-level ${this.getMissingLevel(missing).toLowerCase()}">
                            Current missing: ${missing} draws (${this.getMissingLevel(missing)})
                        </div>
                        <div class="missing-advice">
                            ${this.getMissingAdvice(missing)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    }

    getMissingAdvice(missing) {
        if (missing > 15) {
            return 'Extremely missing, highly recommended to watch, likely to return soon';
        } else if (missing > 10) {
            return 'Highly missing, worth watching, high probability of return';
        } else if (missing > 5) {
            return 'Moderately missing, keep watching, consider moderately';
        }
        return 'Normal missing, no special attention needed';
    }

    getLastAppearance(number) {
        const history = this.trendData.history;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].number === number) {
                return history[i].period;
            }
        }
        return null;
    }

    calculateMissing(number) {
        const history = this.trendData.history;
        let missing = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].number === number) break;
            missing++;
        }
        return missing;
    }

    generateTrendData() {
        const periodSelect = AppUtils.getElement('.period-select');
        const periods = periodSelect ? parseInt(periodSelect.value) : APP_CONSTANTS.DEFAULTS.CHART_DEFAULT_PERIODS;
        
        this.trendData.numbers = [];
        this.trendData.patterns = [];

        // Generate historical number data
        for (let i = 0; i < periods; i++) {
            const number = AppUtils.randomInt(0, 9);
            this.trendData.numbers.push({
                number: number,
                period: periods - i,
                big: number >= 5,
                odd: number % 2 === 1,
                color: AppUtils.getNumberColor(number)
            });
        }

        // Reverse array, newest first
        this.trendData.numbers.reverse();
    }

    switchChart(chartType) {
        // Remove active state from all tabs
        AppUtils.getElements('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });

        // Activate current tab
        const activeTab = AppUtils.getElement(`[data-chart="${chartType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Show corresponding chart
        this.showChart(chartType);
    }

    showChart(chartType) {
        // Hide all charts
        AppUtils.getElements('.trend-chart').forEach(chart => {
            chart.classList.remove('active');
        });

        // Show target chart
        const targetChart = AppUtils.getElement(`${chartType}-chart`);
        if (targetChart) {
            targetChart.classList.add('active');
            
            // Generate content based on chart type
            switch (chartType) {
                case 'number':
                    this.renderNumberTrend();
                    break;
                case 'size':
                    this.renderSizeTrend();
                    break;
                case 'parity':
                    this.renderParityTrend();
                    break;
                case 'color':
                    this.renderColorTrend();
                    break;
            }
        }
    }

    renderNumberTrend() {
        const container = AppUtils.getElement('.number-trend-grid');
        if (!container) return;

        // Count appearances of each number
        const numberStats = {};
        for (let i = 0; i <= 9; i++) {
            numberStats[i] = 0;
        }

        this.trendData.numbers.forEach(item => {
            numberStats[item.number]++;
        });

        // Determine hot and cold numbers
        const counts = Object.values(numberStats);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

        container.innerHTML = '';
        for (let i = 0; i <= 9; i++) {
            const count = numberStats[i];
            const element = document.createElement('div');
            element.className = 'trend-number';
            element.textContent = i;

            // Determine heat
            if (count >= avgCount + 2) {
                element.classList.add('hot');
            } else if (count <= avgCount - 2) {
                element.classList.add('cold');
            }

            // Check if appeared in recent 5 draws
            const recentNumbers = this.trendData.numbers.slice(-5).map(item => item.number);
            if (recentNumbers.includes(i)) {
                element.classList.add('recent');
            }

            // Add click event to show details
            element.addEventListener('click', () => {
                AppUtils.safeExecute(() => this.showNumberDetail(i, count), this);
            });

            container.appendChild(element);
        }
    }

    renderSizeTrend() {
        const container = AppUtils.getElement('#size-trend-line');
        if (!container) return;

        container.innerHTML = '';
        
        // Get last 20 draws data
        const recentData = this.trendData.numbers.slice(-20);
        
        recentData.forEach(item => {
            const point = document.createElement('div');
            point.className = 'trend-point';
            point.textContent = item.number;
            
            if (item.big) {
                point.classList.add('big');
                point.title = `${item.number} - Big`;
            } else {
                point.classList.add('small');
                point.title = `${item.number} - Small`;
            }

            container.appendChild(point);
        });

        // Update statistics
        this.updateSizeStats();
    }

    renderParityTrend() {
        const container = AppUtils.getElement('#parity-trend-line');
        if (!container) return;

        container.innerHTML = '';
        
        // Get last 20 draws data
        const recentData = this.trendData.numbers.slice(-20);
        
        recentData.forEach(item => {
            const point = document.createElement('div');
            point.className = 'trend-point';
            point.textContent = item.number;
            
            if (item.odd) {
                point.classList.add('odd');
                point.title = `${item.number} - Odd`;
            } else {
                point.classList.add('even');
                point.title = `${item.number} - Even`;
            }

            container.appendChild(point);
        });

        // Update statistics
        this.updateParityStats();
    }

    renderColorTrend() {
        const container = AppUtils.getElement('.color-trend-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // Get last 30 draws data
        const recentData = this.trendData.numbers.slice(-30);
        
        recentData.forEach(item => {
            const point = document.createElement('div');
            point.className = `color-point ${item.color}`;
            point.textContent = item.number;
            point.title = `${item.number} - ${this.getColorName(item.color)}`;

            container.appendChild(point);
        });

        // Update statistics
        this.updateColorStats();
    }

    getColorName(color) {
        const colorNames = {
            'red': 'Red',
            'green': 'Green',
            'purple': 'Purple'
        };
        return colorNames[color] || color;
    }

    updateSizeStats() {
        const bigCount = this.trendData.numbers.filter(item => item.big).length;
        const smallCount = this.trendData.numbers.length - bigCount;
        const total = this.trendData.numbers.length;

        const bigRate = AppUtils.getElement('big-rate');
        const smallRate = AppUtils.getElement('small-rate');
        const sizeStreak = AppUtils.getElement('size-streak');

        if (bigRate) bigRate.textContent = ((bigCount / total) * 100).toFixed(1) + '%';
        if (smallRate) smallRate.textContent = ((smallCount / total) * 100).toFixed(1) + '%';
        if (sizeStreak) {
            // Calculate current streak
            let streak = 0;
            const lastType = this.trendData.numbers[this.trendData.numbers.length - 1]?.big;
            for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
                if (this.trendData.numbers[i].big === lastType) {
                    streak++;
                } else {
                    break;
                }
            }
            sizeStreak.textContent = `${streak} ${lastType ? 'Big' : 'Small'}`;
        }
    }

    updateParityStats() {
        const oddCount = this.trendData.numbers.filter(item => item.odd).length;
        const evenCount = this.trendData.numbers.length - oddCount;
        const total = this.trendData.numbers.length;

        const oddRate = AppUtils.getElement('odd-rate');
        const evenRate = AppUtils.getElement('even-rate');
        const parityStreak = AppUtils.getElement('parity-streak');

        if (oddRate) oddRate.textContent = ((oddCount / total) * 100).toFixed(1) + '%';
        if (evenRate) evenRate.textContent = ((evenCount / total) * 100).toFixed(1) + '%';
        if (parityStreak) {
            // Calculate current streak
            let streak = 0;
            const lastType = this.trendData.numbers[this.trendData.numbers.length - 1]?.odd;
            for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
                if (this.trendData.numbers[i].odd === lastType) {
                    streak++;
                } else {
                    break;
                }
            }
            parityStreak.textContent = `${streak} ${lastType ? 'Odd' : 'Even'}`;
        }
    }

    updateColorStats() {
        const colorCounts = { red: 0, green: 0, purple: 0 };
        this.trendData.numbers.forEach(item => {
            colorCounts[item.color]++;
        });

        const total = this.trendData.numbers.length;
        
        const redRate = AppUtils.getElement('red-rate');
        const greenRate = AppUtils.getElement('green-rate');
        const purpleRate = AppUtils.getElement('purple-rate');

        if (redRate) redRate.textContent = ((colorCounts.red / total) * 100).toFixed(1) + '%';
        if (greenRate) greenRate.textContent = ((colorCounts.green / total) * 100).toFixed(1) + '%';
        if (purpleRate) purpleRate.textContent = ((colorCounts.purple / total) * 100).toFixed(1) + '%';
    }

    updateCurrentChart() {
        const activeTab = AppUtils.getElement('.tab-item.active');
        if (activeTab) {
            const chartType = activeTab.getAttribute('data-chart');
            AppUtils.safeExecute(() => this.showChart(chartType), this);
        }
    }

    updateTrendAnalysis() {
        const hotAnalysis = AppUtils.getElement('hot-analysis');
        const coldAnalysis = AppUtils.getElement('cold-analysis');
        const patternAnalysis = AppUtils.getElement('pattern-analysis');

        // Analyze hot numbers
        const numberStats = {};
        for (let i = 0; i <= 9; i++) {
            numberStats[i] = 0;
        }
        this.trendData.numbers.forEach(item => {
            numberStats[item.number]++;
        });

        const maxCount = Math.max(...Object.values(numberStats));
        const minCount = Math.min(...Object.values(numberStats));
        const hotNumbers = Object.keys(numberStats).filter(num => numberStats[num] === maxCount);
        const coldNumbers = Object.keys(numberStats).filter(num => numberStats[num] === minCount);

        if (hotAnalysis) {
            hotAnalysis.textContent = `Numbers ${hotNumbers.join(', ')} appear most frequently, ${maxCount} times total, recommended to watch`;
        }

        if (coldAnalysis) {
            coldAnalysis.textContent = `Numbers ${coldNumbers.join(', ')} appear least frequently, ${minCount} times total, possible rebound`;
        }

        if (patternAnalysis) {
            const recent5 = this.trendData.numbers.slice(-5);
            const bigCount = recent5.filter(item => item.big).length;
            const oddCount = recent5.filter(item => item.odd).length;
            
            let pattern = '';
            if (bigCount >= 4) pattern += 'Big numbers appearing continuously, ';
            if (bigCount <= 1) pattern += 'Small numbers appearing continuously, ';
            if (oddCount >= 4) pattern += 'Odd numbers dense, ';
            if (oddCount <= 1) pattern += 'Even numbers dense, ';
            
            pattern = pattern || 'Number distribution relatively balanced, ';
            patternAnalysis.textContent = pattern + 'recommend combining missing data analysis';
        }
    }

    updateMissingData() {
        this.updateNumberMissing();
        this.updatePatternMissing();
    }

    updateNumberMissing() {
        const container = AppUtils.getElement('number-missing');
        if (!container) return;

        // Calculate missing draws for each number
        const missingData = {};
        for (let i = 0; i <= 9; i++) {
            missingData[i] = 0;
        }

        // Calculate missing from newest
        for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
            const number = this.trendData.numbers[i].number;
            
            // Find this number, update missing for other numbers
            for (let j = 0; j <= 9; j++) {
                if (j === number) {
                    // Found, stop calculating missing for this number
                    continue;
                } else {
                    // Not found, continue accumulating missing
                    if (missingData[j] === 0) {
                        missingData[j] = this.trendData.numbers.length - i;
                    }
                }
            }
        }

        container.innerHTML = '';
        for (let i = 0; i <= 9; i++) {
            const missing = missingData[i];
            const item = document.createElement('div');
            item.className = 'missing-item';
            
            const number = document.createElement('div');
            number.className = 'missing-number';
            number.textContent = i;
            
            const count = document.createElement('div');
            count.className = 'missing-count';
            count.textContent = `Missing ${missing} draws`;
            
            // Set style based on missing draws
            if (missing >= 10) {
                count.classList.add('cold');
            } else if (missing <= 2) {
                count.classList.add('hot');
            }
            
            item.appendChild(number);
            item.appendChild(count);
            container.appendChild(item);
        }
    }

    updatePatternMissing() {
        const container = AppUtils.getElement('pattern-missing');
        if (!container) return;

        const patterns = [
            { name: 'Big', check: item => item.big },
            { name: 'Small', check: item => !item.big },
            { name: 'Odd', check: item => item.odd },
            { name: 'Even', check: item => !item.odd },
            { name: 'Red', check: item => item.color === 'red' },
            { name: 'Green', check: item => item.color === 'green' },
            { name: 'Purple', check: item => item.color === 'purple' }
        ];

        container.innerHTML = '';
        
        patterns.forEach(pattern => {
            let missing = 0;
            for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
                if (pattern.check(this.trendData.numbers[i])) {
                    break;
                }
                missing++;
            }

            const item = document.createElement('div');
            item.className = 'missing-item';
            
            const name = document.createElement('div');
            name.className = 'missing-number';
            name.textContent = pattern.name;
            
            const count = document.createElement('div');
            count.className = 'missing-count';
            count.textContent = `Missing ${missing} draws`;
            
            if (missing >= 8) {
                count.classList.add('cold');
            } else if (missing <= 1) {
                count.classList.add('hot');
            }
            
            item.appendChild(name);
            item.appendChild(count);
            container.appendChild(item);
        });
    }

    switchMissingData(type) {
        // Remove active state from all tabs
        AppUtils.getElements('.missing-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Activate current tab
        const activeTab = AppUtils.getElement(`[data-type="${type}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Show corresponding content
        AppUtils.getElements('.missing-grid').forEach(grid => {
            grid.classList.add('hidden');
        });

        const targetGrid = AppUtils.getElement(`${type}-missing`);
        if (targetGrid) {
            targetGrid.classList.remove('hidden');
        }
    }

    showNumberDetail(number, count) {
        const recent = this.trendData.numbers.filter(item => item.number === number).slice(-5);
        const periods = recent.map(item => `Period ${item.period}`).join(', ');
        
        this.showToast(`Number ${number}: Appeared ${count} times, Recent appearances: ${periods || 'None'}`);
    }

    setupPatternPageEvents() {
        // Pattern type switching
        AppUtils.getElements('.pattern-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const patternType = tab.getAttribute('data-pattern');
                AppUtils.safeExecute(() => this.switchPatternChart(patternType), this);
            });
        });

        // Period selection
        const roadPeriodSelect = AppUtils.getElement('.road-period-select');
        if (roadPeriodSelect) {
            roadPeriodSelect.addEventListener('change', () => {
                AppUtils.safeExecute(() => this.generatePatternData(), this);
                AppUtils.safeExecute(() => this.updateCurrentPatternChart(), this);
            });
        }

        // Pattern refresh button
        const patternRefreshBtn = AppUtils.getElement('.pattern-refresh-btn');
        if (patternRefreshBtn) {
            patternRefreshBtn.addEventListener('click', AppUtils.debounce(() => {
                AppUtils.safeExecute(() => this.generatePatternData(), this);
                AppUtils.safeExecute(() => this.updateCurrentPatternChart(), this);
                AppUtils.safeExecute(() => this.updatePatternAnalysis(), this);
                AppUtils.safeExecute(() => this.updatePatternStats(), this);
                AppUtils.safeExecute(() => this.updatePatternPrediction(), this);
            }, 1000));
        }

        // Pattern cell click event
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('road-cell')) {
                AppUtils.safeExecute(() => this.showRoadCellDetail(e.target), this);
            }
        });
    }

    generatePatternData() {
        const roadPeriodSelect = AppUtils.getElement('.road-period-select');
        const periods = roadPeriodSelect ? parseInt(roadPeriodSelect.value) : APP_CONSTANTS.DEFAULTS.CHART_DEFAULT_PERIODS;
        
        this.patternData.roads = [];

        // Generate historical pattern data
        for (let i = 0; i < periods; i++) {
            const number = AppUtils.randomInt(0, 9);
            const roadEntry = {
                number: number,
                period: periods - i,
                big: number >= 5,
                odd: number % 2 === 1,
                color: AppUtils.getNumberColor(number),
                timestamp: new Date(Date.now() - i * 5 * 60 * 1000) // Every 5 minutes
            };
            this.patternData.roads.push(roadEntry);
        }

        // Reverse array, newest first
        this.patternData.roads.reverse();
    }

    switchPatternChart(patternType) {
        // Remove active state from all tabs
        AppUtils.getElements('.pattern-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Activate current tab
        const activeTab = AppUtils.getElement(`[data-pattern="${patternType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Show corresponding pattern
        this.showPatternChart(patternType);
    }

    showPatternChart(patternType) {
        // Hide all pattern charts
        AppUtils.getElements('.pattern-chart').forEach(chart => {
            chart.classList.remove('active');
        });

        // Show target chart
        const targetChart = AppUtils.getElement(`${patternType}-pattern`);
        if (targetChart) {
            targetChart.classList.add('active');
            
            // Generate content based on pattern type
            switch (patternType) {
                case 'size':
                    this.renderSizeRoad();
                    break;
                case 'parity':
                    this.renderParityRoad();
                    break;
                case 'color':
                    this.renderColorRoad();
                    break;
                case 'comprehensive':
                    this.renderComprehensiveRoad();
                    break;
            }
        }
    }

    renderSizeRoad() {
        const container = AppUtils.getElement('size-road-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // Analyze size pattern, arrange by continuity
        const roadData = this.analyzeRoadPattern(this.patternData.roads, 'big');
        
        roadData.forEach((cell, index) => {
            const roadCell = document.createElement('div');
            roadCell.className = `road-cell ${cell.type}`;
            roadCell.textContent = cell.number;
            roadCell.title = `Period ${cell.period}: ${cell.number} (${cell.type === 'big' ? 'Big' : 'Small'})`;
            roadCell.setAttribute('data-period', cell.period);
            roadCell.setAttribute('data-number', cell.number);
            
            // Mark streak
            if (cell.isStreak && cell.streakLength > 2) {
                roadCell.classList.add('streak');
            }

            container.appendChild(roadCell);
        });

        // Update statistics
        this.updateSizeRoadStats(roadData);
    }

    renderParityRoad() {
        const container = AppUtils.getElement('parity-road-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // Analyze parity pattern
        const roadData = this.analyzeRoadPattern(this.patternData.roads, 'odd');
        
        roadData.forEach((cell, index) => {
            const roadCell = document.createElement('div');
            roadCell.className = `road-cell ${cell.type}`;
            roadCell.textContent = cell.number;
            roadCell.title = `Period ${cell.period}: ${cell.number} (${cell.type === 'odd' ? 'Odd' : 'Even'})`;
            roadCell.setAttribute('data-period', cell.period);
            roadCell.setAttribute('data-number', cell.number);
            
            // Mark streak
            if (cell.isStreak && cell.streakLength > 2) {
                roadCell.classList.add('streak');
            }

            container.appendChild(roadCell);
        });

        // Update statistics
        this.updateParityRoadStats(roadData);
    }

    renderColorRoad() {
        const container = AppUtils.getElement('color-road-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // Analyze color pattern
        const roadData = this.analyzeColorRoadPattern(this.patternData.roads);
        
        roadData.forEach((cell, index) => {
            const roadCell = document.createElement('div');
            roadCell.className = `road-cell ${cell.color}`;
            roadCell.textContent = cell.number;
            roadCell.title = `Period ${cell.period}: ${cell.number} (${this.getColorName(cell.color)})`;
            roadCell.setAttribute('data-period', cell.period);
            roadCell.setAttribute('data-number', cell.number);
            
            // Mark streak
            if (cell.isStreak && cell.streakLength > 2) {
                roadCell.classList.add('streak');
            }

            container.appendChild(roadCell);
        });

        // Update statistics
        this.updateColorRoadStats(roadData);
    }

    renderComprehensiveRoad() {
        // Render size road
        this.renderMiniRoad('mini-size-road', 'big');
        // Render parity road
        this.renderMiniRoad('mini-parity-road', 'odd');
        // Render color road
        this.renderMiniColorRoad('mini-color-road');
    }

    renderMiniRoad(containerId, property) {
        const container = AppUtils.getElement(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        const roadData = this.analyzeRoadPattern(this.patternData.roads.slice(-20), property);
        
        roadData.forEach(cell => {
            const miniCell = document.createElement('div');
            miniCell.className = `mini-road-cell ${cell.type}`;
            miniCell.textContent = cell.number;
            miniCell.title = `${cell.number}`;
            
            container.appendChild(miniCell);
        });
    }

    renderMiniColorRoad(containerId) {
        const container = AppUtils.getElement(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        const recentData = this.patternData.roads.slice(-20);
        
        recentData.forEach(item => {
            const miniCell = document.createElement('div');
            miniCell.className = `mini-road-cell ${item.color}`;
            miniCell.textContent = item.number;
            miniCell.title = `${item.number}`;
            
            container.appendChild(miniCell);
        });
    }

    analyzeRoadPattern(data, property) {
        const roadData = [];
        let currentStreak = 1;
        let currentType = null;

        data.forEach((item, index) => {
            const type = item[property] ? (property === 'big' ? 'big' : 'odd') : (property === 'big' ? 'small' : 'even');
            
            // Check if continuous
            if (type === currentType) {
                currentStreak++;
            } else {
                currentStreak = 1;
                currentType = type;
            }

            roadData.push({
                number: item.number,
                period: item.period,
                type: type,
                isStreak: currentStreak > 1,
                streakLength: currentStreak
            });
        });

        return roadData;
    }

    analyzeColorRoadPattern(data) {
        const roadData = [];
        let currentStreak = 1;
        let currentColor = null;

        data.forEach((item, index) => {
            const color = item.color;
            
            // Check if continuous
            if (color === currentColor) {
                currentStreak++;
            } else {
                currentStreak = 1;
                currentColor = color;
            }

            roadData.push({
                number: item.number,
                period: item.period,
                color: color,
                isStreak: currentStreak > 1,
                streakLength: currentStreak
            });
        });

        return roadData;
    }

    updateSizeRoadStats(roadData) {
        const bigStreaks = this.calculateStreaks(roadData, 'big');
        const smallStreaks = this.calculateStreaks(roadData, 'small');
        const jumps = this.calculateJumps(roadData);

        const bigStreakElement = AppUtils.getElement('big-streak');
        const smallStreakElement = AppUtils.getElement('small-streak');
        const sizeJumpsElement = AppUtils.getElement('size-jumps');

        if (bigStreakElement) bigStreakElement.textContent = Math.max(...bigStreaks, 0);
        if (smallStreakElement) smallStreakElement.textContent = Math.max(...smallStreaks, 0);
        if (sizeJumpsElement) sizeJumpsElement.textContent = jumps;
    }

    updateParityRoadStats(roadData) {
        const oddStreaks = this.calculateStreaks(roadData, 'odd');
        const evenStreaks = this.calculateStreaks(roadData, 'even');
        const jumps = this.calculateJumps(roadData);

        const oddStreakElement = AppUtils.getElement('odd-streak');
        const evenStreakElement = AppUtils.getElement('even-streak');
        const parityJumpsElement = AppUtils.getElement('parity-jumps');

        if (oddStreakElement) oddStreakElement.textContent = Math.max(...oddStreaks, 0);
        if (evenStreakElement) evenStreakElement.textContent = Math.max(...evenStreaks, 0);
        if (parityJumpsElement) parityJumpsElement.textContent = jumps;
    }

    updateColorRoadStats(roadData) {
        const redStreaks = this.calculateColorStreaks(roadData, 'red');
        const greenStreaks = this.calculateColorStreaks(roadData, 'green');
        const purpleStreaks = this.calculateColorStreaks(roadData, 'purple');

        const redStreakElement = AppUtils.getElement('red-streak');
        const greenStreakElement = AppUtils.getElement('green-streak');
        const purpleStreakElement = AppUtils.getElement('purple-streak');

        if (redStreakElement) redStreakElement.textContent = Math.max(...redStreaks, 0);
        if (greenStreakElement) greenStreakElement.textContent = Math.max(...greenStreaks, 0);
        if (purpleStreakElement) purpleStreakElement.textContent = Math.max(...purpleStreaks, 0);
    }

    calculateStreaks(roadData, type) {
        const streaks = [];
        let currentStreak = 0;

        roadData.forEach(cell => {
            if (cell.type === type) {
                currentStreak++;
            } else {
                if (currentStreak > 0) {
                    streaks.push(currentStreak);
                }
                currentStreak = 0;
            }
        });

        if (currentStreak > 0) {
            streaks.push(currentStreak);
        }

        return streaks;
    }

    calculateColorStreaks(roadData, color) {
        const streaks = [];
        let currentStreak = 0;

        roadData.forEach(cell => {
            if (cell.color === color) {
                currentStreak++;
            } else {
                if (currentStreak > 0) {
                    streaks.push(currentStreak);
                }
                currentStreak = 0;
            }
        });

        if (currentStreak > 0) {
            streaks.push(currentStreak);
        }

        return streaks;
    }

    calculateJumps(roadData) {
        let jumps = 0;
        let lastType = null;

        roadData.forEach(cell => {
            if (lastType && lastType !== cell.type) {
                jumps++;
            }
            lastType = cell.type;
        });

        return jumps;
    }

    updateCurrentPatternChart() {
        const activeTab = AppUtils.getElement('.pattern-tab.active');
        if (activeTab) {
            const patternType = activeTab.getAttribute('data-pattern');
            AppUtils.safeExecute(() => this.showPatternChart(patternType), this);
        }
    }

    updatePatternAnalysis() {
        const currentPatternElement = AppUtils.getElement('current-pattern');
        const patternTrendElement = AppUtils.getElement('pattern-trend');
        const patternSuggestionElement = AppUtils.getElement('pattern-suggestion');

        // Analyze current pattern
        const recent5 = this.patternData.roads.slice(-5);
        const bigCount = recent5.filter(item => item.big).length;
        const oddCount = recent5.filter(item => item.odd).length;
        const colorCounts = this.getColorCounts(recent5);

        let currentPattern = '';
        if (bigCount >= 4) currentPattern += 'Big numbers strong ';
        if (bigCount <= 1) currentPattern += 'Small numbers strong ';
        if (oddCount >= 4) currentPattern += 'Odd numbers dense ';
        if (oddCount <= 1) currentPattern += 'Even numbers dense ';

        currentPattern = currentPattern || 'Pattern balanced';

        // Analyze trend
        const recent10 = this.patternData.roads.slice(-10);
        const sizeJumps = this.calculateJumps(this.analyzeRoadPattern(recent10, 'big'));
        const parityJumps = this.calculateJumps(this.analyzeRoadPattern(recent10, 'odd'));

        let trend = '';
        if (sizeJumps > 6) trend += 'Size jumping frequently ';
        if (parityJumps > 6) trend += 'Parity jumping frequently ';
        if (sizeJumps <= 3 && parityJumps <= 3) trend = 'Pattern relatively stable';

        trend = trend || 'Pattern normal jumping';

        // Prediction suggestion
        const lastItem = this.patternData.roads[this.patternData.roads.length - 1];
        let suggestion = '';
        
        if (lastItem.big && bigCount >= 3) {
            suggestion = 'Big numbers appearing continuously, watch small numbers';
        } else if (!lastItem.big && bigCount <= 2) {
            suggestion = 'Small numbers appearing continuously, watch big numbers';
        } else if (lastItem.odd && oddCount >= 3) {
            suggestion = 'Odd numbers appearing continuously, watch even numbers';
        } else if (!lastItem.odd && oddCount <= 2) {
            suggestion = 'Even numbers appearing continuously, watch odd numbers';
        } else {
            suggestion = 'Current pattern relatively balanced, follow trend';
        }

        if (currentPatternElement) currentPatternElement.textContent = currentPattern;
        if (patternTrendElement) patternTrendElement.textContent = trend;
        if (patternSuggestionElement) patternSuggestionElement.textContent = suggestion;
    }

    updatePatternStats() {
        const sizeTotalJumpsElement = AppUtils.getElement('size-total-jumps');
        const parityTotalJumpsElement = AppUtils.getElement('parity-total-jumps');
        const colorTotalJumpsElement = AppUtils.getElement('color-total-jumps');
        const maxStreakElement = AppUtils.getElement('max-streak');
        const patternIndexElement = AppUtils.getElement('pattern-index');

        // Calculate total jumps
        const sizeRoadData = this.analyzeRoadPattern(this.patternData.roads, 'big');
        const parityRoadData = this.analyzeRoadPattern(this.patternData.roads, 'odd');
        const colorRoadData = this.analyzeColorRoadPattern(this.patternData.roads);

        const sizeJumps = this.calculateJumps(sizeRoadData);
        const parityJumps = this.calculateJumps(parityRoadData);
        const colorJumps = this.calculateColorJumps(colorRoadData);

        // Calculate longest streak
        const allStreaks = [
            ...this.calculateStreaks(sizeRoadData, 'big'),
            ...this.calculateStreaks(sizeRoadData, 'small'),
            ...this.calculateStreaks(parityRoadData, 'odd'),
            ...this.calculateStreaks(parityRoadData, 'even')
        ];
        const maxStreak = Math.max(...allStreaks, 0);

        // Calculate regularity index
        const totalPeriods = this.patternData.roads.length;
        const avgJumps = (sizeJumps + parityJumps + colorJumps) / 3;
        const expectedJumps = totalPeriods * 0.5; // Theoretical 50% jump rate
        const patternIndex = Math.max(0, Math.min(100, (1 - Math.abs(avgJumps - expectedJumps) / expectedJumps) * 100));

        if (sizeTotalJumpsElement) sizeTotalJumpsElement.textContent = sizeJumps;
        if (parityTotalJumpsElement) parityTotalJumpsElement.textContent = parityJumps;
        if (colorTotalJumpsElement) colorTotalJumpsElement.textContent = colorJumps;
        if (maxStreakElement) maxStreakElement.textContent = maxStreak;
        if (patternIndexElement) patternIndexElement.textContent = patternIndex.toFixed(0) + '%';
    }

    calculateColorJumps(roadData) {
        let jumps = 0;
        let lastColor = null;

        roadData.forEach(cell => {
            if (lastColor && lastColor !== cell.color) {
                jumps++;
            }
            lastColor = cell.color;
        });

        return jumps;
    }

    updatePatternPrediction() {
        const recent5 = this.patternData.roads.slice(-5);
        const recent10 = this.patternData.roads.slice(-10);

        // Size prediction
        const bigRate = recent10.filter(item => item.big).length / recent10.length;
        const sizePreference = bigRate < 0.4 ? 'big' : bigRate > 0.6 ? 'small' : (AppUtils.randomInt(0, 1) > 0.5 ? 'big' : 'small');
        const sizeProb = AppUtils.randomInt(50, 70) + AppUtils.randomInt(0, 20);

        // Parity prediction
        const oddRate = recent10.filter(item => item.odd).length / recent10.length;
        const parityPreference = oddRate < 0.4 ? 'odd' : oddRate > 0.6 ? 'even' : (AppUtils.randomInt(0, 1) > 0.5 ? 'odd' : 'even');
        const parityProb = AppUtils.randomInt(50, 70) + AppUtils.randomInt(0, 20);

        // Color prediction
        const colorCounts = this.getColorCounts(recent10);
        const minColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] < colorCounts[b] ? a : b);
        const colorProb = AppUtils.randomInt(60, 85);

        // Update display
        this.updatePredictionDisplay('size-prediction', 'size-prob', sizePreference, sizeProb);
        this.updatePredictionDisplay('parity-prediction', 'parity-prob', parityPreference, parityProb);
        this.updatePredictionDisplay('color-prediction', 'color-prob', minColor, colorProb);

        // Update confidence
        const avgProb = (sizeProb + parityProb + colorProb) / 3;
        const confidenceElement = AppUtils.getElement('prediction-confidence');
        if (confidenceElement) {
            confidenceElement.textContent = Math.floor(avgProb) + '%';
        }
    }

    updatePredictionDisplay(resultId, probId, preference, probability) {
        const resultElement = AppUtils.getElement(resultId);
        const probElement = AppUtils.getElement(probId);

        if (resultElement) {
            const choices = resultElement.querySelectorAll('.prediction-choice');
            choices.forEach(choice => {
                choice.classList.remove('active');
                const choiceText = choice.textContent.trim();
                
                if ((preference === 'big' && choiceText === 'Big') ||
                    (preference === 'small' && choiceText === 'Small') ||
                    (preference === 'odd' && choiceText === 'Odd') ||
                    (preference === 'even' && choiceText === 'Even') ||
                    (preference === 'red' && choiceText === 'Red') ||
                    (preference === 'green' && choiceText === 'Green') ||
                    (preference === 'purple' && choiceText === 'Purple')) {
                    choice.classList.add('active');
                }
            });
        }

        if (probElement) {
            probElement.textContent = probability + '%';
        }
    }

    getColorCounts(data) {
        const counts = { red: 0, green: 0, purple: 0 };
        data.forEach(item => {
            counts[item.color]++;
        });
        return counts;
    }

    showRoadCellDetail(cell) {
        const period = cell.getAttribute('data-period');
        const number = cell.getAttribute('data-number');
        const type = cell.className.includes('big') ? 'Big' : 
                    cell.className.includes('small') ? 'Small' :
                    cell.className.includes('odd') ? 'Odd' :
                    cell.className.includes('even') ? 'Even' :
                    cell.className.includes('red') ? 'Red' :
                    cell.className.includes('green') ? 'Green' :
                    cell.className.includes('purple') ? 'Purple' : '';

        this.showToast(`Period ${period}: ${number} (${type})`);
    }

    setupStrategyPageEvents() {
        // Strategy selection
        AppUtils.getElements('.strategy-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const strategy = item.getAttribute('data-strategy');
                AppUtils.safeExecute(() => this.switchStrategy(strategy), this);
            });
        });

        // Amount selection buttons
        AppUtils.getElements('.amount-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = parseInt(btn.getAttribute('data-amount'));
                AppUtils.safeExecute(() => this.selectAmount(amount), this);
            });
        });

        // Custom amount input
        const customAmountInput = AppUtils.getElement('.custom-amount');
        if (customAmountInput) {
            customAmountInput.addEventListener('input', (e) => {
                const amount = parseInt(e.target.value);
                if (amount > 0) {
                    AppUtils.safeExecute(() => this.selectAmount(amount), this);
                }
            });
        }

        // Parameter selection
        const profitTargetSelect = AppUtils.getElement('profit-target');
        const stopLossSelect = AppUtils.getElement('stop-loss');
        
        if (profitTargetSelect) {
            profitTargetSelect.addEventListener('change', (e) => {
                this.strategyData.config.profitTarget = parseInt(e.target.value);
                AppUtils.safeExecute(() => this.updateStrategyRecommendation(), this);
            });
        }

        if (stopLossSelect) {
            stopLossSelect.addEventListener('change', (e) => {
                this.strategyData.config.stopLoss = parseInt(e.target.value);
                AppUtils.safeExecute(() => this.updateStrategyRecommendation(), this);
            });
        }

        // Backtest button
        const backtestBtn = AppUtils.getElement('strategy-backtest-btn');
        if (backtestBtn) {
            backtestBtn.addEventListener('click', () => {
                this.showBacktestModal();
            });
        }

        // Period selection buttons
        AppUtils.getElements('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = btn.getAttribute('data-period');
                AppUtils.safeExecute(() => this.switchStatsPeriod(period), this);
            });
        });

        // Clear history button
        const clearHistoryBtn = AppUtils.getElement('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                this.clearBetHistory();
            });
        }

        // Backtest modal events
        this.setupBacktestModalEvents();
    }

    setupBacktestModalEvents() {
        // Close modal
        const closeModalBtn = AppUtils.getElement('close-backtest-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.hideBacktestModal();
            });
        }

        // Modal background click to close
        const modal = AppUtils.getElement('backtest-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.hideBacktestModal();
                }
            });
        }

        // Start backtest button
        const runBacktestBtn = AppUtils.getElement('run-backtest-btn');
        if (runBacktestBtn) {
            runBacktestBtn.addEventListener('click', () => {
                this.runBacktest();
            });
        }
    }

    generateStrategyData() {
        // Initialize strategy data structure
        this.strategyData = {
            current: 'ai', // Current strategy
            config: {
                baseAmount: this.config.baseAmount, // Use base amount from global config
                profitTarget: 200,
                stopLoss: 200
            },
            history: [],
            profitChart: [],
            stats: {
                totalProfit: 0,
                winRate: 0,
                totalBets: 0,
                maxStreak: 0
            }
        };

        console.log('Initializing strategy data, base amount:', this.strategyData.config.baseAmount);

        // Generate betting records
        for (let i = 0; i < 10; i++) {
            const isWin = AppUtils.randomInt(0, 1) > 0.3;
            const amount = this.strategyData.config.baseAmount + AppUtils.randomInt(0, 50);
            const profit = isWin ? Math.floor(amount * (0.8 + Math.random() * 0.4)) : -amount;
            
            this.strategyData.history.push({
                id: Date.now() + i,
                time: new Date(Date.now() - i * 5 * 60 * 1000),
                number: AppUtils.randomInt(0, 9),
                betType: ['Big', 'Small', 'Odd', 'Even', 'Red', 'Green', 'Purple'][AppUtils.randomInt(0, 6)],
                amount: amount,
                profit: profit,
                status: isWin ? 'win' : 'lose'
            });
        }

        // Calculate statistics
        this.calculateStrategyStats();

        // Generate profit chart data
        this.generateProfitChartData();

        console.log('Strategy data generation complete:', this.strategyData);
    }

    // Calculate strategy statistics
    calculateStrategyStats() {
        if (!this.strategyData.history.length) return;

        const totalProfit = this.strategyData.history.reduce((sum, record) => sum + record.profit, 0);
        const winCount = this.strategyData.history.filter(record => record.status === 'win').length;
        const winRate = Math.round((winCount / this.strategyData.history.length) * 100);
        
        // Calculate longest winning streak
        let maxStreak = 0;
        let currentStreak = 0;
        
        this.strategyData.history.forEach(record => {
            if (record.status === 'win') {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });

        this.strategyData.stats = {
            totalProfit,
            winRate,
            totalBets: this.strategyData.history.length,
            maxStreak
        };
    }

    generateProfitChartData() {
        this.strategyData.profitChart = [];
        let cumulative = 0;
        
        for (let i = 0; i < 15; i++) {
            const profit = Math.floor((Math.random() - 0.3) * 100);
            cumulative += profit;
            
            this.strategyData.profitChart.push({
                period: i + 1,
                profit: profit,
                cumulative: cumulative
            });
        }
    }

    switchStrategy(strategyType) {
        // Remove active state from all strategies
        AppUtils.getElements('.strategy-item').forEach(item => {
            item.classList.remove('active');
        });

        // Activate selected strategy
        const selectedStrategy = AppUtils.getElement(`[data-strategy="${strategyType}"]`);
        if (selectedStrategy) {
            selectedStrategy.classList.add('active');
        }

        // Update current strategy
        this.strategyData.current = strategyType;

        // Update strategy details
        this.updateStrategyDetails(strategyType);

        // Update recommendation
        this.updateStrategyRecommendation();

        this.showToast(`Switched to ${this.getStrategyName(strategyType)}`);
    }

    getStrategyName(strategyType) {
        const names = {
            'ai': 'AI Smart Strategy',
            'follow': 'Follow Trend Strategy',
            'reverse': 'Reverse Trend Strategy',
            'martin': 'Martingale Strategy',
            'flat': 'Flat Bet Strategy',
            'wave': 'Wave Strategy'
        };
        return names[strategyType] || 'Unknown Strategy';
    }

    getStrategyDescription(strategyType) {
        const descriptions = {
            'ai': 'Based on machine learning algorithms, analyzes historical data and real-time trends, intelligently recommends optimal betting solutions. Considers multiple dimensions including number heat, pattern rules, pattern analysis.',
            'follow': 'Follow current hot trend for betting, when a number or pattern appears continuously, continue following. Suitable for obvious trend periods, relatively low risk.',
            'reverse': 'Reverse betting strategy, when a pattern appears multiple times continuously, bet opposite result. Based on reversal principle, suitable for rebound situations.',
            'martin': 'Classic Martingale strategy, double bet after each loss until win. Theoretically guarantees profit, but requires sufficient capital support.',
            'flat': 'Fixed amount betting strategy, each bet amount remains same. Risk controllable, suitable for conservative investors, relatively stable long-term returns.',
            'wave': 'Wave betting strategy, adjust bet amount and frequency based on market fluctuations. Increase bets at lows, decrease at highs, pursue wave profits.'
        };
        return descriptions[strategyType] || 'No strategy description available';
    }

    updateStrategyDetails(strategyType) {
        const nameElement = AppUtils.getElement('current-strategy-name');
        const descElement = AppUtils.getElement('strategy-description');

        if (nameElement) {
            nameElement.textContent = this.getStrategyName(strategyType);
        }

        if (descElement) {
            descElement.textContent = this.getStrategyDescription(strategyType);
        }
    }

    selectAmount(amount) {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.config) {
            console.warn('Strategy data or config not initialized, cannot set amount');
            return;
        }

        // Remove active state from all amount buttons
        AppUtils.getElements('.amount-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // If preset amount, activate corresponding button
        const targetBtn = AppUtils.getElement(`[data-amount="${amount}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }

        // Update config
        this.strategyData.config.baseAmount = amount;

        // Update recommended amount
        this.updateRecommendationAmount();
    }

    updateRecommendationAmount() {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.config) {
            console.warn('Strategy data or config not initialized, cannot update recommended amount');
            return;
        }

        const amountElement = AppUtils.getElement('recommendation-amount');
        if (amountElement) {
            amountElement.textContent = `$${this.strategyData.config.baseAmount}`;
        }
    }

    updateStrategyRecommendation() {
        // Generate recommended numbers
        const numbers = [];
        const primaryNumber = AppUtils.randomInt(0, 9);
        numbers.push(primaryNumber);
        
        while (numbers.length < 3) {
            const num = AppUtils.randomInt(0, 9);
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }

        // Update recommended numbers display
        const numbersContainer = AppUtils.getElement('recommendation-numbers');
        if (numbersContainer) {
            numbersContainer.innerHTML = numbers.map((num, index) => 
                `<div class="rec-number ${index === 0 ? 'primary' : ''}">${num}</div>`
            ).join('');
        }

        // Update recommended patterns
        const patterns = this.generateRecommendationPatterns(numbers[0]);
        const patternsContainer = AppUtils.getElement('recommendation-patterns');
        if (patternsContainer) {
            patternsContainer.innerHTML = patterns.map(pattern => 
                `<span class="pattern-tag ${pattern.active ? 'active' : ''}">${pattern.name}</span>`
            ).join('');
        }

        // Update confidence
        const confidence = AppUtils.randomInt(70, 90);
        const confidenceElement = AppUtils.getElement('recommendation-confidence');
        if (confidenceElement) {
            confidenceElement.textContent = `${confidence}%`;
        }

        // Update recommendation reason
        const reasonElement = AppUtils.getElement('recommendation-reason');
        if (reasonElement) {
            reasonElement.textContent = this.generateRecommendationReason(numbers[0], patterns);
        }

        // Update recommended amount
        this.updateRecommendationAmount();
    }

    generateRecommendationPatterns(number) {
        return [
            { name: 'Big', active: number >= 5 },
            { name: 'Small', active: number < 5 },
            { name: 'Odd', active: number % 2 === 1 },
            { name: 'Even', active: number % 2 === 0 },
            { name: 'Red', active: [2, 4, 6, 8].includes(number) || number === 0 },
            { name: 'Green', active: [1, 3, 7, 9].includes(number) || number === 5 },
            { name: 'Purple', active: [0, 5].includes(number) }
        ].filter(p => p.active);
    }

    generateRecommendationReason(number, patterns) {
        const reasons = [
            `Based on AI analysis, number ${number} has been active recently, ${patterns.map(p => p.name).join('')} pattern appearing continuously, high probability this trend continues next draw.`,
            `Pattern analysis shows ${patterns.map(p => p.name).join('')} pattern about to rebound, number ${number} has high appearance potential.`,
            `Historical data shows number ${number} hit rate reaches 85% in current environment, recommend focusing.`,
            `Heat statistics show number ${number} in rising period, combined with ${patterns.map(p => p.name).join('')} pattern, recommend betting.`
        ];
        return reasons[AppUtils.randomInt(0, reasons.length - 1)];
    }

    updateStrategyStats() {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.stats) {
            console.warn('Strategy data not initialized, skipping stats update');
            return;
        }

        // Update total profit/loss
        const totalProfitElement = AppUtils.getElement('total-profit');
        if (totalProfitElement) {
            const profit = this.strategyData.stats.totalProfit;
            totalProfitElement.textContent = profit >= 0 ? `+$${profit}` : `-$${Math.abs(profit)}`;
            totalProfitElement.className = `stat-value ${profit >= 0 ? 'profit' : 'loss'}`;
        }

        // Update win rate
        const winRateElement = AppUtils.getElement('win-rate');
        if (winRateElement) {
            winRateElement.textContent = `${this.strategyData.stats.winRate}%`;
        }

        // Update total bets
        const totalBetsElement = AppUtils.getElement('total-bets');
        if (totalBetsElement) {
            totalBetsElement.textContent = this.strategyData.stats.totalBets;
        }

        // Update longest winning streak
        const maxStreakElement = AppUtils.getElement('max-streak');
        if (maxStreakElement) {
            maxStreakElement.textContent = this.strategyData.stats.maxStreak;
        }
    }

    switchStatsPeriod(period) {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.stats) {
            console.warn('Strategy data not initialized, cannot switch stats period');
            return;
        }

        // Remove active state from all period buttons
        AppUtils.getElements('.period-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Activate selected period button
        const selectedBtn = AppUtils.getElement(`[data-period="${period}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        // Update statistics based on period
        this.updateStatsByPeriod(period);
        this.showToast(`Switched to ${this.getPeriodName(period)} statistics`);
    }

    getPeriodName(period) {
        const names = {
            'today': 'Today',
            'week': 'This Week',
            'month': 'This Month'
        };
        return names[period] || 'Unknown Period';
    }

    updateStatsByPeriod(period) {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.stats) {
            console.warn('Strategy data not initialized, cannot update period statistics');
            return;
        }

        // Simulate different period statistics
        const statsData = {
            'today': { totalProfit: 48, winRate: 68, totalBets: 8, maxStreak: 3 },
            'week': { totalProfit: 156, winRate: 74, totalBets: 25, maxStreak: 5 },
            'month': { totalProfit: 248, winRate: 72, totalBets: 42, maxStreak: 7 }
        };

        const data = statsData[period] || statsData['today'];
        this.strategyData.stats = { ...this.strategyData.stats, ...data };
        this.updateStrategyStats();
    }

    renderProfitChart() {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.profitChart) {
            console.warn('Strategy data or profit chart data not initialized');
            return;
        }

        const chartContainer = AppUtils.getElement('profit-chart');
        if (!chartContainer) return;

        chartContainer.innerHTML = '';
        
        if (this.strategyData.profitChart.length === 0) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">No chart data available</div>';
            return;
        }
        
        const maxHeight = 100;
        const maxProfit = Math.max(...this.strategyData.profitChart.map(item => Math.abs(item.profit)));
        
        this.strategyData.profitChart.forEach(item => {
            const bar = document.createElement('div');
            bar.className = `chart-bar ${item.profit >= 0 ? 'profit' : 'loss'}`;
            
            const height = Math.max(5, Math.abs(item.profit) / maxProfit * maxHeight);
            bar.style.height = `${height}px`;
            bar.title = `Period ${item.period}: ${item.profit >= 0 ? '+' : ''}$${item.profit}`;
            
            chartContainer.appendChild(bar);
        });
    }

    updateBetHistory() {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.history) {
            console.warn('Strategy data or history not initialized');
            return;
        }

        const historyList = AppUtils.getElement('bet-history-list');
        if (!historyList) return;

        if (this.strategyData.history.length === 0) {
            historyList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📋</div>
                    <p>No betting records available</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.strategyData.history.map(bet => `
            <div class="bet-item">
                <div class="bet-info">
                    <div class="bet-detail">Number ${bet.number} - ${bet.betType}</div>
                    <div class="bet-time">${AppUtils.formatTime(bet.time)}</div>
                </div>
                <div class="bet-result">
                    <div class="bet-amount ${bet.status}">${bet.profit >= 0 ? '+' : ''}$${bet.profit}</div>
                    <div class="bet-status ${bet.status}">${bet.status === 'win' ? 'Win' : 'Lose'}</div>
                </div>
            </div>
        `).join('');
    }

    clearBetHistory() {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.history) {
            console.warn('Strategy data or history not initialized');
            return;
        }

        this.strategyData.history = [];
        this.updateBetHistory();
        this.showToast('Betting records cleared');
    }

    showBacktestModal() {
        const modal = AppUtils.getElement('backtest-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Reset backtest results
            const results = AppUtils.getElement('backtest-results');
            if (results) {
                results.classList.add('hidden');
            }
        }
    }

    hideBacktestModal() {
        const modal = AppUtils.getElement('backtest-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    runBacktest() {
        const periodsSelect = AppUtils.getElement('backtest-periods');
        const capitalInput = AppUtils.getElement('initial-capital');
        
        const periods = periodsSelect ? parseInt(periodsSelect.value) : APP_CONSTANTS.DEFAULTS.CHART_DEFAULT_PERIODS;
        const initialCapital = capitalInput ? parseInt(capitalInput.value) : 1000;

        // Show loading state
        const runBtn = AppUtils.getElement('run-backtest-btn');
        if (runBtn) {
            runBtn.textContent = 'Backtesting...';
            runBtn.disabled = true;
        }

        // Simulate backtest calculation
        setTimeout(() => {
            const results = this.calculateBacktestResults(periods, initialCapital);
            this.displayBacktestResults(results);
            
            // Restore button state
            if (runBtn) {
                runBtn.textContent = 'Start Backtest';
                runBtn.disabled = false;
            }
        }, 2000);
    }

    calculateBacktestResults(periods, initialCapital) {
        // Ensure strategy data exists
        if (!this.strategyData || !this.strategyData.config) {
            console.warn('Strategy data or config not initialized, using defaults for backtest');
            // Use default base amount
            const defaultBaseAmount = this.config.baseAmount;
            return this.performBacktestCalculation(periods, initialCapital, defaultBaseAmount);
        }

        return this.performBacktestCalculation(periods, initialCapital, this.strategyData.config.baseAmount);
    }

    // Core logic for backtest calculation
    performBacktestCalculation(periods, initialCapital, baseAmount) {
        let capital = initialCapital;
        let maxCapital = initialCapital;
        let minCapital = initialCapital;
        let wins = 0;
        let totalTrades = periods;
        
        const chartData = [];
        
        for (let i = 0; i < periods; i++) {
            const isWin = AppUtils.randomInt(0, 1) > 0.35; // 65% win rate
            const betAmount = Math.min(this.strategyData.config.baseAmount, capital * 0.1);
            
            if (isWin) {
                const profit = betAmount * (0.8 + Math.random() * 0.4);
                capital += profit;
                wins++;
            } else {
                capital -= betAmount;
            }
            
            maxCapital = Math.max(maxCapital, capital);
            minCapital = Math.min(minCapital, capital);
            
            chartData.push({
                period: i + 1,
                capital: capital
            });
        }

        const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
        const maxDrawdown = ((maxCapital - minCapital) / maxCapital) * 100;
        const winRate = (wins / totalTrades) * 100;
        const sharpeRatio = totalReturn / Math.max(maxDrawdown, 1);

        return {
            totalReturn: totalReturn.toFixed(1),
            maxDrawdown: maxDrawdown.toFixed(1),
            sharpeRatio: sharpeRatio.toFixed(2),
            winRate: winRate.toFixed(0),
            finalCapital: capital.toFixed(0),
            chartData: chartData
        };
    }

    displayBacktestResults(results) {
        // Update result values
        const returnElement = AppUtils.getElement('backtest-return');
        const drawdownElement = AppUtils.getElement('backtest-drawdown');
        const sharpeElement = AppUtils.getElement('backtest-sharpe');
        const winrateElement = AppUtils.getElement('backtest-winrate');

        if (returnElement) {
            returnElement.textContent = `${results.totalReturn >= 0 ? '+' : ''}${results.totalReturn}%`;
            returnElement.style.color = results.totalReturn >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        }
        if (drawdownElement) drawdownElement.textContent = `-${results.maxDrawdown}%`;
        if (sharpeElement) sharpeElement.textContent = results.sharpeRatio;
        if (winrateElement) winrateElement.textContent = `${results.winRate}%`;

        // Render capital curve
        this.renderBacktestChart(results.chartData);

        // Show results
        const resultsContainer = AppUtils.getElement('backtest-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');
        }

        this.showToast('Backtest completed');
    }

    renderBacktestChart(chartData) {
        const chartDisplay = AppUtils.getElement('backtest-chart');
        if (!chartDisplay) return;

        // Simple text display, can use chart library in actual project
        chartDisplay.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 24px; font-weight: bold; color: var(--primary-color); margin-bottom: 10px;">
                    $${chartData[chartData.length - 1].capital.toFixed(0)}
                </div>
                <div style="color: var(--text-secondary); margin-bottom: 15px;">Final Capital</div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
                    <span>Start: $${chartData[0].capital.toFixed(0)}</span>
                    <span>High: $${Math.max(...chartData.map(d => d.capital)).toFixed(0)}</span>
                    <span>Low: $${Math.min(...chartData.map(d => d.capital)).toFixed(0)}</span>
                </div>
            </div>
        `;
    }

    setupLanguageManager() {
        console.log('Setting up language manager...');
        
        // Simplify initialization, only set basic language
        try {
            i18n.init();
            console.log('Language manager initialization complete');
        } catch (error) {
            console.warn('Language manager initialization failed:', error);
        }
    }

    setupLanguageEvents() {
        console.log('Setting up language events...');
        
        // Language button click event
        const languageBtn = AppUtils.getElement('#languageBtn');
        const languageModal = AppUtils.getElement('#languageModal');
        const closeLanguageModal = AppUtils.getElement('#closeLanguageModal');
        
        if (languageBtn) {
            languageBtn.addEventListener('click', () => {
                this.showLanguageModal();
            });
        }
        
        if (closeLanguageModal) {
            closeLanguageModal.addEventListener('click', () => {
                this.hideLanguageModal();
            });
        }
        
        if (languageModal) {
            // Click overlay to close
            const overlay = languageModal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => {
                    this.hideLanguageModal();
                });
            }
            
            // Language selection event
            languageModal.querySelectorAll('.language-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lang = item.getAttribute('data-lang');
                    if (lang) {
                        console.log('Switching language to:', lang);
                        if (typeof i18n !== 'undefined' && i18n.setLanguage) {
                            i18n.setLanguage(lang);
                        }
                        this.hideLanguageModal();
                    }
                });
            });
        }
    }

    showLanguageModal() {
        const modal = AppUtils.getElement('languageModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateLanguageSelector();
        }
    }
    
    hideLanguageModal() {
        const modal = AppUtils.getElement('languageModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    generateInitialData() {
        AppUtils.safeExecute(() => {
            console.log('Generating initial data...');
            
            // Generate hot numbers
            this.generateHotNumbers();
            
            // Update statistics
            this.updateStats();
            
            // Generate trend data
            this.generateTrendData();
            
            // Generate pattern data
            this.generatePatternData();
            
            // Generate strategy data
            this.generateStrategyData();
            
            // Initialize all pages
            this.initializePage(APP_CONSTANTS.PAGES.HOME);
        }, this);
    }

    // Clean up resources
    destroy() {
        // Clear timers
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        if (this.dataPollingInterval) {
            clearInterval(this.dataPollingInterval);
            this.dataPollingInterval = null;
        }

        // Clear event listeners
        this.dataManager = null;

        // Clear cache
        AppUtils.elementCache.clear();
    }

    // Application update management
    checkForUpdates() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
    }

    // Performance monitoring
    trackPerformance() {
        if ('performance' in window) {
            const navigation = performance.getEntriesByType('navigation')[0];
            console.log('Page load time:', navigation.loadEventEnd - navigation.loadEventStart);
        }
    }

    // Backup history data generation
    generateFallbackHistoryData() {
        console.log('Generating backup historical data...');
        
        this.historyData = [];
        const now = new Date();
        
        // Generate last 100 draws history data
        for (let i = 0; i < 100; i++) {
            const periodTime = new Date(now.getTime() - i * 5 * 60 * 1000); // Every 5 minutes
            const number = AppUtils.randomInt(0, 9);
            const color = AppUtils.getNumberColor(number);
            
            const historyRecord = {
                period: `2025${String(1000 + (99 - i))}`,
                time: periodTime,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: color,
                patterns: this.generateHistoryPatterns(number, color),
                isApi: false // Mark as non-API data
            };
            
            this.historyData.push(historyRecord);
        }
    }

    // Refresh historical data
    async refreshHistoryData() {
        console.log('Refreshing historical data...');
        
        // Clear cache
        this.apiService.cache.clear();
        
        // Re-fetch data
        await this.generateHistoryData();
        
        // Update related UI
        this.updateRecentHistory();
        this.updateHomeStats();
        this.updateHotNumbers();
    }

    generateHistoryPatterns(number, color) {
        const patterns = [];
        
        patterns.push(number >= 5 ? 'Big' : 'Small');
        patterns.push(number % 2 === 1 ? 'Odd' : 'Even');
        
        if (color === 'red') patterns.push('Red');
        else if (color === 'green') patterns.push('Green');
        else if (color === 'purple') patterns.push('Purple');
            
        return patterns;
    }

    // Initialize history page
    initializeHistoryPage() {
        console.log('Initializing history page...');
        
        // Ensure historical data exists
        if (!this.historyData.length) {
            this.generateHistoryData();
        }
        
        // Set up event listeners
        this.setupHistoryPageEvents();
        
        // Initialize filter conditions
        this.resetHistoryFilters();
        
        // Update page content
        this.updateHistoryStats();
        this.updateFrequencyAnalysis();
        this.updateHistoryTable();
    }

    // Set up history page events
    setupHistoryPageEvents() {
        // Filter reset button
        const resetBtn = AppUtils.getElement('.filter-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetHistoryFilters();
            });
        }

        // Search button
        const searchBtn = AppUtils.getElement('#searchHistory');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.filterHistoryData();
            });
        }

        // Filter condition changes
        const filters = ['#dateRange', '#numberFilter', '#patternFilter'];
        filters.forEach(selector => {
            const element = AppUtils.getElement(selector);
            if (element) {
                element.addEventListener('change', () => {
                    this.filterHistoryData();
                });
            }
        });

        // Frequency analysis switching
        AppUtils.getElements('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
                if (view) {
                    this.switchAnalysisView(view);
                }
            });
        });

        // Export button
        const exportBtn = AppUtils.getElement('.export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportHistoryData();
            });
        }

        // Load more button
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreHistoryRecords();
            });
        }
    }

    // Reset filter conditions
    resetHistoryFilters() {
        const dateRange = AppUtils.getElement('#dateRange');
        const numberFilter = AppUtils.getElement('#numberFilter');
        const patternFilter = AppUtils.getElement('#patternFilter');

        if (dateRange) dateRange.value = 'month';
        if (numberFilter) numberFilter.value = 'all';
        if (patternFilter) patternFilter.value = 'all';

        this.historyCurrentPage = 1;
        this.filterHistoryData();
    }

    // Filter historical data
    filterHistoryData() {
        console.log('Filtering historical data...');
        
        const dateRange = AppUtils.getElement('#dateRange')?.value || 'month';
        const numberFilter = AppUtils.getElement('#numberFilter')?.value || 'all';
        const patternFilter = AppUtils.getElement('#patternFilter')?.value || 'all';

        let filtered = [...this.historyData];

        // Time filtering
        const now = new Date();
        switch (dateRange) {
            case 'today':
                filtered = filtered.filter(item => {
                    const itemDate = new Date(item.time);
                    return itemDate.toDateString() === now.toDateString();
                });
                break;
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(item => item.time >= weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(item => item.time >= monthAgo);
                break;
        }

        // Number filtering
        if (numberFilter !== 'all') {
            const targetNumber = parseInt(numberFilter);
            filtered = filtered.filter(item => item.number === targetNumber);
        }

        // Pattern filtering
        if (patternFilter !== 'all') {
            switch (patternFilter) {
                case 'big':
                    filtered = filtered.filter(item => item.big);
                    break;
                case 'small':
                    filtered = filtered.filter(item => !item.big);
                    break;
                case 'odd':
                    filtered = filtered.filter(item => item.odd);
                    break;
                case 'even':
                    filtered = filtered.filter(item => !item.odd);
                    break;
                case 'red':
                    filtered = filtered.filter(item => item.color === 'red');
                    break;
                case 'green':
                    filtered = filtered.filter(item => item.color === 'green');
                    break;
                case 'purple':
                    filtered = filtered.filter(item => item.color === 'purple');
                    break;
            }
        }

        this.filteredHistoryData = filtered;
        this.historyCurrentPage = 1;

        // Update interface
        this.updateHistoryStats();
        this.updateFrequencyAnalysis();
        this.updateHistoryTable();

        console.log('Filtering complete, total', filtered.length, 'records');
    }

    // Update historical statistics
    updateHistoryStats() {
        const data = this.filteredHistoryData;
        
        // Basic statistics
        const totalDraws = data.length;
        const bigCount = data.filter(item => item.big).length;
        const oddCount = data.filter(item => item.odd).length;
        
        // Find hottest number
        const numberCounts = {};
        for (let i = 0; i <= 9; i++) {
            numberCounts[i] = 0;
        }
        data.forEach(item => {
            numberCounts[item.number]++;
        });
        
        const maxCount = Math.max(...Object.values(numberCounts));
        const hotNumber = Object.keys(numberCounts).find(num => numberCounts[num] === maxCount);

        // Update display
        const totalDrawsEl = AppUtils.getElement('#totalDraws');
        const bigCountEl = AppUtils.getElement('#bigCount');
        const oddCountEl = AppUtils.getElement('#oddCount');
        const hotNumberEl = AppUtils.getElement('#hotNumber');

        if (totalDrawsEl) totalDrawsEl.textContent = totalDraws;
        if (bigCountEl) bigCountEl.textContent = bigCount;
        if (oddCountEl) oddCountEl.textContent = oddCount;
        if (hotNumberEl) hotNumberEl.textContent = hotNumber || '-';

        // Update period text
        const statsPeriodText = AppUtils.getElement('#statsPeriodText');
        const dateRange = AppUtils.getElement('#dateRange')?.value || 'month';
        const periodNames = {
            'today': 'Today',
            'week': 'Last 7 Days',
            'month': 'Last 30 Days',
            'custom': 'Custom'
        };
        if (statsPeriodText) {
            statsPeriodText.textContent = periodNames[dateRange] || 'Last 30 Days';
        }
    }

    // Update frequency analysis
    updateFrequencyAnalysis() {
        const data = this.filteredHistoryData;
        const total = data.length;
        
        if (total === 0) return;

        // Calculate frequency for each number
        const frequencies = {};
        for (let i = 0; i <= 9; i++) {
            frequencies[i] = {
                count: 0,
                percent: 0
            };
        }

        data.forEach(item => {
            frequencies[item.number].count++;
        });

        // Calculate percentage and determine hot/cold status
        const counts = Object.values(frequencies).map(f => f.count);
        const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

        for (let i = 0; i <= 9; i++) {
            frequencies[i].percent = ((frequencies[i].count / total) * 100).toFixed(1);
            
            if (frequencies[i].count >= avgCount + 2) {
                frequencies[i].status = 'hot';
            } else if (frequencies[i].count <= avgCount - 2) {
                frequencies[i].status = 'cold';
            } else {
                frequencies[i].status = 'normal';
            }
        }

        // Update frequency grid display
        const frequencyGrid = AppUtils.getElement('#frequencyGrid');
        if (frequencyGrid) {
            frequencyGrid.innerHTML = '';
            
            for (let i = 0; i <= 9; i++) {
                const freq = frequencies[i];
                const item = document.createElement('div');
                item.className = `frequency-item ${freq.status}`;
                item.innerHTML = `
                    <div class="frequency-number">${i}</div>
                    <div class="frequency-count">${freq.count} times</div>
                    <div class="frequency-percent">${freq.percent}%</div>
                `;
                
                item.addEventListener('click', () => {
                    this.showNumberDetail(i, freq);
                });
                
                frequencyGrid.appendChild(item);
            }
        }
    }

    // Switch analysis view
    switchAnalysisView(view) {
        // Update toggle button state
        AppUtils.getElements('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = AppUtils.getElement(`[data-view="${view}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Show corresponding content
        const frequencyGrid = AppUtils.getElement('#frequencyGrid');
        const trendChart = AppUtils.getElement('#trendChart');

        if (view === 'frequency') {
            if (frequencyGrid) frequencyGrid.style.display = 'grid';
            if (trendChart) trendChart.style.display = 'none';
        } else if (view === 'trend') {
            if (frequencyGrid) frequencyGrid.style.display = 'none';
            if (trendChart) trendChart.style.display = 'block';
            this.renderTrendChart();
        }
    }

    // Render trend chart
    renderTrendChart() {
        const trendChart = AppUtils.getElement('#trendChart');
        if (!trendChart) return;

        // Simple trend chart display
        const recentData = this.filteredHistoryData.slice(0, 20);
        
        trendChart.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 18px; font-weight: 600; color: var(--primary-color); margin-bottom: 16px;">
                    Last ${recentData.length} Draws Trend
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                    ${recentData.map(item => `
                        <div style="
                            width: 32px; 
                            height: 32px; 
                            background: ${this.getNumberColorStyle(item.color)};
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: 700;
                            font-size: 14px;
                        " title="Period ${item.period}: ${item.number}">${item.number}</div>
                    `).join('')}
                </div>
                <div style="margin-top: 16px; font-size: 12px; color: var(--text-secondary);">
                    Click number for details
                </div>
            </div>
        `;
    }

    getNumberColorStyle(color) {
        const colorStyles = {
            'red': 'linear-gradient(135deg, #ef4444, #dc2626)',
            'green': 'linear-gradient(135deg, #10b981, #059669)',
            'purple': 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
        };
        return colorStyles[color] || 'linear-gradient(135deg, var(--primary-color), var(--primary-dark))';
    }

    // Update historical records table
    updateHistoryTable() {
        const tableBody = AppUtils.getElement('#historyTableBody');
        const recordCount = AppUtils.getElement('#recordCount');
        
        if (!tableBody) return;

        const startIndex = 0;
        const endIndex = this.historyCurrentPage * this.historyPageSize;
        const displayData = this.filteredHistoryData.slice(startIndex, endIndex);

        tableBody.innerHTML = displayData.map(item => this.createHistoryTableRow(item)).join('');

        // Update record count
        if (recordCount) {
            recordCount.textContent = this.filteredHistoryData.length;
        }

        // Update load more button state
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            if (endIndex >= this.filteredHistoryData.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'inline-flex';
                loadMoreBtn.classList.remove('loading');
            }
        }
    }

    createHistoryTableRow(item) {
        const time = AppUtils.formatTime(item.time);
        const patterns = item.patterns.map(pattern => 
            `<span class="history-pattern-tag active">${pattern}</span>`
        ).join('');

        return `
            <div class="history-table-row">
                <div class="table-cell period">${item.period}</div>
                <div class="table-cell time">${time}</div>
                <div class="table-cell">
                    <div class="history-number ${item.color}">${item.number}</div>
                </div>
                <div class="table-cell">
                    <div class="history-patterns">${patterns}</div>
                </div>
                <div class="table-cell">
                    <button class="detail-btn" onclick="window.app.showHistoryDetail('${item.period}')">Details</button>
                </div>
            </div>
        `;
    }

    // Load more records
    loadMoreHistoryRecords() {
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.classList.add('loading');
        }

        // Simulate async loading
        setTimeout(() => {
            this.historyCurrentPage++;
            this.updateHistoryTable();
        }, 500);
    }

    // Show history details
    showHistoryDetail(period) {
        const item = this.historyData.find(h => h.period === period);
        if (!item) return;

        const patterns = item.patterns.join(' | ');
        const time = item.time.toLocaleString('en-US');
        
        this.showToast(`Period ${period} Details\nDraw Time: ${time}\nDraw Number: ${item.number}\nNumber Patterns: ${patterns}`);
    }

    // Export historical data
    exportHistoryData() {
        const data = this.filteredHistoryData;
        if (data.length === 0) {
            this.showToast('No data available to export');
            return;
        }

        // Create CSV content
        const headers = ['Period', 'Draw Time', 'Draw Number', 'Size', 'Parity', 'Color'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                item.period,
                item.time.toLocaleString('en-US'),
                item.number,
                item.big ? 'Big' : 'Small',
                item.odd ? 'Odd' : 'Even',
                item.color === 'red' ? 'Red' : item.color === 'green' ? 'Green' : 'Purple'
            ].join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `wingo_history_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('Data exported successfully');
    }

    // Update home page recent draws
    updateRecentHistory() {
        console.log('Updating home page recent draws...');
        
        const recentHistoryList = AppUtils.getElement('#recentHistoryList');
        if (!recentHistoryList) return;

        // Ensure historical data exists
        if (!this.historyData.length) {
            this.generateHistoryData();
        }
        
        // Apply current filters
        const filteredData = this.applyHistoryFilters();
        
        // Get number of records to display
        const displayCount = this.historyDisplayCount || 8;
        const recentData = filteredData.slice(0, displayCount);
        
        recentHistoryList.innerHTML = recentData.map((item, index) => `
            <div class="recent-history-item" role="listitem" data-period="${item.period}" data-index="${index}">
                <div class="history-item-left">
                    <div class="history-period">${item.period.slice(-4)}</div>
                    <div class="history-time">${AppUtils.formatTime(item.time)}</div>
                </div>
                <div class="history-item-center">
                    <div class="history-number ${item.color}">${item.number}</div>
                </div>
                <div class="history-patterns">
                    ${item.patterns.map(pattern => 
                        `<span class="history-pattern-tag active">${pattern}</span>`
                    ).join('')}
                </div>
            </div>
        `).join('');

        // Add click events
        this.setupHistoryItemEvents();
        
        // Update historical statistics cards
        this.updateHistoryStatsCards();
        
        // Update load more button state
        this.updateLoadMoreButton(filteredData.length, displayCount);
    }

    // Apply history record filters
    applyHistoryFilters() {
        if (!this.historyData.length) return [];
        
        const activeFilters = this.getActiveHistoryFilters();
        
        return this.historyData.filter(item => {
            // Size filter
            if (activeFilters.size !== 'all') {
                const isBig = item.number >= 5;
                if (activeFilters.size === 'big' && !isBig) return false;
                if (activeFilters.size === 'small' && isBig) return false;
            }
            
            // Parity filter
            if (activeFilters.parity !== 'all') {
                const isOdd = item.number % 2 === 1;
                if (activeFilters.parity === 'odd' && !isOdd) return false;
                if (activeFilters.parity === 'even' && isOdd) return false;
            }
            
            // Color filter
            if (activeFilters.color !== 'all') {
                if (item.color !== activeFilters.color) return false;
            }
            
            return true;
        });
    }

    // Get currently active filters
    getActiveHistoryFilters() {
        const activeFilterTab = AppUtils.getElement('.filter-tab.active');
        const activeColorFilter = AppUtils.getElement('.color-filter.active');
        
        let sizeFilter = 'all';
        let parityFilter = 'all';
        
        if (activeFilterTab) {
            const filterType = activeFilterTab.dataset.filter;
            if (filterType === 'big' || filterType === 'small') {
                sizeFilter = filterType;
            } else if (filterType === 'odd' || filterType === 'even') {
                parityFilter = filterType;
            }
        }
        
        const colorFilter = activeColorFilter ? activeColorFilter.dataset.color : 'all';
        
        return {
            size: sizeFilter,
            parity: parityFilter,
            color: colorFilter
        };
    }

    // Set up history record item events
    setupHistoryItemEvents() {
        const historyItems = AppUtils.getElements('.recent-history-item');
        
        historyItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const period = item.dataset.period;
                const index = parseInt(item.dataset.index);
                this.showHistoryDetailModal(period, index);
            });
        });
    }

    // Update historical statistics cards
    updateHistoryStatsCards() {
        if (!this.historyData.length) return;
        
        const recent20 = this.historyData.slice(0, 20);
        
        // Calculate current streak
        const currentStreak = this.calculateCurrentStreak(recent20);
        const currentStreakEl = AppUtils.getElement('#currentStreak');
        if (currentStreakEl) {
            currentStreakEl.textContent = currentStreak;
        }
        
        // Calculate hottest number
        const hotestNumber = this.getHottestNumber(recent20);
        const hotestNumberEl = AppUtils.getElement('#hotestNumber');
        if (hotestNumberEl) {
            hotestNumberEl.textContent = hotestNumber;
        }
        
        // Calculate coldest number
        const coldestNumber = this.getColdestNumber(recent20);
        const coldestNumberEl = AppUtils.getElement('#coldestNumber');
        if (coldestNumberEl) {
            coldestNumberEl.textContent = coldestNumber;
        }
        
        // Update last update time
        const lastUpdateEl = AppUtils.getElement('#lastUpdate');
        if (lastUpdateEl) {
            const now = new Date();
            const timeAgo = AppUtils.getTimeAgo(now);
            lastUpdateEl.textContent = timeAgo;
        }
    }

    // Calculate current streak
    calculateCurrentStreak(data) {
        if (!data.length) return 'No data';
        
        let streak = 1;
        let type = '';
        
        // Determine first number type
        const firstNumber = data[0].number;
        if (firstNumber >= 5) {
            type = 'Big';
        } else {
            type = 'Small';
        }
        
        // Calculate continuous count
        for (let i = 1; i < data.length; i++) {
            const currentNumber = data[i].number;
            const isBig = currentNumber >= 5;
            
            if ((type === 'Big' && isBig) || (type === 'Small' && !isBig)) {
                streak++;
            } else {
                break;
            }
        }
        
        return `${streak} ${type}`;
    }

    // Get hottest number
    getHottestNumber(data) {
        const frequencies = {};
        data.forEach(item => {
            frequencies[item.number] = (frequencies[item.number] || 0) + 1;
        });
        
        let maxCount = 0;
        let hotNumber = 0;
        
        Object.entries(frequencies).forEach(([number, count]) => {
            if (count > maxCount) {
                maxCount = count;
                hotNumber = parseInt(number);
            }
        });
        
        return hotNumber;
    }

    // Get coldest number
    getColdestNumber(data) {
        const frequencies = {};
        
        // Initialize all number frequencies to 0
        for (let i = 0; i <= 9; i++) {
            frequencies[i] = 0;
        }
        
        // Count actual frequencies
        data.forEach(item => {
            frequencies[item.number]++;
        });
        
        let minCount = Infinity;
        let coldNumber = 0;
        
        Object.entries(frequencies).forEach(([number, count]) => {
            if (count < minCount) {
                minCount = count;
                coldNumber = parseInt(number);
            }
        });
        
        return coldNumber;
    }

    // Update load more button
    updateLoadMoreButton(totalCount, currentCount) {
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (!loadMoreBtn) return;
        
        if (currentCount >= totalCount) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'flex';
            const remainingCount = totalCount - currentCount;
            const buttonText = loadMoreBtn.querySelector('span:last-child') || loadMoreBtn;
            buttonText.textContent = `View More History (${remainingCount} more)`;
        }
    }

    // Show history record details modal
    showHistoryDetailModal(period, index) {
        const item = this.historyData[index];
        if (!item) return;
        
        // Create modal HTML
        const modalHtml = `
            <div class="history-detail-modal" id="historyDetailModal">
                <div class="history-detail-content">
                    <div class="history-detail-header">
                        <h3>Draw Details</h3>
                        <button class="history-detail-close">
                            <span class="material-icons-round">close</span>
                        </button>
                    </div>
                    <div class="history-detail-body">
                        <div class="detail-number-section">
                            <div class="detail-number ${item.color}">${item.number}</div>
                            <div class="detail-patterns">
                                ${item.patterns.map(pattern => 
                                    `<span class="history-pattern-tag active">${pattern}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="detail-info-grid">
                            <div class="detail-info-item">
                                <div class="detail-info-value">${period}</div>
                                <div class="detail-info-label">Period</div>
                            </div>
                            <div class="detail-info-item">
                                <div class="detail-info-value">${AppUtils.formatTime(item.time)}</div>
                                <div class="detail-info-label">Draw Time</div>
                            </div>
                            <div class="detail-info-item">
                                <div class="detail-info-value">${item.number >= 5 ? 'Big' : 'Small'}</div>
                                <div class="detail-info-label">Size</div>
                            </div>
                            <div class="detail-info-item">
                                <div class="detail-info-value">${item.number % 2 === 1 ? 'Odd' : 'Even'}</div>
                                <div class="detail-info-label">Parity</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal
        const existingModal = AppUtils.getElement('#historyDetailModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = AppUtils.getElement('#historyDetailModal');
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        // Set up close events
        this.setupHistoryDetailModalEvents(modal);
    }

    // Set up history details modal events
    setupHistoryDetailModalEvents(modal) {
        const closeBtn = modal.querySelector('.history-detail-close');
        const overlay = modal;
        
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300);
        };
        
        closeBtn.addEventListener('click', closeModal);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
        
        document.addEventListener('keydown', function handleEscape(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        });
    }

    // Set up enhanced history events for home page
    setupEnhancedHistoryEvents() {
        // Filter toggle button
        const filterHistoryBtn = AppUtils.getElement('#filterHistoryBtn');
        if (filterHistoryBtn) {
            filterHistoryBtn.addEventListener('click', () => {
                this.toggleHistoryFilters();
            });
        }
        
        // Filter tab events
        const filterTabs = AppUtils.getElements('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.handleFilterTabClick(tab);
            });
        });
        
        // Color filter events
        const colorFilters = AppUtils.getElements('.color-filter');
        colorFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                this.handleColorFilterClick(filter);
            });
        });
        
        // History statistics cards click events
        const historyStatCards = AppUtils.getElements('.history-stat-card');
        historyStatCards.forEach(card => {
            card.addEventListener('click', () => {
                this.handleHistoryStatCardClick(card);
            });
        });
        
        // Load more button event
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreHistoryRecords();
            });
        }
        
        // Initialize history display count
        this.historyDisplayCount = 8;
    }

    // Toggle history filters display
    toggleHistoryFilters() {
        const filtersEl = AppUtils.getElement('#historyFilters');
        const filterBtn = AppUtils.getElement('#filterHistoryBtn');
        
        if (!filtersEl) return;
        
        if (filtersEl.classList.contains('show')) {
            filtersEl.classList.remove('show');
            filterBtn.classList.remove('active');
        } else {
            filtersEl.classList.add('show');
            filterBtn.classList.add('active');
        }
    }

    // Handle filter tab click
    handleFilterTabClick(clickedTab) {
        // Remove active state from other tabs
        const allTabs = AppUtils.getElements('.filter-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Activate current tab
        clickedTab.classList.add('active');
        
        // Refresh history display
        this.updateRecentHistory();
    }

    // Handle color filter click
    handleColorFilterClick(clickedFilter) {
        // Remove active state from other filters
        const allFilters = AppUtils.getElements('.color-filter');
        allFilters.forEach(filter => filter.classList.remove('active'));
        
        // Activate current filter
        clickedFilter.classList.add('active');
        
        // Refresh history display
        this.updateRecentHistory();
    }

    // Handle history statistics card click
    handleHistoryStatCardClick(card) {
        const statValue = card.querySelector('.stat-value');
        const statLabel = card.querySelector('.stat-label');
        
        if (statValue && statLabel) {
            const message = `${statLabel.textContent}: ${statValue.textContent}`;
            this.showToast(message, 'info');
        }
    }

    // Refresh home page data
    refreshHomeData() {
        console.log('Refreshing home page data...');
        
        // Update countdown
        this.updateCountdown();
        
        // Update statistics
        this.updateHomeStats();
        
        // Update hot numbers
        this.updateHotNumbers();
        
        // Update recent draws
        this.updateRecentHistory();
        
        // Ensure data integrity
        if (!this.historyData.length) {
            this.generateHistoryData();
        }
    }

    // Update home page statistics
    updateHomeStats() {
        if (!this.historyData.length) return;
        
        const recentData = this.historyData.slice(0, 20);
        
        // Update statistics cards
        this.updateStatCard('total-periods', this.historyData.length);
        this.updateStatCard('today-draws', this.getTodayDrawsCount());
        this.updateStatCard('hot-number', this.getHottestNumber(recentData).number);
        this.updateStatCard('cold-number', this.getColdestNumber(recentData).number);
    }

    // Update statistics card
    updateStatCard(cardId, value) {
        const card = AppUtils.getElement(`#${cardId}`);
        if (card) {
            const valueEl = card.querySelector('.stat-value');
            if (valueEl) {
                valueEl.textContent = value;
            }
        }
    }

    // Get today's draw count
    getTodayDrawsCount() {
        const today = new Date().toDateString();
        return this.historyData.filter(item => 
            new Date(item.time).toDateString() === today
        ).length;
    }

    // Update hot numbers
    updateHotNumbers() {
        if (!this.historyData.length) return;
        
        const hotNumbersList = AppUtils.getElement('#hotNumbersList');
        if (!hotNumbersList) return;
        
        // Count number frequencies
        const frequency = {};
        this.historyData.slice(0, 50).forEach(item => {
            frequency[item.number] = (frequency[item.number] || 0) + 1;
        });
        
        // Sort to get hot numbers
        const hotNumbers = Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([number, count]) => ({ number: parseInt(number), count }));
        
        hotNumbersList.innerHTML = hotNumbers.map(item => `
            <div class="hot-number-item" data-number="${item.number}">
                <span class="number ${AppUtils.getNumberColor(item.number)}">${item.number}</span>
                <span class="count">${item.count}</span>
            </div>
        `).join('');
    }

    // Update countdown
    updateCountdown() {
        const countdownEl = AppUtils.getElement('#countdown');
        if (!countdownEl) return;
        
        // Simple countdown logic
        const now = new Date();
        const nextMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0);
        const diff = nextMinute - now;
        
        const seconds = Math.floor(diff / 1000) % 60;
        countdownEl.textContent = `00:${seconds.toString().padStart(2, '0')}`;
    }

    // Show toast message
    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add styles
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : '#4299e1',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '10000',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        });
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Show statistics details
    showStatDetail(statType) {
        let message = '';
        
        switch(statType) {
            case 'total-periods':
                message = `Total ${this.historyData.length} draw records`;
                break;
            case 'today-draws':
                message = `Today ${this.getTodayDrawsCount()} draws`;
                break;
            case 'hot-number':
                const hot = this.getHottestNumber(this.historyData.slice(0, 20));
                message = `Hottest number: ${hot.number} (appeared ${hot.count} times)`;
                break;
            case 'cold-number':
                const cold = this.getColdestNumber(this.historyData.slice(0, 20));
                message = `Coldest number: ${cold.number} (appeared ${cold.count} times)`;
                break;
            default:
                message = 'No detailed information available';
        }
        
        this.showToast(message, 'info');
    }

    // Set up pull to refresh
    setupPullToRefresh() {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        
        const homeContainer = AppUtils.getElement('#home');
        if (!homeContainer) return;
        
        homeContainer.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        });
        
        homeContainer.addEventListener('touchmove', (e) => {
            currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            
            if (diff > 0 && homeContainer.scrollTop === 0) {
                isPulling = true;
                e.preventDefault();
                
                // Add visual feedback
                if (diff > 80) {
                    homeContainer.style.transform = `translateY(${Math.min(diff * 0.5, 50)}px)`;
                }
            }
        });
        
        homeContainer.addEventListener('touchend', () => {
            if (isPulling && currentY - startY > 80) {
                this.refreshHomeData();
                this.showToast('Data refreshed', 'success');
            }
            
            homeContainer.style.transform = '';
            isPulling = false;
        });
    }

    // Show error message
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #f56565; color: white; padding: 20px; border-radius: 8px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3); text-align: center; z-index: 10000;">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" 
                        style="background: white; color: #f56565; border: none; padding: 8px 16px; 
                               border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    Refresh Page
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    // Hide loader
    hideLoader() {
        const loader = document.querySelector('.loader-screen');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }

    // Start countdown
    startCountdown() {
        // Simple countdown implementation
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    // Refresh statistics
    async refreshStats() {
        console.log('Refreshing statistics...');
        try {
            await this.generateHistoryData();
            this.updateStats();
            this.updateRecentHistory();
            this.showToast('Data updated', 'success');
        } catch (error) {
            console.error('Failed to refresh statistics:', error);
            this.showToast('Refresh failed, please try again later', 'error');
        }
    }

    // Update statistics
    updateStats() {
        if (!this.historyData || !this.historyData.length) {
            console.warn('No historical data, skipping statistics update');
            return;
        }

        const recentData = this.historyData.slice(0, 50);
        
        // Calculate big/small ratio
        const bigCount = recentData.filter(item => item.big).length;
        const smallCount = recentData.length - bigCount;
        const bigPercent = ((bigCount / recentData.length) * 100).toFixed(1);
        const smallPercent = ((smallCount / recentData.length) * 100).toFixed(1);
        
        // Calculate odd/even ratio
        const oddCount = recentData.filter(item => item.odd).length;
        const evenCount = recentData.length - oddCount;
        const oddPercent = ((oddCount / recentData.length) * 100).toFixed(1);
        const evenPercent = ((evenCount / recentData.length) * 100).toFixed(1);
        
        // Update page display
        this.updateStatElement('#bigPercent', `${bigPercent}%`);
        this.updateStatElement('#smallPercent', `${smallPercent}%`);
        this.updateStatElement('#oddPercent', `${oddPercent}%`);
        this.updateStatElement('#evenPercent', `${evenPercent}%`);
    }

    // Update statistics element
    updateStatElement(selector, value) {
        const element = AppUtils.getElement(selector);
        if (element) {
            element.textContent = value;
        }
    }

    // Update current period info
    updateCurrentPeriodInfo() {
        const periodElement = AppUtils.getElement('.period-number');
        if (periodElement && this.historyData && this.historyData.length > 0) {
            const currentPeriod = parseInt(this.historyData[0].period) + 1;
            periodElement.textContent = `Period ${currentPeriod.toString().padStart(8, '0')}`;
        }
    }

    // Generate hot numbers
    generateHotNumbers() {
        console.log('Generating hot numbers...');
        
        if (!this.historyData || !this.historyData.length) {
            console.warn('No historical data, skipping hot numbers generation');
            return;
        }

        // Count number frequencies
        const frequency = {};
        this.historyData.slice(0, 50).forEach(item => {
            frequency[item.number] = (frequency[item.number] || 0) + 1;
        });

        // Sort to get hot numbers
        const hotNumbers = Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8)
            .map(([number, count]) => ({ number: parseInt(number), count }));

        // Update hot numbers display
        const hotNumbersList = AppUtils.getElement('.hot-numbers-list');
        if (hotNumbersList) {
            hotNumbersList.innerHTML = hotNumbers.map(item => `
                <div class="hot-number-item" data-number="${item.number}">
                    <div class="hot-number ${AppUtils.getNumberColor(item.number)}">${item.number}</div>
                    <div class="hot-count">${item.count}</div>
                </div>
            `).join('');
        }
    }

    // Show quick preview
    showQuickPreview() {
        this.showToast('Quick preview feature under development...', 'info');
    }

    // Generate new prediction
    generateNewPrediction() {
        console.log('Generating new prediction...');
        
        // Generate random prediction
        const prediction = {
            id: Date.now(),
            time: new Date(),
            numbers: [
                AppUtils.randomInt(0, 9),
                AppUtils.randomInt(0, 9),
                AppUtils.randomInt(0, 9)
            ],
            confidence: AppUtils.randomInt(70, 95),
            pattern: ['Big', 'Small', 'Odd', 'Even'][AppUtils.randomInt(0, 3)]
        };
        
        // Add to history
        this.predictionHistory.unshift(prediction);
        
        // Limit history size
        if (this.predictionHistory.length > this.config.maxHistory) {
            this.predictionHistory = this.predictionHistory.slice(0, this.config.maxHistory);
        }
        
        // Update display
        this.updatePredictionHistory();
        
        this.showToast('New prediction generated', 'success');
    }

    // Update prediction history
    updatePredictionHistory() {
        const historyList = AppUtils.getElement('#predictionHistoryList');
        if (!historyList) return;
        
        if (this.predictionHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No prediction history</div>';
            return;
        }
        
        historyList.innerHTML = this.predictionHistory.map(pred => `
            <div class="prediction-history-item">
                <div class="prediction-time">${AppUtils.formatTime(pred.time)}</div>
                <div class="prediction-numbers">
                    ${pred.numbers.map(num => 
                        `<span class="prediction-number ${AppUtils.getNumberColor(num)}">${num}</span>`
                    ).join('')}
                </div>
                <div class="prediction-confidence">${pred.confidence}%</div>
                <div class="prediction-pattern">${pred.pattern}</div>
            </div>
        `).join('');
    }

    // Show detailed analysis
    showDetailedAnalysis() {
        this.showToast('Detailed analysis feature under development...', 'info');
    }

    // Reset parameters
    resetParameters() {
        // Reset all parameter sliders to default
        const sliders = AppUtils.getElements('.parameter-slider');
        sliders.forEach(slider => {
            slider.value = slider.getAttribute('data-default') || 50;
            const valueDisplay = slider.parentElement.querySelector('.parameter-value');
            if (valueDisplay) {
                valueDisplay.textContent = slider.value;
            }
        });
        
        this.showToast('Parameters reset to defaults', 'info');
    }

    // Clear prediction history
    clearPredictionHistory() {
        this.predictionHistory = [];
        this.updatePredictionHistory();
        this.showToast('Prediction history cleared', 'info');
    }

    // Update language selector
    updateLanguageSelector() {
        const languageItems = AppUtils.getElements('.language-item');
        languageItems.forEach(item => {
            const lang = item.getAttribute('data-lang');
            if (lang === i18n.currentLanguage) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// Simple internationalization system
const i18n = {
    currentLanguage: 'en',
    translations: {
        en: {
            'app.title': 'Wingo Prediction',
            'nav.home': 'Home',
            'nav.predict': 'Predict',
            'nav.trend': 'Trend',
            'nav.pattern': 'Pattern',
            'nav.strategy': 'Strategy',
            'nav.history': 'History'
        },
        zh: {
            'app.title': 'Wingo预测',
            'nav.home': '首页',
            'nav.predict': '预测',
            'nav.trend': '走势',
            'nav.pattern': '路单',
            'nav.strategy': '策略',
            'nav.history': '历史'
        }
    },
    
    init() {
        // Detect browser language
        const browserLang = navigator.language.split('-')[0];
        if (this.translations[browserLang]) {
            this.currentLanguage = browserLang;
        }
        this.updateDocumentLang();
    },
    
    t(key) {
        return this.translations[this.currentLanguage]?.[key] || key;
    },
    
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            this.updateDocumentLang();
            this.updateUI();
        }
    },
    
    updateDocumentLang() {
        document.documentElement.lang = this.currentLanguage;
    },
    
    updateUI() {
        // Update all translatable elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key) {
                element.textContent = this.t(key);
            }
        });
    }
};

// Initialize internationalization system
i18n.init();

// Application startup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM content loaded, starting application...');
    
    // Performance monitoring
    const startTime = performance.now();
    
    try {
        // Create application instance
        const app = new WingoApp();
        
        // Asynchronous application initialization
        await app.init();
        
        // Record initialization time
        const initTime = performance.now() - startTime;
        console.log(`Application initialization complete, time taken: ${initTime.toFixed(2)}ms`);
        
        // Global error handling
        window.app = app;
        
        // Simplified event listeners
        window.addEventListener('online', () => {
            if (app.showToast) app.showToast('Network connection restored');
        });
        
        window.addEventListener('offline', () => {
            if (app.showToast) app.showToast('Network connection lost');
        });
        
        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause timers when page hidden
                if (app.countdownInterval) {
                    clearInterval(app.countdownInterval);
                }
            } else {
                // Restart timers when page visible
                if (app.startCountdown) {
                    app.startCountdown();
                }
            }
        });
        
        // Clean up resources on page unload
        window.addEventListener('beforeunload', () => {
            if (app.destroy) {
                app.destroy();
            }
        });
        
        console.log('Application startup successful!');
        
    } catch (error) {
        console.error('Application startup failed:', error);
        
        // Show error prompt
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        text-align: center; z-index: 10000;">
                <h3 style="color: #e53e3e; margin-bottom: 10px;">Application Startup Failed</h3>
                <p style="margin-bottom: 15px;">Please refresh page and try again</p>
                <button onclick="location.reload()" 
                        style="background: #3182ce; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Refresh Page
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

// Export for global use
window.WingoApp = WingoApp;
window.APP_CONSTANTS = APP_CONSTANTS;
window.AppUtils = AppUtils;
window.i18n = i18n;
