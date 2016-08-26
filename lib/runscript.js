'use strict';

var _ = require('lodash');
var File = require('vinyl');
var through = require('through2');
var Web3Interface = require('dapple-core/web3Interface.js');
var runwevm = require('./runwevm.js');
var async = require('async');
var Supervisor = require('./supervisor.js');
var clc = require('cli-color');
var deasync = require('deasync');

module.exports = function (opts) {

  console.log('rs');
  var withSimulation = opts.chainenv.type !== 'internal' && opts.simulate;
  var supervisor = new Supervisor(withSimulation ? '1.1' : '2.1');

  var web3Interface = new Web3Interface(_.assign({mode: 'persistent', supervisor}, opts, {web3: opts.chainenv.network}));

  // TODO - export to something else (maybe expert?)
  function handleEnvExports (logs) {
    var newEnv = {};
    logs.forEach(r => {
      switch (r.event) {
        case 'exportObject':
          newEnv[r.args.name] = {
            value: r.args.addr,
            type: r.args.class
          };
          break;
        case 'exportNumber':
          newEnv[r.args.name] = {
            value: '0x' + r.args.number.toString(16),
            type: 'uint'
          };
          break;
        default:
          // console.log(`LOG "${r.event}" not supported`);
      }
    });
    return newEnv;
  }

  function simulate (cb) {
    // TODO - different behaviour for forks and custom chains
    // TODO - WARN for custom chains - missing integration will cause gas predictions to differ
    let settings = _.assign({mode: 'temporary', type: 'tmp'}, opts);
    var _web3Interface = new Web3Interface(settings);
    runwevm(_.assign({
      classes: opts.classes,
      web3Interface: _web3Interface,
      supervisor,
      fsimulation: true
    }, opts), cb );
  }

  function evaluateSimulation (result, cb) {
    // check if environment will be overwritten
    var newEnv = handleEnvExports(result.logs);
    var newNames = Object.keys(newEnv);
    var oldNames = Object.keys(opts.chainenv.env);
    var overwritten = _.intersection(newNames, oldNames);

    if(overwritten.length > 0) {
      supervisor.warn(`${clc.xterm(208)('WARN')}  The names "${overwritten.join(', ')}" will get overwritten.`);
    }

    supervisor.endSimulation({
      result,
      chainenv: opts.chainenv,
      web3Interface
    }, cb);
  }

  function realRun (cb) {
    web3Interface.runFilter();
    runwevm(_.assign({
      classes: opts.classes,
      web3Interface,
      supervisor,
      fsimulation: false
    }, opts), cb);
  }

  function digestRun (result, cb) {
    web3Interface.stopFilter();
    var newEnv = handleEnvExports(result.logs);
    opts.chainenv.env = _.assign(opts.chainenv.env, newEnv);
    opts.state.saveState(true);
    supervisor.setStatus('Finished!');
    supervisor.finish(result);
    cb(null, result);
  }

  var tasks = [];
  // If real chain => simulate first
  if (withSimulation) {
    // var ensureCorrectChain = web3Interface.ensureType.bind(web3Interface, opts.chainenv.type);
    tasks.push(ensureCorrectChain);
    tasks.push(simulate);
    tasks.push(evaluateSimulation);
    // TODO - OMFG - strangelly this one async leads to an error
    // UGLY UGLY UGLY UGLY
    try {
      var res = deasync(ensureCorrectChain)();
    } catch(e) {
      console.log(clc.redBright(`ERR `) + e.message);
      process.exit(0);
    }
  }

  tasks.push(realRun);
  tasks.push(digestRun);

  async.waterfall(tasks, (err, res) => {
    if(err) {
      throw err;
    }
  });
};
