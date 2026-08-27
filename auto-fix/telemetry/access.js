'use strict';

const ROLES = Object.freeze(['admin', 'viewer']);
const ACTIONS = Object.freeze(['read', 'write', 'delete', 'prune']);

function authorize(role, action) {
  if (!ROLES.includes(role)) throw new Error(`invalid role: ${role}`);
  if (!ACTIONS.includes(action)) throw new Error(`invalid action: ${action}`);
  if (role === 'admin') return true;
  if (role === 'viewer' && action === 'read') return true;
  return false;
}

module.exports = { ROLES, ACTIONS, authorize };