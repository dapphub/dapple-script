"use strict";

var async = require('async');
var _ = require('lodash');
var BN = require('ethereumjs-util').BN;

module.exports = {

  performStaticCall: function (runState, co, localOpts, cb) {
    runState.ds.web3Interface._web3.eth.call(co, (err, result) => {
      if (err || !result) return cb(err, new Buffer([0]));
      var hex = result.slice(2);
      if(hex === '0') hex += '0';
      var _return = new Buffer(hex, 'hex');
      for (var i = 0; i < Math.min(localOpts.outLength, _return.length); i++) {
        runState.memory[localOpts.outOffset + i] = _return[i]
      }

      var ctx = runState.ds.web3Interface;
      ctx.getCode(co.to, (err, res) => {
        var rtcode = res.slice(2);
        var db = runState.ds.expert
        .from({
          rtcode,
          address: co.to,
          function: co.data.slice(2,10)
        });
        // .get(['fabi', 'className']);

        var params = '';
        var result = '';
        // TODO - export to contract
        if(db.fabi) {
          params = db.fabi.decodeInputs(co.data.slice(10)).join(', ');
          result = db.fabi.decodeOutputs(_return.toString('hex'));
          result = _.map(db.fabi.outputs, ( o, i ) => _.assign(o, {value: result[i]}));
        }
        runState.ds.supervisor &&
        runState.ds.supervisor.step({
          from: co.from,
          data: co.data,
          to: co.to,
          pc: runState.programCounter,
          className: db.contract.name,
          simulation: runState.ds.simulation,
          type: 'get',
          fname: db.fabi && db.fabi.name || '',
          params,
          result
        });
        cb(err, new Buffer([1]))
      })
    });
  },

  performLibraryCall: function (runState, co, localOpts, cb) {
    var fabi = runState.ds.expert
    .from({
      address: co.to,
      function: co.data.slice(2,10)
    }).fabi;
    var params = fabi.decodeInputs(co.data.slice(10));
    var inputObject = _.assign.apply(this, fabi.inputs.map((i,j) => ({[i.name]: params[j]})));

    runState.ds.libs[co.to].methods[fabi.name].handler(inputObject, (err, res, gas) => {
      var resArray = _.map(fabi.outputs, o => res[o.name]);
      var _return = new Buffer(fabi.encodeOutputs([parseInt(resArray)]),'hex');
      try {
        for (var i = 0; i < localOpts.outLength; i++) {
          if(i < _return.length) {
            runState.memory[localOpts.outOffset + i] = _return[i];
          } else {
            runState.memory[localOpts.outOffset + i] = 0
          }
        }
      } catch(e) {
        console.log('error',e);
      }
      cb(null, gas, new Buffer([1]));
    });
  },

  performTransaction: function (runState, co, callback) {
    // TODO - build a knowledge engine around this
    if(co.to === '0x0000000000000000000000000000000000000000') {
      console.log(`ERR: you are sending a transaction to ${co.to}, maybe some environment value is not set correctly. This is currently not supported! Aborting.`);
      process.exit(1);
    }
    var gasPrice = 0;

    function registerStep(res, db, step) {
      var logs = db.contract && db.contract.logtr.translateAll(res.logs) || [];
      runState.ds.supervisor &&
      runState.ds.supervisor.step(_.assign({
        from: co.from,
        data: co.data,
        pc: runState.programCounter,
        receipt: res,
        logs,
        className: db.contract && db.contract.name || "address",
        simulation: runState.ds.simulation
      }, step));
    }

    // @param co call object - gas, data, to, value, etc...
    // @param res receipt object
    function digestDeploy(res, cb) {
      var db = runState.ds.expert
      .from({
        code: co.data,
        function: 'constructor'
      });
      runState.ds.expert.learnAddress(res.contractAddress, db.contract.classId, runState.ds.web3Interface.chainenv.type);

      var params = '';
      if(db.fabi) {
        params = db.fabi.decodeInputs(db.constructorData).join(', ');
        // var types = db.fabi.inputs.map(i => i.type)
      }

      registerStep(res, db, {
        address: res.contractAddress,
        type: 'new',
        params
      })

      // TODO - gas * gasPrice
      cb(null, res.gasUsed, new Buffer(res.contractAddress.slice(2), 'hex'));
    }

    function digestTxCall(res, cb) {
      var ctx = runState.ds.web3Interface;
      ctx.getCode(co.to, (err, code) => {
        var rtcode = code.slice(2);
        var db = runState.ds.expert
        .from({
          rtcode,
          address: co.to,
          function: co.data.slice(2,10)
        });
        // .get(['fabi', 'className']);

        var params = '';
        if(db.fabi) {
          params = db.fabi.decodeInputs(co.data.slice(10));
        }

        registerStep(res, db, {
          to: co.to,
          fname: db.fabi && db.fabi.name || '',
          type: 'txr',
          params
        });

        cb(null, res.gasUsed, new Buffer([1]))
      })
    }

    function handleReceipt (res, cb) {
      if( res.contractAddress ) {
        digestDeploy(res, cb);
      } else {
        digestTxCall(res, cb);
      }
    }

    // TODO - global persistant step object
    if( runState.ds.supervisor && runState.ds.supervisor.processState === '1.3') {
      var nextStep = runState.ds.supervisor.getNextStep();
      co.gas = nextStep.receipt.gasUsed;
    }

    // TODO - export tx confirmations to web3Interface
    var toConfirmTx = 'confirmationBlocks' in runState.ds.web3Interface.chainenv
                      && runState.ds.web3Interface.chainenv.confirmationBlocks > 0;
    var ctx = runState.ds.web3Interface;
    var sendTx = ctx.tx.bind(ctx, co);
    var confirmTx = ctx.confirmTx.bind(ctx);
    // var getGasPrice = ctx._web3.eth.getGasPrice.bind(ctx._web3.eth);
    // var rememberGasPrice = (_gasPrice, cb) => {
    //   gasPrice = new BN(_gasPrice);
    //   cb();
    // }

    var tasks = [];
    // tasks.push(getGasPrice);
    // tasks.push(rememberGasPrice);
    tasks.push(sendTx);
    if( runState.ds.supervisor && runState.ds.supervisor.processState !== '1.1' && toConfirmTx) tasks.push(confirmTx);
    tasks.push(handleReceipt.bind(this));

    async.waterfall(tasks, function (err, gas, res) {
      if(err) return callback(err, new Buffer([0]));
      callback(err, gas, res)
    });
  },

  getBalance: function (runState, address, cb) {
    runState.ds.web3Interface._web3.eth.getBalance( address, (err, res) => {
      cb(err, res);
    });
  }
}
