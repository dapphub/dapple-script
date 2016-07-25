'use strict';

var _ = require('lodash');
var File = require('vinyl');
var through = require('through2');
var Web3Interface = require('dapple-utils/web3Interface.js');
var runwevm = require('./runwevm.js');

module.exports = function (opts) {
  // TODO - simulate call

  return through.obj(function (file, enc, cb) {
    var self = this;
    this.push(file);

    if (file.basename === 'classes.json') {
      // create a new VM instance
      var classes = JSON.parse(String(file.contents));
      // If real chain => simulate first
      if (opts.web3 !== 'internal' && opts.simulate) {
        console.log('Simulating...');
        var web3Interface = new Web3Interface(opts);
        runwevm(_.assign({classes, web3Interface}, opts), (err, logs) => {

        });
      } else {
        var web3Interface = new Web3Interface(opts);
        runwevm(_.assign({classes, web3Interface}, opts), (err, result) => {
          console.log(result.process_logs.join('\n'));
          // console.log(result.logs);
        });
      }
    } else {
      cb();
    }
  });
};
