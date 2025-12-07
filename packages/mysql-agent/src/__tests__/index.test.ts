import { MySQLAgent, MySQLQueryMetrics, createMySQLAgent } from '../index';

describe('MySQLAgent', () => {
  let agent: MySQLAgent;

  beforeEach(() => {
    agent = new MySQLAgent({
      slowQueryThreshold: 100,
      maxMetricsHistory: 1000,
      autoInit: false
    });
  });

  afterEach(async () => {
    await agent.stop();
  });

  describe('constructor', () => {
    it('should create a new MySQLAgent instance', () => {
      expect(agent).toBeInstanceOf(MySQLAgent);
    });

    it('should accept configuration options', () => {
      const configuredAgent = new MySQLAgent({
        slowQueryThreshold: 50,
        maxMetricsHistory: 500,
        autoInit: false
      });
      expect(configuredAgent).toBeInstanceOf(MySQLAgent);
    });
  });

  describe('init', () => {
    it('should initialize the agent', async () => {
      await agent.init();
      const stats = agent.getPerformanceStats();
      expect(stats).toBeDefined();
    });

    it('should not re-initialize if already active', async () => {
      await agent.init();
      await agent.init(); // Second call should be no-op
    });
  });

  describe('recordQueryMetrics', () => {
    beforeEach(async () => {
      await agent.init();
    });

    it('should record query metrics', () => {
      const metrics: MySQLQueryMetrics = {
        query: 'SELECT * FROM users WHERE id = ?',
        duration: 10,
        rowsAffected: 1,
        rowsExamined: 1,
        database: 'testdb',
        table: 'users',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      };

      agent.recordQueryMetrics(metrics);

      const recentQueries = agent.getRecentQueries(10);
      expect(recentQueries.length).toBe(1);
      expect(recentQueries[0].operation).toBe('SELECT');
    });

    it('should record slow query metrics', () => {
      const slowMetrics: MySQLQueryMetrics = {
        query: 'SELECT * FROM large_table',
        duration: 200, // Above threshold
        rowsAffected: 10000,
        rowsExamined: 50000,
        database: 'testdb',
        table: 'large_table',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      };

      agent.recordQueryMetrics(slowMetrics);

      const stats = agent.getPerformanceStats();
      expect(stats.slowQueries.length).toBe(1);
    });

    it('should record error metrics', () => {
      const errorMetrics: MySQLQueryMetrics = {
        query: 'SELECT * FROM nonexistent',
        duration: 5,
        rowsAffected: 0,
        rowsExamined: 0,
        database: 'testdb',
        operation: 'SELECT',
        success: false,
        error: 'Table does not exist',
        timestamp: Date.now(),
        connectionId: 'test-connection'
      };

      agent.recordQueryMetrics(errorMetrics);

      const stats = agent.getPerformanceStats();
      expect(stats.errorRate).toBeGreaterThan(0);
    });

    it('should maintain metrics history limit', () => {
      for (let i = 0; i < 1100; i++) {
        agent.recordQueryMetrics({
          query: `SELECT * FROM table_${i}`,
          duration: 5,
          rowsAffected: 1,
          rowsExamined: 1,
          database: 'testdb',
          operation: 'SELECT',
          success: true,
          timestamp: Date.now(),
          connectionId: 'test-connection'
        });
      }

      const recentQueries = agent.getRecentQueries(2000);
      expect(recentQueries.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getPerformanceStats', () => {
    beforeEach(async () => {
      await agent.init();
    });

    it('should return performance statistics', () => {
      agent.recordQueryMetrics({
        query: 'SELECT * FROM users',
        duration: 10,
        rowsAffected: 5,
        rowsExamined: 5,
        database: 'testdb',
        table: 'users',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      const stats = agent.getPerformanceStats();

      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('avgResponseTime');
      expect(stats).toHaveProperty('slowQueries');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('topQueries');
      expect(stats).toHaveProperty('connectionPool');
      expect(stats).toHaveProperty('queryDistribution');
      expect(stats).toHaveProperty('indexStats');
    });

    it('should return zero stats when no metrics', () => {
      const stats = agent.getPerformanceStats();

      expect(stats.totalQueries).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    it('should calculate correct average response time', () => {
      agent.recordQueryMetrics({
        query: 'SELECT 1',
        duration: 10,
        rowsAffected: 0,
        rowsExamined: 0,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      agent.recordQueryMetrics({
        query: 'SELECT 2',
        duration: 20,
        rowsAffected: 0,
        rowsExamined: 0,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      const stats = agent.getPerformanceStats();
      expect(stats.avgResponseTime).toBe(15);
    });

    it('should calculate query distribution', () => {
      // Add different types of queries
      agent.recordQueryMetrics({
        query: 'SELECT * FROM users',
        duration: 10,
        rowsAffected: 5,
        rowsExamined: 5,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      agent.recordQueryMetrics({
        query: 'INSERT INTO users VALUES (?)',
        duration: 5,
        rowsAffected: 1,
        rowsExamined: 0,
        database: 'testdb',
        operation: 'INSERT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      agent.recordQueryMetrics({
        query: 'UPDATE users SET name = ?',
        duration: 8,
        rowsAffected: 1,
        rowsExamined: 1,
        database: 'testdb',
        operation: 'UPDATE',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      agent.recordQueryMetrics({
        query: 'DELETE FROM users WHERE id = ?',
        duration: 3,
        rowsAffected: 1,
        rowsExamined: 1,
        database: 'testdb',
        operation: 'DELETE',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      const stats = agent.getPerformanceStats();
      expect(stats.queryDistribution.select).toBe(1);
      expect(stats.queryDistribution.insert).toBe(1);
      expect(stats.queryDistribution.update).toBe(1);
      expect(stats.queryDistribution.delete).toBe(1);
    });

    it('should calculate top queries', () => {
      // Record multiple calls to same query pattern
      for (let i = 0; i < 5; i++) {
        agent.recordQueryMetrics({
          query: 'SELECT * FROM users WHERE id = ?',
          duration: 10,
          rowsAffected: 1,
          rowsExamined: 1,
          database: 'testdb',
          operation: 'SELECT',
          success: true,
          timestamp: Date.now(),
          connectionId: 'test-connection'
        });
      }

      for (let i = 0; i < 3; i++) {
        agent.recordQueryMetrics({
          query: 'INSERT INTO logs VALUES (?)',
          duration: 5,
          rowsAffected: 1,
          rowsExamined: 0,
          database: 'testdb',
          operation: 'INSERT',
          success: true,
          timestamp: Date.now(),
          connectionId: 'test-connection'
        });
      }

      const stats = agent.getPerformanceStats();
      expect(stats.topQueries.length).toBe(2);
      expect(stats.topQueries[0].count).toBe(5);
    });
  });

  describe('getRecentQueries', () => {
    beforeEach(async () => {
      await agent.init();
    });

    it('should return recent queries', () => {
      agent.recordQueryMetrics({
        query: 'SELECT * FROM users',
        duration: 10,
        rowsAffected: 1,
        rowsExamined: 1,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      const recentQueries = agent.getRecentQueries(10);
      expect(recentQueries.length).toBe(1);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        agent.recordQueryMetrics({
          query: `SELECT ${i}`,
          duration: 5,
          rowsAffected: 0,
          rowsExamined: 0,
          database: 'testdb',
          operation: 'SELECT',
          success: true,
          timestamp: Date.now(),
          connectionId: 'test-connection'
        });
      }

      const recentQueries = agent.getRecentQueries(5);
      expect(recentQueries.length).toBe(5);
    });

    it('should sort by timestamp descending', () => {
      const now = Date.now();

      agent.recordQueryMetrics({
        query: 'SELECT old',
        duration: 10,
        rowsAffected: 0,
        rowsExamined: 0,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: now - 1000,
        connectionId: 'test-connection'
      });

      agent.recordQueryMetrics({
        query: 'SELECT new',
        duration: 10,
        rowsAffected: 0,
        rowsExamined: 0,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: now,
        connectionId: 'test-connection'
      });

      const recentQueries = agent.getRecentQueries(10);
      expect(recentQueries[0].query).toBe('SELECT new');
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

  describe('startMonitoring / stopMonitoring', () => {
    it('should start monitoring', async () => {
      await agent.startMonitoring();
      const stats = agent.getPerformanceStats();
      expect(stats).toBeDefined();
    });

    it('should stop monitoring', async () => {
      await agent.startMonitoring();
      await agent.stopMonitoring();
      // No error should be thrown
    });
  });

  describe('stop', () => {
    it('should stop the agent', async () => {
      await agent.init();
      await agent.stop();
    });

    it('should clear metrics on stop', async () => {
      await agent.init();

      agent.recordQueryMetrics({
        query: 'SELECT * FROM users',
        duration: 10,
        rowsAffected: 1,
        rowsExamined: 1,
        database: 'testdb',
        operation: 'SELECT',
        success: true,
        timestamp: Date.now(),
        connectionId: 'test-connection'
      });

      await agent.stop();

      const recentQueries = agent.getRecentQueries(10);
      expect(recentQueries.length).toBe(0);
    });
  });
});

describe('createMySQLAgent', () => {
  it('should create a new MySQLAgent instance', () => {
    const agent = createMySQLAgent({ autoInit: false });
    expect(agent).toBeInstanceOf(MySQLAgent);
  });

  it('should pass configuration to the agent', () => {
    const agent = createMySQLAgent({
      slowQueryThreshold: 500,
      maxMetricsHistory: 2000,
      autoInit: false
    });
    expect(agent).toBeInstanceOf(MySQLAgent);
  });
});
