import { Queue as BullQueue } from 'bullmq';
import type { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { CAMPAIGN_SEND_QUEUE_NAME } from './campaign-send.constants';
import { SEQUENCE_DISPATCH_QUEUE_NAME } from '../sequences/sequence-dispatch.constants';

export function getBullmqConnectionConfig(): {
  host: string;
  port: number;
  username?: string;
  password?: string;
} {
  const raw = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const u = new URL(raw);
  const port = u.port ? Number(u.port) : 6379;
  const cfg: { host: string; port: number; username?: string; password?: string } = {
    host: u.hostname,
    port,
  };
  if (u.username) {
    cfg.username = decodeURIComponent(u.username);
  }
  if (u.password) {
    cfg.password = decodeURIComponent(u.password);
  }
  return cfg;
}

/** Dedicated Redis client for rate limiting (separate from BullMQ connection config). */
export function createRateLimitRedis(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
  });
}

export function createCampaignSendQueue(): Queue {
  return new BullQueue(CAMPAIGN_SEND_QUEUE_NAME, {
    connection: getBullmqConnectionConfig(),
  });
}

export function createSequenceDispatchQueue(): Queue {
  return new BullQueue(SEQUENCE_DISPATCH_QUEUE_NAME, {
    connection: getBullmqConnectionConfig(),
  });
}
