export interface MySQLQueryMetrics {
    query: string;
    duration: number;
    rowsAffected: number;
    rowsExamined: number;
    database: string;
    table?: string;
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
    success: boolean;
    error?: string;
    timestamp: number;
    connectionId: string;
}
export interface MySQLConnectionMetrics {
    id: string;
    host: string;
    port: number;
    database: string;
    user: string;
    connectTime: number;
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
    lastActivity: number;
    threadId?: number;
}
export interface MySQLPerformanceStats {
    totalQueries: number;
    avgResponseTime: number;
    slowQueries: MySQLQueryMetrics[];
    errorRate: number;
    topQueries: Array<{
        query: string;
        count: number;
        avgDuration: number;
    }>;
    connectionPool: MySQLConnectionMetrics[];
    queryDistribution: {
        select: number;
        insert: number;
        update: number;
        delete: number;
        other: number;
    };
    indexStats: {
        totalIndexHits: number;
        totalTableScans: number;
        recommendations: string[];
    };
}
export interface MySQLAgentConfig {
    endpoint?: string;
    apiKey?: string;
    slowQueryThreshold?: number;
    maxMetricsHistory?: number;
    monitorQueries?: boolean;
    trackSlowQueries?: boolean;
    autoInit?: boolean;
}
export declare class MySQLAgent {
    private profiler;
    private queryMetrics;
    private connectionMetrics;
    private isActive;
    private config;
    private slowQueryThreshold;
    private maxMetricsHistory;
    private originalMethods;
    private metricsInterval?;
    constructor(config?: MySQLAgentConfig);
    /**
     * Initialize the MySQL agent
     */
    init(): Promise<void>;
    /**
     * Instrument a MySQL connection (mysql2 library)
     */
    instrumentConnection(connection: any): void;
    /**
     * Instrument a MySQL pool
     */
    instrumentPool(pool: any): void;
    /**
     * Wrap a query for monitoring
     */
    private wrapQuery;
    /**
     * Track connection
     */
    private trackConnection;
    /**
     * Record query metrics (public for testing)
     */
    recordQueryMetrics(metrics: MySQLQueryMetrics): void;
    /**
     * Update connection metrics
     */
    private updateConnectionMetrics;
    /**
     * Start periodic metrics collection
     */
    private startPeriodicMetricsCollection;
    /**
     * Clean up old metrics
     */
    private cleanupOldMetrics;
    /**
     * Generate unique connection ID
     */
    private generateConnectionId;
    /**
     * Sanitize query for logging (remove sensitive data)
     */
    private sanitizeQuery;
    /**
     * Extract table name from query
     */
    private extractTableFromQuery;
    /**
     * Extract operation type from query
     */
    private extractOperation;
    /**
     * Get performance statistics
     */
    getPerformanceStats(): MySQLPerformanceStats;
    /**
     * Normalize query for grouping
     */
    private normalizeQuery;
    /**
     * Generate index recommendations
     */
    private generateIndexRecommendations;
    /**
     * Get recent queries
     */
    getRecentQueries(limit?: number): MySQLQueryMetrics[];
    /**
     * Get connection metrics
     */
    getConnectionMetrics(): MySQLConnectionMetrics[];
    /**
     * Start monitoring (alias for init)
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop monitoring (alias for stop)
     */
    stopMonitoring(): Promise<void>;
    /**
     * Stop the MySQL agent
     */
    stop(): Promise<void>;
}
export declare const mysqlAgent: MySQLAgent;
export declare function createMySQLAgent(config?: MySQLAgentConfig): MySQLAgent;
export default MySQLAgent;
//# sourceMappingURL=index.d.ts.map