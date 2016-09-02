'use strict';

var _ = require('lodash');
var VM = require('dapple-wevm');
var LogTranslator = require('dapple-core/logtranslator.js');
var utils = require('web3/lib/utils/utils.js');
var sha3 = require('web3/lib/utils/sha3.js');
var Expert = require('./expert.js');
var iface = require('./iface.js');
var async = require('async');


var runwevm = (opts, cb) => {
  var vm = new VM(null, null, {
    enableHomestead: true
  });
  var expert = new Expert();
  var process_logs = [];

  expert.learn(opts.classes);
  // TODO - save other nessecery information on a contract
  //        source code on a contract type can differ
  //        therefore we need to save everything including
  //        the binary and abi in order to recognize its type
  //        propperly
  //        hence we need to save it
  // var n2id = _.invert(expert.classid_to_classname);
  // _.each(opts.chainenv.env, (obj, name) => {
  //   if(obj.type in opts.classes > -1 && obj.type in n2id) {
  //     expert.learnAddress(obj.value, n2id[obj.type]);
  //   }
  // });

  var logStep = (runState, log) => {
    switch (log.event) {
      case 'setCalls':
        // TODO - beware of throws!!
        runState.ds.callFlag = log.args.flag;
        break;
      case 'setOrigin':
        // TODO - check if user owns account
        //      - if not, warn and fake
        runState.ds.origin = log.args.origin;
        runState.ds.logs.push({
          type: 'acc',
          log: `ACC   switch origin to ${log.args.origin}`
        });
        break;
      default:
        if( !(/^export/.test(log.event)) ) {
          runState.ds.supervisor.step({
            type: 'log',
            log: log,
            pc: runState.programCounter,
            simulation: runState.ds.simulation
          });
        }
        return false;
    }
    return true;
  }

  // TODO - make an interface check
  if(!(opts.scriptname in opts.classes)) {
    console.log(`Error: "${opts.scriptname}" is not a script.`);
    process.exit(1);
  }
  const scriptobject = opts.classes[opts.scriptname];

  var logtranslator = new LogTranslator(JSON.parse(scriptobject.interface));
  // console.log(opts.classes.SH);
  // TODO - a lot of modules in here
  var modules = {
    // "SH": sha3(opts.classes["SH"].bytecode)
  };

  vm.runCode({
    code: new Buffer(scriptobject.bytecode, 'hex'),
    gasLimit: new Buffer('ffffffff', 'hex'),
    caller: new Buffer(opts.chainenv.defaultAccount.slice(2), 'hex'),
    ds: {
      origin: opts.chainenv.defaultAccount,
      logtranslator,// TODO - deprecated?
      callFlag: false,
      web3: opts.web3Interface._web3,
      web3Interface: opts.web3Interface,
      chainenv: opts.chainenv,
      iface,
      supervisor: opts.supervisor,
      logStep,
      expert,
      modules,
      simulation: opts.simulation,
      logs: process_logs// TODO - deprecated?
    }
  }, function (err, receipt) {
    if(err) return cb(err);
    if (typeof opts.web3Interface._web3.currentProvider.stop === 'function') {
      opts.web3Interface._web3.currentProvider.stop();
    }

    var logs = [];

    for (var i = 0; i < receipt.logs.length; i++) {
      var log = receipt.logs[i];
      var address = '0x'+log[0].toString('hex');
      var topics = []

      for (var j = 0; j < log[1].length; j++) {
        topics.push('0x'+log[1][j].toString('hex'));
      }

      var data = '0x'+log[2].toString('hex');

      logs.push({
        logIndex: i.toString(16),
        transactionIndex: "0x0",
        address: address,
        data: data,
        topics: topics,
        type: "mined"
      });
    }
    var llogs = logtranslator.translateAll(logs);

    var tasks = llogs
    .filter(llog => llog.event === 'exportObject')
    .map(llog => {
      return (cb) => {
        var ctx = opts.web3Interface;
        ctx.getCode(llog.args.addr, (err, res) => {
          var rtcode = res.slice(2);
          var className = expert
          .from({
            address: llog.args.addr,
            rtcode: rtcode
          }).contract.name;
          if(!className) className = "address";
          llog.args.class = className;
          cb();
        });
      }
    });

    async.parallel(tasks, () => {
      cb(null, {
        process_logs,
        logs: llogs
      });
    });
    // console.log('\n\n\n');
    // console.log(llogs.map(log => `${log.event}(${_.map(log.args, (v, k) => {return k + ' ' + v}).join(', ')})`).join('\n'));
  });
};

module.exports = runwevm;
