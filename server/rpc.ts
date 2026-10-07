import { ensureReady, get } from './db';
import { initDatabase } from './seed';
import { handlers, registerHandlers } from './handlers';
import { issueToken, verifyToken } from './auth';

registerHandlers();

/** Channels whose first client argument is the acting user's id — replaced with the token's user. */
const ACTOR_FIRST = new Set([
  'users:create', 'users:setActive', 'users:resetPassword', 'buildings:save', 'buildings:delete', 'rooms:save', 'rooms:delete',
  'areas:save', 'areas:delete', 'equipment:create', 'equipment:update', 'equipment:delete', 'contractors:save', 'contractors:delete',
  'suppliers:save', 'suppliers:delete', 'pannes:create', 'pannes:assign', 'pannes:setStatus', 'pannes:diagnosis', 'pannes:intervention',
  'pannes:costs', 'pannes:addPart', 'pannes:removePart', 'pannes:addPhoto', 'inventory:save', 'inventory:delete', 'inventory:receive',
  'inventory:adjust', 'purchaseOrders:create', 'purchaseOrders:receive', 'maintenanceSchedules:save', 'maintenanceSchedules:delete',
  'maintenanceSchedules:complete', 'handovers:add', 'reports:frequency', 'reports:rooms', 'reports:equipment', 'reports:costs',
  'reports:technicians', 'reports:resolutionTime', 'reports:auditLog', 'settings:set', 'backup:create', 'backup:restore',
]);

export class RpcError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Runs one API call. Throws RpcError for auth problems; other errors are user-facing messages. */
export async function dispatch(method: string, args: unknown, token: string | null): Promise<any> {
  await ensureReady(initDatabase);
  const handler = handlers[method];
  if (!handler || !Array.isArray(args)) throw new RpcError('Requête invalide.', 400);

  if (method === 'auth:login') {
    const user = await handler({ actorId: null }, ...args);
    return { ...user, token: issueToken(user.id) };
  }

  const actorId = verifyToken(token);
  if (actorId == null) throw new RpcError('Session expirée. Reconnectez-vous.', 401);
  const actor = await get<{ active: number }>('SELECT active FROM users WHERE id = ?', [actorId]);
  if (!actor?.active) throw new RpcError('Compte désactivé. Reconnectez-vous.', 401);

  const callArgs = ACTOR_FIRST.has(method) ? [actorId, ...args.slice(1)] : args;
  return handler({ actorId }, ...callArgs);
}
