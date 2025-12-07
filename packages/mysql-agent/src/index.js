"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlAgent = exports.MySQLAgent = void 0;
exports.createMySQLAgent = createMySQLAgent;
const core_1 = require("@stacksleuth/core");
class MySQLAgent {
    constructor(config = {}) {
        this.queryMetrics = [];
        this.connectionMetrics = new Map();
        this.isActive = false;
        this.originalMethods = new Map();
        this.config = {
            slowQueryThreshold: 1000,
            maxMetricsHistory: 10000,
            monitorQueries: true,
            trackSlowQueries: true,
            autoInit: true,
            ...config
        };
        this.slowQueryThreshold = this.config.slowQueryThreshold;
        this.maxMetricsHistory = this.config.maxMetricsHistory;
        this.profiler = new core_1.ProfilerCore(config);
        // Auto-initialize if enabled and not in test environment
        if (this.config.autoInit && process.env.NODE_ENV !== 'test') {
            setTimeout(() => this.init().catch(console.error), 0);
        }
    }
    /**
     * Initialize the MySQL agent
     */
    async init() {
        if (this.isActive)
            return;
        this.isActive = true;
        try {
            await this.profiler.init();
        }
        catch (error) {
            console.warn('⚠️ ProfilerCore initialization failed:', error);
        }
        // Start periodic metrics collection
        this.startPeriodicMetricsCollection();
        console.log('✅ MySQL Agent initialized');
    }
    /**
     * Instrument a MySQL connection (mysql2 library)
     */
    instrumentConnection(connection) {
        if (!connection)
            return;
        const connectionId = this.generateConnectionId(connection);
        this.trackConnection(connection, connectionId);
        // Wrap execute method
        if (typeof connection.execute === 'function') {
            const originalExecute = connection.execute.bind(connection);
            this.originalMethods.set(`${connectionId}_execute`, originalExecute);
            connection.execute = (...args) => {
                return this.wrapQuery(originalExecute, args, connectionId, connection);
            };
        }
        // Wrap query method
        if (typeof connection.query === 'function') {
            const originalQuery = connection.query.bind(connection);
            this.originalMethods.set(`${connectionId}_query`, originalQuery);
            connection.query = (...args) => {
                return this.wrapQuery(originalQuery, args, connectionId, connection);
            };
        }
        console.log('🔧 MySQL connection instrumented');
    }
    /**
     * Instrument a MySQL pool
     */
    instrumentPool(pool) {
        if (!pool)
            return;
        // Wrap getConnection method
        if (typeof pool.getConnection === 'function') {
            const originalGetConnection = pool.getConnection.bind(pool);
            this.originalMethods.set('pool_getConnection', originalGetConnection);
            pool.getConnection = (...args) => {
                const callback = args[args.length - 1];
                if (typeof callback === 'function') {
                    // Callback style
                    return originalGetConnection((err, connection) => {
                        if (!err && connection) {
                            this.instrumentConnection(connection);
                        }
                        callback(err, connection);
                    });
                }
                else {
                    // Promise style
                    return originalGetConnection().then((connection) => {
                        this.instrumentConnection(connection);
                        return connection;
                    });
                }
            };
        }
        // Wrap execute method on pool
        if (typeof pool.execute === 'function') {
            const connectionId = this.generateConnectionId(pool);
            const originalExecute = pool.execute.bind(pool);
            this.originalMethods.set('pool_execute', originalExecute);
            pool.execute = (...args) => {
                return this.wrapQuery(originalExecute, args, connectionId, pool);
            };
        }
        // Wrap query method on pool
        if (typeof pool.query === 'function') {
            const connectionId = this.generateConnectionId(pool);
            const originalQuery = pool.query.bind(pool);
            this.originalMethods.set('pool_query', originalQuery);
            pool.query = (...args) => {
                return this.wrapQuery(originalQuery, args, connectionId, pool);
            };
        }
        console.log('🔧 MySQL pool instrumented');
    }
    /**
     * Wrap a query for monitoring
     */
    async wrapQuery(originalMethod, args, connectionId, connection) {
        const startTime = performance.now();
        const timestamp = Date.now();
        const query = typeof args[0] === 'string' ? args[0] : args[0]?.sql || 'UNKNOWN';
        let result;
        let success = true;
        let error;
        let rowsAffected = 0;
        try {
            result = await originalMethod(...args);
            // Extract rows affected based on result type
            if (Array.isArray(result)) {
                rowsAffected = result[0]?.length || result[0]?.affectedRows || 0;
            }
            else if (result?.affectedRows !== undefined) {
                rowsAffected = result.affectedRows;
            }
        }
        catch (err) {
            success = false;
            error = err instanceof Error ? err.message : String(err);
            throw err;
        }
        finally {
            const duration = performance.now() - startTime;
            const metrics = {
                query: this.sanitizeQuery(query),
                duration,
                rowsAffected,
                rowsExamined: 0, // Would need EXPLAIN to get this
                database: connection?.config?.database || 'unknown',
                table: this.extractTableFromQuery(query),
                operation: this.extractOperation(query),
                success,
                error,
                timestamp,
                connectionId
            };
            this.recordQueryMetrics(metrics);
            this.updateConnectionMetrics(connectionId, metrics);
        }
        return result;
    }
    /**
     * Track connection
     */
    trackConnection(connection, connectionId) {
        const connectStartTime = performance.now();
        const connectionMetrics = {
            id: connectionId,
            host: connection?.config?.host || 'localhost',
            port: connection?.config?.port || 3306,
            database: connection?.config?.database || 'unknown',
            user: connection?.config?.user || 'unknown',
            connectTime: performance.now() - connectStartTime,
            totalQueries: 0,
            avgResponseTime: 0,
            errorRate: 0,
            lastActivity: Date.now(),
            threadId: connection?.threadId
        };
        this.connectionMetrics.set(connectionId, connectionMetrics);
        this.profiler.recordMetric('mysql_connection_established', {
            connectionId,
            host: connectionMetrics.host,
            port: connectionMetrics.port,
            database: connectionMetrics.database,
            timestamp: Date.now()
        });
    }
    /**
     * Record query metrics (public for testing)
     */
    recordQueryMetrics(metrics) {
        this.queryMetrics.push(metrics);
        // Maintain history limit
        if (this.queryMetrics.length > this.maxMetricsHistory) {
            this.queryMetrics.splice(0, this.queryMetrics.length - this.maxMetricsHistory);
        }
        try {
            if (this.isActive) {
                this.profiler.recordMetric('mysql_query', metrics);
                // Record slow queries
                if (metrics.duration > this.slowQueryThreshold) {
                    this.profiler.recordMetric('mysql_slow_query', metrics);
                }
            }
        }
        catch (error) {
            console.warn('⚠️ Failed to record metrics:', error);
        }
    }
    /**
     * Update connection metrics
     */
    updateConnectionMetrics(connectionId, queryMetrics) {
        const connection = this.connectionMetrics.get(connectionId);
        if (!connection)
            return;
        connection.totalQueries++;
        connection.lastActivity = Date.now();
        // Update average response time
        connection.avgResponseTime = ((connection.avgResponseTime * (connection.totalQueries - 1) + queryMetrics.duration) /
            connection.totalQueries);
        // Update error rate
        if (!queryMetrics.success) {
            const errorCount = this.queryMetrics
                .filter(m => m.connectionId === connectionId && !m.success)
                .length;
            connection.errorRate = errorCount / connection.totalQueries;
        }
        this.connectionMetrics.set(connectionId, connection);
    }
    /**
     * Start periodic metrics collection
     */
    startPeriodicMetricsCollection() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        this.metricsInterval = setInterval(() => {
            this.cleanupOldMetrics();
        }, 30000);
    }
    /**
     * Clean up old metrics
     */
    cleanupOldMetrics() {
        const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
        this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > cutoff);
    }
    /**
     * Generate unique connection ID
     */
    generateConnectionId(connection) {
        const host = connection?.config?.host || 'localhost';
        const port = connection?.config?.port || 3306;
        const db = connection?.config?.database || 'unknown';
        return `mysql:${host}:${port}:${db}:${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Sanitize query for logging (remove sensitive data)
     */
    sanitizeQuery(query) {
        // Remove string literals and number values
        return query
            .replace(/'[^']*'/g, '?')
            .replace(/"[^"]*"/g, '?')
            .replace(/\b\d+\b/g, '?')
            .substring(0, 500); // Limit length
    }
    /**
     * Extract table name from query
     */
    extractTableFromQuery(query) {
        const upperQuery = query.toUpperCase();
        // FROM table_name
        const fromMatch = upperQuery.match(/FROM\s+`?(\w+)`?/i);
        if (fromMatch)
            return fromMatch[1].toLowerCase();
        // INTO table_name
        const intoMatch = upperQuery.match(/INTO\s+`?(\w+)`?/i);
        if (intoMatch)
            return intoMatch[1].toLowerCase();
        // UPDATE table_name
        const updateMatch = upperQuery.match(/UPDATE\s+`?(\w+)`?/i);
        if (updateMatch)
            return updateMatch[1].toLowerCase();
        return undefined;
    }
    /**
     * Extract operation type from query
     */
    extractOperation(query) {
        const upperQuery = query.trim().toUpperCase();
        if (upperQuery.startsWith('SELECT'))
            return 'SELECT';
        if (upperQuery.startsWith('INSERT'))
            return 'INSERT';
        if (upperQuery.startsWith('UPDATE'))
            return 'UPDATE';
        if (upperQuery.startsWith('DELETE'))
            return 'DELETE';
        return 'OTHER';
    }
    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const totalQueries = this.queryMetrics.length;
        const avgResponseTime = totalQueries > 0
            ? this.queryMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries
            : 0;
        const slowQueries = this.queryMetrics
            .filter(m => m.duration > this.slowQueryThreshold)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10);
        const errorCount = this.queryMetrics.filter(m => !m.success).length;
        const errorRate = totalQueries > 0 ? errorCount / totalQueries : 0;
        // Calculate top queries
        const queryStats = new Map();
        this.queryMetrics.forEach(m => {
            const normalized = this.normalizeQuery(m.query);
            const existing = queryStats.get(normalized) || { count: 0, totalDuration: 0 };
            existing.count++;
            existing.totalDuration += m.duration;
            queryStats.set(normalized, existing);
        });
        const topQueries = Array.from(queryStats.entries())
            .map(([query, stats]) => ({
            query,
            count: stats.count,
            avgDuration: stats.totalDuration / stats.count
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        // Calculate query distribution
        const queryDistribution = {
            select: this.queryMetrics.filter(m => m.operation === 'SELECT').length,
            insert: this.queryMetrics.filter(m => m.operation === 'INSERT').length,
            update: this.queryMetrics.filter(m => m.operation === 'UPDATE').length,
            delete: this.queryMetrics.filter(m => m.operation === 'DELETE').length,
            other: this.queryMetrics.filter(m => m.operation === 'OTHER').length
        };
        return {
            totalQueries,
            avgResponseTime,
            slowQueries,
            errorRate,
            topQueries,
            connectionPool: Array.from(this.connectionMetrics.values()),
            queryDistribution,
            indexStats: {
                totalIndexHits: 0, // Would need EXPLAIN analysis
                totalTableScans: 0,
                recommendations: this.generateIndexRecommendations()
            }
        };
    }
    /**
     * Normalize query for grouping
     */
    normalizeQuery(query) {
        return query
            .replace(/\s+/g, ' ')
            .replace(/\?/g, '?')
            .substring(0, 100);
    }
    /**
     * Generate index recommendations
     */
    generateIndexRecommendations() {
        const recommendations = [];
        // Analyze slow queries for patterns
        const slowQueries = this.queryMetrics.filter(m => m.duration > this.slowQueryThreshold);
        const tableFrequency = new Map();
        slowQueries.forEach(q => {
            if (q.table) {
                tableFrequency.set(q.table, (tableFrequency.get(q.table) || 0) + 1);
            }
        });
        tableFrequency.forEach((count, table) => {
            if (count > 5) {
                recommendations.push(`Consider adding indexes to table '${table}' - ${count} slow queries detected`);
            }
        });
        return recommendations;
    }
    /**
     * Get recent queries
     */
    getRecentQueries(limit = 100) {
        return this.queryMetrics
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    /**
     * Get connection metrics
     */
    getConnectionMetrics() {
        return Array.from(this.connectionMetrics.values());
    }
    /**
     * Start monitoring (alias for init)
     */
    startMonitoring() {
        return this.init();
    }
    /**
     * Stop monitoring (alias for stop)
     */
    stopMonitoring() {
        return this.stop();
    }
    /**
     * Stop the MySQL agent
     */
    async stop() {
        this.isActive = false;
        // Clear metrics interval
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = undefined;
        }
        // Clear metrics
        this.queryMetrics = [];
        this.connectionMetrics.clear();
        try {
            await this.profiler.stop();
        }
        catch (error) {
            // Ignore errors during stop
        }
        console.log('🛑 MySQL Agent stopped');
    }
}
exports.MySQLAgent = MySQLAgent;
// Export default instance
exports.mysqlAgent = new MySQLAgent({ autoInit: false });
// Export factory function
function createMySQLAgent(config) {
    return new MySQLAgent(config);
}
exports.default = MySQLAgent;
//# sourceMappingURL=index.js.map