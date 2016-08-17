"use strict";

var async = require('async');
var _ = require('lodash');

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

    function registerStep(res, db, step) {
      var logs = db.logtr.translateAll(res.logs);
      runState.ds.supervisor.step(_.assign({
        from: co.from,
        data: co.data,
        pc: runState.programCounter,
        receipt: res,
        logs,
        className: db.className,
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
      })
      .get(['classId', 'constructorData','fabi', 'logtr']);
      runState.ds.expert.learnAddress(res.contractAddress, db.classId);

      var params = '';
      if(db.fabi) {
        var types = db.fabi.inputs.map(i => i.type)
        params = runState.ds.coder.decodeParams(types, db.constructorData).join(', ');
      }

      registerStep(res, db, {
        address: res.contractAddress,
        type: 'new',
        params
      })

      cb(null, new Buffer(res.contractAddress.slice(2), 'hex'))
    }

    function digestTxCall(res, cb) {
      var ctx = runState.ds.web3Interface;
      var rtcode = ctx.getCode(co.to);
      var db = runState.ds.expert
      .from({
        rtcode,
        address: co.to,
        function: co.data.slice(2,10)
      })
      .get(['fabi', 'className']);

      var params = runState.ds.coder.decodeParams(db.fabi.inputs.map(i => i.type), co.data.slice(10)).map(p => p.toString()).join(', ');

      registerStep(res, db, {
        to: co.to,
        fname: db.fabi.name,
        type: 'txr',
        params
      });

      cb(null, new Buffer([1]))
    }

    function handleReceipt (res, cb) {
      if( res.contractAddress ) {
        digestDeploy(res, cb);
      } else {
        digestTxCall(res, cb);
      }
    }

    // TODO - global persistant step object
    if(runState.ds.supervisor.processState === '1.3') {
      var nextStep = runState.ds.supervisor.getNextStep();
      co.gas = nextStep.receipt.gasUsed;
    }

    var toConfirmTx = 'confirmationBlocks' in runState.ds.chainenv
                      && runState.ds.chainenv.confirmationBlocks > 0;
    var ctx = runState.ds.web3Interface;
    var sendTx = ctx.tx.bind(ctx, co);
    var confirmTx = ctx.confirmTx.bind(ctx);

    var tasks = [];
    tasks.push(sendTx);
    if(runState.ds.supervisor.processState !== '1.1' && toConfirmTx) tasks.push(confirmTx);
    tasks.push(handleReceipt.bind(this));

    async.waterfall(tasks, function (err, res) {
      if(err) return callback(err, new Buffer([0]));
      callback(err, res)
    });

  }
}
