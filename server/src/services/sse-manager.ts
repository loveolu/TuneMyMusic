import { EventEmitter } from 'events';
import type { FastifyReply } from 'fastify';
import type { TransferProgress } from '@tunemymusic/types';

class SSEManager extends EventEmitter {
  private clients = new Map<string, Set<FastifyReply>>();

  addClient(transferId: string, res: FastifyReply): void {
    if (!this.clients.has(transferId)) {
      this.clients.set(transferId, new Set());
    }
    this.clients.get(transferId)!.add(res);
  }

  removeClient(transferId: string, res: FastifyReply): void {
    const clientSet = this.clients.get(transferId);
    if (clientSet) {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.clients.delete(transferId);
      }
    }
  }

  sendEvent(transferId: string, event: TransferProgress): void {
    const clientSet = this.clients.get(transferId);
    if (!clientSet || clientSet.size === 0) {
      // Emit to internal event bus as well for any listeners
      this.emit(`progress:${transferId}`, event);
      return;
    }

    const data = `data: ${JSON.stringify(event)}\n\n`;
    const deadClients: FastifyReply[] = [];

    for (const res of clientSet) {
      try {
        res.raw.write(data);
      } catch {
        deadClients.push(res);
      }
    }

    for (const dead of deadClients) {
      this.removeClient(transferId, dead);
    }

    this.emit(`progress:${transferId}`, event);
  }
}

export const sseManager = new SSEManager();
