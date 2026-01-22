// =============================================================================
// src/config/queues.ts
// BullMQ Queue Configuration
// =============================================================================

import { Queue, QueueOptions } from 'bullmq';
import { redisOptions } from './redis.js';

// =============================================================================
// Queue Names
// =============================================================================

export const QUEUE_NAMES = {
  EVENTS: 'events',
  ROUTING: 'routing',
  SYNC: 'sync',
  SCHEDULED: 'scheduled',
  NOTIFICATIONS: 'notifications'
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// =============================================================================
// Default Queue Options
// =============================================================================

const defaultQueueOptions: QueueOptions = {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60 // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 60 * 60 // 7 days
    }
  }
};

// =============================================================================
// Queue Instances
// =============================================================================

const queues: Map<QueueName, Queue> = new Map();

export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, defaultQueueOptions);
    queues.set(name, queue);
  }
  return queues.get(name)!;
}

// =============================================================================
// Initialize All Queues
// =============================================================================

export function initializeQueues(): Map<QueueName, Queue> {
  for (const name of Object.values(QUEUE_NAMES)) {
    getQueue(name);
  }
  console.log('✅ All BullMQ queues initialized');
  return queues;
}

// =============================================================================
// Close All Queues
// =============================================================================

export async function closeQueues(): Promise<void> {
  for (const [name, queue] of queues) {
    await queue.close();
    console.log(`Queue ${name} closed`);
  }
  queues.clear();
}

// =============================================================================
// Convenience Exports
// =============================================================================

export const getEventsQueue = () => getQueue(QUEUE_NAMES.EVENTS);
export const getRoutingQueue = () => getQueue(QUEUE_NAMES.ROUTING);
export const getSyncQueue = () => getQueue(QUEUE_NAMES.SYNC);
export const getScheduledQueue = () => getQueue(QUEUE_NAMES.SCHEDULED);
export const getNotificationsQueue = () => getQueue(QUEUE_NAMES.NOTIFICATIONS);
