"use strict";

var _ = require('lodash');
var utils = require('web3/lib/utils/utils.js');
var sha3 = require('web3/lib/utils/sha3.js');

class Expert {
  constructor () {
    // This is needed to infer class names of deployed contracts
    this.sources = [];
    this.class_x_function_to_object = {};
    this.address_to_classId = {};
    this.classid_to_classname = {};
  }

  learn(classes) {
    _.each(classes, (json, name) => {
      let classId = sha3(json.bytecode);
      this.sources.push(json.bytecode);
      this.class_x_function_to_object[classId] = {};
      this.classid_to_classname[classId] = name;

      JSON.parse(json.interface)
      .filter(json => json.type !== 'constructor')
      .forEach(abi => {
        var fname = utils.transformToFullName(abi);
        this.class_x_function_to_object[classId][sha3(fname).slice(0,8)] = abi;
      });
      var constructor =
        JSON.parse(json.interface)
        .find(abi => abi.type === 'constructor');
        if(!!constructor) this.class_x_function_to_object[classId]['constructor'] = constructor;
    });
  }

  learnAddress(addr, classId) {
    this.address_to_classId[addr] = classId;
  }

  from(ctx) {
    if('address' in ctx) {
      ctx.classId = this.address_to_classId[ctx.address];
    }

    if('classId' in ctx) {
      ctx.className = this.classid_to_classname[ctx.classId];
    }

    if('code' in ctx) {
      this.sources.forEach(code => {
        if(ctx.code.indexOf(code) === 2) {
          ctx.classId = sha3(code);
          ctx.className = this.classid_to_classname[ctx.classId];
          ctx.constructorData = ctx.code.slice(code.length - ctx.code.length + 2);
        }
      });
    }

    return {
      get: (objects) => {
        if( !Array.isArray(objects) ) objects = [objects];
        for (let goal in objects) {
          switch(objects[goal]){
            case "fabi":
              // class function
              if('classId' in ctx && 'function' in ctx) {
                if(!( ctx.classId in this.class_x_function_to_object )) {
                  console.log(`WARN: don't know about ${ctx.classId}`);
                  continue;
                }
                if(!( ctx.function in this.class_x_function_to_object[ctx.classId] )) {
                  console.log(`WARN: don't know about function ${ctx.function} in ${ctx.classId}`);
                  continue;
                }
                ctx.fabi = this.class_x_function_to_object[ctx.classId][ctx.function];
              }
              break;
            case "className": break;
            case "classId": break;
            case "constructorData": break;
            default:
              console.log(`WARN: can't reasob about ${objects[goal]}`);
          }
        }
        if(objects.length == 1) return ctx[objects[0]];
        return ctx;
      }
    };
  }

}

module.exports = Expert;
