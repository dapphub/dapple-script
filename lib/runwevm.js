'use strict';

var _ = require('lodash');
var VM = require('dapple-wevm');
var LogTranslator = require('dapple-core/logtranslator.js');
var utils = require('web3/lib/utils/utils.js');
var sha3 = require('web3/lib/utils/sha3.js');
var Expert = require('./expert.js');
var iface = require('./iface.js');
var async = require('async');
var Web3Interface = require('dapple-core/web3Interface.js');


var runwevm = (opts, cb) => {
  var vm = new VM(null, null, {
    enableHomestead: true
  });
  var expert = new Expert();
  var process_logs = [];

  // var libs = {
  //   '0x007202eeaad2c871c74c094231d1a4d28028321b': {
  //     classid: sha3(opts.classes["System"].bytecode),
  //     methods: {
  //       "to_uint": {
  //         inputs: [ { name: 'input', type: 'string' } ],
  //         outputs: [ { name: 'output', type: 'uint256' } ],
  //         handler: (obj, cb) => {
  //           var res = require('child_process').execSync(obj.input);
  //           // TODO - compute gas costs
  //           cb(null, {
  //             output: res
  //           }, 400000);
  //         }
  //       }
  //     }
  //   },
  //   '0x0000000000000000000000000000000000000002': {
  //     classid: sha3(opts.classes["SMS"].bytecode),
  //     methods: {
  //       send: {
  //         handler: (obj, cb) => {
  //           console.log(obj);
  //           cb();
  //         }
  //       }
  //     }
  //   },
  // };

  expert.learn(opts.classes);
  // _.each(libs, (lib, address) => expert.learnAddress(address, lib.classid, 'service'));

  _.each(opts.chainenv.env, (obj, name) => {
    if( obj.type.indexOf('[') == -1) {
      if(obj.type in opts.classes > -1) {
        var classid = sha3(opts.classes[obj.type].bytecode);
        expert.learnAddress(obj.value, classid, opts.chainenv.typ);
      }
    } else {
      let type = obj.type.split('[')[0];
      let classid = /.*\[(.*)\]/.exec(obj.type)[1];
      // TODO - check if deployed contract is known contract
      if(type in opts.classes > -1 && classid in expert.classid_to_contract) {
        expert.learnAddress(obj.value, classid, opts.chainenv.typ);
      }
    }
  });

  var logStep = (runState, log, cb) => {
    switch (log.event) {
      case 'setCalls':
        // TODO - beware of throws!!
        runState.ds.callFlag = log.args.flag;
        return cb(null, true);
        break;
      case 'setOrigin':
        // TODO - check if user owns account
        //      - if not, warn and fake
        runState.ds.origin = log.args.origin;
        runState.ds.logs.push({
          type: 'acc',
          log: `ACC   switch origin to ${log.args.origin}`
        });
        return cb(null, true);
        break;
      case 'pushEnv':
        opts.state.getRemoteWeb3Interface(utils.toAscii(log.args.env), (err, web3, chainenv) => {
          new Web3Interface({ chainenv }, web3, (err, web3Interface) => {
            web3Interface.runFilter();
            runState.ds.origin = chainenv.defaultAccount;
            // runState.address = runState.caller = new Buffer(chainenv.defaultAccount.slice(2), 'hex');
            runState.ds.web3Interface = web3Interface;
            runState.ds.envs.push(web3Interface);
            cb(null, true);
          });
        });
        break;
      case 'popEnv':
        // TODO: Test is env is last, if yes, thant throw
        var web3Interface = runState.ds.envs.pop();
        web3Interface.stopFilter();
        runState.ds.web3Interface = runState.ds.envs[runState.ds.envs.length - 1];
        return cb(null, true);
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
        return cb(null, false);
    }
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
    // "System": sha3(opts.classes["System"].bytecode)
  };

//   vm.on('step', function (data) {
//     var format = (what) => {
//       var _tmp = what.map(m => utils.toHex(m).slice(2)).map(m => m.length ==0? '00': (m.length==1?"0"+m:m));
//       return _tmp.map( (m,i) => i%32 == 0 ? '\n'+m : (i%2==0? ' '+m: m) ).join('');
//     }
//     // console.log(`\n`);
//     // console.log(`ADDRESS: ${data.address.toString("hex")}`);
//     console.log(`${data.opcode.name} PC: ${data.pc}`);
//     // console.log(`STACK: \n${data.stack.map(s=>s.toString("hex")).map(s=>s.length==0?"0x00":"0x"+s).reverse().map((s,i)=>i+" "+s).join('\n')}`);
//     // console.log(`MEMORY: \n`, format(data.memory));
//  })

  vm.runCode({
    code: new Buffer(scriptobject.bytecode, 'hex'),
    gasLimit: new Buffer('ffffffff', 'hex'),
    caller: new Buffer(opts.chainenv.defaultAccount.slice(2), 'hex'),
    ds: {
      origin: opts.chainenv.defaultAccount,
      callFlag: false,
      web3Interface: opts.web3Interface,
      envs: [opts.web3Interface],
      iface,
      supervisor: opts.supervisor,
      logStep,
      expert,
      modules,
      simulation: opts.simulation,
      logs: process_logs,
      libs: {}
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
          var contract = expert
          .from({
            address: llog.args.addr,
            rtcode: rtcode
          }).contract;
          if(!contract) className = "address";
          llog.args.type = `${contract.name}[${contract.classId}]`;
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
