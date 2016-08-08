"use strict";

var async = require('async');

module.exports = {

  performStaticCall: function (runState, co, localOpts, cb) {
    runState.ds.web3Interface._web3.eth.call(co, (err, result) => {
      if (err || !result) cb(err, new Buffer([0]));
      var _return = new Buffer(result.slice(2),'hex');
      for (var i = 0; i < Math.min(localOpts.outLength, _return.length); i++) {
        runState.memory[localOpts.outOffset + i] = _return[i]
      }
      cb(err, new Buffer([1]))
    });
  },

  performLibraryCall: function (runState, co, localOpts, cb) {
    var functionAbi = runState.ds.expert
    .from({
      classId: runState.ds.modules['SH'],
      function: co.data.slice(2,10)
    })
    .get("fabi");
    var params = runState.ds.coder.decodeParams(functionAbi.inputs.map(i => i.type), co.data.slice(10)).map(p => p.toString());
    var _ret = require('child_process').execSync(params[0]);
    var _return = new Buffer(runState.ds.coder.encodeParam('uint256', parseInt(_ret)),'hex');
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
    cb(null, new Buffer([1]));
  },

  performTransaction: function (runState, co, callback) {

    var handleReceipt = (co, res, cb) => {

      if( res.contractAddress ) {
        var db = runState.ds.expert
        .from({
          code: co.data,
          function: 'constructor'
        })
        .get(['classId', 'constructorData','fabi', 'logtr']);
        runState.ds.expert.learnAddress(res.contractAddress, db.classId);

        var types = db.fabi.inputs.map(i => i.type)
        var params = runState.ds.coder.decodeParams(types, db.constructorData).join(', ');

        var logs = db.logtr.translateAll(res.logs);
        runState.ds.supervisor.step({
          from: co.from,
          data: co.data,
          pc: runState.programCounter,
          receipt: res,
          type: 'new',
          className: db.className,
          params,
          address: res.contractAddress,
          logs,
          simulation: runState.ds.simulation
        });

        cb(null, new Buffer(res.contractAddress.slice(2), 'hex'))
      } else {
        var db = runState.ds.expert
        .from({
          address: co.to,
          function: co.data.slice(2,10)
        })
        .get(['fabi', 'className']);

        var params = runState.ds.coder.decodeParams(db.fabi.inputs.map(i => i.type), co.data.slice(10)).map(p => p.toString()).join(', ');

        var logs = db.logtr.translateAll(res.logs);
        runState.ds.supervisor.step({
          from: co.from,
          data: co.data,
          pc: runState.programCounter,
          receipt: res,
          type: 'txr',
          params,
          className: db.className,
          to: co.to,
          logs,
          fname: db.fabi.name,
          params,
          simulation: runState.ds.simulation
        });

        cb(null, new Buffer([1]))
      }
    }

    var nextStep = runState.ds.supervisor.getNextStep();
    if(nextStep) {
      co.gas = nextStep.receipt.gasUsed;
    }

    var ctx = runState.ds.web3Interface;
    var sendTx = ctx.tx.bind(ctx, co);
    var confirmTx = ctx.confirmTx.bind(ctx);

    // TODO - estimate gas
    var tasks = [
      sendTx,
      confirmTx, // TODO - check address on code
      handleReceipt.bind(this, co)
    ];

    async.waterfall(tasks, function (err, res) {
      if(err) return callback(err, new Buffer([0]));
      callback(err, res)
    });

  }
}
