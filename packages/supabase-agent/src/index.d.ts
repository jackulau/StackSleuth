import { SupabaseClient } from '@supabase/supabase-js';
export interface SupabaseOperationMetrics {
    operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'rpc' | 'storage' | 'auth';
    table?: string;
    duration: number;
    rowCount?: number;
    querySize: number;
    cacheHit: boolean;
    error?: string;
    timestamp: number;
    traceId?: string;
    userId?: string;
    queryComplexity?: number;
    indexUsage?: string[];
}
export interface SupabaseRealtimeMetrics {
    channel: string;
    event: string;
    subscriptionCount: number;
    messageSize: number;
    latency: number;
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
    timestamp: number;
    retryCount?: number;
    errorRate?: number;
}
export interface SupabaseStorageMetrics {
    bucket: string;
    operation: 'upload' | 'download' | 'delete' | 'list' | 'move' | 'copy';
    fileSize: number;
    duration: number;
    error?: string;
    timestamp: number;
    compressionRatio?: number;
    cdnHit?: boolean;
}
export interface SupabaseAuthMetrics {
    operation: 'signIn' | 'signUp' | 'signOut' | 'getUser' | 'refreshToken' | 'resetPassword' | 'updateUser';
    provider?: string;
    duration: number;
    success: boolean;
    error?: string;
    timestamp: number;
    sessionDuration?: number;
    mfaEnabled?: boolean;
}
export interface SupabasePerformanceStats {
    database: {
        totalOperations: number;
        averageDuration: number;
        slowQueries: number;
        errorRate: number;
        topTables: Array<{
            table: string;
            operations: number;
            avgDuration: number;
        }>;
        cacheHitRate: number;
        connectionPoolStats: {
            activeConnections: number;
            maxConnections: number;
            waitingQueries: number;
        };
    };
    realtime: {
        activeChannels: number;
        totalEvents: number;
        averageLatency: number;
        connectionStatus: 'connected' | 'disconnected' | 'mixed';
        subscriptionHealth: number;
        messageDropRate: number;
    };
    storage: {
        totalOperations: number;
        totalDataTransferred: number;
        averageDuration: number;
        compressionEfficiency: number;
        cdnHitRate: number;
        costOptimization: {
            estimatedCost: number;
            suggestions: string[];
        };
    };
    auth: {
        totalOperations: number;
        successRate: number;
        averageDuration: number;
        activeUsers: number;
        securityMetrics: {
            failedLoginAttempts: number;
            suspiciousActivity: number;
            mfaAdoption: number;
        };
    };
}
export interface SupabaseAgentConfig {
    endpoint?: string;
    apiKey?: string;
    slowQueryThreshold?: number;
    maxMetricsHistory?: number;
    monitorRealtime?: boolean;
    monitorStorage?: boolean;
    monitorAuth?: boolean;
    enableQueryOptimization?: boolean;
    enableCostTracking?: boolean;
    enableSecurityMonitoring?: boolean;
    samplingRate?: number;
    autoInit?: boolean;
}
export declare class SupabaseAgent {
    private profiler;
    private client?;
    private isActive;
    private config;
    private operationMetrics;
    private realtimeMetrics;
    private storageMetrics;
    private authMetrics;
    private activeChannels;
    private originalMethods;
    private performanceBaselines;
    private queryOptimizationSuggestions;
    private costTracker;
    private securityEvents;
    private monitoringInterval?;
    constructor(config?: SupabaseAgentConfig);
    /**
     * Initialize the Supabase agent
     */
    init(supabaseUrl?: string, supabaseKey?: string): Promise<void>;
    /**
     * Instrument an existing Supabase client
     */
    instrumentClient(client: SupabaseClient): void;
    /**
     * Instrument Supabase client methods
     */
    private instrumentSupabaseClient;
    /**
     * Enhanced database operations instrumentation
     */
    private instrumentDatabaseOperations;
    /**
     * Enhanced query builder wrapping
     */
    private wrapQueryBuilder;
    /**
     * Enhanced realtime operations instrumentation
     */
    private instrumentRealtimeOperations;
    /**
     * Enhanced channel instrumentation
     */
    private instrumentChannel;
    /**
     * Enhanced storage operations instrumentation
     */
    private instrumentStorageOperations;
    /**
     * Enhanced storage bucket wrapping
     */
    private wrapStorageBucket;
    /**
     * Enhanced auth operations instrumentation
     */
    private instrumentAuthOperations;
    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring;
    /**
     * Record database operation metrics with enhanced tracking
     */
    private recordOperation;
    /**
     * Enhanced performance analysis methods
     */
    private analyzeQueryPerformance;
    private generateOptimizationSuggestions;
    private calculateQueryComplexity;
    private analyzeIndexUsage;
    private checkCacheHit;
    private trackOperationCost;
    private getBaseCost;
    private trackStorageCost;
    private analyzeAuthSecurity;
    private recordSecurityEvent;
    private analyzePerformanceTrends;
    private optimizeQueries;
    private generateCostReport;
    private checkSecurityThresholds;
    private generateTraceId;
    private getFileSize;
    private calculateCompressionRatio;
    private checkCdnHit;
    private mapAuthOperation;
    private recordRealtimeEvent;
    private recordStorageOperation;
    private recordAuthOperation;
    getPerformanceSummary(): SupabasePerformanceStats;
    getTableStats(tableName: string): any;
    exportMetrics(): any;
    stop(): Promise<void>;
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
    getOperationMetrics(): any[];
    getTableStatistics(): any[];
    private getTopTables;
    private getOverallConnectionStatus;
    private calculateSubscriptionHealth;
    private calculateMessageDropRate;
    private calculateCompressionEfficiency;
    private generateCostOptimizationSuggestions;
    private getActiveUserCount;
    private calculateSuspiciousActivity;
    private calculateMfaAdoption;
    private groupBy;
    private calculatePerformanceTrend;
}
export declare const supabaseAgent: SupabaseAgent;
//# sourceMappingURL=index.d.ts.map