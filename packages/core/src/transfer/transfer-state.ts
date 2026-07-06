import type { TransferStatus } from '@tunemymusic/types';

const VALID_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  PENDING: ['QUEUED', 'CANCELLED', 'FAILED'],
  QUEUED: ['PROCESSING', 'CANCELLED', 'FAILED'],
  PROCESSING: ['MATCHING', 'CANCELLED', 'FAILED'],
  MATCHING: ['IMPORTING', 'CANCELLED', 'FAILED'],
  IMPORTING: ['COMPLETED', 'CANCELLED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export class TransferStateMachine {
  private _status: TransferStatus = 'PENDING';

  get status(): TransferStatus {
    return this._status;
  }

  transition(to: TransferStatus): void {
    const allowed = VALID_TRANSITIONS[this._status];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid transition: ${this._status} → ${to}`);
    }
    this._status = to;
  }

  get isTerminal(): boolean {
    return VALID_TRANSITIONS[this._status].length === 0;
  }
}
