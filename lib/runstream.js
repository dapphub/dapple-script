'use strict';

var _ = require('lodash');
var File = require('vinyl');
var through = require('through2');
var Web3Interface = require('dapple-utils/web3Interface.js');
var runwevm = require('./runwevm.js');
var async = require('async');
var Supervisor = require('./supervisor.js');

module.exports = function (opts) {

  return through.obj(function (file, enc, cb) {
    var self = this;
    this.push(file);

    if (file.basename === 'classes.json') {
      // create a new VM instance
      var classes = JSON.parse(String(file.contents));

      var supervisor;

      var simulate = (cb) => {
        // TODO - different behaviour for forks and custom chains
        // TODO - WARN for custom chains - missing integration will cause gas predictions to differ
        var web3Interface = new Web3Interface(_.assign({mode: 'temporary', type: 'tmp'}, opts));
        runwevm(_.assign({classes, web3Interface, supervisor, simulation: true}, opts), (err, result) => {
          cb(null, result);
          // TODO - check if environment will be overwritten
          console.log('chainenv');
          console.log(opts.chainenv);
          // TODO - check what to do with throws and errors
          // TODO - build gas knowledge base to be able to send the exact gas
        });
      }

      var prepareRun = (result, cb) => {
        var web3Interface = new Web3Interface(_.assign({mode: 'persistent', supervisor}, opts, {web3: opts.chainenv.network}));

        supervisor.endSimulation({
          result,
          chainenv: opts.chainenv,
          web3Interface
        }, () => {
          cb(null, web3Interface);
        });
      }

      var realRun = (web3Interface, cb) => {
        web3Interface.runFilter();
        runwevm(_.assign({classes, web3Interface, supervisor, simulation: false}, opts), (err, result) => {
          web3Interface.stopFilter();
          cb(null, result);
        });
      }

      var tasks = [realRun];
      // If real chain => simulate first
      if (opts.chainenv.type !== 'internal' && opts.simulate) {
        supervisor = new Supervisor('1.1');
        tasks = [simulate, prepareRun].concat(tasks);
      }

      async.waterfall(tasks, (err, res) => {
        supervisor.setStatus('Finished!');
        supervisor.finish(res);
      });

    } else {
      cb();
    }
  });
};
