"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
describe('ProfilerCore', () => {
    let profiler;
    beforeEach(() => {
        profiler = new index_1.ProfilerCore({ output: { console: false } });
    });
    afterEach(async () => {
        await profiler.stop();
    });
    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await profiler.init();
            expect(profiler.active).toBe(true);
        });
        it('should not re-initialize if already active', async () => {
            await profiler.init();
            await profiler.init(); // Second call should be no-op
            expect(profiler.active).toBe(true);
        });
        it('should accept custom configuration', async () => {
            const customProfiler = new index_1.ProfilerCore({
                enabled: true,
                sampling: { rate: 0.5 },
                output: { console: false }
            });
            await customProfiler.init();
            expect(customProfiler.active).toBe(true);
            await customProfiler.stop();
        });
    });
    describe('trace management', () => {
        beforeEach(async () => {
            await profiler.init();
        });
        it('should start and complete a trace', () => {
            const traceId = profiler.startTrace('test-trace', { key: 'value' });
            expect(traceId).toBeTruthy();
            profiler.completeTrace(traceId, index_1.TraceStatus.SUCCESS);
            // Wait for async operations
            return new Promise((resolve) => {
                setTimeout(() => {
                    const traces = profiler.getTraces();
                    const trace = traces.find(t => t.id === traceId);
                    expect(trace).toBeTruthy();
                    expect(trace?.status).toBe(index_1.TraceStatus.SUCCESS);
                    resolve();
                }, 10);
            });
        });
        it('should return null for trace when profiler is not active', async () => {
            await profiler.stop();
            const traceId = profiler.startTrace('test-trace');
            expect(traceId).toBeNull();
        });
        it('should complete trace with error status', () => {
            const traceId = profiler.startTrace('error-trace');
            profiler.completeTrace(traceId, index_1.TraceStatus.ERROR);
            return new Promise((resolve) => {
                setTimeout(() => {
                    const traces = profiler.getTraces();
                    const trace = traces.find(t => t.id === traceId);
                    expect(trace?.status).toBe(index_1.TraceStatus.ERROR);
                    resolve();
                }, 10);
            });
        });
    });
    describe('span management', () => {
        beforeEach(async () => {
            await profiler.init();
        });
        it('should start and complete a span', () => {
            const traceId = profiler.startTrace('test-trace');
            const spanId = profiler.startSpan(traceId, 'test-span', index_1.SpanType.FUNCTION_CALL);
            expect(spanId).toBeTruthy();
            profiler.completeSpan(spanId, index_1.TraceStatus.SUCCESS);
            profiler.completeTrace(traceId);
            return new Promise((resolve) => {
                setTimeout(() => {
                    const traces = profiler.getTraces();
                    const trace = traces.find(t => t.id === traceId);
                    expect(trace?.spans.length).toBeGreaterThan(0);
                    resolve();
                }, 10);
            });
        });
        it('should handle nested spans', () => {
            const traceId = profiler.startTrace('nested-trace');
            const parentSpanId = profiler.startSpan(traceId, 'parent-span', index_1.SpanType.HTTP_REQUEST);
            const childSpanId = profiler.startSpan(traceId, 'child-span', index_1.SpanType.DB_QUERY, parentSpanId);
            expect(childSpanId).toBeTruthy();
            profiler.completeSpan(childSpanId, index_1.TraceStatus.SUCCESS);
            profiler.completeSpan(parentSpanId, index_1.TraceStatus.SUCCESS);
            profiler.completeTrace(traceId);
            return new Promise((resolve) => {
                setTimeout(() => {
                    const traces = profiler.getTraces();
                    const trace = traces.find(t => t.id === traceId);
                    expect(trace?.spans.length).toBe(2);
                    resolve();
                }, 10);
            });
        });
    });
    describe('metrics recording', () => {
        beforeEach(async () => {
            await profiler.init();
        });
        it('should record a metric', () => {
            profiler.recordMetric('custom-metric', {
                timestamp: Date.now(),
                duration: 100,
                customValue: 42
            });
            return new Promise((resolve) => {
                setTimeout(() => {
                    const traces = profiler.getTraces();
                    const metricTrace = traces.find(t => t.name === 'custom-metric');
                    expect(metricTrace).toBeTruthy();
                    resolve();
                }, 10);
            });
        });
        it('should not record metric when profiler is inactive', async () => {
            await profiler.stop();
            profiler.recordMetric('inactive-metric', { timestamp: Date.now() });
            // Re-initialize to check traces
            await profiler.init();
            const traces = profiler.getTraces();
            const metricTrace = traces.find(t => t.name === 'inactive-metric');
            expect(metricTrace).toBeUndefined();
        });
    });
    describe('error recording', () => {
        beforeEach(async () => {
            await profiler.init();
        });
        it('should record an error', () => {
            const error = new Error('Test error');
            profiler.recordError(error, { context: 'test' });
            return new Promise((resolve) => {
                setTimeout(() => {
                    const traces = profiler.getTraces();
                    const errorTrace = traces.find(t => t.name === 'error');
                    expect(errorTrace).toBeTruthy();
                    expect(errorTrace?.status).toBe(index_1.TraceStatus.ERROR);
                    resolve();
                }, 10);
            });
        });
    });
    describe('statistics', () => {
        beforeEach(async () => {
            await profiler.init();
        });
        it('should return performance statistics', () => {
            const traceId = profiler.startTrace('stats-trace');
            profiler.completeTrace(traceId);
            return new Promise((resolve) => {
                setTimeout(() => {
                    const stats = profiler.getStats();
                    expect(stats).toHaveProperty('traces');
                    expect(stats).toHaveProperty('spans');
                    expect(stats.traces).toHaveProperty('total');
                    resolve();
                }, 10);
            });
        });
    });
    describe('export', () => {
        beforeEach(async () => {
            await profiler.init();
        });
        it('should export as JSON', () => {
            const traceId = profiler.startTrace('export-trace');
            profiler.completeTrace(traceId);
            return new Promise((resolve) => {
                setTimeout(() => {
                    const json = profiler.export('json');
                    expect(() => JSON.parse(json)).not.toThrow();
                    resolve();
                }, 10);
            });
        });
        it('should export as CSV', () => {
            const traceId = profiler.startTrace('csv-trace');
            profiler.completeTrace(traceId);
            return new Promise((resolve) => {
                setTimeout(() => {
                    const csv = profiler.export('csv');
                    expect(csv).toContain('traceId');
                    expect(csv).toContain('name');
                    resolve();
                }, 10);
            });
        });
    });
    describe('stop', () => {
        it('should stop the profiler', async () => {
            await profiler.init();
            expect(profiler.active).toBe(true);
            await profiler.stop();
            expect(profiler.active).toBe(false);
        });
        it('should not fail when stopping inactive profiler', async () => {
            await profiler.stop();
            expect(profiler.active).toBe(false);
        });
    });
});
describe('TraceCollector', () => {
    let collector;
    beforeEach(() => {
        collector = new index_1.TraceCollector({ enabled: true, sampling: { rate: 1.0 } });
    });
    describe('trace lifecycle', () => {
        it('should start a trace', () => {
            const trace = collector.startTrace('test-trace', { key: 'value' });
            expect(trace).toBeTruthy();
            expect(trace?.name).toBe('test-trace');
            expect(trace?.metadata.key).toBe('value');
        });
        it('should complete a trace', () => {
            const trace = collector.startTrace('test-trace');
            collector.completeTrace(trace.id, index_1.TraceStatus.SUCCESS);
            const completedTrace = collector.getTrace(trace.id);
            expect(completedTrace?.status).toBe(index_1.TraceStatus.SUCCESS);
            expect(completedTrace?.timing.duration).toBeDefined();
        });
        it('should not start trace when disabled', () => {
            const disabledCollector = new index_1.TraceCollector({ enabled: false });
            const trace = disabledCollector.startTrace('test');
            expect(trace).toBeNull();
        });
        it('should respect sampling rate', () => {
            const samplingCollector = new index_1.TraceCollector({
                enabled: true,
                sampling: { rate: 0 } // 0% sampling
            });
            const trace = samplingCollector.startTrace('test');
            expect(trace).toBeNull();
        });
    });
    describe('span lifecycle', () => {
        it('should start a span within a trace', () => {
            const trace = collector.startTrace('test-trace');
            const span = collector.startSpan(trace.id, 'test-span', index_1.SpanType.FUNCTION_CALL);
            expect(span).toBeTruthy();
            expect(span?.name).toBe('test-span');
        });
        it('should complete a span', () => {
            const trace = collector.startTrace('test-trace');
            const span = collector.startSpan(trace.id, 'test-span', index_1.SpanType.DB_QUERY);
            collector.completeSpan(span.id, index_1.TraceStatus.SUCCESS, { extra: 'data' });
            const completedTrace = collector.getTrace(trace.id);
            const completedSpan = completedTrace?.spans.find(s => s.id === span?.id);
            expect(completedSpan?.status).toBe(index_1.TraceStatus.SUCCESS);
            expect(completedSpan?.timing.duration).toBeDefined();
        });
        it('should add error to span', () => {
            const trace = collector.startTrace('test-trace');
            const span = collector.startSpan(trace.id, 'error-span', index_1.SpanType.HTTP_REQUEST);
            const error = new Error('Test error');
            collector.addSpanError(span.id, error);
            // Complete the span first
            collector.completeSpan(span.id, index_1.TraceStatus.ERROR);
            const completedTrace = collector.getTrace(trace.id);
            const errorSpan = completedTrace?.spans.find(s => s.id === span?.id);
            expect(errorSpan?.errors).toHaveLength(1);
            expect(errorSpan?.status).toBe(index_1.TraceStatus.ERROR);
        });
    });
    describe('trace retrieval', () => {
        it('should get all traces', () => {
            collector.startTrace('trace-1');
            collector.startTrace('trace-2');
            collector.startTrace('trace-3');
            const traces = collector.getAllTraces();
            expect(traces.length).toBe(3);
        });
        it('should get traces by time range', () => {
            const startTime = Date.now();
            const trace = collector.startTrace('time-range-trace');
            collector.completeTrace(trace.id);
            const endTime = Date.now() + 1000;
            const traces = collector.getTracesByTimeRange(startTime - 1000, endTime);
            expect(traces.length).toBeGreaterThan(0);
        });
    });
    describe('statistics', () => {
        it('should calculate stats for traces', () => {
            const trace = collector.startTrace('stats-trace');
            collector.completeTrace(trace.id);
            const stats = collector.getStats();
            expect(stats.traces.total).toBe(1);
            expect(stats).toHaveProperty('spans');
        });
        it('should return zero stats when no traces', () => {
            const stats = collector.getStats();
            expect(stats.traces.total).toBe(0);
            expect(stats.traces.avg).toBe(0);
        });
    });
    describe('cleanup', () => {
        it('should cleanup old traces', () => {
            const trace = collector.startTrace('old-trace');
            collector.completeTrace(trace.id);
            // Force the trace to appear old by manipulating timing
            const storedTrace = collector.getTrace(trace.id);
            if (storedTrace) {
                storedTrace.timing.start.millis = Date.now() - 400000; // 6+ minutes ago
            }
            collector.cleanup(300000); // 5 minute max age
            const traces = collector.getAllTraces();
            // Old trace should be cleaned up
            expect(traces.find(t => t.id === trace?.id)).toBeUndefined();
        });
    });
    describe('export', () => {
        it('should export as JSON', () => {
            const trace = collector.startTrace('export-trace');
            collector.completeTrace(trace.id);
            const json = collector.export('json');
            const parsed = JSON.parse(json);
            expect(Array.isArray(parsed)).toBe(true);
        });
        it('should export as CSV', () => {
            const trace = collector.startTrace('csv-trace');
            collector.completeTrace(trace.id);
            const csv = collector.export('csv');
            expect(csv).toContain('traceId');
            expect(csv).toContain('csv-trace');
        });
    });
    describe('events', () => {
        it('should emit trace:started event', (done) => {
            collector.on('trace:started', (trace) => {
                expect(trace.name).toBe('event-trace');
                done();
            });
            collector.startTrace('event-trace');
        });
        it('should emit trace:completed event', (done) => {
            collector.on('trace:completed', (trace) => {
                expect(trace.status).toBe(index_1.TraceStatus.SUCCESS);
                done();
            });
            const trace = collector.startTrace('complete-event-trace');
            collector.completeTrace(trace.id, index_1.TraceStatus.SUCCESS);
        });
        it('should emit span:started event', (done) => {
            collector.on('span:started', (span) => {
                expect(span.name).toBe('event-span');
                done();
            });
            const trace = collector.startTrace('span-event-trace');
            collector.startSpan(trace.id, 'event-span', index_1.SpanType.CUSTOM);
        });
    });
});
describe('Timer', () => {
    it('should return a timestamp with nanos and millis', () => {
        const timestamp = index_1.Timer.now();
        expect(timestamp).toHaveProperty('nanos');
        expect(timestamp).toHaveProperty('millis');
        expect(typeof timestamp.nanos).toBe('number');
        expect(typeof timestamp.millis).toBe('number');
    });
    it('should calculate diff between timestamps', () => {
        const start = index_1.Timer.now();
        // Simulate some delay
        const busyWait = Date.now() + 5;
        while (Date.now() < busyWait) { /* busy wait */ }
        const end = index_1.Timer.now();
        const diff = index_1.Timer.diff(start, end);
        expect(diff).toBeGreaterThan(0);
    });
    it('should calculate time since a timestamp', () => {
        const start = index_1.Timer.now();
        // Simulate some delay
        const busyWait = Date.now() + 5;
        while (Date.now() < busyWait) { /* busy wait */ }
        const elapsed = index_1.Timer.since(start);
        expect(elapsed).toBeGreaterThan(0);
    });
});
describe('IdGenerator', () => {
    it('should generate unique trace IDs', () => {
        const id1 = index_1.IdGenerator.traceId();
        const id2 = index_1.IdGenerator.traceId();
        expect(id1).toBeTruthy();
        expect(id2).toBeTruthy();
        expect(id1).not.toBe(id2);
    });
    it('should generate unique span IDs', () => {
        const id1 = index_1.IdGenerator.spanId();
        const id2 = index_1.IdGenerator.spanId();
        expect(id1).toBeTruthy();
        expect(id2).toBeTruthy();
        expect(id1).not.toBe(id2);
    });
    it('should generate short IDs', () => {
        const fullId = index_1.IdGenerator.traceId();
        const shortId = index_1.IdGenerator.shortId(fullId);
        expect(shortId.length).toBe(8);
        expect(fullId.startsWith(shortId)).toBe(true);
    });
});
describe('PerformanceUtils', () => {
    describe('calculatePercentile', () => {
        it('should calculate percentile correctly', () => {
            const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            expect(index_1.PerformanceUtils.calculatePercentile(values, 50)).toBe(5.5);
            expect(index_1.PerformanceUtils.calculatePercentile(values, 0)).toBe(1);
            expect(index_1.PerformanceUtils.calculatePercentile(values, 100)).toBe(10);
        });
        it('should return 0 for empty array', () => {
            expect(index_1.PerformanceUtils.calculatePercentile([], 50)).toBe(0);
        });
    });
    describe('calculateStats', () => {
        it('should calculate all stats', () => {
            const values = [10, 20, 30, 40, 50];
            const stats = index_1.PerformanceUtils.calculateStats(values);
            expect(stats.min).toBe(10);
            expect(stats.max).toBe(50);
            expect(stats.avg).toBe(30);
            expect(stats.count).toBe(5);
            expect(stats.p50).toBeDefined();
            expect(stats.p95).toBeDefined();
            expect(stats.p99).toBeDefined();
        });
        it('should return zeros for empty array', () => {
            const stats = index_1.PerformanceUtils.calculateStats([]);
            expect(stats.min).toBe(0);
            expect(stats.max).toBe(0);
            expect(stats.avg).toBe(0);
            expect(stats.count).toBe(0);
        });
    });
    describe('formatDuration', () => {
        it('should format microseconds', () => {
            expect(index_1.PerformanceUtils.formatDuration(0.5)).toContain('μs');
        });
        it('should format milliseconds', () => {
            expect(index_1.PerformanceUtils.formatDuration(500)).toContain('ms');
        });
        it('should format seconds', () => {
            expect(index_1.PerformanceUtils.formatDuration(2000)).toContain('s');
        });
    });
    describe('formatBytes', () => {
        it('should format bytes', () => {
            expect(index_1.PerformanceUtils.formatBytes(500)).toContain('B');
        });
        it('should format kilobytes', () => {
            expect(index_1.PerformanceUtils.formatBytes(1500)).toContain('KB');
        });
        it('should format megabytes', () => {
            expect(index_1.PerformanceUtils.formatBytes(1500000)).toContain('MB');
        });
    });
});
describe('SamplingUtils', () => {
    describe('shouldSample', () => {
        it('should always sample at rate 1.0', () => {
            let sampled = 0;
            for (let i = 0; i < 100; i++) {
                if (index_1.SamplingUtils.shouldSample(1.0))
                    sampled++;
            }
            expect(sampled).toBe(100);
        });
        it('should never sample at rate 0', () => {
            let sampled = 0;
            for (let i = 0; i < 100; i++) {
                if (index_1.SamplingUtils.shouldSample(0))
                    sampled++;
            }
            expect(sampled).toBe(0);
        });
    });
    describe('createThrottler', () => {
        it('should throttle requests', () => {
            const throttler = index_1.SamplingUtils.createThrottler(5);
            let allowed = 0;
            for (let i = 0; i < 10; i++) {
                if (throttler())
                    allowed++;
            }
            expect(allowed).toBe(5);
        });
        it('should refill tokens after one second', (done) => {
            const throttler = index_1.SamplingUtils.createThrottler(2);
            // Use all tokens
            throttler();
            throttler();
            expect(throttler()).toBe(false);
            // Wait for refill
            setTimeout(() => {
                expect(throttler()).toBe(true);
                done();
            }, 1100);
        });
    });
});
describe('ErrorUtils', () => {
    describe('serializeError', () => {
        it('should serialize an error', () => {
            const error = new Error('Test error');
            const serialized = index_1.ErrorUtils.serializeError(error);
            expect(serialized.name).toBe('Error');
            expect(serialized.message).toBe('Test error');
            expect(serialized.stack).toBeDefined();
            expect(serialized.timestamp).toBeDefined();
        });
    });
    describe('isRetryableError', () => {
        it('should identify NetworkError as retryable', () => {
            const error = new Error('Network failure');
            error.name = 'NetworkError';
            expect(index_1.ErrorUtils.isRetryableError(error)).toBe(true);
        });
        it('should identify TimeoutError as retryable', () => {
            const error = new Error('Timeout');
            error.name = 'TimeoutError';
            expect(index_1.ErrorUtils.isRetryableError(error)).toBe(true);
        });
        it('should identify ECONNRESET as retryable', () => {
            const error = new Error('Connection reset: ECONNRESET');
            expect(index_1.ErrorUtils.isRetryableError(error)).toBe(true);
        });
        it('should not identify generic errors as retryable', () => {
            const error = new Error('Generic error');
            expect(index_1.ErrorUtils.isRetryableError(error)).toBe(false);
        });
    });
});
//# sourceMappingURL=index.test.js.map