"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
describe('RedisAgent', () => {
    let agent;
    beforeEach(() => {
        // Create agent with autoInit: false to prevent hanging
        agent = new index_1.RedisAgent({
            slowQueryThreshold: 100,
            maxMetricsHistory: 1000,
            autoInit: false
        });
    });
    afterEach(async () => {
        await agent.stop();
    });
    describe('constructor', () => {
        it('should create a new RedisAgent instance', () => {
            expect(agent).toBeInstanceOf(index_1.RedisAgent);
        });
        it('should accept configuration options', () => {
            const configuredAgent = new index_1.RedisAgent({
                slowQueryThreshold: 50,
                maxMetricsHistory: 500,
                autoInit: false
            });
            expect(configuredAgent).toBeInstanceOf(index_1.RedisAgent);
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
    describe('recordOperationMetrics', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should record operation metrics', () => {
            const metrics = {
                command: 'GET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            };
            agent.recordOperationMetrics(metrics);
            const recentOps = agent.getRecentOperations(10);
            expect(recentOps.length).toBe(1);
            expect(recentOps[0].command).toBe('GET');
        });
        it('should record slow query metrics', () => {
            const slowMetrics = {
                command: 'SCAN',
                duration: 200, // Above threshold
                keyCount: 100,
                dataSize: 5000,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            };
            agent.recordOperationMetrics(slowMetrics);
            const stats = agent.getPerformanceStats();
            expect(stats.slowQueries.length).toBe(1);
        });
        it('should record error metrics', () => {
            const errorMetrics = {
                command: 'SET',
                duration: 5,
                keyCount: 1,
                dataSize: 50,
                success: false,
                error: 'Connection refused',
                timestamp: Date.now(),
                connectionId: 'test-connection'
            };
            agent.recordOperationMetrics(errorMetrics);
            const stats = agent.getPerformanceStats();
            expect(stats.errorRate).toBeGreaterThan(0);
        });
        it('should maintain metrics history limit', () => {
            // Record more metrics than the limit
            for (let i = 0; i < 1100; i++) {
                agent.recordOperationMetrics({
                    command: 'GET',
                    duration: 5,
                    keyCount: 1,
                    dataSize: 10,
                    success: true,
                    timestamp: Date.now(),
                    connectionId: 'test-connection'
                });
            }
            const recentOps = agent.getRecentOperations(2000);
            expect(recentOps.length).toBeLessThanOrEqual(1000);
        });
    });
    describe('getPerformanceStats', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should return performance statistics', () => {
            // Add some metrics first
            agent.recordOperationMetrics({
                command: 'GET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            });
            const stats = agent.getPerformanceStats();
            expect(stats).toHaveProperty('totalOperations');
            expect(stats).toHaveProperty('avgResponseTime');
            expect(stats).toHaveProperty('slowQueries');
            expect(stats).toHaveProperty('errorRate');
            expect(stats).toHaveProperty('topCommands');
            expect(stats).toHaveProperty('connectionPool');
            expect(stats).toHaveProperty('memoryStats');
        });
        it('should return zero stats when no metrics', () => {
            const stats = agent.getPerformanceStats();
            expect(stats.totalOperations).toBe(0);
            expect(stats.avgResponseTime).toBe(0);
            expect(stats.errorRate).toBe(0);
        });
        it('should calculate correct average response time', () => {
            agent.recordOperationMetrics({
                command: 'GET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            });
            agent.recordOperationMetrics({
                command: 'SET',
                duration: 20,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            });
            const stats = agent.getPerformanceStats();
            expect(stats.avgResponseTime).toBe(15);
        });
        it('should calculate top commands', () => {
            // Record multiple commands
            for (let i = 0; i < 5; i++) {
                agent.recordOperationMetrics({
                    command: 'GET',
                    duration: 10,
                    keyCount: 1,
                    dataSize: 100,
                    success: true,
                    timestamp: Date.now(),
                    connectionId: 'test-connection'
                });
            }
            for (let i = 0; i < 3; i++) {
                agent.recordOperationMetrics({
                    command: 'SET',
                    duration: 15,
                    keyCount: 1,
                    dataSize: 100,
                    success: true,
                    timestamp: Date.now(),
                    connectionId: 'test-connection'
                });
            }
            const stats = agent.getPerformanceStats();
            expect(stats.topCommands.length).toBe(2);
            expect(stats.topCommands[0].command).toBe('GET');
            expect(stats.topCommands[0].count).toBe(5);
        });
    });
    describe('getRecentOperations', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should return recent operations', () => {
            agent.recordOperationMetrics({
                command: 'GET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            });
            const recentOps = agent.getRecentOperations(10);
            expect(recentOps.length).toBe(1);
        });
        it('should respect the limit parameter', () => {
            for (let i = 0; i < 20; i++) {
                agent.recordOperationMetrics({
                    command: 'GET',
                    duration: 10,
                    keyCount: 1,
                    dataSize: 100,
                    success: true,
                    timestamp: Date.now(),
                    connectionId: 'test-connection'
                });
            }
            const recentOps = agent.getRecentOperations(5);
            expect(recentOps.length).toBe(5);
        });
        it('should sort by timestamp descending', () => {
            const now = Date.now();
            agent.recordOperationMetrics({
                command: 'GET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: now - 1000,
                connectionId: 'test-connection'
            });
            agent.recordOperationMetrics({
                command: 'SET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: now,
                connectionId: 'test-connection'
            });
            const recentOps = agent.getRecentOperations(10);
            expect(recentOps[0].command).toBe('SET');
        });
    });
    describe('getConnectionMetrics', () => {
        beforeEach(async () => {
            await agent.init();
        });
        it('should return connection metrics', () => {
            const connections = agent.getConnectionMetrics();
            expect(Array.isArray(connections)).toBe(true);
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
            agent.recordOperationMetrics({
                command: 'GET',
                duration: 10,
                keyCount: 1,
                dataSize: 100,
                success: true,
                timestamp: Date.now(),
                connectionId: 'test-connection'
            });
            await agent.stop();
            const recentOps = agent.getRecentOperations(10);
            expect(recentOps.length).toBe(0);
        });
    });
});
//# sourceMappingURL=index.test.js.map