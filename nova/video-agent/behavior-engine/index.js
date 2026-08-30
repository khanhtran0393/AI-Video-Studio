'use strict';
const registry = require('./registry');
const schema = require('./schema');
const validator = require('./validator');
const resolver = require('./resolver');
const executor = require('./executor');
const legacy = require('./legacy');
module.exports = { ...registry, ...schema, ...validator, ...resolver, ...executor, ...legacy };
