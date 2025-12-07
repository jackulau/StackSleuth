"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
// Mock express
jest.mock('express', () => {
    const mockApp = {
        use: jest.fn()
    };
    const expressFn = jest.fn(() => mockApp);
    expressFn.Application = jest.fn();
    return expressFn;
});
describe('BackendAgent', () => {
    let agent;
    beforeEach(() => {
        agent = new index_1.BackendAgent({ enabled: true, sampling: { rate: 1.0 } });
    });
    describe('constructor', () => {
        it('should create a new BackendAgent instance', () => {
            expect(agent).toBeInstanceOf(index_1.BackendAgent);
        });
        it('should accept configuration options', () => {
            const configuredAgent = new index_1.BackendAgent({
                enabled: true,
                sampling: { rate: 0.5 }
            });
            expect(configuredAgent).toBeInstanceOf(index_1.BackendAgent);
        });
    });
    describe('getCollector', () => {
        it('should return the trace collector', () => {
            const collector = agent.getCollector();
            expect(collector).toBeDefined();
            expect(typeof collector.startTrace).toBe('function');
        });
    });
    describe('trace', () => {
        it('should trace an async operation successfully', async () => {
            const result = await agent.trace('test-operation', async () => {
                return 'test-result';
            });
            expect(result).toBe('test-result');
        });
        it('should handle errors in traced operations', async () => {
            const testError = new Error('Test error');
            await expect(agent.trace('error-operation', async () => {
                throw testError;
            })).rejects.toThrow('Test error');
        });
        it('should create traces with correct structure', async () => {
            await agent.trace('structured-trace', async () => {
                return 'result';
            });
            const collector = agent.getCollector();
            const traces = collector.getAllTraces();
            expect(traces.length).toBeGreaterThan(0);
            const trace = traces.find(t => t.name === 'structured-trace');
            expect(trace).toBeTruthy();
        });
        it('should add spans to existing traces', async () => {
            // Start a trace first
            const collector = agent.getCollector();
            const trace = collector.startTrace('parent-trace');
            if (trace) {
                // Now trace an operation
                await agent.trace('child-operation', async () => {
                    return 'child-result';
                });
            }
            const traces = collector.getAllTraces();
            expect(traces.length).toBeGreaterThan(0);
        });
    });
    describe('traceHandler', () => {
        it('should wrap a handler function', async () => {
            const mockHandler = jest.fn().mockResolvedValue('handler-result');
            const wrappedHandler = agent.traceHandler(mockHandler);
            const mockReq = { method: 'GET', path: '/test' };
            const mockRes = {};
            const mockNext = jest.fn();
            const result = await wrappedHandler(mockReq, mockRes, mockNext);
            expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
        });
        it('should handle errors in wrapped handlers', async () => {
            const testError = new Error('Handler error');
            const mockHandler = jest.fn().mockRejectedValue(testError);
            const wrappedHandler = agent.traceHandler(mockHandler);
            const mockReq = { method: 'GET', path: '/test' };
            const mockRes = {};
            const mockNext = jest.fn();
            await expect(wrappedHandler(mockReq, mockRes, mockNext)).rejects.toThrow('Handler error');
        });
        it('should create spans when trace context exists', async () => {
            const collector = agent.getCollector();
            const trace = collector.startTrace('handler-trace');
            const mockHandler = jest.fn().mockResolvedValue('result');
            const wrappedHandler = agent.traceHandler(mockHandler);
            const mockReq = {
                method: 'POST',
                path: '/api/test',
                stacksleuthTrace: trace
            };
            await wrappedHandler(mockReq, {}, jest.fn());
            expect(mockHandler).toHaveBeenCalled();
        });
    });
    describe('instrument', () => {
        it('should add middleware to express app', () => {
            const mockApp = {
                use: jest.fn()
            };
            agent.instrument(mockApp);
            expect(mockApp.use).toHaveBeenCalled();
        });
    });
});
describe('createBackendAgent', () => {
    it('should create a new BackendAgent instance', () => {
        const agent = (0, index_1.createBackendAgent)();
        expect(agent).toBeInstanceOf(index_1.BackendAgent);
    });
    it('should pass configuration to the agent', () => {
        const agent = (0, index_1.createBackendAgent)({
            enabled: true,
            sampling: { rate: 0.5 }
        });
        expect(agent).toBeInstanceOf(index_1.BackendAgent);
    });
});
//# sourceMappingURL=index.test.js.map