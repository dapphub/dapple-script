"use strict";

var _ = require('lodash');
var utils = require('web3/lib/utils/utils.js');
var sha3 = require('web3/lib/utils/sha3.js');
var LogTranslator = require('dapple-core/logtranslator.js');
var Contract = require('dapple-core/contract.js');


class Expert {
  constructor () {
    // This is needed to infer class names of deployed contracts
    // TODO - replace it with prefix trie structure
    this.sources = [];

    this.classid_to_contract = {};
    this.rtcodeid_to_contract = {};
    this.address_to_contract = {};
  }

  learn(classes) {
    _.each(classes, (json, name) => {
      let classId = sha3(json.bytecode);
      let rtcodeId = sha3(json.bin_runtime);
      let contract = new Contract(json, name);
      this.sources.push(json.bytecode);

      this.classid_to_contract[classId] = contract;
      this.rtcodeid_to_contract[rtcodeId] = contract;

    });
  }

  learnAddress(addr, classId) {
    this.address_to_contract[addr] = this.classid_to_contract[classId];
  }

  from(ctx) {
    if('address' in ctx) {
      if(ctx.address in this.address_to_contract) {
        ctx.contract = this.address_to_contract[ctx.address];
      } else {
        let rtcodeId = sha3(ctx.rtcode);
        if(rtcodeId in this.rtcodeid_to_contract) {
          ctx.contract = this.rtcodeid_to_contract[rtcodeId];
        } else {
          console.log('WARN: expoert could not reason about '+ ctx.address);
        }
      }
    }

    if('rtcodeId' in ctx) {
      ctx.contract = this.rtcodeid_to_contract[ctx.rtcodeId];
      ctx.classId = ctx.contract.classId;
    }

    if('classId' in ctx) {
      ctx.contract = this.classid_to_contract[ctx.classId];
    }

    if('code' in ctx) {
      this.sources.forEach(code => {
        if(ctx.code.indexOf(code) === 2) {
          let classId = sha3(code);
          ctx.contract = this.classid_to_contract[classId];
          ctx.constructorData = ctx.code.slice(code.length - ctx.code.length + 2);
        }
      });
    }

    if('function' in ctx) {
      ctx.fabi = ctx.contract.signatures_to_fabi[ctx['function']];
      if(typeof ctx.fabi === 'function') {
        ctx.fabi = null;
      }
    }

    return ctx;
  }

}

module.exports = Expert;
