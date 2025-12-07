"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAgent = exports.SupabaseAgent = void 0;
const core_1 = require("@stacksleuth/core");
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseAgent {
    constructor(config = {}) {
        this.isActive = false;
        this.operationMetrics = new Map();
        this.realtimeMetrics = new Map();
        this.storageMetrics = [];
        this.authMetrics = [];
        this.activeChannels = new Map();
        this.originalMethods = new Map();
        this.performanceBaselines = new Map();
        this.queryOptimizationSuggestions = new Map();
        this.costTracker = new Map();
        this.securityEvents = [];
        this.config = {
            slowQueryThreshold: 1000,
            maxMetricsHistory: 10000,
            monitorRealtime: true,
            monitorStorage: true,
            monitorAuth: true,
            enableQueryOptimization: true,
            enableCostTracking: true,
            enableSecurityMonitoring: true,
            samplingRate: 1.0,
            autoInit: true,
            ...config
        };
        this.profiler = new core_1.ProfilerCore(config);
        // Auto-initialize if enabled and not in test environment
        if (this.config.autoInit && process.env.NODE_ENV !== 'test') {
            setTimeout(() => this.init().catch(console.error), 0);
        }
    }
    /**
     * Initialize the Supabase agent
     */
    async init(supabaseUrl, supabaseKey) {
        if (this.isActive)
            return;
        this.isActive = true;
        try {
            await this.profiler.init();
        }
        catch (error) {
            console.warn('⚠️ ProfilerCore initialization failed:', error);
        }
        // Initialize Supabase client if credentials provided
        if (supabaseUrl && supabaseKey) {
            this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10
                    }
                }
            });
            this.instrumentSupabaseClient();
        }
        // Start performance monitoring
        this.startPerformanceMonitoring();
        console.log('✅ Supabase Agent initialized with advanced monitoring');
    }
    /**
     * Instrument an existing Supabase client
     */
    instrumentClient(client) {
        this.client = client;
        this.instrumentSupabaseClient();
        console.log('🔧 Supabase client instrumented');
    }
    /**
     * Instrument Supabase client methods
     */
    instrumentSupabaseClient() {
        if (!this.client)
            return;
        try {
            // Instrument database operations
            this.instrumentDatabaseOperations();
            // Instrument realtime operations
            if (this.config.monitorRealtime) {
                this.instrumentRealtimeOperations();
            }
            // Instrument storage operations
            if (this.config.monitorStorage) {
                this.instrumentStorageOperations();
            }
            // Instrument auth operations
            if (this.config.monitorAuth) {
                this.instrumentAuthOperations();
            }
            console.log('🔄 Supabase client fully instrumented');
        }
        catch (error) {
            console.error('❌ Failed to instrument Supabase client:', error);
            throw error;
        }
    }
    /**
     * Enhanced database operations instrumentation
     */
    instrumentDatabaseOperations() {
        if (!this.client)
            return;
        const originalFrom = this.client.from.bind(this.client);
        this.originalMethods.set('from', originalFrom);
        this.client.from = (table) => {
            const queryBuilder = originalFrom(table);
            return this.wrapQueryBuilder(queryBuilder, table);
        };
        // Enhanced RPC instrumentation
        const originalRpc = this.client.rpc.bind(this.client);
        this.originalMethods.set('rpc', originalRpc);
        this.client.rpc = (fn, args, options) => {
            const startTime = Date.now();
            const traceId = this.generateTraceId();
            const promise = originalRpc(fn, args, options);
            return Promise.resolve(promise).then((result) => {
                const duration = Date.now() - startTime;
                this.recordOperation({
                    operation: 'rpc',
                    table: fn,
                    duration,
                    rowCount: result.data?.length,
                    querySize: JSON.stringify(args || {}).length,
                    cacheHit: this.checkCacheHit(result),
                    timestamp: Date.now(),
                    traceId,
                    queryComplexity: this.calculateQueryComplexity(fn, args)
                });
                // Check for performance optimization opportunities
                this.analyzeQueryPerformance(fn, duration, args);
                return result;
            }).catch((error) => {
                this.recordOperation({
                    operation: 'rpc',
                    table: fn,
                    duration: Date.now() - startTime,
                    querySize: JSON.stringify(args || {}).length,
                    cacheHit: false,
                    error: error.message,
                    timestamp: Date.now(),
                    traceId
                });
                // Record security event if relevant
                if (this.config.enableSecurityMonitoring) {
                    this.recordSecurityEvent('rpc_error', { fn, error: error.message, traceId });
                }
                throw error;
            });
        };
    }
    /**
     * Enhanced query builder wrapping
     */
    wrapQueryBuilder(queryBuilder, tableName) {
        const operations = ['select', 'insert', 'update', 'delete', 'upsert'];
        operations.forEach(operation => {
            if (queryBuilder[operation]) {
                const originalMethod = queryBuilder[operation].bind(queryBuilder);
                queryBuilder[operation] = (...args) => {
                    const startTime = Date.now();
                    const traceId = this.generateTraceId();
                    // Apply sampling if configured
                    if (Math.random() > this.config.samplingRate) {
                        return originalMethod(...args);
                    }
                    const result = originalMethod(...args);
                    if (result && typeof result.then === 'function') {
                        return result.then((response) => {
                            const duration = Date.now() - startTime;
                            this.recordOperation({
                                operation: operation,
                                table: tableName,
                                duration,
                                rowCount: response.data?.length || (response.count !== null ? response.count : 1),
                                querySize: JSON.stringify(args).length,
                                cacheHit: this.checkCacheHit(response),
                                error: response.error?.message,
                                timestamp: Date.now(),
                                traceId,
                                queryComplexity: this.calculateQueryComplexity(operation, args),
                                indexUsage: this.analyzeIndexUsage(tableName, operation, args)
                            });
                            // Analyze performance and suggest optimizations
                            this.analyzeQueryPerformance(tableName, duration, args, operation);
                            // Track costs if enabled
                            if (this.config.enableCostTracking) {
                                this.trackOperationCost(operation, tableName, response.data?.length || 0);
                            }
                            return response;
                        });
                    }
                    return result;
                };
            }
        });
        return queryBuilder;
    }
    /**
     * Enhanced realtime operations instrumentation
     */
    instrumentRealtimeOperations() {
        if (!this.client)
            return;
        const originalChannel = this.client.channel.bind(this.client);
        this.originalMethods.set('channel', originalChannel);
        this.client.channel = (name, opts) => {
            const channel = originalChannel(name, opts);
            this.instrumentChannel(channel, name);
            return channel;
        };
    }
    /**
     * Enhanced channel instrumentation
     */
    instrumentChannel(channel, channelName) {
        this.activeChannels.set(channelName, channel);
        try {
            // Enhanced event monitoring
            const originalOn = channel.on.bind(channel);
            channel.on = (type, filter, callback) => {
                const wrappedCallback = (payload) => {
                    const startTime = Date.now();
                    try {
                        const result = callback(payload);
                        this.recordRealtimeEvent({
                            channel: channelName,
                            event: payload.eventType || type,
                            subscriptionCount: this.activeChannels.size,
                            messageSize: JSON.stringify(payload).length,
                            latency: Date.now() - startTime,
                            connectionStatus: 'connected',
                            timestamp: Date.now()
                        });
                        return result;
                    }
                    catch (error) {
                        this.recordRealtimeEvent({
                            channel: channelName,
                            event: 'callback_error',
                            subscriptionCount: this.activeChannels.size,
                            messageSize: JSON.stringify(error).length,
                            latency: Date.now() - startTime,
                            connectionStatus: 'connected',
                            timestamp: Date.now()
                        });
                        throw error;
                    }
                };
                return originalOn(type, filter, wrappedCallback);
            };
            // Monitor subscription status
            const originalSubscribe = channel.subscribe.bind(channel);
            channel.subscribe = (callback) => {
                const startTime = Date.now();
                const wrappedCallback = (status, err) => {
                    this.recordRealtimeEvent({
                        channel: channelName,
                        event: 'subscription_status',
                        subscriptionCount: this.activeChannels.size,
                        messageSize: 0,
                        latency: Date.now() - startTime,
                        connectionStatus: status === 'SUBSCRIBED' ? 'connected' : 'disconnected',
                        timestamp: Date.now(),
                        retryCount: err ? 1 : 0
                    });
                    if (callback)
                        callback(status, err);
                };
                return originalSubscribe(wrappedCallback);
            };
        }
        catch (error) {
            this.recordRealtimeEvent({
                channel: channelName,
                event: 'error',
                subscriptionCount: this.activeChannels.size,
                messageSize: JSON.stringify(error).length,
                latency: 0,
                connectionStatus: 'disconnected',
                timestamp: Date.now()
            });
        }
    }
    /**
     * Enhanced storage operations instrumentation
     */
    instrumentStorageOperations() {
        if (!this.client?.storage)
            return;
        const originalFrom = this.client.storage.from.bind(this.client.storage);
        this.originalMethods.set('storageFrom', originalFrom);
        this.client.storage.from = (bucketName) => {
            const bucket = originalFrom(bucketName);
            return this.wrapStorageBucket(bucket, bucketName);
        };
    }
    /**
     * Enhanced storage bucket wrapping
     */
    wrapStorageBucket(bucket, bucketName) {
        const operations = ['upload', 'download', 'remove', 'list', 'move', 'copy'];
        operations.forEach(operation => {
            if (bucket[operation]) {
                const originalMethod = bucket[operation].bind(bucket);
                bucket[operation] = (...args) => {
                    const startTime = Date.now();
                    const result = originalMethod(...args);
                    if (result && typeof result.then === 'function') {
                        return result.then((response) => {
                            const duration = Date.now() - startTime;
                            const fileSize = this.getFileSize(args[0], response);
                            this.recordStorageOperation({
                                bucket: bucketName,
                                operation: operation,
                                fileSize,
                                duration,
                                error: response.error?.message,
                                timestamp: Date.now(),
                                compressionRatio: this.calculateCompressionRatio(fileSize, response),
                                cdnHit: this.checkCdnHit(response)
                            });
                            // Track storage costs
                            if (this.config.enableCostTracking) {
                                this.trackStorageCost(operation, bucketName, fileSize);
                            }
                            return response;
                        });
                    }
                    return result;
                };
            }
        });
        return bucket;
    }
    /**
     * Enhanced auth operations instrumentation
     */
    instrumentAuthOperations() {
        if (!this.client?.auth)
            return;
        const authMethods = [
            'signInWithPassword',
            'signInWithOAuth',
            'signUp',
            'signOut',
            'getUser',
            'refreshToken',
            'resetPassword',
            'updateUser'
        ];
        authMethods.forEach(method => {
            const authClient = this.client.auth;
            if (authClient[method] && typeof authClient[method] === 'function') {
                const originalMethod = authClient[method].bind(authClient);
                this.originalMethods.set(`auth_${method}`, originalMethod);
                authClient[method] = (...args) => {
                    const startTime = Date.now();
                    const result = originalMethod(...args);
                    if (result && typeof result.then === 'function') {
                        return result.then((response) => {
                            const duration = Date.now() - startTime;
                            const isSuccess = !response.error;
                            this.recordAuthOperation({
                                operation: this.mapAuthOperation(method),
                                provider: args[0]?.provider,
                                duration,
                                success: isSuccess,
                                error: response.error?.message,
                                timestamp: Date.now(),
                                mfaEnabled: response.data?.user?.app_metadata?.mfa_enabled
                            });
                            // Security monitoring
                            if (this.config.enableSecurityMonitoring) {
                                this.analyzeAuthSecurity(method, args, response, isSuccess);
                            }
                            return response;
                        });
                    }
                    return result;
                };
            }
        });
    }
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        if (this.monitoringInterval)
            return;
        this.monitoringInterval = setInterval(() => {
            this.analyzePerformanceTrends();
            this.optimizeQueries();
            this.generateCostReport();
            this.checkSecurityThresholds();
        }, 30000); // Every 30 seconds
    }
    /**
     * Record database operation metrics with enhanced tracking
     */
    recordOperation(metrics) {
        const tableMetrics = this.operationMetrics.get(metrics.table || 'unknown') || [];
        tableMetrics.push(metrics);
        // Keep only last metrics based on config
        if (tableMetrics.length > (this.config.maxMetricsHistory / 10)) {
            tableMetrics.shift();
        }
        this.operationMetrics.set(metrics.table || 'unknown', tableMetrics);
        // Record with profiler
        try {
            this.profiler.recordMetric('supabase_operation', {
                ...metrics,
                timestamp: Date.now()
            });
        }
        catch (error) {
            console.warn('⚠️ Failed to record metrics:', error);
        }
        // Check for slow queries
        if (metrics.duration > this.config.slowQueryThreshold) {
            this.profiler.recordMetric('supabase_slow_query', metrics);
        }
    }
    /**
     * Enhanced performance analysis methods
     */
    analyzeQueryPerformance(table, duration, args, operation) {
        const baseline = this.performanceBaselines.get(table) || duration;
        if (duration > baseline * 1.5) {
            const suggestions = this.generateOptimizationSuggestions(table, operation, args, duration);
            this.queryOptimizationSuggestions.set(table, suggestions);
        }
        // Update baseline (moving average)
        this.performanceBaselines.set(table, (baseline * 0.9) + (duration * 0.1));
    }
    generateOptimizationSuggestions(table, operation, args, duration) {
        const suggestions = [];
        if (duration && duration > 2000) {
            suggestions.push(`Consider adding indexes for table ${table}`);
        }
        if (operation === 'select' && args?.length > 0) {
            suggestions.push(`Consider using .limit() for large result sets in ${table}`);
        }
        return suggestions;
    }
    calculateQueryComplexity(operation, args) {
        let complexity = 1;
        if (args && typeof args === 'object') {
            complexity += Object.keys(args).length;
        }
        return complexity;
    }
    analyzeIndexUsage(table, operation, args) {
        // This would integrate with Supabase's query plan analysis in a real implementation
        return ['primary_key']; // Placeholder
    }
    checkCacheHit(response) {
        // Check if response came from cache (implementation would depend on Supabase's cache headers)
        return false; // Placeholder
    }
    trackOperationCost(operation, table, rowCount) {
        const baseCost = this.getBaseCost(operation);
        const cost = baseCost * Math.max(1, rowCount);
        const currentCost = this.costTracker.get(table) || 0;
        this.costTracker.set(table, currentCost + cost);
    }
    getBaseCost(operation) {
        const costs = {
            select: 0.001,
            insert: 0.002,
            update: 0.002,
            delete: 0.002,
            rpc: 0.005
        };
        return costs[operation] || 0.001;
    }
    trackStorageCost(operation, bucket, fileSize) {
        const costPerMB = 0.021; // Example cost
        const cost = (fileSize / (1024 * 1024)) * costPerMB;
        const currentCost = this.costTracker.get(`storage:${bucket}`) || 0;
        this.costTracker.set(`storage:${bucket}`, currentCost + cost);
    }
    analyzeAuthSecurity(method, args, response, isSuccess) {
        if (!isSuccess && method.includes('signIn')) {
            this.recordSecurityEvent('failed_login', {
                method,
                email: args[0]?.email,
                timestamp: Date.now()
            });
        }
        if (isSuccess && method === 'signUp') {
            this.recordSecurityEvent('new_user_registration', {
                email: args[0]?.email,
                timestamp: Date.now()
            });
        }
    }
    recordSecurityEvent(type, details) {
        this.securityEvents.push({ type, timestamp: Date.now(), details });
        // Keep only last 1000 security events
        if (this.securityEvents.length > 1000) {
            this.securityEvents.shift();
        }
    }
    analyzePerformanceTrends() {
        // Analyze performance trends and record insights
        const allOperations = Array.from(this.operationMetrics.values()).flat();
        const recentOperations = allOperations.filter(op => Date.now() - op.timestamp < 300000 // Last 5 minutes
        );
        if (recentOperations.length > 0) {
            const avgDuration = recentOperations.reduce((sum, op) => sum + op.duration, 0) / recentOperations.length;
            const errorRate = recentOperations.filter(op => op.error).length / recentOperations.length;
            this.profiler.recordMetric('supabase_performance_trend', {
                avgDuration,
                errorRate,
                operationCount: recentOperations.length,
                timestamp: Date.now()
            });
        }
    }
    optimizeQueries() {
        // Auto-optimization suggestions based on performance data
        this.queryOptimizationSuggestions.forEach((suggestions, table) => {
            if (suggestions.length > 0) {
                this.profiler.recordMetric('supabase_optimization_suggestion', {
                    table,
                    suggestions,
                    timestamp: Date.now()
                });
            }
        });
    }
    generateCostReport() {
        if (!this.config.enableCostTracking)
            return;
        const totalCost = Array.from(this.costTracker.values()).reduce((sum, cost) => sum + cost, 0);
        this.profiler.recordMetric('supabase_cost_analysis', {
            totalCost,
            costBreakdown: Object.fromEntries(this.costTracker),
            timestamp: Date.now()
        });
    }
    checkSecurityThresholds() {
        if (!this.config.enableSecurityMonitoring)
            return;
        const recentFailedLogins = this.securityEvents
            .filter(event => event.type === 'failed_login' && Date.now() - event.timestamp < 300000)
            .length;
        if (recentFailedLogins > 10) {
            this.profiler.recordMetric('supabase_security_alert', {
                type: 'high_failed_login_rate',
                count: recentFailedLogins,
                timestamp: Date.now()
            });
        }
    }
    // Additional helper methods
    generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getFileSize(fileName, response) {
        if (response.data && typeof response.data === 'object') {
            return JSON.stringify(response.data).length;
        }
        return 0;
    }
    calculateCompressionRatio(fileSize, response) {
        // Placeholder for compression ratio calculation
        return 1.0;
    }
    checkCdnHit(response) {
        // Check CDN hit from response headers
        return false;
    }
    mapAuthOperation(method) {
        const mapping = {
            'signInWithPassword': 'signIn',
            'signInWithOAuth': 'signIn',
            'signUp': 'signUp',
            'signOut': 'signOut',
            'getUser': 'getUser',
            'refreshToken': 'refreshToken',
            'resetPassword': 'resetPassword',
            'updateUser': 'updateUser'
        };
        return mapping[method] || 'getUser';
    }
    // Record other types of metrics
    recordRealtimeEvent(metrics) {
        const channelMetrics = this.realtimeMetrics.get(metrics.channel) || [];
        channelMetrics.push(metrics);
        if (channelMetrics.length > 500) {
            channelMetrics.shift();
        }
        this.realtimeMetrics.set(metrics.channel, channelMetrics);
        this.profiler.recordMetric('supabase_realtime', {
            ...metrics,
            timestamp: Date.now()
        });
    }
    recordStorageOperation(metrics) {
        this.storageMetrics.push(metrics);
        if (this.storageMetrics.length > 500) {
            this.storageMetrics.shift();
        }
        this.profiler.recordMetric('supabase_storage', {
            ...metrics,
            timestamp: Date.now()
        });
    }
    recordAuthOperation(metrics) {
        this.authMetrics.push(metrics);
        if (this.authMetrics.length > 200) {
            this.authMetrics.shift();
        }
        this.profiler.recordMetric('supabase_auth', {
            ...metrics,
            timestamp: Date.now()
        });
    }
    // Public API methods
    getPerformanceSummary() {
        const allOperations = Array.from(this.operationMetrics.values()).flat();
        const allRealtimeEvents = Array.from(this.realtimeMetrics.values()).flat();
        return {
            database: {
                totalOperations: allOperations.length,
                averageDuration: allOperations.reduce((sum, op) => sum + op.duration, 0) / allOperations.length || 0,
                slowQueries: allOperations.filter(op => op.duration > this.config.slowQueryThreshold).length,
                errorRate: allOperations.filter(op => op.error).length / allOperations.length || 0,
                topTables: this.getTopTables(),
                cacheHitRate: allOperations.filter(op => op.cacheHit).length / allOperations.length || 0,
                connectionPoolStats: {
                    activeConnections: this.activeChannels.size,
                    maxConnections: 100, // Example
                    waitingQueries: 0
                }
            },
            realtime: {
                activeChannels: this.activeChannels.size,
                totalEvents: allRealtimeEvents.length,
                averageLatency: allRealtimeEvents.reduce((sum, event) => sum + event.latency, 0) / allRealtimeEvents.length || 0,
                connectionStatus: this.getOverallConnectionStatus(),
                subscriptionHealth: this.calculateSubscriptionHealth(),
                messageDropRate: this.calculateMessageDropRate()
            },
            storage: {
                totalOperations: this.storageMetrics.length,
                totalDataTransferred: this.storageMetrics.reduce((sum, op) => sum + op.fileSize, 0),
                averageDuration: this.storageMetrics.reduce((sum, op) => sum + op.duration, 0) / this.storageMetrics.length || 0,
                compressionEfficiency: this.calculateCompressionEfficiency(),
                cdnHitRate: this.storageMetrics.filter(op => op.cdnHit).length / this.storageMetrics.length || 0,
                costOptimization: {
                    estimatedCost: Array.from(this.costTracker.values()).reduce((sum, cost) => sum + cost, 0),
                    suggestions: this.generateCostOptimizationSuggestions()
                }
            },
            auth: {
                totalOperations: this.authMetrics.length,
                successRate: this.authMetrics.filter(op => op.success).length / this.authMetrics.length || 0,
                averageDuration: this.authMetrics.reduce((sum, op) => sum + op.duration, 0) / this.authMetrics.length || 0,
                activeUsers: this.getActiveUserCount(),
                securityMetrics: {
                    failedLoginAttempts: this.securityEvents.filter(e => e.type === 'failed_login').length,
                    suspiciousActivity: this.calculateSuspiciousActivity(),
                    mfaAdoption: this.calculateMfaAdoption()
                }
            }
        };
    }
    getTableStats(tableName) {
        const operations = this.operationMetrics.get(tableName) || [];
        return {
            totalOperations: operations.length,
            averageDuration: operations.reduce((sum, op) => sum + op.duration, 0) / operations.length || 0,
            operationTypes: this.groupBy(operations, 'operation'),
            recentErrors: operations.filter(op => op.error).slice(-5),
            performanceTrend: this.calculatePerformanceTrend(operations),
            optimizationSuggestions: this.queryOptimizationSuggestions.get(tableName) || []
        };
    }
    exportMetrics() {
        return {
            operations: Object.fromEntries(this.operationMetrics),
            realtime: Object.fromEntries(this.realtimeMetrics),
            storage: this.storageMetrics,
            auth: this.authMetrics,
            costs: Object.fromEntries(this.costTracker),
            security: this.securityEvents,
            optimizations: Object.fromEntries(this.queryOptimizationSuggestions),
            timestamp: Date.now()
        };
    }
    async stop() {
        this.isActive = false;
        // Clear monitoring interval
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        // Close all realtime channels
        this.activeChannels.forEach(channel => {
            try {
                channel.unsubscribe();
            }
            catch (error) {
                console.warn('Failed to unsubscribe channel:', error);
            }
        });
        this.activeChannels.clear();
        // Restore original methods
        if (this.client) {
            this.originalMethods.forEach((originalMethod, key) => {
                try {
                    if (key === 'from') {
                        this.client.from = originalMethod;
                    }
                    else if (key === 'rpc') {
                        this.client.rpc = originalMethod;
                    }
                    else if (key.startsWith('auth_')) {
                        const authMethod = key.replace('auth_', '');
                        this.client.auth[authMethod] = originalMethod;
                    }
                    // Add more restoration logic as needed
                }
                catch (error) {
                    console.warn(`Failed to restore method ${key}:`, error);
                }
            });
        }
        // Clear metrics
        this.operationMetrics.clear();
        this.realtimeMetrics.clear();
        this.storageMetrics = [];
        this.authMetrics = [];
        this.securityEvents = [];
        this.costTracker.clear();
        this.queryOptimizationSuggestions.clear();
        try {
            await this.profiler.stop();
        }
        catch (error) {
            console.warn('Failed to stop profiler:', error);
        }
        console.log('🛑 Supabase Agent stopped');
    }
    // Legacy compatibility methods
    startMonitoring() {
        return this.init();
    }
    async stopMonitoring() {
        return this.stop();
    }
    getOperationMetrics() {
        return Array.from(this.operationMetrics.values()).flat();
    }
    getTableStatistics() {
        return Array.from(this.operationMetrics.keys()).map(table => ({
            table,
            ...this.getTableStats(table)
        }));
    }
    // Helper methods
    getTopTables() {
        return Array.from(this.operationMetrics.entries())
            .map(([table, operations]) => ({
            table,
            operations: operations.length,
            avgDuration: operations.reduce((sum, op) => sum + op.duration, 0) / operations.length || 0
        }))
            .sort((a, b) => b.operations - a.operations)
            .slice(0, 10);
    }
    getOverallConnectionStatus() {
        if (this.activeChannels.size === 0)
            return 'disconnected';
        return 'connected'; // Simplified logic
    }
    calculateSubscriptionHealth() {
        // Calculate subscription health score (0-100)
        return 95; // Placeholder
    }
    calculateMessageDropRate() {
        // Calculate message drop rate
        return 0.01; // Placeholder
    }
    calculateCompressionEfficiency() {
        const avgRatio = this.storageMetrics
            .filter(op => op.compressionRatio)
            .reduce((sum, op) => sum + (op.compressionRatio || 1), 0) / this.storageMetrics.length || 1;
        return avgRatio;
    }
    generateCostOptimizationSuggestions() {
        const suggestions = [];
        // Analyze cost patterns and suggest optimizations
        this.costTracker.forEach((cost, resource) => {
            if (cost > 10) { // Threshold for expensive resources
                suggestions.push(`Consider optimizing queries for ${resource} to reduce costs`);
            }
        });
        return suggestions;
    }
    getActiveUserCount() {
        // Count unique users from auth metrics
        const uniqueUsers = new Set(this.authMetrics
            .filter(metric => metric.success && metric.operation === 'signIn')
            .map(metric => metric.provider || 'unknown'));
        return uniqueUsers.size;
    }
    calculateSuspiciousActivity() {
        // Count suspicious security events
        return this.securityEvents.filter(event => event.type === 'failed_login' &&
            Date.now() - event.timestamp < 3600000 // Last hour
        ).length;
    }
    calculateMfaAdoption() {
        const mfaEnabledCount = this.authMetrics.filter(metric => metric.mfaEnabled).length;
        const totalUsers = this.authMetrics.filter(metric => metric.operation === 'signIn').length;
        return totalUsers > 0 ? mfaEnabledCount / totalUsers : 0;
    }
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = String(item[key]);
            result[group] = (result[group] || 0) + 1;
            return result;
        }, {});
    }
    calculatePerformanceTrend(operations) {
        const recentOps = operations.slice(-100); // Last 100 operations
        const olderOps = operations.slice(-200, -100); // Previous 100 operations
        const recentAvg = recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length || 0;
        const olderAvg = olderOps.reduce((sum, op) => sum + op.duration, 0) / olderOps.length || 0;
        return {
            trend: recentAvg > olderAvg ? 'deteriorating' : 'improving',
            change: olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0,
            recentAverage: recentAvg,
            previousAverage: olderAvg
        };
    }
}
exports.SupabaseAgent = SupabaseAgent;
// Export default instance
exports.supabaseAgent = new SupabaseAgent();
// Auto-initialize if in browser/Node environment
if (typeof window !== 'undefined' || typeof global !== 'undefined') {
    // Note: Requires manual init with credentials
    console.log('💡 Supabase Agent ready - call supabaseAgent.init(url, key) to start monitoring');
}
//# sourceMappingURL=index.js.map