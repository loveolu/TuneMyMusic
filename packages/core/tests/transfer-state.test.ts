import { describe, it, expect } from 'vitest';
import { TransferStateMachine } from '../src/transfer/transfer-state.js';

describe('TransferStateMachine', () => {
  it('starts in PENDING state', () => {
    const sm = new TransferStateMachine();
    expect(sm.status).toBe('PENDING');
  });

  it('transitions PENDING → QUEUED', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    expect(sm.status).toBe('QUEUED');
  });

  it('transitions through full happy path', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('PROCESSING');
    sm.transition('MATCHING');
    sm.transition('IMPORTING');
    sm.transition('COMPLETED');
    expect(sm.status).toBe('COMPLETED');
  });

  it('allows CANCELLED from any active state', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('PROCESSING');
    sm.transition('CANCELLED');
    expect(sm.status).toBe('CANCELLED');
  });

  it('allows FAILED from any active state', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('FAILED');
    expect(sm.status).toBe('FAILED');
  });

  it('throws on invalid transition', () => {
    const sm = new TransferStateMachine();
    expect(() => sm.transition('COMPLETED')).toThrow();
  });

  it('throws when transitioning from terminal state', () => {
    const sm = new TransferStateMachine();
    sm.transition('QUEUED');
    sm.transition('FAILED');
    expect(() => sm.transition('PROCESSING')).toThrow();
  });
});
