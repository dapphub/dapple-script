'use strict';

var _ = require('lodash');
var File = require('vinyl');
var through = require('through2');
var Web3Interface = require('dapple-utils/web3Interface.js');
var runwevm = require('./runwevm.js');
var async = require('async');

module.exports = function (opts) {
  // TODO - simulate call

  return through.obj(function (file, enc, cb) {
    var self = this;
    this.push(file);

    if (file.basename === 'classes.json') {
      // create a new VM instance
      var classes = JSON.parse(String(file.contents));

      var report = (result) => {
        console.log(result.process_logs.map(l => l.log).join('\n'));
        const gas = result.process_logs
        // get only chain relevant actions
        .filter(l=>l.type === 'new' || l.type === 'txr')
        // get the gas value
        .map(l=>l.gas)
        // sum all gas values
        .reduce((a,b) => a+b, 0);
        console.log(`Total Gas Used: ${gas}`);
      }


      // If real chain => simulate first
      var simulate = (cb) => {
        if (opts.chainenv.type !== 'internal' && opts.simulate) {
          console.log('Simulating...')
        // TODO - different behaviour for forks and custom chains
        // TODO - WARN for custom chains - integration and gas prediction differ
        var web3Interface = new Web3Interface(_.assign({mode: 'temporary', type: 'tmp'}, opts));
        runwevm(_.assign({classes, web3Interface}, opts), (err, result) => {
          report(result);
          console.log('Simulation finished.\n\n\n');
          // TODO - check if environment will be overwritten
          // TODO - check what to do with throws and errors
          // TODO - build gas knowledge base to be able to send the exact gas
          cb(null);
        });
        } else {
          cb(null);
        }
      }

      var realRun = (cb) => {
        var web3Interface = new Web3Interface(_.assign({mode: 'persistent'}, opts, {web3: opts.chainenv.network}));
        runwevm(_.assign({classes, web3Interface}, opts), (err, result) => {
          report(result);
          cb(null);
        });
      }

      async.waterfall([
        simulate,
        realRun
      ]);


    } else {
      cb();
    }
  });
};
