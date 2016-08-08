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

  return through.obj(function (file, enc, cb) {
    var self = this;
    this.push(file);

    if (file.basename === 'classes.json') {
      // create a new VM instance
      var classes = JSON.parse(String(file.contents));

      var supervisor;
      var web3Interface = new Web3Interface(_.assign({mode: 'persistent', supervisor}, opts, {web3: opts.chainenv.network}));

      var handleEnvExports = (logs) => {
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
                value: r.args.number,
                type: 'uint'
              };
              break;
            default:
              // console.log(`LOG "${r.event}" not supported`);
          }
        });
        return newEnv;
      }

      var simulate = (cb) => {
        // TODO - different behaviour for forks and custom chains
        // TODO - WARN for custom chains - missing integration will cause gas predictions to differ
        var _web3Interface = new Web3Interface(_.assign({mode: 'temporary', type: 'tmp'}, opts));
        runwevm(_.assign({classes, web3Interface: _web3Interface, supervisor, simulation: true}, opts), (err, result) => {
          cb(err, result);
          // check if environment will be overwritten
          var newEnv = handleEnvExports(result.logs);
          var newNames = Object.keys(newEnv);
          var oldNames = Object.keys(opts.chainenv.env);
          var overwritten = _.intersection(newNames, oldNames);
          if(overwritten.length > 0) supervisor.warn(`${clc.xterm(208)('WARN')}  The names "${overwritten.join(', ')}" will get overwritten.`);
          // TODO - check what to do with throws and errors
        });
      }

      var prepareRun = (result, cb) => {
        supervisor.endSimulation({
          result,
          chainenv: opts.chainenv,
          web3Interface
        }, cb);
      }

      var realRun = (cb) => {
        web3Interface.runFilter();
        runwevm(_.assign({classes, web3Interface, supervisor, simulation: false}, opts), (err, result) => {
          if(err) return cb(err);
          web3Interface.stopFilter();
          var newEnv = handleEnvExports(result.logs);
          opts.chainenv.env = _.assign(opts.chainenv.env, newEnv);
          opts.state.saveState(true);
          cb(err, result);
        });
      }
      var ensureCorrectChain = web3Interface.ensureType.bind(web3Interface, opts.chainenv.type);

      var tasks = [realRun];
      // If real chain => simulate first
      if (opts.chainenv.type !== 'internal' && opts.simulate) {
        supervisor = new Supervisor('1.1');
        tasks = [simulate, prepareRun].concat(tasks);
        // TODO - strangelly this one async leads to an error
        // UGLY UGLY UGLY UGLY
        try {
          var res = deasync(ensureCorrectChain)();
        } catch(e) {
          console.log(clc.redBright(`ERR `) + e.message);
          process.exit();
        }
      } else {
         supervisor = new Supervisor('2.1');
      }


      async.waterfall(tasks, (err, res) => {
        if(err) {
          throw err;
        }
        supervisor.setStatus('Finished!');
        supervisor.finish(res);
      });

    } else {
      cb();
    }
  });
};
