"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
describe('FastAPIAgent', () => {
    let agent;
    beforeEach(() => {
        // Create agent with autoInit: false to prevent hanging
        agent = new index_1.FastAPIAgent({
            slowQueryThreshold: 1000,
            maxMetricsHistory: 1000,
            pythonServerUrl: 'http://localhost:8000',
            autoInit: false
        });
    });
    afterEach(async () => {
        await agent.stop();
    });
    describe('constructor', () => {
        it('should create a new FastAPIAgent instance', () => {
            expect(agent).toBeInstanceOf(index_1.FastAPIAgent);
        });
        it('should accept configuration options', () => {
            const configuredAgent = new index_1.FastAPIAgent({
                slowQueryThreshold: 500,
                maxMetricsHistory: 500,
                pythonServerUrl: 'http://localhost:9000',
                autoInit: false
            });
            expect(configuredAgent).toBeInstanceOf(index_1.FastAPIAgent);
        });
    });
    describe('init', () => {
        it('should initialize the agent', async () => {
            await agent.init();
            // Agent should be active after init
            const stats = agent.getPerformanceStats();
            expect(stats).toBeDefined();
        });
        it('should not re-initialize if already active', async () => {
            await agent.init();
            await agent.init(); // Second call should be no-op
            // No error should be thrown
        });
    });
    describe('recordRouteMetrics', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should record route metrics', () => {
            const metrics = {
                path: '/api/users',
                method: 'GET',
                duration: 100,
                status_code: 200,
                request_size: 0,
                response_size: 1024,
                timestamp: Date.now(),
                errors: [],
                db_queries: 2,
                db_query_time: 50,
                cache_hits: 1,
                cache_misses: 0
            };
            agent.recordRouteMetrics(metrics);
            const recentRoutes = agent.getRecentRoutes(10);
            expect(recentRoutes.length).toBe(1);
            expect(recentRoutes[0].path).toBe('/api/users');
        });
        it('should record slow query metrics', () => {
            const slowMetrics = {
                path: '/api/heavy-operation',
                method: 'POST',
                duration: 2000, // Above threshold
                status_code: 200,
                request_size: 500,
                response_size: 10000,
                timestamp: Date.now(),
                errors: [],
                db_queries: 10,
                db_query_time: 1500,
                cache_hits: 0,
                cache_misses: 5
            };
            agent.recordRouteMetrics(slowMetrics);
            const stats = agent.getPerformanceStats();
            expect(stats.slowEndpoints.length).toBe(1);
        });
        it('should record error metrics', () => {
            const errorMetrics = {
                path: '/api/error',
                method: 'GET',
                duration: 50,
                status_code: 500,
                request_size: 0,
                response_size: 100,
                timestamp: Date.now(),
                errors: ['Internal Server Error'],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            };
            agent.recordRouteMetrics(errorMetrics);
            const stats = agent.getPerformanceStats();
            expect(stats.errorRate).toBeGreaterThan(0);
        });
        it('should maintain metrics history limit', () => {
            // Record more metrics than the limit
            for (let i = 0; i < 1100; i++) {
                agent.recordRouteMetrics({
                    path: `/api/route-${i}`,
                    method: 'GET',
                    duration: 50,
                    status_code: 200,
                    request_size: 0,
                    response_size: 100,
                    timestamp: Date.now(),
                    errors: [],
                    db_queries: 0,
                    db_query_time: 0,
                    cache_hits: 0,
                    cache_misses: 0
                });
            }
            const recentRoutes = agent.getRecentRoutes(2000);
            expect(recentRoutes.length).toBeLessThanOrEqual(1000);
        });
    });
    describe('getPerformanceStats', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should return performance statistics', () => {
            agent.recordRouteMetrics({
                path: '/api/test',
                method: 'GET',
                duration: 100,
                status_code: 200,
                request_size: 0,
                response_size: 500,
                timestamp: Date.now(),
                errors: [],
                db_queries: 1,
                db_query_time: 20,
                cache_hits: 1,
                cache_misses: 0
            });
            const stats = agent.getPerformanceStats();
            expect(stats).toHaveProperty('totalRequests');
            expect(stats).toHaveProperty('avgResponseTime');
            expect(stats).toHaveProperty('slowEndpoints');
            expect(stats).toHaveProperty('errorRate');
            expect(stats).toHaveProperty('topEndpoints');
            expect(stats).toHaveProperty('serverMetrics');
            expect(stats).toHaveProperty('databaseStats');
            expect(stats).toHaveProperty('cacheStats');
        });
        it('should return zero stats when no metrics', () => {
            const stats = agent.getPerformanceStats();
            expect(stats.totalRequests).toBe(0);
            expect(stats.avgResponseTime).toBe(0);
            expect(stats.errorRate).toBe(0);
        });
        it('should calculate correct average response time', () => {
            agent.recordRouteMetrics({
                path: '/api/fast',
                method: 'GET',
                duration: 100,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            });
            agent.recordRouteMetrics({
                path: '/api/slow',
                method: 'GET',
                duration: 200,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            });
            const stats = agent.getPerformanceStats();
            expect(stats.avgResponseTime).toBe(150);
        });
        it('should calculate database stats correctly', () => {
            agent.recordRouteMetrics({
                path: '/api/db-heavy',
                method: 'GET',
                duration: 500,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 5,
                db_query_time: 300,
                cache_hits: 0,
                cache_misses: 0
            });
            agent.recordRouteMetrics({
                path: '/api/db-light',
                method: 'GET',
                duration: 100,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 1,
                db_query_time: 20,
                cache_hits: 0,
                cache_misses: 0
            });
            const stats = agent.getPerformanceStats();
            expect(stats.databaseStats.totalQueries).toBe(6);
            expect(stats.databaseStats.avgQueryTime).toBeGreaterThan(0);
        });
        it('should calculate cache stats correctly', () => {
            agent.recordRouteMetrics({
                path: '/api/cached',
                method: 'GET',
                duration: 50,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 3,
                cache_misses: 1
            });
            const stats = agent.getPerformanceStats();
            expect(stats.cacheStats.totalHits).toBe(3);
            expect(stats.cacheStats.totalMisses).toBe(1);
            expect(stats.cacheStats.hitRate).toBe(0.75);
        });
        it('should calculate top endpoints', () => {
            // Record multiple calls to same endpoint
            for (let i = 0; i < 5; i++) {
                agent.recordRouteMetrics({
                    path: '/api/popular',
                    method: 'GET',
                    duration: 100,
                    status_code: 200,
                    timestamp: Date.now(),
                    errors: [],
                    db_queries: 0,
                    db_query_time: 0,
                    cache_hits: 0,
                    cache_misses: 0
                });
            }
            for (let i = 0; i < 3; i++) {
                agent.recordRouteMetrics({
                    path: '/api/less-popular',
                    method: 'POST',
                    duration: 150,
                    status_code: 200,
                    timestamp: Date.now(),
                    errors: [],
                    db_queries: 0,
                    db_query_time: 0,
                    cache_hits: 0,
                    cache_misses: 0
                });
            }
            const stats = agent.getPerformanceStats();
            expect(stats.topEndpoints.length).toBe(2);
            expect(stats.topEndpoints[0].path).toBe('/api/popular');
            expect(stats.topEndpoints[0].count).toBe(5);
        });
    });
    describe('getRecentRoutes', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should return recent routes', () => {
            agent.recordRouteMetrics({
                path: '/api/test',
                method: 'GET',
                duration: 100,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            });
            const recentRoutes = agent.getRecentRoutes(10);
            expect(recentRoutes.length).toBe(1);
        });
        it('should respect the limit parameter', () => {
            for (let i = 0; i < 20; i++) {
                agent.recordRouteMetrics({
                    path: `/api/route-${i}`,
                    method: 'GET',
                    duration: 50,
                    status_code: 200,
                    timestamp: Date.now(),
                    errors: [],
                    db_queries: 0,
                    db_query_time: 0,
                    cache_hits: 0,
                    cache_misses: 0
                });
            }
            const recentRoutes = agent.getRecentRoutes(5);
            expect(recentRoutes.length).toBe(5);
        });
        it('should sort by timestamp descending', () => {
            const now = Date.now();
            agent.recordRouteMetrics({
                path: '/api/old',
                method: 'GET',
                duration: 100,
                status_code: 200,
                timestamp: now - 1000,
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            });
            agent.recordRouteMetrics({
                path: '/api/new',
                method: 'GET',
                duration: 100,
                status_code: 200,
                timestamp: now,
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            });
            const recentRoutes = agent.getRecentRoutes(10);
            expect(recentRoutes[0].path).toBe('/api/new');
        });
    });
    describe('getServerMetrics', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should return server metrics', () => {
            const serverMetrics = agent.getServerMetrics();
            expect(Array.isArray(serverMetrics)).toBe(true);
        });
    });
    describe('generateMiddlewareCode', () => {
        it('should generate Python middleware code', () => {
            const code = agent.generateMiddlewareCode();
            expect(code).toContain('StackSleuthMiddleware');
            expect(code).toContain('BaseHTTPMiddleware');
            expect(code).toContain('fastapi');
        });
    });
    describe('stop', () => {
        it('should stop the agent', async () => {
            await agent.init();
            await agent.stop();
            // Agent should be stopped without errors
        });
        it('should clear metrics on stop', async () => {
            await agent.init();
            agent.recordRouteMetrics({
                path: '/api/test',
                method: 'GET',
                duration: 100,
                status_code: 200,
                timestamp: Date.now(),
                errors: [],
                db_queries: 0,
                db_query_time: 0,
                cache_hits: 0,
                cache_misses: 0
            });
            await agent.stop();
            const recentRoutes = agent.getRecentRoutes(10);
            expect(recentRoutes.length).toBe(0);
        });
    });
});
//# sourceMappingURL=index.test.js.map