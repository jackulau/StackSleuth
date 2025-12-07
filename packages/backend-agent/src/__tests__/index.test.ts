import { BackendAgent, createBackendAgent } from '../index';
import express, { Request, Response, NextFunction } from 'express';
import { TraceStatus } from '@stacksleuth/core';

// Mock express
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn()
  };
  const expressFn = jest.fn(() => mockApp);
  (expressFn as any).Application = jest.fn();
  return expressFn;
});

describe('BackendAgent', () => {
  let agent: BackendAgent;

  beforeEach(() => {
    agent = new BackendAgent({ enabled: true, sampling: { rate: 1.0 } });
  });

  describe('constructor', () => {
    it('should create a new BackendAgent instance', () => {
      expect(agent).toBeInstanceOf(BackendAgent);
    });

    it('should accept configuration options', () => {
      const configuredAgent = new BackendAgent({
        enabled: true,
        sampling: { rate: 0.5 }
      });
      expect(configuredAgent).toBeInstanceOf(BackendAgent);
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

      await expect(
        agent.trace('error-operation', async () => {
          throw testError;
        })
      ).rejects.toThrow('Test error');
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

      const mockReq = { method: 'GET', path: '/test' } as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn() as NextFunction;

      const result = await wrappedHandler(mockReq, mockRes, mockNext);

      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should handle errors in wrapped handlers', async () => {
      const testError = new Error('Handler error');
      const mockHandler = jest.fn().mockRejectedValue(testError);
      const wrappedHandler = agent.traceHandler(mockHandler);

      const mockReq = { method: 'GET', path: '/test' } as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn() as NextFunction;

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
      } as any;

      await wrappedHandler(mockReq, {} as Response, jest.fn() as NextFunction);

      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('instrument', () => {
    it('should add middleware to express app', () => {
      const mockApp = {
        use: jest.fn()
      } as unknown as express.Application;

      agent.instrument(mockApp);

      expect(mockApp.use).toHaveBeenCalled();
    });
  });
});

describe('createBackendAgent', () => {
  it('should create a new BackendAgent instance', () => {
    const agent = createBackendAgent();
    expect(agent).toBeInstanceOf(BackendAgent);
  });

  it('should pass configuration to the agent', () => {
    const agent = createBackendAgent({
      enabled: true,
      sampling: { rate: 0.5 }
    });
    expect(agent).toBeInstanceOf(BackendAgent);
  });
});
