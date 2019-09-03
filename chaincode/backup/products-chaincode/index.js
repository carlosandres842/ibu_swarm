'use strict';

const changeOwnerContract = require('./changeOwnerContract/changeOwnerContract');
const createProductContract = require('./createProductContract/createProductContract');
const queryContract = require('./queryContract/queryContract');
const walletsContract = require('./walletsContract/walletsContract');
module.exports.contracts = [changeOwnerContract,createProductContract,queryContract,walletsContract];