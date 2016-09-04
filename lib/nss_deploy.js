"use strict";
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8544"));


module.exports = function (opts) {
  var script = opts.classes[opts.scriptname];
  web3.eth.sendTransaction({
    data: script.bytecode,
    from: '0x00000b8dbd80db136764c89129ac203ead5d7f3a'
  }, (err, res) => {
    console.log(err, res);
  });
}
