"use strict";
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8544"));
var http = require('http');
var LogTranslator = require('dapple-core/logtranslator.js');
var _ = require('lodash');

function teachEverybody(what, cb) {
  var options = {
    hostname: 'localhost',
    port: 8544,
    method: 'POST'
  };

  var req = http.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      // console.log('body:\n' + chunk);
    });
    res.on('end', function () {
      cb(null, true);
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.write(`{"jsonrpc":"2.0","method":"expert_learn","params":[${JSON.stringify(what)}],"id":1}`);
  req.end();
}

module.exports = function (opts) {
  teachEverybody( opts.classes, () => {
    var script = opts.classes[opts.scriptname];
    var logtr = new LogTranslator(JSON.parse(script.interface));
    web3.eth.sendTransaction({
      data: script.bytecode,
      from: '0x00000b8dbd80db136764c89129ac203ead5d7f3a'
    }, (err, hash) => {
      if(err) return console.log(err);
      web3.eth.getTransactionReceipt(hash, (err, receipt) => {
        console.log(err, receipt);
        var logs = logtr.translateAll(receipt.logs);
        logs = logs.map(l => {
          var args = (l) => _.map(l.args, (value, key) => ` |  ${key}: ${value}`).join('\n');
          return ` ${l.event}\n${args(l)}`;
        });
        console.log(logs.join('\n\n'));
      })
    });
  });
}
