'use strict';
const { listBehaviorTypes } = require('../behavior-engine/registry');
const grammar = require('../visual-grammar/grammar');
const stringArray = { type: 'array', items: { type: 'string' } };

const scriptPlanSchema = { type: 'object', required: ['summary', 'characters', 'actions', 'mood', 'location'], additionalProperties: false,
  properties: { summary: { type: 'string', minLength: 1 }, characters: stringArray, actions: stringArray,
    mood: { type: 'string' }, location: { type: ['string', 'null'] } } };

const scenePlanSchema = { type: 'object', required: ['background', 'character', 'camera', 'characterAnimation', 'transition'], additionalProperties: false,
  properties: { background: { type: ['string', 'null'] }, character: stringArray,
    camera: { type: 'string', enum: Object.keys(grammar.CAMERA) },
    characterAnimation: { type: 'string', enum: Object.keys(grammar.CHARACTER_ANIM) },
    transition: { type: 'string', enum: Object.keys(grammar.TRANSITIONS) } } };

const behaviorSchema = { type: 'object', required: ['behaviorId', 'type', 'timing', 'parameters'],
  properties: { behaviorId: { type: 'string', minLength: 1 }, type: { type: 'string', enum: listBehaviorTypes() },
    actor: { type: ['string', 'null'] }, target: { type: ['string', 'null'] }, parameters: { type: 'object' },
    timing: { type: 'object', required: ['start', 'end'], properties: { start: { type: 'number', minimum: 0 }, end: { type: 'number', minimum: 0 } } },
    priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] }, dependsOn: stringArray, conflictsWith: stringArray,
    interruptible: { type: 'boolean' }, reason: { type: ['string', 'null'] }, beatId: { type: ['string', 'null'] } } };
const behaviorPlanSchema = { type: 'object', required: ['behaviors'], properties: { behaviors: { type: 'array', items: behaviorSchema } } };

module.exports = { scriptPlanSchema, scenePlanSchema, behaviorPlanSchema };
