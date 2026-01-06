// Wingo Lottery Analysis Assistant - Main Script File

// API Service Class - Get Real Draw Data
class ApiService {
    constructor() {
        this.baseUrl = 'https://draw.ar-lottery01.com/WinGo/WinGo_1M';
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    // Get historical draw data
    async getHistoryData() {
        const cacheKey = 'historyData';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log('Using cached history data');
            return cached.data;
        }

        try {
            console.log('Fetching history data from API...');
            const timestamp = Date.now();
            const url = `${this.baseUrl}/GetHistoryIssuePage.json?ts=${timestamp}`;
            
            // Try multiple request methods
            const response = await this.fetchWithFallback(url);
            
            if (!response.ok && response.status !== 0) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
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
            console.error('Failed to get history data:', error);
            // Return fallback data
            return this.getFallbackData();
        }
    }

    // Multiple ways to fetch data
    async fetchWithFallback(url) {
        const methods = [
            () => fetch(url, { method: 'GET', mode: 'cors', headers: { 'Accept': 'application/json' } }),
            () => fetch(url, { method: 'GET', mode: 'no-cors' }),
            () => fetch(url, { method: 'GET' }),
            () => fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
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

    // Process API response data
    processHistoryData(apiData) {
        try {
            const historyList = [];
            
            // Process based on actual API response format
            if (apiData && apiData.data && Array.isArray(apiData.data)) {
                console.log('Processing API data array:', apiData.data.length, 'items');
                
                apiData.data.forEach((item, index) => {
                    const processedItem = this.processHistoryItem(item, index);
                    if (processedItem) {
                        historyList.push(processedItem);
                    }
                });
            } else if (apiData && Array.isArray(apiData)) {
                // If direct array response
                apiData.forEach((item, index) => {
                    const processedItem = this.processHistoryItem(item, index);
                    if (processedItem) {
                        historyList.push(processedItem);
                    }
                });
            } else {
                console.warn('API data format unexpected, using fallback data');
                return this.getFallbackData();
            }

            console.log(`Successfully processed ${historyList.length} history records`);
            return historyList.length > 0 ? historyList : this.getFallbackData();
        } catch (error) {
            console.error('Error processing history data:', error);
            return this.getFallbackData();
        }
    }

    // Process single history record
    processHistoryItem(item, index) {
        try {
            // Extract period from various possible fields
            const period = item.period || item.issueNo || item.issue || item.id || 
                          item.issueName || `2024${String(1000 + index).slice(-4)}`;
            
            // Extract number from various possible fields
            const number = this.extractNumber(item);
            
            // Extract time
            const time = this.extractTime(item, index);

            if (number === null) {
                console.warn('Could not extract number from item:', item);
                return null;
            }

            return {
                period: String(period),
                time: time,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: this.getNumberColor(number),
                patterns: this.generatePatterns(number),
                isApi: true // Mark as API data
            };
        } catch (error) {
            console.error('Error processing history item:', error, item);
            return null;
        }
    }

    // Extract number from item
    extractNumber(item) {
        // Common number field names
        const numberFields = ['number', 'result', 'winNumber', 'draw', 'drawResult', 
                            'num', 'value', 'lottery', 'winNum', 'drawNumber', 
                            'winningNumber', 'lotteryNumber'];
        
        for (const field of numberFields) {
            if (item[field] !== undefined && item[field] !== null) {
                const num = parseInt(item[field]);
                if (!isNaN(num) && num >= 0 && num <= 9) {
                    return num;
                }
            }
        }

        // Try to find number in string values
        const stringFields = ['issueName', 'name', 'title', 'description'];
        for (const field of stringFields) {
            if (typeof item[field] === 'string') {
                const matches = item[field].match(/\d+/g);
                if (matches) {
                    for (const match of matches) {
                        const num = parseInt(match);
                        if (!isNaN(num) && num >= 0 && num <= 9) {
                            return num;
                        }
                    }
                }
            }
        }

        // Last resort: generate random number
        console.warn('No valid number found, generating random');
        return Math.floor(Math.random() * 10);
    }

    // Extract time from item
    extractTime(item, index) {
        const timeFields = ['time', 'createTime', 'drawTime', 'timestamp', 
                          'date', 'issueTime', 'lotteryTime', 'resultTime'];
        
        for (const field of timeFields) {
            if (item[field]) {
                const time = new Date(item[field]);
                if (!isNaN(time.getTime())) {
                    return time;
                }
            }
        }

        // Generate reasonable time (every 5 minutes)
        return new Date(Date.now() - index * 5 * 60 * 1000);
    }

    // Get number color
    getNumberColor(number) {
        if ([1, 3, 7, 9].includes(number)) return 'red';
        if ([2, 4, 6, 8].includes(number)) return 'green';
        if ([0, 5].includes(number)) return 'purple';
        return 'red';
    }

    // Generate number patterns
    generatePatterns(number) {
        const patterns = [];
        
        if (number >= 5) patterns.push('Big');
        else patterns.push('Small');
        
        if (number % 2 === 1) patterns.push('Odd');
        else patterns.push('Even');
        
        const color = this.getNumberColor(number);
        if (color === 'red') patterns.push('Red');
        else if (color === 'green') patterns.push('Green');
        else if (color === 'purple') patterns.push('Purple');
        
        return patterns;
    }

    // Fallback data when API fails
    getFallbackData() {
        console.log('Using fallback mock data');
        const fallbackData = [];
        const now = new Date();
        
        for (let i = 0; i < 50; i++) {
            const number = Math.floor(Math.random() * 10);
            const time = new Date(now.getTime() - i * 5 * 60 * 1000);
            
            fallbackData.push({
                period: `2024${String(1000 + i).slice(-4)}`,
                time: time,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: this.getNumberColor(number),
                patterns: this.generatePatterns(number),
                isApi: false // Mark as mock data
            });
        }
        
        return fallbackData;
    }

    // Get current period info
    getCurrentPeriodInfo() {
        const now = new Date();
        const periodNumber = `2024${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(Math.floor(now.getMinutes() / 5) + 1).padStart(2, '0')}`;
        
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
}

// App Constants
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
        HISTORY_URL: 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json',
        TIMEOUT: 10000,
        CACHE_DURATION: 60000
    },
    NUMBER_COLORS: {
        RED: [1, 3, 7, 9],
        GREEN: [2, 4, 6, 8],
        PURPLE: [0, 5]
    },
    DEFAULTS: {
        BASE_AMOUNT: 10,
        MAX_PREDICTION_HISTORY: 100,
        COUNTDOWN_TIME: 300000, // 5 minutes
        CHART_DEFAULT_PERIODS: 50
    }
};

// Utility Class
class AppUtils {
    // DOM element cache
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
    
    // Safe execution wrapper
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
        if (!date) return 'Unknown';
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }
    
    // Get number color
    static getNumberColor(number) {
        if (APP_CONSTANTS.NUMBER_COLORS.RED.includes(number)) return 'red';
        if (APP_CONSTANTS.NUMBER_COLORS.GREEN.includes(number)) return 'green';
        if (APP_CONSTANTS.NUMBER_COLORS.PURPLE.includes(number)) return 'purple';
        return 'red';
    }
    
    // Random integer
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Shuffle array
    static shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// Data Manager
class DataManager {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
    }
    
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
    
    get(key, defaultValue = null) {
        return this.cache.get(key) ?? defaultValue;
    }
    
    subscribe(key, callback) {
        if (!this.observers.has(key)) {
            this.observers.set(key, []);
        }
        this.observers.get(key).push(callback);
    }
    
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

// Main Wingo App
class WingoApp {
    constructor() {
        // Basic state
        this.currentPage = APP_CONSTANTS.PAGES.HOME;
        this.isLoading = true;
        this.countdownInterval = null;
        
        // API service
        this.apiService = new ApiService();
        
        // Data management
        this.dataManager = new DataManager();
        this.historyData = [];
        this.filteredHistoryData = [];
        this.predictionHistory = [];
        this.historyCurrentPage = 1;
        this.historyPageSize = 20;
        this.historyDisplayCount = 8;
        
        // Real-time data state
        this.isDataLoading = false;
        this.lastDataUpdate = null;
        
        // Configuration
        this.config = {
            baseAmount: APP_CONSTANTS.DEFAULTS.BASE_AMOUNT,
            maxHistory: APP_CONSTANTS.DEFAULTS.MAX_PREDICTION_HISTORY,
            countdownTime: APP_CONSTANTS.DEFAULTS.COUNTDOWN_TIME
        };
        
        console.log('WingoApp initialized');
    }

    async init() {
        console.log('Starting app initialization...');
        
        try {
            // Set up basic event listeners
            this.setupBasicEventListeners();
            
            // Generate basic data
            await this.generateBasicData();
            
            // Start timers
            this.startCountdown();
            
            // Hide loader
            setTimeout(() => {
                this.hideLoader();
                console.log('App initialization completed');
                this.showToast('App loaded successfully', 'success');
            }, 1500);
            
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('App initialization failed, please refresh the page');
            
            // Still hide loader on error
            setTimeout(() => {
                this.hideLoader();
            }, 2000);
        }
    }

    // Set up basic event listeners
    setupBasicEventListeners() {
        console.log('Setting up basic event listeners...');
        
        // Bottom navigation
        const navItems = AppUtils.getElements(APP_CONSTANTS.SELECTORS.NAV_ITEMS);
        navItems.forEach(item => {
            item.addEventListener('click', AppUtils.throttle((e) => {
                const page = item.getAttribute('data-page');
                this.navigateToPage(page);
            }, 300));
        });

        // Feature cards
        const featureCards = AppUtils.getElements(APP_CONSTANTS.SELECTORS.FEATURE_CARDS);
        featureCards.forEach(card => {
            card.addEventListener('click', AppUtils.throttle((e) => {
                const page = card.getAttribute('data-page');
                if (page) this.navigateToPage(page);
            }, 300));
        });

        // Back buttons
        const backButtons = AppUtils.getElements(APP_CONSTANTS.SELECTORS.BACK_BUTTONS);
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
        }

        // View all buttons
        const viewAllBtns = AppUtils.getElements('.view-all-btn');
        viewAllBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.getAttribute('data-page');
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });

        // Stat cards click events
        const statCards = AppUtils.getElements('.stat-card');
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.getAttribute('data-stat');
                this.showStatDetail(statType);
            });
        });

        // History filter button
        const filterHistoryBtn = AppUtils.getElement('#filterHistoryBtn');
        if (filterHistoryBtn) {
            filterHistoryBtn.addEventListener('click', () => {
                this.toggleHistoryFilters();
            });
        }

        // Load more history button
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreHistoryRecords();
            });
        }

        // History filter tabs
        const filterTabs = AppUtils.getElements('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.handleFilterTabClick(tab);
            });
        });

        // Color filters
        const colorFilters = AppUtils.getElements('.color-filter');
        colorFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                this.handleColorFilterClick(filter);
            });
        });

        // History stat cards
        const historyStatCards = AppUtils.getElements('.history-stat-card');
        historyStatCards.forEach(card => {
            card.addEventListener('click', () => {
                this.handleHistoryStatCardClick(card);
            });
        });

        console.log('Basic event listeners setup completed');
    }

    // Generate basic data
    async generateBasicData() {
        console.log('Generating basic data...');
        
        try {
            // Generate history data
            await this.generateHistoryData();
            
            // Update based on real data
            this.updateStats();
            this.generateHotNumbers();
            this.updateRecentHistory();
            this.updateCurrentPeriodInfo();
            
            console.log('Basic data generation completed');
        } catch (error) {
            console.error('Basic data generation failed:', error);
            // Ensure we have fallback data
            this.generateFallbackHistoryData();
            this.updateStats();
            this.generateHotNumbers();
            this.updateRecentHistory();
        }
    }

    // Generate history data from API
    async generateHistoryData() {
        console.log('Fetching real history data...');
        
        this.isDataLoading = true;
        this.showLoadingState('Fetching latest draw data...');
        
        try {
            const apiData = await this.apiService.getHistoryData();
            
            if (apiData && apiData.length > 0) {
                this.historyData = apiData;
                this.lastDataUpdate = new Date();
                console.log(`Successfully fetched ${apiData.length} history records`);
                
                this.hideLoadingState();
                this.showToast('History data updated', 'success');
            } else {
                console.warn('API returned empty data, generating mock data');
                this.generateFallbackHistoryData();
            }
            
        } catch (error) {
            console.error('Failed to fetch API data:', error);
            this.generateFallbackHistoryData();
            this.showToast('Data fetch failed, using mock data', 'warning');
        } finally {
            this.isDataLoading = false;
            this.hideLoadingState();
        }
        
        // Initialize filtered data
        this.filteredHistoryData = [...this.historyData];
        
        console.log('History data processing completed:', this.historyData.length, 'records');
    }

    // Fallback history data
    generateFallbackHistoryData() {
        console.log('Generating fallback history data...');
        
        this.historyData = [];
        const now = new Date();
        
        // Generate recent 100 periods
        for (let i = 0; i < 100; i++) {
            const periodTime = new Date(now.getTime() - i * 5 * 60 * 1000); // Every 5 minutes
            const number = AppUtils.randomInt(0, 9);
            const color = AppUtils.getNumberColor(number);
            
            const historyRecord = {
                period: `2024${String(1000 + (99 - i)).slice(-4)}`,
                time: periodTime,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: color,
                patterns: this.generateHistoryPatterns(number),
                isApi: false
            };
            
            this.historyData.push(historyRecord);
        }
    }

    // Generate patterns for history data
    generateHistoryPatterns(number) {
        const patterns = [];
        
        if (number >= 5) patterns.push('Big');
        else patterns.push('Small');
        
        if (number % 2 === 1) patterns.push('Odd');
        else patterns.push('Even');
        
        const color = AppUtils.getNumberColor(number);
        if (color === 'red') patterns.push('Red');
        else if (color === 'green') patterns.push('Green');
        else if (color === 'purple') patterns.push('Purple');
            
        return patterns;
    }

    // Update statistics
    updateStats() {
        if (!this.historyData || !this.historyData.length) {
            console.warn('No history data available for stats');
            return;
        }

        const recentData = this.historyData.slice(0, 50);
        
        // Calculate big/small ratios
        const bigCount = recentData.filter(item => item.big).length;
        const smallCount = recentData.length - bigCount;
        const bigPercent = ((bigCount / recentData.length) * 100).toFixed(1);
        const smallPercent = ((smallCount / recentData.length) * 100).toFixed(1);
        
        // Calculate odd/even ratios
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

    // Update stat element
    updateStatElement(selector, value) {
        const element = AppUtils.getElement(selector);
        if (element) {
            element.textContent = value;
        }
    }

    // Generate hot numbers
    generateHotNumbers() {
        console.log('Generating hot numbers...');
        
        if (!this.historyData || !this.historyData.length) {
            console.warn('No history data for hot numbers');
            return;
        }

        // Count number frequency
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
        const hotNumbersList = AppUtils.getElement('#hotNumbersList');
        if (hotNumbersList) {
            hotNumbersList.innerHTML = hotNumbers.map(item => `
                <div class="hot-number-item" data-number="${item.number}">
                    <div class="hot-number ${AppUtils.getNumberColor(item.number)}">${item.number}</div>
                    <div class="hot-count">${item.count}</div>
                </div>
            `).join('');
        }
    }

    // Update recent history
    updateRecentHistory() {
        console.log('Updating recent history...');
        
        const recentHistoryList = AppUtils.getElement('#recentHistoryList');
        if (!recentHistoryList) return;

        // Ensure history data exists
        if (!this.historyData.length) {
            this.generateHistoryData();
        }

        // Apply current filters
        const filteredData = this.applyHistoryFilters();
        
        // Get records to display
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
        
        // Update history stats cards
        this.updateHistoryStatsCards();
        
        // Update load more button
        this.updateLoadMoreButton(filteredData.length, displayCount);
    }

    // Apply history filters
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

    // Get active history filters
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

    // Set up history item events
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

    // Update history stats cards
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
        const hottestNumber = this.getHottestNumber(recent20);
        const hottestNumberEl = AppUtils.getElement('#hotestNumber');
        if (hottestNumberEl) {
            hottestNumberEl.textContent = hottestNumber;
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
            const timeAgo = this.getTimeAgo(now);
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
        
        // Count consecutive same type
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
        
        // Initialize all numbers frequency to 0
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

    // Get time ago description
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hours ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} days ago`;
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

    // Show history detail modal
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

    // Set up history detail modal events
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

    // Toggle history filters
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
        // Remove active from other tabs
        const allTabs = AppUtils.getElements('.filter-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Activate clicked tab
        clickedTab.classList.add('active');
        
        // Refresh history display
        this.updateRecentHistory();
    }

    // Handle color filter click
    handleColorFilterClick(clickedFilter) {
        // Remove active from other filters
        const allFilters = AppUtils.getElements('.color-filter');
        allFilters.forEach(filter => filter.classList.remove('active'));
        
        // Activate clicked filter
        clickedFilter.classList.add('active');
        
        // Refresh history display
        this.updateRecentHistory();
    }

    // Handle history stat card click
    handleHistoryStatCardClick(card) {
        const statValue = card.querySelector('.stat-value');
        const statLabel = card.querySelector('.stat-label');
        
        if (statValue && statLabel) {
            const message = `${statLabel.textContent}: ${statValue.textContent}`;
            this.showToast(message, 'info');
        }
    }

    // Load more history records
    loadMoreHistoryRecords() {
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (!loadMoreBtn) return;
        
        // Show loading state
        loadMoreBtn.classList.add('loading');
        
        // Increase display count
        this.historyDisplayCount = (this.historyDisplayCount || 8) + 10;
        
        // Simulate loading delay
        setTimeout(() => {
            this.updateRecentHistory();
            loadMoreBtn.classList.remove('loading');
        }, 800);
    }

    // Navigate to page
    navigateToPage(pageId) {
        AppUtils.safeExecute(() => {
            // Remove active from all pages
            AppUtils.getElements(APP_CONSTANTS.SELECTORS.PAGES).forEach(page => {
                page.classList.remove('active');
            });

            // Remove active from all nav items
            AppUtils.getElements(APP_CONSTANTS.SELECTORS.NAV_ITEMS).forEach(item => {
                item.classList.remove('active');
            });

            // Activate target page
            const targetPage = AppUtils.getElement(`#${pageId}`);
            if (targetPage) {
                targetPage.classList.add('active');
                this.currentPage = pageId;
            }

            // Activate corresponding nav item
            const targetNavItem = AppUtils.getElement(`[data-page="${pageId}"]`);
            if (targetNavItem && targetNavItem.classList.contains('nav-item')) {
                targetNavItem.classList.add('active');
            }

            // Page-specific initialization
            this.initializePage(pageId);
        }, this);
    }

    // Initialize page
    initializePage(pageId) {
        const initMethods = {
            [APP_CONSTANTS.PAGES.HOME]: () => this.refreshHomeData(),
            [APP_CONSTANTS.PAGES.PREDICT]: () => this.initializePredictPage(),
            [APP_CONSTANTS.PAGES.TREND]: () => this.initializeTrendPage(),
            [APP_CONSTANTS.PAGES.PATTERN]: () => this.initializePatternPage(),
            [APP_CONSTANTS.PAGES.STRATEGY]: () => this.initializeStrategyPage(),
            [APP_CONSTANTS.PAGES.HISTORY]: () => this.initializeHistoryPage()
        };

        const initMethod = initMethods[pageId];
        if (initMethod) {
            AppUtils.safeExecute(initMethod, this);
        }
    }

    // Initialize prediction page
    initializePredictPage() {
        // Ensure prediction page has data
        if (!this.predictionHistory.length) {
            this.generateNewPrediction();
        }
        this.updatePredictionHistory();
    }

    // Generate new prediction
    generateNewPrediction() {
        // Generate prediction based on historical data
        const prediction = {
            id: Date.now(),
            time: new Date(),
            numbers: this.generatePredictedNumbers(),
            confidence: Math.floor(Math.random() * 20) + 75, // 75-95%
            patterns: this.generatePredictedPatterns()
        };
        
        this.predictionHistory.unshift(prediction);
        
        // Keep only recent predictions
        if (this.predictionHistory.length > this.config.maxHistory) {
            this.predictionHistory = this.predictionHistory.slice(0, this.config.maxHistory);
        }
        
        this.showToast('New prediction generated', 'success');
    }

    // Generate predicted numbers
    generatePredictedNumbers() {
        const numbers = [];
        while (numbers.length < 5) {
            const num = Math.floor(Math.random() * 10);
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        return numbers;
    }

    // Generate predicted patterns
    generatePredictedPatterns() {
        return {
            size: Math.random() > 0.5 ? 'Big' : 'Small',
            parity: Math.random() > 0.5 ? 'Odd' : 'Even',
            color: ['Red', 'Green', 'Purple'][Math.floor(Math.random() * 3)]
        };
    }

    // Update prediction history
    updatePredictionHistory() {
        // Implementation for prediction history display
    }

    // Initialize trend page
    initializeTrendPage() {
        console.log('Initializing trend page...');
        // Trend page initialization logic
    }

    // Initialize pattern page
    initializePatternPage() {
        console.log('Initializing pattern page...');
        // Pattern page initialization logic
    }

    // Initialize strategy page
    initializeStrategyPage() {
        console.log('Initializing strategy page...');
        // Strategy page initialization logic
    }

    // Initialize history page
    initializeHistoryPage() {
        console.log('Initializing history page...');
        // History page initialization logic
    }

    // Refresh home data
    refreshHomeData() {
        console.log('Refreshing home data...');
        
        // Update countdown
        this.updateCountdown();
        
        // Update statistics
        this.updateStats();
        
        // Update hot numbers
        this.generateHotNumbers();
        
        // Update recent history
        this.updateRecentHistory();
        
        // Ensure data integrity
        if (!this.historyData.length) {
            this.generateHistoryData();
        }
    }

    // Update current period info
    updateCurrentPeriodInfo() {
        const periodElement = AppUtils.getElement('#currentPeriod');
        if (periodElement && this.historyData && this.historyData.length > 0) {
            const currentPeriod = parseInt(this.historyData[0].period) + 1;
            periodElement.textContent = `Period ${currentPeriod.toString().padStart(8, '0')}`;
        }
    }

    // Start countdown
    startCountdown() {
        // Clear existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        // Start new countdown
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    // Update countdown
    updateCountdown() {
        const countdownEl = AppUtils.getElement('#countdownTimer');
        if (!countdownEl) return;
        
        // Calculate time to next 5-minute interval
        const now = new Date();
        const nextMinute = Math.ceil(now.getMinutes() / 5) * 5;
        const nextDraw = new Date(now);
        
        if (nextMinute >= 60) {
            nextDraw.setHours(now.getHours() + 1);
            nextDraw.setMinutes(nextMinute - 60);
        } else {
            nextDraw.setMinutes(nextMinute);
        }
        nextDraw.setSeconds(0);
        nextDraw.setMilliseconds(0);
        
        // Calculate difference
        const diff = nextDraw - now;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        // Update display
        countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Refresh statistics
    async refreshStats() {
        console.log('Refreshing statistics...');
        try {
            await this.generateHistoryData();
            this.updateStats();
            this.updateRecentHistory();
            this.showToast('Data refreshed successfully', 'success');
        } catch (error) {
            console.error('Failed to refresh stats:', error);
            this.showToast('Refresh failed, please try again', 'error');
        }
    }

    // Show stat detail
    showStatDetail(statType) {
        let message = '';
        
        switch(statType) {
            case 'big':
                message = 'Big numbers (5-9) probability';
                break;
            case 'small':
                message = 'Small numbers (0-4) probability';
                break;
            case 'odd':
                message = 'Odd numbers probability';
                break;
            case 'even':
                message = 'Even numbers probability';
                break;
            default:
                message = 'No detailed information';
        }
        
        this.showToast(message, 'info');
    }

    // Show loading state
    showLoadingState(message = 'Loading...') {
        const liveCard = AppUtils.getElement('.live-card');
        if (liveCard) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            `;
            liveCard.appendChild(loadingOverlay);
        }
    }

    // Hide loading state
    hideLoadingState() {
        const loadingOverlay = AppUtils.getElement('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
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
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textAlign: 'center',
            maxWidth: '90%',
            wordBreak: 'break-word'
        });
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Show error
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
                               border-radius: 4px; cursor: pointer; margin-top: 10px; font-weight: 600;">
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

    // Clean up resources
    destroy() {
        // Clear timers
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        // Clear caches
        AppUtils.elementCache.clear();
        this.dataManager = null;
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
            'nav.pattern': 'Road',
            'nav.strategy': 'Strategy'
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
    
    updateDocumentLang() {
        document.documentElement.lang = this.currentLanguage;
    }
};

// Initialize internationalization
i18n.init();

// App startup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, starting app...');
    
    const startTime = performance.now();
    
    try {
        // Create app instance
        const app = new WingoApp();
        
        // Initialize app
        await app.init();
        
        // Record initialization time
        const initTime = performance.now() - startTime;
        console.log(`App initialization completed in ${initTime.toFixed(2)}ms`);
        
        // Make app globally accessible
        window.app = app;
        
        // Network status events
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
        
        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (app.destroy) {
                app.destroy();
            }
        });
        
        console.log('App started successfully!');
        
    } catch (error) {
        console.error('App startup failed:', error);
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        text-align: center; z-index: 10000;">
                <h3 style="color: #e53e3e; margin-bottom: 10px;">App Startup Failed</h3>
                <p style="margin-bottom: 15px; color: #4a5568;">Please refresh the page and try again</p>
                <button onclick="location.reload()" 
                        style="background: #3182ce; color: white; border: none; padding: 8px 16px; 
                               border-radius: 4px; cursor: pointer; font-weight: 600;">
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
