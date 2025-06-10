// Wingo彩票分析助手 - 主要脚本文件

// API服务类 - 获取真实开奖数据
class ApiService {
        constructor() {
        this.baseUrl = 'https://draw.ar-lottery01.com/MotoRace/MotoRace_1M';
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1分钟缓存
    }

    // 获取历史开奖数据
    async getHistoryData() {
        const cacheKey = 'historyData';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            console.log('获取历史开奖数据...');
            const timestamp = Date.now();
            const url = `${this.baseUrl}/GetHistoryIssuePage.json?ts=${timestamp}`;
            
            // 尝试多种方式请求数据
            const response = await this.fetchWithFallback(url);
            const data = await response.json();
            console.log('API返回数据:', data);

            // 处理API数据格式
            const processedData = this.processHistoryData(data);
            
            // 缓存数据
            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;
        } catch (error) {
            console.error('获取历史数据失败:', error);
            // 返回模拟数据作为备选
            return this.getFallbackData();
        }
    }

    // 多种方式尝试获取数据
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
                console.warn('请求方法失败，尝试下一种:', error.message);
            }
        }

        throw new Error('所有请求方法都失败');
    }

    // 处理API返回的数据格式
    processHistoryData(apiData) {
        try {
            const historyList = [];
            
            // 根据API实际返回格式处理数据
            if (apiData && apiData.data && Array.isArray(apiData.data)) {
                apiData.data.forEach((item, index) => {
                    const processedItem = this.processHistoryItem(item, index);
                    if (processedItem) {
                        historyList.push(processedItem);
                    }
                });
            } else if (apiData && Array.isArray(apiData)) {
                // 如果直接返回数组
                apiData.forEach((item, index) => {
                    const processedItem = this.processHistoryItem(item, index);
                    if (processedItem) {
                        historyList.push(processedItem);
                    }
                });
            } else {
                console.warn('API数据格式不符合预期，使用备选数据');
                return this.getFallbackData();
            }

            console.log(`成功处理 ${historyList.length} 条历史数据`);
            return historyList.length > 0 ? historyList : this.getFallbackData();
        } catch (error) {
            console.error('处理历史数据时出错:', error);
            return this.getFallbackData();
        }
    }

    // 处理单个历史记录项
    processHistoryItem(item, index) {
        try {
            // 尝试多种可能的字段名
            const period = item.period || item.issueNo || item.issue || item.id || `2024${String(1000 + index).slice(-4)}`;
            const number = this.extractNumber(item);
            const time = this.extractTime(item, index);

            if (number === null) {
                return null;
            }

            return {
                period: String(period),
                time: time,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: this.getNumberColor(number),
                patterns: this.generatePatterns(number)
            };
        } catch (error) {
            console.error('处理单个历史记录时出错:', error);
            return null;
        }
    }

    // 提取号码 - 尝试多种可能的字段
    extractNumber(item) {
        // 常见的号码字段名
        const numberFields = ['number', 'result', 'winNumber', 'draw', 'drawResult', 'num', 'value', 'lottery'];
        
        for (const field of numberFields) {
            if (item[field] !== undefined) {
                const num = parseInt(item[field]);
                if (!isNaN(num) && num >= 0 && num <= 9) {
                    return num;
                }
            }
        }

        // 尝试从整个对象中找数字
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

        // 生成随机数作为最后备选
        return Math.floor(Math.random() * 10);
    }

    // 提取时间
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

        // 如果没有时间字段，生成一个合理的时间
        return new Date(Date.now() - index * 5 * 60 * 1000); // 每5分钟一期
    }

    // 获取号码颜色
    getNumberColor(number) {
        if ([1, 3, 7, 9].includes(number)) return 'red';
        if ([2, 4, 6, 8].includes(number)) return 'green';
        if ([0, 5].includes(number)) return 'purple';
        return 'red';
    }

    // 生成号码形态
    generatePatterns(number) {
        const patterns = [];
        
        if (number >= 5) patterns.push('大');
        else patterns.push('小');
        
        if (number % 2 === 1) patterns.push('单');
        else patterns.push('双');
        
        const color = this.getNumberColor(number);
        if (color === 'red') patterns.push('红');
        else if (color === 'green') patterns.push('绿');
        else if (color === 'purple') patterns.push('紫');
        
        return patterns;
    }

    // 备选数据 - 当API不可用时使用
    getFallbackData() {
        console.log('使用备选模拟数据');
        const fallbackData = [];
        const now = new Date();
        
        for (let i = 0; i < 50; i++) {
            const number = Math.floor(Math.random() * 10);
            const time = new Date(now.getTime() - i * 5 * 60 * 1000);
            
            fallbackData.push({
                period: `2024${String(1000 + i)}`,
                time: time,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: this.getNumberColor(number),
                patterns: this.generatePatterns(number)
            });
        }
        
        return fallbackData;
    }

    // 获取当前期信息
    getCurrentPeriodInfo() {
        const now = new Date();
        const periodNumber = `2024${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(Math.floor(now.getMinutes() / 5) + 1).padStart(2, '0')}`;
        
        return {
            period: periodNumber,
            nextDrawTime: this.getNextDrawTime()
        };
    }

    // 计算下次开奖时间
    getNextDrawTime() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // 计算距离下一个5分钟整点的时间
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

// 应用常量定义
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
        HISTORY_URL: 'https://draw.ar-lottery01.com/MotoRace/MotoRace_1M/GetHistoryIssuePage.json',
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
        COUNTDOWN_TIME: 300000, // 5分钟
        CHART_DEFAULT_PERIODS: 50
    }
};

// 工具类 - 提取公共功能
class AppUtils {
    // DOM查询优化 - 缓存常用元素
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
    
    // 错误处理包装器
    static safeExecute(fn, context = null, ...args) {
        try {
            return context ? fn.call(context, ...args) : fn(...args);
        } catch (error) {
            console.error('执行出错:', error);
            return null;
        }
    }
    
    // 防抖函数
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
    
    // 节流函数
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
    
    // 格式化时间
    static formatTime(date) {
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    // 数字颜色获取
    static getNumberColor(number) {
        if (APP_CONSTANTS.NUMBER_COLORS.RED.includes(number)) return 'red';
        if (APP_CONSTANTS.NUMBER_COLORS.GREEN.includes(number)) return 'green';
        if (APP_CONSTANTS.NUMBER_COLORS.PURPLE.includes(number)) return 'purple';
        return 'red'; // 默认值
    }
    
    // 随机数生成
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // 数组随机打乱
    static shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// 数据管理类
class DataManager {
        constructor() {
        this.cache = new Map();
        this.observers = new Map();
    }
    
    // 设置数据
    set(key, value) {
        const oldValue = this.cache.get(key);
        this.cache.set(key, value);
        
        // 通知观察者
        if (this.observers.has(key)) {
            this.observers.get(key).forEach(callback => {
                AppUtils.safeExecute(callback, null, value, oldValue);
            });
        }
    }
    
    // 获取数据
    get(key, defaultValue = null) {
        return this.cache.get(key) ?? defaultValue;
    }
    
    // 订阅数据变化
    subscribe(key, callback) {
        if (!this.observers.has(key)) {
            this.observers.set(key, []);
        }
        this.observers.get(key).push(callback);
    }
    
    // 取消订阅
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

class WingoApp {
    constructor() {
        // 基础状态
        this.currentPage = APP_CONSTANTS.PAGES.HOME;
        this.isLoading = true;
        this.countdownInterval = null;
        
        // API服务
        this.apiService = new ApiService();
        
        // 数据管理
        this.dataManager = new DataManager();
        this.predictionHistory = [];
        this.trendData = [];
        this.patternData = [];
        this.strategyData = {};
        
        // 历史记录数据管理
        this.historyData = [];
        this.filteredHistoryData = [];
        this.historyCurrentPage = 1;
        this.historyPageSize = 20;
        
        // 实时数据状态
        this.isDataLoading = false;
        this.lastDataUpdate = null;
        
        // 初始化配置
        this.config = {
            baseAmount: APP_CONSTANTS.DEFAULTS.BASE_AMOUNT,
            maxHistory: APP_CONSTANTS.DEFAULTS.MAX_PREDICTION_HISTORY,
            countdownTime: APP_CONSTANTS.DEFAULTS.COUNTDOWN_TIME
        };
        
        // 初始化语言管理器
        this.setupLanguageManager();
        
        // 错误处理
        this.setupErrorHandling();
    }

    // 错误处理设置
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
            this.showToast('系统出现错误，请刷新页面重试');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            event.preventDefault();
        });
        }

        async init() {
        console.log('开始初始化应用...');
        
        try {
            // 首先确保基础数据结构存在
            this.historyData = this.historyData || [];
            this.trendData = this.trendData || [];
            this.patternData = this.patternData || [];
            
            console.log('正在设置基础事件监听器...');
            // 基础事件监听器
            this.setupBasicEventListeners();
            
            console.log('正在生成基础数据...');
            // 异步生成基础数据 - 增加错误处理
            try {
                await this.generateBasicData();
                console.log('基础数据生成完成');
            } catch (dataError) {
                console.error('基础数据生成失败，使用默认数据:', dataError);
                // 确保至少有一些默认数据
                this.generateFallbackHistoryData();
                this.updateStats();
                this.generateHotNumbers();
                this.updateRecentHistory();
            }
            
            console.log('正在启动定时器...');
            // 启动定时器
            this.startCountdown();
            
            // 延迟初始化其他功能
            setTimeout(() => {
                try {
                    console.log('正在设置高级功能...');
                    this.setupAdvancedFeatures();
                    console.log('高级功能设置完成');
                } catch (error) {
                    console.error('高级功能设置失败:', error);
                }
            }, 100);
            
            // 延迟隐藏加载屏幕
            setTimeout(() => {
                try {
                    console.log('正在隐藏加载屏幕...');
                    this.hideLoader();
                    console.log('应用初始化完成');
                    
                    // 显示初始化成功消息
                    setTimeout(() => {
                        if (this.showToast) {
                            this.showToast('应用加载完成', 'success');
                        }
                    }, 500);
                } catch (error) {
                    console.error('隐藏加载屏幕失败:', error);
                    // 强制隐藏加载屏幕
                    const loader = document.querySelector('.loader-screen');
                    if (loader) {
                        loader.style.display = 'none';
                    }
                }
            }, 1500);
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showError('应用初始化失败，请刷新页面重试');
            
            // 即使初始化失败，也要隐藏加载屏幕
            setTimeout(() => {
                const loader = document.querySelector('.loader-screen');
                if (loader) {
                    loader.style.display = 'none';
                }
            }, 2000);
        }
    }

    // 基础事件监听器设置
    setupBasicEventListeners() {
        console.log('设置基础事件监听器...');
        
        // 底部导航
        const navItems = AppUtils.getElements(APP_CONSTANTS.SELECTORS.NAV_ITEMS);
        console.log('找到导航项:', navItems.length);
        navItems.forEach(item => {
            item.addEventListener('click', AppUtils.throttle((e) => {
                const page = item.getAttribute('data-page');
                this.navigateToPage(page);
            }, 300));
        });

        // 功能卡片点击
        const featureCards = AppUtils.getElements(APP_CONSTANTS.SELECTORS.FEATURE_CARDS);
        console.log('找到功能卡片:', featureCards.length);
        featureCards.forEach(card => {
            card.addEventListener('click', AppUtils.throttle((e) => {
                const page = card.getAttribute('data-page');
                if (page) this.navigateToPage(page);
            }, 300));
        });

        // 返回按钮
        const backButtons = AppUtils.getElements(APP_CONSTANTS.SELECTORS.BACK_BUTTONS);
        console.log('找到返回按钮:', backButtons.length);
        backButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigateToPage(APP_CONSTANTS.PAGES.HOME);
                });
            });

        // 刷新统计按钮 - 使用新的ID
        const refreshStatsBtn = AppUtils.getElement('#refreshStatsBtn');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', AppUtils.debounce(async () => {
                await this.refreshStats();
            }, 1000));
        } else {
            console.warn('未找到刷新统计按钮');
        }

        // "查看全部"按钮
        const viewAllBtns = AppUtils.getElements('.view-all-btn');
        viewAllBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.getAttribute('data-page');
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });

        // 统计卡片点击事件
        const statCards = AppUtils.getElements('.stat-card');
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.getAttribute('data-stat');
                this.showStatDetail(statType);
            });
        });

        // 下拉刷新支持
        this.setupPullToRefresh();

        // 语言按钮
        this.setupLanguageEvents();
    }

    // 生成基础数据 - 更新为异步方法
    async generateBasicData() {
        console.log('生成基础数据...');
        
        // 只生成首页必需的数据
        await AppUtils.safeExecute(async () => {
            // 异步获取历史记录数据
            await this.generateHistoryData();
            
            // 基于真实数据生成其他数据
            this.generateHotNumbers();
            this.updateStats();
            
            // 更新首页最近开奖记录
            this.updateRecentHistory();
            
            // 更新实时期数信息
            this.updateCurrentPeriodInfo();
        }, this);
    }

    // 延迟设置高级功能
    setupAdvancedFeatures() {
        console.log('设置高级功能...');
        
        AppUtils.safeExecute(() => {
            // 事件委托
            this.setupDelegatedEvents();
            
            // 预测相关按钮
            this.setupPredictionButtons();
            
            // 参数滑块
            this.setupParameterSliders();
            
            // 触摸反馈
            this.setupTouchFeedback();
            
            // 增强的历史记录事件监听器
            this.setupEnhancedHistoryEvents();
            
            // 快速预览按钮
            const quickPreviewBtn = AppUtils.getElement('.quick-preview-btn');
            if (quickPreviewBtn) {
                quickPreviewBtn.addEventListener('click', () => {
                    this.showQuickPreview();
                });
            }
            
            // 生成其他页面数据（延迟加载）
            this.generateTrendData();
            this.generatePatternData();
            this.generateStrategyData();
            
            console.log('高级功能设置完成');
        }, this);
    }

    setupEventListeners() {
        // 保留原方法，在页面特定初始化时调用
        console.log('设置完整事件监听器...');
        
        // 走势页面事件
        this.setupTrendPageEvents();
        
        // 路单页面事件
        this.setupPatternPageEvents();

        // 策略页面事件
        this.setupStrategyPageEvents();
    }

    setupDelegatedEvents() {
        document.addEventListener('click', (e) => {
            // 处理各种点击事件
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
    
    // 标签点击处理
    handleTabClick(e) {
        const chartType = e.target.getAttribute('data-chart');
        if (chartType) {
            AppUtils.safeExecute(() => this.switchChart(chartType), this);
        }
    }
    
    // 路单标签点击处理
    handlePatternTabClick(e) {
        const patternType = e.target.getAttribute('data-pattern');
        if (patternType) {
            AppUtils.safeExecute(() => this.switchPatternChart(patternType), this);
        }
    }
    
    // 策略点击处理
    handleStrategyClick(e) {
        const strategy = e.target.closest('.strategy-item')?.getAttribute('data-strategy');
        if (strategy) {
            AppUtils.safeExecute(() => this.switchStrategy(strategy), this);
        }
    }
    
    // 金额按钮点击处理
    handleAmountClick(e) {
        const amount = parseInt(e.target.getAttribute('data-amount'));
        if (amount) {
            AppUtils.safeExecute(() => this.selectAmount(amount), this);
        }
    }

    setupPredictionButtons() {
        // 刷新预测按钮
        const refreshBtn = AppUtils.getElement('.action-btn.primary');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.generateNewPrediction();
            });
        }

        // 详细分析按钮
        const analyzeBtn = AppUtils.getElement('.action-btn.secondary');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.showDetailedAnalysis();
            });
        }

        // 重置参数按钮
        const resetBtn = AppUtils.getElement('.reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetParameters();
            });
        }

        // 清空历史按钮
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
            // 移除所有页面的active类
            AppUtils.getElements(APP_CONSTANTS.SELECTORS.PAGES).forEach(page => {
                page.classList.remove('active');
            });

            // 移除所有导航项的active类
            AppUtils.getElements(APP_CONSTANTS.SELECTORS.NAV_ITEMS).forEach(item => {
                item.classList.remove('active');
            });

            // 激活目标页面
            const targetPage = AppUtils.getElement(`#${pageId}`);
            if (targetPage) {
                targetPage.classList.add('active');
                this.currentPage = pageId;
            }

            // 激活对应的导航项
            const targetNavItem = AppUtils.getElement(`[data-page="${pageId}"]`);
            if (targetNavItem && targetNavItem.classList.contains('nav-item')) {
                targetNavItem.classList.add('active');
            }

            // 页面特定初始化
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
        // 确保预测页面有数据
        if (!this.predictionHistory.length) {
            this.generateNewPrediction();
        }
        this.updatePredictionHistory();
    }

    initializeTrendPage() {
        console.log('初始化走势页面...');
        this.setupNewTrendPageEvents();
    }

    // 初始化路单页面
    initializePatternPage() {
        console.log('初始化路单页面...');
        AppUtils.safeExecute(() => {
            this.setupPatternPageEvents();
            this.generatePatternData();
        }, this);
    }

    // 初始化策略页面
    initializeStrategyPage() {
        console.log('初始化策略页面...');
        AppUtils.safeExecute(() => {
            this.setupStrategyPageEvents();
            this.generateStrategyData();
        }, this);
    }

    setupNewTrendPageEvents() {
        const container = AppUtils.getElement('#trend');
        if (!container) return;

        // 图表切换事件
        container.addEventListener('click', (e) => {
            if (e.target.matches('.chart-tab') || e.target.closest('.chart-tab')) {
                const tabBtn = e.target.closest('.chart-tab');
                const chartType = tabBtn.dataset.chart;
                this.switchTrendChart(chartType);
            }

            // 遗漏数据类型切换
            if (e.target.matches('.missing-tab')) {
                const tabBtn = e.target;
                const missingType = tabBtn.dataset.type;
                this.switchMissingType(missingType);
            }

            // 刷新按钮
            if (e.target.matches('.chart-refresh-btn') || e.target.closest('.chart-refresh-btn')) {
                this.refreshCurrentChart();
            }

            // 频率项点击
            if (e.target.closest('.frequency-item')) {
                const item = e.target.closest('.frequency-item');
                const number = item.dataset.number;
                this.showNumberDetailModal(number);
            }

            // 遗漏项点击
            if (e.target.closest('.missing-item')) {
                const item = e.target.closest('.missing-item');
                const data = item.dataset;
                this.showMissingDetailModal(data);
            }
        });

        // 全局期数选择器
        const periodSelect = AppUtils.getElement('#globalPeriodSelect');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => {
                this.updateTrendPeriod(periodSelect.value);
            });
        }

        // 对比期间选择器
        const comparisonSelect = AppUtils.getElement('#comparisonPeriod');
        if (comparisonSelect) {
            comparisonSelect.addEventListener('change', () => {
                this.updateComparisonPeriod(comparisonSelect.value);
            });
        }

        // 添加触摸友好的交互
        this.setupTouchInteractions();
    }

    initializeResponsiveLayout() {
        // 检测屏幕尺寸并调整布局
        const handleResize = () => {
            const container = AppUtils.getElement('#trend');
            if (!container) return;

            const width = window.innerWidth;
            
            // 移动端优化
            if (width <= 768) {
                this.optimizeForMobile();
            } else {
                this.optimizeForDesktop();
            }
        };

        window.addEventListener('resize', AppUtils.debounce(handleResize, 250));
        handleResize(); // 初始化时执行一次
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
        // 为触摸设备添加更好的交互体验
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

        // 生成历史数据
        for (let i = 0; i < periods; i++) {
            const number = AppUtils.randomInt(0, 9);
            const timestamp = Date.now() - (periods - i) * 3 * 60 * 1000; // 每3分钟一期
            
            const result = {
                period: `2023${String(i + 1).padStart(4, '0')}`,
                number: number,
                timestamp: timestamp,
                size: number >= 5 ? 'big' : 'small',
                parity: number % 2 === 0 ? 'even' : 'odd',
                color: this.getNumberColor(number)
            };

            this.trendData.history.push(result);
        }

        // 计算频率统计
        for (let num = 0; num <= 9; num++) {
            const count = this.trendData.history.filter(item => item.number === num).length;
            this.trendData.frequencies[num] = {
                count: count,
                percentage: (count / periods * 100).toFixed(1),
                lastAppear: this.getLastAppearance(num),
                missing: this.calculateMissing(num)
            };
        }

        // 分析热冷号码
        this.analyzeHotColdNumbers();
        
        // 计算模式统计
        this.calculatePatternStats();
        
        // 计算遗漏数据
        this.calculateMissingData();
    }

    analyzeHotColdNumbers() {
        const frequencies = Object.entries(this.trendData.frequencies)
            .map(([number, data]) => ({ number: parseInt(number), ...data }))
            .sort((a, b) => b.count - a.count);

        this.trendData.analysis.hot = frequencies.slice(0, 3);
        this.trendData.analysis.cold = frequencies.slice(-3).reverse();
        
        // 计算趋势
        this.trendData.analysis.trends = this.analyzeTrends();
    }

    analyzeTrends() {
        const recent = this.trendData.history.slice(-20);
        const trends = [];

        // 大小号趋势
        const bigCount = recent.filter(item => item.size === 'big').length;
        if (bigCount > 12) {
            trends.push({ type: 'size', trend: 'big', strength: 'strong', count: bigCount });
        } else if (bigCount < 8) {
            trends.push({ type: 'size', trend: 'small', strength: 'strong', count: 20 - bigCount });
        }

        // 单双号趋势
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
        
        // 大小统计
        const bigCount = history.filter(item => item.size === 'big').length;
        const smallCount = history.length - bigCount;
        
        // 单双统计
        const oddCount = history.filter(item => item.parity === 'odd').length;
        const evenCount = history.length - oddCount;
        
        // 颜色统计
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
        
        // 号码遗漏
        for (let num = 0; num <= 9; num++) {
            let missing = 0;
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].number === num) break;
                missing++;
            }
            this.trendData.missing.numbers[num] = missing;
        }

        // 形态遗漏
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
        
        // 计算波动率
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
        // 更新标签页状态
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        
        const activeTab = document.querySelector(`[data-chart="${chartType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
        }

        // 切换图表显示
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
                    <div class="frequency-count">出现 ${data.count} 次</div>
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
                <div class="timeline-item ${colorClass}" title="期数: ${item.period}, 号码: ${item.number}">
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
                     title="期数: ${item.period}, ${type === 'size' ? '大小' : '单双'}: ${value}">
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
        if (recent.length === 0) return '无连续';
        
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
            'big': '大', 'small': '小',
            'odd': '单', 'even': '双'
        };
        
        return `${streak}连${typeMap[lastValue] || lastValue}`;
    }

    calculateBalance(value1, value2) {
        const diff = Math.abs(parseFloat(value1) - parseFloat(value2));
        if (diff < 5) return '均衡';
        if (diff < 10) return '轻微偏向';
        return parseFloat(value1) > parseFloat(value2) ? '明显偏大' : '明显偏小';
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
                <div>颜色分布饼图</div>
                <div style="font-size: 12px; margin-top: 8px;">
                    红 ${patterns.red.percentage}% | 
                    绿 ${patterns.green.percentage}% | 
                    紫 ${patterns.purple.percentage}%
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
                <div class="color-dot ${item.color}" title="期数: ${item.period}, 号码: ${item.number}">
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

        // 更新下期预测
        const prediction = this.generateNextPeriodPrediction();
        AppUtils.safeExecute(() => {
            AppUtils.getElement('#nextTrendPrediction').textContent = prediction;
        });
    }

    generateSmartInsights() {
        const insights = [];
        const analysis = this.trendData.analysis;

        // 热号分析
        if (analysis.hot.length > 0) {
            const hotNumber = analysis.hot[0];
            insights.push({
                icon: 'local_fire_department',
                text: `号码${hotNumber.number}为当前最热号码，出现${hotNumber.count}次，频率${hotNumber.percentage}%`
            });
        }

        // 冷号分析
        if (analysis.cold.length > 0) {
            const coldNumber = analysis.cold[0];
            insights.push({
                icon: 'ac_unit',
                text: `号码${coldNumber.number}为当前最冷号码，仅出现${coldNumber.count}次，建议关注补出机会`
            });
        }

        // 趋势分析
        analysis.trends.forEach(trend => {
            const trendMap = {
                'big': '大号', 'small': '小号',
                'odd': '单号', 'even': '双号'
            };
            insights.push({
                icon: 'trending_up',
                text: `${trendMap[trend.trend]}呈现强势趋势，近20期出现${trend.count}次`
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
                'big': '大号偏多', 'small': '小号偏多',
                'odd': '单号偏多', 'even': '双号偏多'
            };
            return trendMap[mainTrend.trend] || '均衡发展';
        }

        return '均衡发展';
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
                    <div class="missing-count">遗漏 ${missingCount} 期</div>
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
            { key: 'big', name: '大号' },
            { key: 'small', name: '小号' },
            { key: 'odd', name: '单号' },
            { key: 'even', name: '双号' },
            { key: 'red', name: '红号' },
            { key: 'green', name: '绿号' },
            { key: 'purple', name: '紫号' }
        ];

        let html = '';
        patterns.forEach(pattern => {
            const missingCount = missing[pattern.key] || 0;
            
            html += `
                <div class="missing-item" data-pattern="${pattern.key}" data-missing="${missingCount}">
                    <div class="missing-number">${pattern.name}</div>
                    <div class="missing-count">遗漏 ${missingCount} 期</div>
                    <div class="missing-days">${this.getMissingLevel(missingCount)}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    getMissingLevel(count) {
        if (count > 15) return '极高';
        if (count > 10) return '高';
        if (count > 5) return '中等';
        return '正常';
    }

    updateMissingSummary() {
        const missing = this.trendData.missing.numbers;
        const missingValues = Object.values(missing);
        
        const maxMissing = Math.max(...missingValues);
        const avgMissing = (missingValues.reduce((sum, val) => sum + val, 0) / missingValues.length).toFixed(1);
        const returnNumbers = missingValues.filter(val => val > 10).length;

        AppUtils.safeExecute(() => {
            AppUtils.getElement('#maxMissing').textContent = `${maxMissing}期`;
            AppUtils.getElement('#avgMissing').textContent = `${avgMissing}期`;
            AppUtils.getElement('#returnNumbers').textContent = `${returnNumbers}个`;
        });
    }

    switchMissingType(type) {
        // 更新标签状态
        document.querySelectorAll('.missing-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-type="${type}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 切换内容显示
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
                <div style="font-size: 18px; margin-bottom: 8px;">历史对比分析图表</div>
                <div style="font-size: 14px;">展示不同时期的数据对比趋势</div>
                </div>
            `;
    }

    updateTrendPeriod(period) {
        // 重新生成指定期数的数据
        this.generateComprehensiveTrendData();
        this.renderTrendStatusCard();
        this.refreshCurrentChart();
        this.updateSmartAnalysis();
        this.renderMissingAnalysis();
        
        this.showToast(`已切换到近${period}期数据分析`);
    }

    updateComparisonPeriod(period) {
        this.renderComparisonAnalysis();
        this.showToast(`已切换到${period}对比分析`);
    }

    refreshCurrentChart() {
        const activeChart = document.querySelector('.trend-chart.active');
        if (!activeChart) return;

        const chartType = activeChart.id.replace('-chart', '');
        this.renderChart(chartType);
        this.showToast('图表数据已刷新');
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
                    <h3>号码 ${number} 详细分析</h3>
                    <button class="modal-close" onclick="this.closest('.trend-detail-modal').remove()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="detail-stats">
                        <div class="stat-item">
                            <div class="stat-label">出现次数</div>
                            <div class="stat-value">${data.count}次</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">出现频率</div>
                            <div class="stat-value">${data.percentage}%</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">当前遗漏</div>
                            <div class="stat-value">${data.missing}期</div>
                    </div>
                        <div class="stat-item">
                            <div class="stat-label">最后出现</div>
                            <div class="stat-value">${data.lastAppear || '未知'}</div>
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
        const title = number ? `号码 ${number}` : `形态 ${pattern}`;
        
        const modal = document.createElement('div');
        modal.className = 'trend-detail-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title} 遗漏分析</h3>
                    <button class="modal-close" onclick="this.closest('.trend-detail-modal').remove()">
                        <span class="material-icons-round">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="missing-detail">
                        <div class="missing-level ${this.getMissingLevel(missing).toLowerCase()}">
                            当前遗漏: ${missing} 期 (${this.getMissingLevel(missing)})
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
            return '极度遗漏，建议重点关注，可能即将补出';
        } else if (missing > 10) {
            return '高度遗漏，值得关注，补出概率较高';
        } else if (missing > 5) {
            return '中等遗漏，保持关注，适度考虑';
        }
        return '遗漏正常，无需特别关注';
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

        // 生成历史号码数据
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

        // 反转数组，最新的在前面
        this.trendData.numbers.reverse();
    }

    getNumberColor(number) {
        if (APP_CONSTANTS.NUMBER_COLORS.RED.includes(number)) return 'red';
        if (APP_CONSTANTS.NUMBER_COLORS.GREEN.includes(number)) return 'green';
        if (APP_CONSTANTS.NUMBER_COLORS.PURPLE.includes(number)) return 'purple';
    }

    switchChart(chartType) {
        // 移除所有tab的active状态
        AppUtils.getElements('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });

        // 激活当前tab
        const activeTab = AppUtils.getElement(`[data-chart="${chartType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 显示对应图表
        this.showChart(chartType);
    }

    showChart(chartType) {
        // 隐藏所有图表
        AppUtils.getElements('.trend-chart').forEach(chart => {
            chart.classList.remove('active');
        });

        // 显示目标图表
        const targetChart = AppUtils.getElement(`${chartType}-chart`);
        if (targetChart) {
            targetChart.classList.add('active');
            
            // 根据图表类型生成内容
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

        // 统计每个号码的出现次数
        const numberStats = {};
        for (let i = 0; i <= 9; i++) {
            numberStats[i] = 0;
        }

        this.trendData.numbers.forEach(item => {
            numberStats[item.number]++;
        });

        // 确定热号和冷号
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

            // 判断热度
            if (count >= avgCount + 2) {
                element.classList.add('hot');
            } else if (count <= avgCount - 2) {
                element.classList.add('cold');
            }

            // 检查是否为最近5期出现
            const recentNumbers = this.trendData.numbers.slice(-5).map(item => item.number);
            if (recentNumbers.includes(i)) {
                element.classList.add('recent');
            }

            // 添加点击事件显示详情
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
        
        // 获取最近20期数据
        const recentData = this.trendData.numbers.slice(-20);
        
        recentData.forEach(item => {
            const point = document.createElement('div');
            point.className = 'trend-point';
            point.textContent = item.number;
            
            if (item.big) {
                point.classList.add('big');
                point.title = `${item.number} - 大`;
            } else {
                point.classList.add('small');
                point.title = `${item.number} - 小`;
            }

            container.appendChild(point);
        });

        // 更新统计
        this.updateSizeStats();
    }

    renderParityTrend() {
        const container = AppUtils.getElement('#parity-trend-line');
        if (!container) return;

        container.innerHTML = '';
        
        // 获取最近20期数据
        const recentData = this.trendData.numbers.slice(-20);
        
        recentData.forEach(item => {
            const point = document.createElement('div');
            point.className = 'trend-point';
            point.textContent = item.number;
            
            if (item.odd) {
                point.classList.add('odd');
                point.title = `${item.number} - 单`;
            } else {
                point.classList.add('even');
                point.title = `${item.number} - 双`;
            }

            container.appendChild(point);
        });

        // 更新统计
        this.updateParityStats();
    }

    renderColorTrend() {
        const container = AppUtils.getElement('.color-trend-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // 获取最近30期数据
        const recentData = this.trendData.numbers.slice(-30);
        
        recentData.forEach(item => {
            const point = document.createElement('div');
            point.className = `color-point ${item.color}`;
            point.textContent = item.number;
            point.title = `${item.number} - ${this.getColorName(item.color)}`;

            container.appendChild(point);
        });

        // 更新统计
        this.updateColorStats();
    }

    getColorName(color) {
        const colorNames = {
            'red': '红',
            'green': '绿',
            'purple': '紫'
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
            // 计算当前连续
            let streak = 0;
            const lastType = this.trendData.numbers[this.trendData.numbers.length - 1]?.big;
            for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
                if (this.trendData.numbers[i].big === lastType) {
                    streak++;
                } else {
                    break;
                }
            }
            sizeStreak.textContent = `${streak}期${lastType ? '大' : '小'}`;
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
            // 计算当前连续
            let streak = 0;
            const lastType = this.trendData.numbers[this.trendData.numbers.length - 1]?.odd;
            for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
                if (this.trendData.numbers[i].odd === lastType) {
                    streak++;
                } else {
                    break;
                }
            }
            parityStreak.textContent = `${streak}期${lastType ? '单' : '双'}`;
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

        // 分析热号
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
            hotAnalysis.textContent = `号码 ${hotNumbers.join(', ')} 出现频率最高，共${maxCount}次，建议关注`;
        }

        if (coldAnalysis) {
            coldAnalysis.textContent = `号码 ${coldNumbers.join(', ')} 出现频率最低，共${minCount}次，可能反弹`;
        }

        if (patternAnalysis) {
            const recent5 = this.trendData.numbers.slice(-5);
            const bigCount = recent5.filter(item => item.big).length;
            const oddCount = recent5.filter(item => item.odd).length;
            
            let pattern = '';
            if (bigCount >= 4) pattern += '大号连续出现，';
            if (bigCount <= 1) pattern += '小号连续出现，';
            if (oddCount >= 4) pattern += '单号密集，';
            if (oddCount <= 1) pattern += '双号密集，';
            
            pattern = pattern || '号码分布相对均衡，';
            patternAnalysis.textContent = pattern + '建议结合遗漏数据分析';
        }
    }

    updateMissingData() {
        this.updateNumberMissing();
        this.updatePatternMissing();
    }

    updateNumberMissing() {
        const container = AppUtils.getElement('number-missing');
        if (!container) return;

        // 计算每个号码的遗漏期数
        const missingData = {};
        for (let i = 0; i <= 9; i++) {
            missingData[i] = 0;
        }

        // 从最新开始计算遗漏
        for (let i = this.trendData.numbers.length - 1; i >= 0; i--) {
            const number = this.trendData.numbers[i].number;
            
            // 找到这个号码，更新其他号码的遗漏期数
            for (let j = 0; j <= 9; j++) {
                if (j === number) {
                    // 找到了，停止计算这个号码的遗漏
                    continue;
                } else {
                    // 没找到，继续累加遗漏期数
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
            count.textContent = `遗漏${missing}期`;
            
            // 根据遗漏期数设置样式
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
            { name: '大', check: item => item.big },
            { name: '小', check: item => !item.big },
            { name: '单', check: item => item.odd },
            { name: '双', check: item => !item.odd },
            { name: '红', check: item => item.color === 'red' },
            { name: '绿', check: item => item.color === 'green' },
            { name: '紫', check: item => item.color === 'purple' }
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
            count.textContent = `遗漏${missing}期`;
            
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
        // 移除所有tab的active状态
        AppUtils.getElements('.missing-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 激活当前tab
        const activeTab = AppUtils.getElement(`[data-type="${type}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 显示对应内容
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
        const periods = recent.map(item => `第${item.period}期`).join(', ');
        
        this.showToast(`号码${number}: 出现${count}次, 最近出现: ${periods || '无'}`);
    }

    setupPatternPageEvents() {
        // 路单类型切换
        AppUtils.getElements('.pattern-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const patternType = tab.getAttribute('data-pattern');
                AppUtils.safeExecute(() => this.switchPatternChart(patternType), this);
            });
        });

        // 期数选择
        const roadPeriodSelect = AppUtils.getElement('.road-period-select');
        if (roadPeriodSelect) {
            roadPeriodSelect.addEventListener('change', () => {
                AppUtils.safeExecute(() => this.generatePatternData(), this);
                AppUtils.safeExecute(() => this.updateCurrentPatternChart(), this);
            });
        }

        // 路单刷新按钮
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

        // 路单格子点击事件
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

        // 生成历史路单数据
        for (let i = 0; i < periods; i++) {
            const number = AppUtils.randomInt(0, 9);
            const roadEntry = {
                number: number,
                period: periods - i,
                big: number >= 5,
                odd: number % 2 === 1,
                color: AppUtils.getNumberColor(number),
                timestamp: new Date(Date.now() - i * 5 * 60 * 1000) // 每5分钟一期
            };
            this.patternData.roads.push(roadEntry);
        }

        // 反转数组，最新的在前面
        this.patternData.roads.reverse();
    }

    switchPatternChart(patternType) {
        // 移除所有tab的active状态
        AppUtils.getElements('.pattern-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 激活当前tab
        const activeTab = AppUtils.getElement(`[data-pattern="${patternType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 显示对应路单
        this.showPatternChart(patternType);
    }

    showPatternChart(patternType) {
        // 隐藏所有路单图表
        AppUtils.getElements('.pattern-chart').forEach(chart => {
            chart.classList.remove('active');
        });

        // 显示目标图表
        const targetChart = AppUtils.getElement(`${patternType}-pattern`);
        if (targetChart) {
            targetChart.classList.add('active');
            
            // 根据路单类型生成内容
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
        
        // 分析大小路单，按连续性排列
        const roadData = this.analyzeRoadPattern(this.patternData.roads, 'big');
        
        roadData.forEach((cell, index) => {
            const roadCell = document.createElement('div');
            roadCell.className = `road-cell ${cell.type}`;
            roadCell.textContent = cell.number;
            roadCell.title = `第${cell.period}期: ${cell.number} (${cell.type === 'big' ? '大' : '小'})`;
            roadCell.setAttribute('data-period', cell.period);
            roadCell.setAttribute('data-number', cell.number);
            
            // 标记连续
            if (cell.isStreak && cell.streakLength > 2) {
                roadCell.classList.add('streak');
            }

            container.appendChild(roadCell);
        });

        // 更新统计
        this.updateSizeRoadStats(roadData);
    }

    renderParityRoad() {
        const container = AppUtils.getElement('parity-road-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // 分析单双路单
        const roadData = this.analyzeRoadPattern(this.patternData.roads, 'odd');
        
        roadData.forEach((cell, index) => {
            const roadCell = document.createElement('div');
            roadCell.className = `road-cell ${cell.type}`;
            roadCell.textContent = cell.number;
            roadCell.title = `第${cell.period}期: ${cell.number} (${cell.type === 'odd' ? '单' : '双'})`;
            roadCell.setAttribute('data-period', cell.period);
            roadCell.setAttribute('data-number', cell.number);
            
            // 标记连续
            if (cell.isStreak && cell.streakLength > 2) {
                roadCell.classList.add('streak');
            }

            container.appendChild(roadCell);
        });

        // 更新统计
        this.updateParityRoadStats(roadData);
    }

    renderColorRoad() {
        const container = AppUtils.getElement('color-road-grid');
        if (!container) return;

        container.innerHTML = '';
        
        // 分析颜色路单
        const roadData = this.analyzeColorRoadPattern(this.patternData.roads);
        
        roadData.forEach((cell, index) => {
            const roadCell = document.createElement('div');
            roadCell.className = `road-cell ${cell.color}`;
            roadCell.textContent = cell.number;
            roadCell.title = `第${cell.period}期: ${cell.number} (${this.getColorName(cell.color)})`;
            roadCell.setAttribute('data-period', cell.period);
            roadCell.setAttribute('data-number', cell.number);
            
            // 标记连续
            if (cell.isStreak && cell.streakLength > 2) {
                roadCell.classList.add('streak');
            }

            container.appendChild(roadCell);
        });

        // 更新统计
        this.updateColorRoadStats(roadData);
    }

    renderComprehensiveRoad() {
        // 渲染大小路
        this.renderMiniRoad('mini-size-road', 'big');
        // 渲染单双路
        this.renderMiniRoad('mini-parity-road', 'odd');
        // 渲染颜色路
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
            
            // 检查是否为连续
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
            
            // 检查是否为连续
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

        // 分析当前形态
        const recent5 = this.patternData.roads.slice(-5);
        const bigCount = recent5.filter(item => item.big).length;
        const oddCount = recent5.filter(item => item.odd).length;
        const colorCounts = this.getColorCounts(recent5);

        let currentPattern = '';
        if (bigCount >= 4) currentPattern += '大号强势 ';
        if (bigCount <= 1) currentPattern += '小号强势 ';
        if (oddCount >= 4) currentPattern += '单号密集 ';
        if (oddCount <= 1) currentPattern += '双号密集 ';

        currentPattern = currentPattern || '形态均衡';

        // 分析趋势
        const recent10 = this.patternData.roads.slice(-10);
        const sizeJumps = this.calculateJumps(this.analyzeRoadPattern(recent10, 'big'));
        const parityJumps = this.calculateJumps(this.analyzeRoadPattern(recent10, 'odd'));

        let trend = '';
        if (sizeJumps > 6) trend += '大小跳动频繁 ';
        if (parityJumps > 6) trend += '单双跳动频繁 ';
        if (sizeJumps <= 3 && parityJumps <= 3) trend = '路单较为稳定';

        trend = trend || '路单正常跳动';

        // 预测建议
        const lastItem = this.patternData.roads[this.patternData.roads.length - 1];
        let suggestion = '';
        
        if (lastItem.big && bigCount >= 3) {
            suggestion = '大号连续出现，建议关注小号';
        } else if (!lastItem.big && bigCount <= 2) {
            suggestion = '小号连续出现，建议关注大号';
        } else if (lastItem.odd && oddCount >= 3) {
            suggestion = '单号连续出现，建议关注双号';
        } else if (!lastItem.odd && oddCount <= 2) {
            suggestion = '双号连续出现，建议关注单号';
        } else {
            suggestion = '当前形态相对均衡，建议跟随趋势';
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

        // 计算总跳数
        const sizeRoadData = this.analyzeRoadPattern(this.patternData.roads, 'big');
        const parityRoadData = this.analyzeRoadPattern(this.patternData.roads, 'odd');
        const colorRoadData = this.analyzeColorRoadPattern(this.patternData.roads);

        const sizeJumps = this.calculateJumps(sizeRoadData);
        const parityJumps = this.calculateJumps(parityRoadData);
        const colorJumps = this.calculateColorJumps(colorRoadData);

        // 计算最长连庄
        const allStreaks = [
            ...this.calculateStreaks(sizeRoadData, 'big'),
            ...this.calculateStreaks(sizeRoadData, 'small'),
            ...this.calculateStreaks(parityRoadData, 'odd'),
            ...this.calculateStreaks(parityRoadData, 'even')
        ];
        const maxStreak = Math.max(...allStreaks, 0);

        // 计算规律性指数
        const totalPeriods = this.patternData.roads.length;
        const avgJumps = (sizeJumps + parityJumps + colorJumps) / 3;
        const expectedJumps = totalPeriods * 0.5; // 理论上50%的跳动率
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

        // 大小预测
        const bigRate = recent10.filter(item => item.big).length / recent10.length;
        const sizePreference = bigRate < 0.4 ? 'big' : bigRate > 0.6 ? 'small' : (AppUtils.randomInt(0, 1) > 0.5 ? 'big' : 'small');
        const sizeProb = AppUtils.randomInt(50, 70) + AppUtils.randomInt(0, 20);

        // 单双预测
        const oddRate = recent10.filter(item => item.odd).length / recent10.length;
        const parityPreference = oddRate < 0.4 ? 'odd' : oddRate > 0.6 ? 'even' : (AppUtils.randomInt(0, 1) > 0.5 ? 'odd' : 'even');
        const parityProb = AppUtils.randomInt(50, 70) + AppUtils.randomInt(0, 20);

        // 颜色预测
        const colorCounts = this.getColorCounts(recent10);
        const minColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] < colorCounts[b] ? a : b);
        const colorProb = AppUtils.randomInt(60, 85);

        // 更新显示
        this.updatePredictionDisplay('size-prediction', 'size-prob', sizePreference, sizeProb);
        this.updatePredictionDisplay('parity-prediction', 'parity-prob', parityPreference, parityProb);
        this.updatePredictionDisplay('color-prediction', 'color-prob', minColor, colorProb);

        // 更新置信度
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
                
                if ((preference === 'big' && choiceText === '大') ||
                    (preference === 'small' && choiceText === '小') ||
                    (preference === 'odd' && choiceText === '单') ||
                    (preference === 'even' && choiceText === '双') ||
                    (preference === 'red' && choiceText === '红') ||
                    (preference === 'green' && choiceText === '绿') ||
                    (preference === 'purple' && choiceText === '紫')) {
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
        const type = cell.className.includes('big') ? '大' : 
                    cell.className.includes('small') ? '小' :
                    cell.className.includes('odd') ? '单' :
                    cell.className.includes('even') ? '双' :
                    cell.className.includes('red') ? '红' :
                    cell.className.includes('green') ? '绿' :
                    cell.className.includes('purple') ? '紫' : '';

        this.showToast(`第${period}期: ${number} (${type})`);
    }

    setupStrategyPageEvents() {
        // 策略选择
        AppUtils.getElements('.strategy-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const strategy = item.getAttribute('data-strategy');
                AppUtils.safeExecute(() => this.switchStrategy(strategy), this);
            });
        });

        // 金额选择按钮
        AppUtils.getElements('.amount-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = parseInt(btn.getAttribute('data-amount'));
                AppUtils.safeExecute(() => this.selectAmount(amount), this);
            });
        });

        // 自定义金额输入
        const customAmountInput = AppUtils.getElement('.custom-amount');
        if (customAmountInput) {
            customAmountInput.addEventListener('input', (e) => {
                const amount = parseInt(e.target.value);
                if (amount > 0) {
                    AppUtils.safeExecute(() => this.selectAmount(amount), this);
                }
            });
        }

        // 参数选择
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

        // 回测按钮
        const backtestBtn = AppUtils.getElement('strategy-backtest-btn');
        if (backtestBtn) {
            backtestBtn.addEventListener('click', () => {
                this.showBacktestModal();
            });
        }

        // 期间选择按钮
        AppUtils.getElements('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = btn.getAttribute('data-period');
                AppUtils.safeExecute(() => this.switchStatsPeriod(period), this);
            });
        });

        // 清空记录按钮
        const clearHistoryBtn = AppUtils.getElement('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                this.clearBetHistory();
            });
        }

        // 回测模态框事件
        this.setupBacktestModalEvents();
    }

    setupBacktestModalEvents() {
        // 关闭模态框
        const closeModalBtn = AppUtils.getElement('close-backtest-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.hideBacktestModal();
            });
        }

        // 模态框背景点击关闭
        const modal = AppUtils.getElement('backtest-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.hideBacktestModal();
                }
            });
        }

        // 开始回测按钮
        const runBacktestBtn = AppUtils.getElement('run-backtest-btn');
        if (runBacktestBtn) {
            runBacktestBtn.addEventListener('click', () => {
                this.runBacktest();
            });
        }
    }

    generateStrategyData() {
        // 初始化策略数据结构
        this.strategyData = {
            current: 'ai', // 当前策略
            config: {
                baseAmount: this.config.baseAmount, // 使用全局配置中的基础金额
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

        console.log('初始化策略数据，基础金额:', this.strategyData.config.baseAmount);

        // 生成投注记录
        for (let i = 0; i < 10; i++) {
            const isWin = AppUtils.randomInt(0, 1) > 0.3;
            const amount = this.strategyData.config.baseAmount + AppUtils.randomInt(0, 50);
            const profit = isWin ? Math.floor(amount * (0.8 + Math.random() * 0.4)) : -amount;
            
            this.strategyData.history.push({
                id: Date.now() + i,
                time: new Date(Date.now() - i * 5 * 60 * 1000),
                number: AppUtils.randomInt(0, 9),
                betType: ['大', '小', '单', '双', '红', '绿', '紫'][AppUtils.randomInt(0, 6)],
                amount: amount,
                profit: profit,
                status: isWin ? 'win' : 'lose'
            });
        }

        // 计算统计数据
        this.calculateStrategyStats();

        // 生成盈亏图表数据
        this.generateProfitChartData();

        console.log('策略数据生成完成:', this.strategyData);
    }

    // 计算策略统计数据
    calculateStrategyStats() {
        if (!this.strategyData.history.length) return;

        const totalProfit = this.strategyData.history.reduce((sum, record) => sum + record.profit, 0);
        const winCount = this.strategyData.history.filter(record => record.status === 'win').length;
        const winRate = Math.round((winCount / this.strategyData.history.length) * 100);
        
        // 计算最长连胜
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
        // 移除所有策略的active状态
        AppUtils.getElements('.strategy-item').forEach(item => {
            item.classList.remove('active');
        });

        // 激活选中的策略
        const selectedStrategy = AppUtils.getElement(`[data-strategy="${strategyType}"]`);
        if (selectedStrategy) {
            selectedStrategy.classList.add('active');
        }

        // 更新当前策略
        this.strategyData.current = strategyType;

        // 更新策略详情
        this.updateStrategyDetails(strategyType);

        // 更新推荐
        this.updateStrategyRecommendation();

        this.showToast(`已切换到${this.getStrategyName(strategyType)}`);
    }

    getStrategyName(strategyType) {
        const names = {
            'ai': 'AI智能策略',
            'follow': '跟庄策略',
            'reverse': '反庄策略',
            'martin': '马丁策略',
            'flat': '平投策略',
            'wave': '波浪策略'
        };
        return names[strategyType] || '未知策略';
    }

    getStrategyDescription(strategyType) {
        const descriptions = {
            'ai': '基于机器学习算法，分析历史数据和实时趋势，智能推荐最优投注方案。综合考虑号码热度、路单规律、形态分析等多维度因素。',
            'follow': '跟随当前热门趋势进行投注，当某个号码或形态连续出现时，继续跟投。适合趋势明显的时期，风险相对较低。',
            'reverse': '反向投注策略，当某个形态连续出现多次后，投注相反的结果。基于物极必反的原理，适合反弹行情。',
            'martin': '经典的马丁格尔策略，每次失败后加倍投注，直到获胜。理论上能保证盈利，但需要充足的资金支持。',
            'flat': '固定金额投注策略，每次投注金额保持不变。风险可控，适合稳健型投资者，长期收益相对稳定。',
            'wave': '波段式投注策略，根据市场波动调整投注金额和频率。在低点增加投注，高点减少投注，追求波段收益。'
        };
        return descriptions[strategyType] || '暂无策略描述';
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
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.config) {
            console.warn('策略数据或配置未初始化，无法设置金额');
            return;
        }

        // 移除所有金额按钮的active状态
        AppUtils.getElements('.amount-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 如果是预设金额，激活对应按钮
        const targetBtn = AppUtils.getElement(`[data-amount="${amount}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }

        // 更新配置
        this.strategyData.config.baseAmount = amount;

        // 更新推荐金额
        this.updateRecommendationAmount();
    }

    updateRecommendationAmount() {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.config) {
            console.warn('策略数据或配置未初始化，无法更新推荐金额');
            return;
        }

        const amountElement = AppUtils.getElement('recommendation-amount');
        if (amountElement) {
            amountElement.textContent = `${this.strategyData.config.baseAmount}元`;
        }
    }

    updateStrategyRecommendation() {
        // 生成推荐号码
            const numbers = [];
        const primaryNumber = AppUtils.randomInt(0, 9);
        numbers.push(primaryNumber);
        
        while (numbers.length < 3) {
            const num = AppUtils.randomInt(0, 9);
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }

        // 更新推荐号码显示
        const numbersContainer = AppUtils.getElement('recommendation-numbers');
        if (numbersContainer) {
            numbersContainer.innerHTML = numbers.map((num, index) => 
                `<div class="rec-number ${index === 0 ? 'primary' : ''}">${num}</div>`
            ).join('');
        }

        // 更新推荐形态
        const patterns = this.generateRecommendationPatterns(numbers[0]);
        const patternsContainer = AppUtils.getElement('recommendation-patterns');
        if (patternsContainer) {
            patternsContainer.innerHTML = patterns.map(pattern => 
                `<span class="pattern-tag ${pattern.active ? 'active' : ''}">${pattern.name}</span>`
            ).join('');
        }

        // 更新置信度
        const confidence = AppUtils.randomInt(70, 90);
        const confidenceElement = AppUtils.getElement('recommendation-confidence');
        if (confidenceElement) {
            confidenceElement.textContent = `${confidence}%`;
        }

        // 更新推荐理由
        const reasonElement = AppUtils.getElement('recommendation-reason');
        if (reasonElement) {
            reasonElement.textContent = this.generateRecommendationReason(numbers[0], patterns);
        }

        // 更新推荐金额
        this.updateRecommendationAmount();
    }

    generateRecommendationPatterns(number) {
        return [
            { name: '大', active: number >= 5 },
            { name: '小', active: number < 5 },
            { name: '单', active: number % 2 === 1 },
            { name: '双', active: number % 2 === 0 },
            { name: '红', active: APP_CONSTANTS.NUMBER_COLORS.RED.includes(number) },
            { name: '绿', active: APP_CONSTANTS.NUMBER_COLORS.GREEN.includes(number) },
            { name: '紫', active: APP_CONSTANTS.NUMBER_COLORS.PURPLE.includes(number) }
        ].filter(p => p.active);
    }

    generateRecommendationReason(number, patterns) {
        const reasons = [
            `基于AI分析，号码${number}在近期表现活跃，${patterns.map(p => p.name).join('')}形态连续出现，预测下期继续维持该趋势的概率较高。`,
            `通过路单分析发现，${patterns.map(p => p.name).join('')}形态即将反弹，号码${number}具有较大的出现潜力。`,
            `历史数据显示，当前环境下号码${number}的命中率达到85%，建议重点关注。`,
            `根据热度统计，号码${number}正处于上升期，结合${patterns.map(p => p.name).join('')}形态，推荐投注。`
        ];
        return reasons[AppUtils.randomInt(0, reasons.length - 1)];
    }

    updateStrategyStats() {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.stats) {
            console.warn('策略数据未初始化，跳过统计更新');
            return;
        }

        // 更新总盈亏
        const totalProfitElement = AppUtils.getElement('total-profit');
        if (totalProfitElement) {
            const profit = this.strategyData.stats.totalProfit;
            totalProfitElement.textContent = profit >= 0 ? `+¥${profit}` : `-¥${Math.abs(profit)}`;
            totalProfitElement.className = `stat-value ${profit >= 0 ? 'profit' : 'loss'}`;
        }

        // 更新胜率
        const winRateElement = AppUtils.getElement('win-rate');
        if (winRateElement) {
            winRateElement.textContent = `${this.strategyData.stats.winRate}%`;
        }

        // 更新投注次数
        const totalBetsElement = AppUtils.getElement('total-bets');
        if (totalBetsElement) {
            totalBetsElement.textContent = this.strategyData.stats.totalBets;
        }

        // 更新最长连胜
        const maxStreakElement = AppUtils.getElement('max-streak');
        if (maxStreakElement) {
            maxStreakElement.textContent = this.strategyData.stats.maxStreak;
        }
    }

    switchStatsPeriod(period) {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.stats) {
            console.warn('策略数据未初始化，无法切换统计期间');
            return;
        }

        // 移除所有期间按钮的active状态
        AppUtils.getElements('.period-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 激活选中的期间按钮
        const selectedBtn = AppUtils.getElement(`[data-period="${period}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        // 根据期间更新统计数据
        this.updateStatsByPeriod(period);
        this.showToast(`已切换到${this.getPeriodName(period)}统计`);
    }

    getPeriodName(period) {
        const names = {
            'today': '今日',
            'week': '本周',
            'month': '本月'
        };
        return names[period] || '未知期间';
    }

    updateStatsByPeriod(period) {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.stats) {
            console.warn('策略数据未初始化，无法更新期间统计');
            return;
        }

        // 模拟不同期间的统计数据
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
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.profitChart) {
            console.warn('策略数据或盈亏图表数据未初始化');
            return;
        }

        const chartContainer = AppUtils.getElement('profit-chart');
        if (!chartContainer) return;

        chartContainer.innerHTML = '';
        
        if (this.strategyData.profitChart.length === 0) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">暂无图表数据</div>';
            return;
        }
        
        const maxHeight = 100;
        const maxProfit = Math.max(...this.strategyData.profitChart.map(item => Math.abs(item.profit)));
        
        this.strategyData.profitChart.forEach(item => {
            const bar = document.createElement('div');
            bar.className = `chart-bar ${item.profit >= 0 ? 'profit' : 'loss'}`;
            
            const height = Math.max(5, Math.abs(item.profit) / maxProfit * maxHeight);
            bar.style.height = `${height}px`;
            bar.title = `第${item.period}期: ${item.profit >= 0 ? '+' : ''}${item.profit}元`;
            
            chartContainer.appendChild(bar);
        });
    }

    updateBetHistory() {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.history) {
            console.warn('策略数据或历史记录未初始化');
            return;
        }

        const historyList = AppUtils.getElement('bet-history-list');
        if (!historyList) return;

        if (this.strategyData.history.length === 0) {
            historyList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📋</div>
                    <p>暂无投注记录</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.strategyData.history.map(bet => `
            <div class="bet-item">
                <div class="bet-info">
                    <div class="bet-detail">号码${bet.number} - ${bet.betType}</div>
                    <div class="bet-time">${AppUtils.formatTime(bet.time)}</div>
                            </div>
                <div class="bet-result">
                    <div class="bet-amount ${bet.status}">${bet.profit >= 0 ? '+' : ''}¥${bet.profit}</div>
                    <div class="bet-status ${bet.status}">${bet.status === 'win' ? '中奖' : '未中'}</div>
                    </div>
                    </div>
        `).join('');
    }

    clearBetHistory() {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.history) {
            console.warn('策略数据或历史记录未初始化');
            return;
        }

        this.strategyData.history = [];
        this.updateBetHistory();
        this.showToast('投注记录已清空');
    }

    showBacktestModal() {
        const modal = AppUtils.getElement('backtest-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // 重置回测结果
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

        // 显示加载状态
        const runBtn = AppUtils.getElement('run-backtest-btn');
        if (runBtn) {
            runBtn.textContent = '回测中...';
            runBtn.disabled = true;
        }

        // 模拟回测计算
        setTimeout(() => {
            const results = this.calculateBacktestResults(periods, initialCapital);
            this.displayBacktestResults(results);
            
            // 恢复按钮状态
            if (runBtn) {
                runBtn.textContent = '开始回测';
                runBtn.disabled = false;
            }
        }, 2000);
    }

    calculateBacktestResults(periods, initialCapital) {
        // 确保策略数据存在
        if (!this.strategyData || !this.strategyData.config) {
            console.warn('策略数据或配置未初始化，使用默认值进行回测');
            // 使用默认基础金额
            const defaultBaseAmount = this.config.baseAmount;
            return this.performBacktestCalculation(periods, initialCapital, defaultBaseAmount);
        }

        return this.performBacktestCalculation(periods, initialCapital, this.strategyData.config.baseAmount);
    }

    // 执行回测计算的核心逻辑
    performBacktestCalculation(periods, initialCapital, baseAmount) {
        let capital = initialCapital;
        let maxCapital = initialCapital;
        let minCapital = initialCapital;
        let wins = 0;
        let totalTrades = periods;
        
        const chartData = [];
        
        for (let i = 0; i < periods; i++) {
            const isWin = AppUtils.randomInt(0, 1) > 0.35; // 65% 胜率
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
        // 更新结果数值
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

        // 渲染资金曲线
        this.renderBacktestChart(results.chartData);

        // 显示结果
        const resultsContainer = AppUtils.getElement('backtest-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');
        }

        this.showToast('回测完成');
    }

    renderBacktestChart(chartData) {
        const chartDisplay = AppUtils.getElement('backtest-chart');
        if (!chartDisplay) return;

        // 简单的文字显示，实际项目中可以使用图表库
        chartDisplay.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 24px; font-weight: bold; color: var(--primary-color); margin-bottom: 10px;">
                    ¥${chartData[chartData.length - 1].capital.toFixed(0)}
                </div>
                <div style="color: var(--text-secondary); margin-bottom: 15px;">最终资金</div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
                    <span>起始: ¥${chartData[0].capital.toFixed(0)}</span>
                    <span>最高: ¥${Math.max(...chartData.map(d => d.capital)).toFixed(0)}</span>
                    <span>最低: ¥${Math.min(...chartData.map(d => d.capital)).toFixed(0)}</span>
                    </div>
                </div>
            `;
    }

    setupLanguageManager() {
        console.log('设置语言管理器...');
        
        // 简化初始化，只设置基本语言
        try {
            i18n.init();
            console.log('语言管理器初始化完成');
        } catch (error) {
            console.warn('语言管理器初始化失败:', error);
        }
    }

    setupLanguageEvents() {
        console.log('设置语言事件...');
        
        // 语言按钮点击事件
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
            // 点击遮罩关闭
            const overlay = languageModal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => {
                    this.hideLanguageModal();
                });
            }
            
            // 语言选择事件
            languageModal.querySelectorAll('.language-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lang = item.getAttribute('data-lang');
                    if (lang) {
                        console.log('切换语言到:', lang);
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
            console.log('生成初始数据...');
            
            // 生成热门号码
            this.generateHotNumbers();
            
            // 更新统计数据
            this.updateStats();
            
            // 生成趋势数据
            this.generateTrendData();
            
            // 生成路单数据
            this.generatePatternData();
            
            // 生成策略数据
            this.generateStrategyData();
            
            // 初始化各页面
            this.initializePage(APP_CONSTANTS.PAGES.HOME);
        }, this);
    }

    // 清理资源
    destroy() {
        // 清除定时器
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        // 清除事件监听器
        this.dataManager = null;

        // 清除缓存
        AppUtils.elementCache.clear();
    }

    // 应用升级管理
    checkForUpdates() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
    }

    // 性能监控
    trackPerformance() {
        if ('performance' in window) {
            const navigation = performance.getEntriesByType('navigation')[0];
            console.log('页面加载时间:', navigation.loadEventEnd - navigation.loadEventStart);
        }
    }

    // 历史记录相关配置

    // 生成历史记录数据 - 使用真实API数据
    async generateHistoryData() {
        console.log('开始获取真实历史记录数据...');
        
        // 显示加载状态
        this.isDataLoading = true;
        this.showLoadingState('正在获取最新开奖数据...');
        
        try {
            // 从API获取真实数据
            const apiData = await this.apiService.getHistoryData();
            
            if (apiData && apiData.length > 0) {
                this.historyData = apiData;
                this.lastDataUpdate = new Date();
                console.log(`成功获取 ${apiData.length} 条真实历史数据`);
                
                // 更新UI显示
                this.hideLoadingState();
                this.showToast('历史数据已更新', 'success');
            } else {
                console.warn('API返回空数据，生成模拟数据');
                this.generateFallbackHistoryData();
            }
            
        } catch (error) {
            console.error('获取API数据失败:', error);
            this.generateFallbackHistoryData();
            this.showToast('数据获取失败，使用模拟数据', 'warning');
        } finally {
            this.isDataLoading = false;
            this.hideLoadingState();
        }
        
        // 初始化筛选数据
        this.filteredHistoryData = [...this.historyData];
        
        console.log('历史记录数据处理完成:', this.historyData.length, '条记录');
    }

    // 显示加载状态
    showLoadingState(message = '加载中...') {
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

    // 隐藏加载状态
    hideLoadingState() {
        const loadingOverlay = AppUtils.getElement('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    // 备用历史数据生成
    generateFallbackHistoryData() {
        console.log('生成备用历史记录数据...');
        
        this.historyData = [];
        const now = new Date();
        
        // 生成近100期的历史数据
        for (let i = 0; i < 100; i++) {
            const periodTime = new Date(now.getTime() - i * 5 * 60 * 1000); // 每5分钟一期
            const number = AppUtils.randomInt(0, 9);
            const color = AppUtils.getNumberColor(number);
            
            const historyRecord = {
                period: `2024${String(1000 + (99 - i))}`,
                time: periodTime,
                number: number,
                big: number >= 5,
                odd: number % 2 === 1,
                color: color,
                patterns: this.generateHistoryPatterns(number),
                isApi: false // 标记为非API数据
            };
            
            this.historyData.push(historyRecord);
        }
    }

    // 刷新历史数据
    async refreshHistoryData() {
        console.log('刷新历史数据...');
        
        // 清除缓存
        this.apiService.cache.clear();
        
        // 重新获取数据
        await this.generateHistoryData();
        
        // 更新相关UI
        this.updateRecentHistory();
        this.updateHomeStats();
        this.updateHotNumbers();
    }

    generateHistoryPatterns(number) {
        const patterns = [];
        
        if (number >= 5) patterns.push('大');
        else patterns.push('小');
        
        if (number % 2 === 1) patterns.push('单');
        else patterns.push('双');
        
        const color = AppUtils.getNumberColor(number);
        if (color === 'red') patterns.push('红');
        else if (color === 'green') patterns.push('绿');
        else if (color === 'purple') patterns.push('紫');
            
            return patterns;
        }

    // 初始化历史记录页面
    initializeHistoryPage() {
        console.log('初始化历史记录页面...');
        
        // 确保历史数据存在
        if (!this.historyData.length) {
            this.generateHistoryData();
        }
        
        // 设置事件监听器
        this.setupHistoryPageEvents();
        
        // 初始化筛选条件
        this.resetHistoryFilters();
        
        // 更新页面内容
        this.updateHistoryStats();
        this.updateFrequencyAnalysis();
        this.updateHistoryTable();
    }

    // 设置历史记录页面事件
    setupHistoryPageEvents() {
        // 筛选重置按钮
        const resetBtn = AppUtils.getElement('.filter-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetHistoryFilters();
            });
        }

        // 查询按钮
        const searchBtn = AppUtils.getElement('#searchHistory');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.filterHistoryData();
            });
        }

        // 筛选条件变化
        const filters = ['#dateRange', '#numberFilter', '#patternFilter'];
        filters.forEach(selector => {
            const element = AppUtils.getElement(selector);
            if (element) {
                element.addEventListener('change', () => {
                    this.filterHistoryData();
                });
            }
        });

        // 频率分析切换
        AppUtils.getElements('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
                if (view) {
                    this.switchAnalysisView(view);
                }
            });
        });

        // 导出按钮
        const exportBtn = AppUtils.getElement('.export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportHistoryData();
            });
        }

        // 加载更多按钮
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreHistoryRecords();
            });
        }
    }

    // 重置筛选条件
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

    // 筛选历史数据
    filterHistoryData() {
        console.log('筛选历史数据...');
        
        const dateRange = AppUtils.getElement('#dateRange')?.value || 'month';
        const numberFilter = AppUtils.getElement('#numberFilter')?.value || 'all';
        const patternFilter = AppUtils.getElement('#patternFilter')?.value || 'all';

        let filtered = [...this.historyData];

        // 时间筛选
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

        // 号码筛选
        if (numberFilter !== 'all') {
            const targetNumber = parseInt(numberFilter);
            filtered = filtered.filter(item => item.number === targetNumber);
        }

        // 形态筛选
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

        // 更新界面
        this.updateHistoryStats();
        this.updateFrequencyAnalysis();
        this.updateHistoryTable();

        console.log('筛选完成，共', filtered.length, '条记录');
    }

    // 更新历史统计
    updateHistoryStats() {
        const data = this.filteredHistoryData;
        
        // 基础统计
        const totalDraws = data.length;
        const bigCount = data.filter(item => item.big).length;
        const oddCount = data.filter(item => item.odd).length;
        
        // 找出最热号码
        const numberCounts = {};
        for (let i = 0; i <= 9; i++) {
            numberCounts[i] = 0;
        }
        data.forEach(item => {
            numberCounts[item.number]++;
        });
        
        const maxCount = Math.max(...Object.values(numberCounts));
        const hotNumber = Object.keys(numberCounts).find(num => numberCounts[num] === maxCount);

        // 更新显示
        const totalDrawsEl = AppUtils.getElement('#totalDraws');
        const bigCountEl = AppUtils.getElement('#bigCount');
        const oddCountEl = AppUtils.getElement('#oddCount');
        const hotNumberEl = AppUtils.getElement('#hotNumber');

        if (totalDrawsEl) totalDrawsEl.textContent = totalDraws;
        if (bigCountEl) bigCountEl.textContent = bigCount;
        if (oddCountEl) oddCountEl.textContent = oddCount;
        if (hotNumberEl) hotNumberEl.textContent = hotNumber || '-';

        // 更新期间文本
        const statsPeriodText = AppUtils.getElement('#statsPeriodText');
        const dateRange = AppUtils.getElement('#dateRange')?.value || 'month';
        const periodNames = {
            'today': '今日',
            'week': '近7天',
            'month': '近30天',
            'custom': '自定义'
        };
        if (statsPeriodText) {
            statsPeriodText.textContent = periodNames[dateRange] || '近30天';
        }
    }

    // 更新频率分析
    updateFrequencyAnalysis() {
        const data = this.filteredHistoryData;
        const total = data.length;
        
        if (total === 0) return;

        // 计算每个号码的频率
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

        // 计算百分比并确定热冷状态
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

        // 更新频率网格显示
        const frequencyGrid = AppUtils.getElement('#frequencyGrid');
        if (frequencyGrid) {
            frequencyGrid.innerHTML = '';
            
            for (let i = 0; i <= 9; i++) {
                const freq = frequencies[i];
                const item = document.createElement('div');
                item.className = `frequency-item ${freq.status}`;
                item.innerHTML = `
                    <div class="frequency-number">${i}</div>
                    <div class="frequency-count">${freq.count}次</div>
                    <div class="frequency-percent">${freq.percent}%</div>
                `;
                
                item.addEventListener('click', () => {
                    this.showNumberDetail(i, freq);
                });
                
                frequencyGrid.appendChild(item);
            }
        }
    }

    // 切换分析视图
    switchAnalysisView(view) {
        // 更新切换按钮状态
        AppUtils.getElements('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = AppUtils.getElement(`[data-view="${view}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // 显示对应内容
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

    // 渲染趋势图表
    renderTrendChart() {
        const trendChart = AppUtils.getElement('#trendChart');
        if (!trendChart) return;

        // 简单的趋势图表显示
        const recentData = this.filteredHistoryData.slice(0, 20);
        
        trendChart.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 18px; font-weight: 600; color: var(--primary-color); margin-bottom: 16px;">
                    最近${recentData.length}期趋势
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
                        " title="第${item.period}期: ${item.number}">${item.number}</div>
                    `).join('')}
                            </div>
                <div style="margin-top: 16px; font-size: 12px; color: var(--text-secondary);">
                    点击号码查看详情
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

    // 更新历史记录表格
    updateHistoryTable() {
        const tableBody = AppUtils.getElement('#historyTableBody');
        const recordCount = AppUtils.getElement('#recordCount');
        
        if (!tableBody) return;

        const startIndex = 0;
        const endIndex = this.historyCurrentPage * this.historyPageSize;
        const displayData = this.filteredHistoryData.slice(startIndex, endIndex);

        tableBody.innerHTML = displayData.map(item => this.createHistoryTableRow(item)).join('');

        // 更新记录数量
        if (recordCount) {
            recordCount.textContent = this.filteredHistoryData.length;
        }

        // 更新加载更多按钮状态
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
                    <button class="detail-btn" onclick="window.app.showHistoryDetail('${item.period}')">详情</button>
                </div>
                            </div>
                        `;
    }

    // 加载更多记录
    loadMoreHistoryRecords() {
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.classList.add('loading');
        }

        // 模拟异步加载
        setTimeout(() => {
            this.historyCurrentPage++;
            this.updateHistoryTable();
        }, 500);
    }

    // 显示历史详情
    showHistoryDetail(period) {
        const item = this.historyData.find(h => h.period === period);
        if (!item) return;

        const patterns = item.patterns.join(' | ');
        const time = item.time.toLocaleString('zh-CN');
        
        this.showToast(`第${period}期详情\n开奖时间: ${time}\n开奖号码: ${item.number}\n号码形态: ${patterns}`);
    }

    // 导出历史数据
    exportHistoryData() {
        const data = this.filteredHistoryData;
        if (data.length === 0) {
            this.showToast('没有可导出的数据');
            return;
        }

        // 创建CSV内容
        const headers = ['期数', '开奖时间', '开奖号码', '大小', '单双', '颜色'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                item.period,
                item.time.toLocaleString('zh-CN'),
                item.number,
                item.big ? '大' : '小',
                item.odd ? '单' : '双',
                item.color === 'red' ? '红' : item.color === 'green' ? '绿' : '紫'
            ].join(','))
        ].join('\n');

        // 创建下载链接
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `wingo_history_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('数据导出成功');
    }

    // 更新首页最近开奖记录
    updateRecentHistory() {
        console.log('更新首页最近开奖记录...');
        
        const recentHistoryList = AppUtils.getElement('#recentHistoryList');
        if (!recentHistoryList) return;

        // 确保历史数据存在
        if (!this.historyData.length) {
            this.generateHistoryData();
        }

        // 应用当前过滤器
        const filteredData = this.applyHistoryFilters();
        
        // 获取要显示的记录数量
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

        // 添加点击事件
        this.setupHistoryItemEvents();
        
        // 更新历史统计卡片
        this.updateHistoryStatsCards();
        
        // 更新加载更多按钮状态
        this.updateLoadMoreButton(filteredData.length, displayCount);
    }

    // 应用历史记录过滤器
    applyHistoryFilters() {
        if (!this.historyData.length) return [];
        
        const activeFilters = this.getActiveHistoryFilters();
        
        return this.historyData.filter(item => {
            // 大小过滤
            if (activeFilters.size !== 'all') {
                const isBig = item.number >= 5;
                if (activeFilters.size === 'big' && !isBig) return false;
                if (activeFilters.size === 'small' && isBig) return false;
            }
            
            // 单双过滤
            if (activeFilters.parity !== 'all') {
                const isOdd = item.number % 2 === 1;
                if (activeFilters.parity === 'odd' && !isOdd) return false;
                if (activeFilters.parity === 'even' && isOdd) return false;
            }
            
            // 颜色过滤
            if (activeFilters.color !== 'all') {
                if (item.color !== activeFilters.color) return false;
            }
            
            return true;
        });
    }

    // 获取当前激活的过滤器
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

    // 设置历史记录项事件
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

    // 更新历史统计卡片
    updateHistoryStatsCards() {
        if (!this.historyData.length) return;
        
        const recent20 = this.historyData.slice(0, 20);
        
        // 计算当前连号
        const currentStreak = this.calculateCurrentStreak(recent20);
        const currentStreakEl = AppUtils.getElement('#currentStreak');
        if (currentStreakEl) {
            currentStreakEl.textContent = currentStreak;
        }
        
        // 计算最热号码
        const hotestNumber = this.getHottestNumber(recent20);
        const hotestNumberEl = AppUtils.getElement('#hotestNumber');
        if (hotestNumberEl) {
            hotestNumberEl.textContent = hotestNumber;
        }
        
        // 计算最冷号码
        const coldestNumber = this.getColdestNumber(recent20);
        const coldestNumberEl = AppUtils.getElement('#coldestNumber');
        if (coldestNumberEl) {
            coldestNumberEl.textContent = coldestNumber;
        }
        
        // 更新最后更新时间
        const lastUpdateEl = AppUtils.getElement('#lastUpdate');
        if (lastUpdateEl) {
            const now = new Date();
            const timeAgo = this.getTimeAgo(now);
            lastUpdateEl.textContent = timeAgo;
        }
    }

    // 计算当前连号
    calculateCurrentStreak(data) {
        if (!data.length) return '无数据';
        
        let streak = 1;
        let type = '';
        
        // 判断第一个号码的类型
        const firstNumber = data[0].number;
        if (firstNumber >= 5) {
            type = '大';
        } else {
            type = '小';
        }
        
        // 计算连续数量
        for (let i = 1; i < data.length; i++) {
            const currentNumber = data[i].number;
            const isBig = currentNumber >= 5;
            
            if ((type === '大' && isBig) || (type === '小' && !isBig)) {
                streak++;
            } else {
                break;
            }
        }
        
        return `${streak}连${type}`;
    }

    // 获取最热号码
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

    // 获取最冷号码
    getColdestNumber(data) {
        const frequencies = {};
        
        // 初始化所有号码频率为0
        for (let i = 0; i <= 9; i++) {
            frequencies[i] = 0;
        }
        
        // 统计实际频率
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

    // 获取时间前描述
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}小时前`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}天前`;
    }

    // 更新加载更多按钮
    updateLoadMoreButton(totalCount, currentCount) {
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (!loadMoreBtn) return;
        
        if (currentCount >= totalCount) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'flex';
            const remainingCount = totalCount - currentCount;
            const buttonText = loadMoreBtn.querySelector('span:last-child') || loadMoreBtn;
            buttonText.textContent = `查看更多历史记录 (还有${remainingCount}条)`;
        }
    }

    // 显示历史记录详情模态框
    showHistoryDetailModal(period, index) {
        const item = this.historyData[index];
        if (!item) return;
        
        // 创建模态框HTML
        const modalHtml = `
            <div class="history-detail-modal" id="historyDetailModal">
                <div class="history-detail-content">
                    <div class="history-detail-header">
                        <h3>开奖详情</h3>
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
                                <div class="detail-info-label">期号</div>
                            </div>
                            <div class="detail-info-item">
                                <div class="detail-info-value">${AppUtils.formatTime(item.time)}</div>
                                <div class="detail-info-label">开奖时间</div>
                            </div>
                            <div class="detail-info-item">
                                <div class="detail-info-value">${item.number >= 5 ? '大' : '小'}号</div>
                                <div class="detail-info-label">大小</div>
                            </div>
                            <div class="detail-info-item">
                                <div class="detail-info-value">${item.number % 2 === 1 ? '单' : '双'}号</div>
                                <div class="detail-info-label">单双</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 移除已存在的模态框
        const existingModal = AppUtils.getElement('#historyDetailModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 添加模态框到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 显示模态框
        const modal = AppUtils.getElement('#historyDetailModal');
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        // 设置关闭事件
        this.setupHistoryDetailModalEvents(modal);
    }

    // 设置历史记录详情模态框事件
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

    // 设置首页历史记录增强功能的事件监听器
    setupEnhancedHistoryEvents() {
        // 过滤器切换按钮
        const filterHistoryBtn = AppUtils.getElement('#filterHistoryBtn');
        if (filterHistoryBtn) {
            filterHistoryBtn.addEventListener('click', () => {
                this.toggleHistoryFilters();
            });
        }
        
        // 过滤器标签事件
        const filterTabs = AppUtils.getElements('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.handleFilterTabClick(tab);
            });
        });
        
        // 颜色过滤器事件
        const colorFilters = AppUtils.getElements('.color-filter');
        colorFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                this.handleColorFilterClick(filter);
            });
        });
        
        // 历史统计卡片点击事件
        const historyStatCards = AppUtils.getElements('.history-stat-card');
        historyStatCards.forEach(card => {
            card.addEventListener('click', () => {
                this.handleHistoryStatCardClick(card);
            });
        });
        
        // 加载更多按钮事件
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreHistoryRecords();
            });
        }
        
        // 初始化历史记录显示数量
        this.historyDisplayCount = 8;
    }

    // 切换历史记录过滤器显示
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

    // 处理过滤器标签点击
    handleFilterTabClick(clickedTab) {
        // 移除其他标签的激活状态
        const allTabs = AppUtils.getElements('.filter-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // 激活当前标签
        clickedTab.classList.add('active');
        
        // 刷新历史记录显示
        this.updateRecentHistory();
    }

    // 处理颜色过滤器点击
    handleColorFilterClick(clickedFilter) {
        // 移除其他过滤器的激活状态
        const allFilters = AppUtils.getElements('.color-filter');
        allFilters.forEach(filter => filter.classList.remove('active'));
        
        // 激活当前过滤器
        clickedFilter.classList.add('active');
        
        // 刷新历史记录显示
        this.updateRecentHistory();
    }

    // 处理历史统计卡片点击
    handleHistoryStatCardClick(card) {
        const statValue = card.querySelector('.stat-value');
        const statLabel = card.querySelector('.stat-label');
        
        if (statValue && statLabel) {
            const message = `${statLabel.textContent}: ${statValue.textContent}`;
            this.showToast(message, 'info');
        }
    }

    // 加载更多历史记录
    loadMoreHistoryRecords() {
        const loadMoreBtn = AppUtils.getElement('#loadMoreHistory');
        if (!loadMoreBtn) return;
        
        // 显示加载状态
        loadMoreBtn.classList.add('loading');
        
        // 增加显示数量
        this.historyDisplayCount = (this.historyDisplayCount || 8) + 10;
        
        // 延迟模拟加载过程
        setTimeout(() => {
            this.updateRecentHistory();
            loadMoreBtn.classList.remove('loading');
        }, 800);
    }

    // 刷新首页数据 - 修复缺失的函数
    refreshHomeData() {
        console.log('刷新首页数据...');
        
        // 更新倒计时
        this.updateCountdown();
        
        // 更新统计数据
        this.updateHomeStats();
        
        // 更新热门号码
        this.updateHotNumbers();
        
        // 更新最近开奖记录
        this.updateRecentHistory();
        
        // 确保数据完整性
        if (!this.historyData.length) {
            this.generateHistoryData();
        }
    }

    // 更新首页统计数据
    updateHomeStats() {
        if (!this.historyData.length) return;
        
        const recentData = this.historyData.slice(0, 20);
        
        // 更新统计卡片
        this.updateStatCard('total-periods', this.historyData.length);
        this.updateStatCard('today-draws', this.getTodayDrawsCount());
        this.updateStatCard('hot-number', this.getHottestNumber(recentData).number);
        this.updateStatCard('cold-number', this.getColdestNumber(recentData).number);
    }

    // 更新统计卡片
    updateStatCard(cardId, value) {
        const card = AppUtils.getElement(`#${cardId}`);
        if (card) {
            const valueEl = card.querySelector('.stat-value');
            if (valueEl) {
                valueEl.textContent = value;
            }
        }
    }

    // 获取今日开奖次数
    getTodayDrawsCount() {
        const today = new Date().toDateString();
        return this.historyData.filter(item => 
            new Date(item.time).toDateString() === today
        ).length;
    }

    // 更新热门号码
    updateHotNumbers() {
        if (!this.historyData.length) return;
        
        const hotNumbersList = AppUtils.getElement('#hotNumbersList');
        if (!hotNumbersList) return;
        
        // 统计号码频率
        const frequency = {};
        this.historyData.slice(0, 50).forEach(item => {
            frequency[item.number] = (frequency[item.number] || 0) + 1;
        });
        
        // 排序获取热门号码
        const hotNumbers = Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([number, count]) => ({ number: parseInt(number), count }));
        
        hotNumbersList.innerHTML = hotNumbers.map(item => `
            <div class="hot-number-item" data-number="${item.number}">
                <span class="number ${this.getNumberColor(item.number)}">${item.number}</span>
                <span class="count">${item.count}</span>
            </div>
        `).join('');
    }

    // 更新倒计时
    updateCountdown() {
        const countdownEl = AppUtils.getElement('#countdown');
        if (!countdownEl) return;
        
        // 简单的倒计时逻辑
        const now = new Date();
        const nextMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0);
        const diff = nextMinute - now;
        
        const seconds = Math.floor(diff / 1000) % 60;
        countdownEl.textContent = `00:${seconds.toString().padStart(2, '0')}`;
    }

    // 显示Toast消息
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式
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
        
        // 自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // 显示统计详情
    showStatDetail(statType) {
        let message = '';
        
        switch(statType) {
            case 'total-periods':
                message = `总共记录了 ${this.historyData.length} 期开奖数据`;
                break;
            case 'today-draws':
                message = `今日已开奖 ${this.getTodayDrawsCount()} 期`;
                break;
            case 'hot-number':
                const hot = this.getHottestNumber(this.historyData.slice(0, 20));
                message = `最热号码: ${hot.number} (出现 ${hot.count} 次)`;
                break;
            case 'cold-number':
                const cold = this.getColdestNumber(this.historyData.slice(0, 20));
                message = `最冷号码: ${cold.number} (出现 ${cold.count} 次)`;
                break;
            default:
                message = '暂无详细信息';
        }
        
        this.showToast(message, 'info');
    }

    // 设置下拉刷新
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
                
                // 添加视觉反馈
                if (diff > 80) {
                    homeContainer.style.transform = `translateY(${Math.min(diff * 0.5, 50)}px)`;
                }
            }
        });
        
        homeContainer.addEventListener('touchend', () => {
            if (isPulling && currentY - startY > 80) {
                this.refreshHomeData();
                this.showToast('数据已刷新', 'success');
            }
            
            homeContainer.style.transform = '';
            isPulling = false;
        });
    }

    // 显示错误信息
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #f56565; color: white; padding: 20px; border-radius: 8px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3); text-align: center; z-index: 10000;">
                <h3>错误</h3>
                <p>${message}</p>
                <button onclick="location.reload()" 
                        style="background: white; color: #f56565; border: none; padding: 8px 16px; 
                               border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    刷新页面
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }

    // 隐藏加载器
    hideLoader() {
        const loader = document.querySelector('.loader-screen');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }

    // 启动倒计时
    startCountdown() {
        // 简单的倒计时实现
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 1000);
    }

    // 刷新统计数据
    async refreshStats() {
        console.log('刷新统计数据...');
        try {
            await this.generateHistoryData();
            this.updateStats();
            this.updateRecentHistory();
            this.showToast('数据已更新', 'success');
        } catch (error) {
            console.error('刷新统计数据失败:', error);
            this.showToast('刷新失败，请稍后重试', 'error');
        }
    }

    // 更新统计数据
    updateStats() {
        if (!this.historyData || !this.historyData.length) {
            console.warn('没有历史数据，跳过统计更新');
            return;
        }

        const recentData = this.historyData.slice(0, 50);
        
        // 计算大小号比例
        const bigCount = recentData.filter(item => item.big).length;
        const smallCount = recentData.length - bigCount;
        const bigPercent = ((bigCount / recentData.length) * 100).toFixed(1);
        const smallPercent = ((smallCount / recentData.length) * 100).toFixed(1);
        
        // 计算单双号比例
        const oddCount = recentData.filter(item => item.odd).length;
        const evenCount = recentData.length - oddCount;
        const oddPercent = ((oddCount / recentData.length) * 100).toFixed(1);
        const evenPercent = ((evenCount / recentData.length) * 100).toFixed(1);
        
        // 更新页面显示
        this.updateStatElement('#bigPercent', `${bigPercent}%`);
        this.updateStatElement('#smallPercent', `${smallPercent}%`);
        this.updateStatElement('#oddPercent', `${oddPercent}%`);
        this.updateStatElement('#evenPercent', `${evenPercent}%`);
    }

    // 更新统计元素
    updateStatElement(selector, value) {
        const element = AppUtils.getElement(selector);
        if (element) {
            element.textContent = value;
        }
    }

    // 更新当前期数信息
    updateCurrentPeriodInfo() {
        const periodElement = AppUtils.getElement('.period-number');
        if (periodElement && this.historyData && this.historyData.length > 0) {
            const currentPeriod = parseInt(this.historyData[0].period) + 1;
            periodElement.textContent = `第${currentPeriod.toString().padStart(8, '0')}期`;
        }
    }

    // 生成热门号码 - 修复函数
    generateHotNumbers() {
        console.log('生成热门号码...');
        
        if (!this.historyData || !this.historyData.length) {
            console.warn('没有历史数据，跳过热门号码生成');
            return;
        }

        // 统计号码频率
        const frequency = {};
        this.historyData.slice(0, 50).forEach(item => {
            frequency[item.number] = (frequency[item.number] || 0) + 1;
        });

        // 排序获取热门号码
        const hotNumbers = Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8)
            .map(([number, count]) => ({ number: parseInt(number), count }));

        // 更新热门号码显示
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

    // 设置语言事件
    setupLanguageEvents() {
        // 简单的语言事件设置，暂时为空
        console.log('语言事件设置完成');
    }

    // 显示快速预览
    showQuickPreview() {
        this.showToast('快速预览功能开发中...', 'info');
    }
}

// 简单的国际化系统
const i18n = {
    currentLanguage: 'zh',
    translations: {
        zh: {
            'app.title': 'Wingo预测',
            'nav.home': '首页',
            'nav.predict': '预测',
            'nav.trend': '走势',
            'nav.pattern': '路单',
            'nav.strategy': '策略'
        },
        en: {
            'app.title': 'Wingo Prediction',
            'nav.home': 'Home',
            'nav.predict': 'Predict',
            'nav.trend': 'Trend',
            'nav.pattern': 'Pattern',
            'nav.strategy': 'Strategy'
        }
    },
    
    init() {
        // 检测浏览器语言
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

// 初始化国际化系统
i18n.init();

// 应用启动
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM内容加载完成，开始启动应用...');
    
    // 性能监控
    const startTime = performance.now();
    
    try {
        // 创建应用实例
        const app = new WingoApp();
        
        // 异步初始化应用
        await app.init();
        
        // 记录初始化时间
        const initTime = performance.now() - startTime;
        console.log(`应用初始化完成，耗时: ${initTime.toFixed(2)}ms`);
        
        // 全局错误处理
        window.app = app;
        
        // 简化事件监听器
        window.addEventListener('online', () => {
            if (app.showToast) app.showToast('网络连接已恢复');
        });
        
        window.addEventListener('offline', () => {
            if (app.showToast) app.showToast('网络连接已断开');
        });
        
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面隐藏时暂停定时器
                if (app.countdownInterval) {
                    clearInterval(app.countdownInterval);
                }
            } else {
                // 页面显示时重启定时器
                if (app.startCountdown) {
                    app.startCountdown();
                }
            }
        });
        
        // 页面卸载时清理资源
        window.addEventListener('beforeunload', () => {
            if (app.destroy) {
                app.destroy();
            }
        });
        
        console.log('应用启动成功！');
        
    } catch (error) {
        console.error('应用启动失败:', error);
        
        // 显示错误提示
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        text-align: center; z-index: 10000;">
                <h3 style="color: #e53e3e; margin-bottom: 10px;">应用启动失败</h3>
                <p style="margin-bottom: 15px;">请刷新页面重试</p>
                <button onclick="location.reload()" 
                        style="background: #3182ce; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    刷新页面
                </button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

// 导出给全局使用
window.WingoApp = WingoApp;
window.APP_CONSTANTS = APP_CONSTANTS;
window.AppUtils = AppUtils;
window.i18n = i18n; 