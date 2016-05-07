'use strict';

var runscript = require('./runscript.js');
var cli_out = require('./cli_out.js');

var _ = require('lodash');
var Combine = require('stream-combiner');

// This file contains collections of streams that have been packaged up into
// discreet "pipelines" which are ultimately themselves streams. This helps keep
// `main.js` clean and easy to read.

var _fillOptionDefaults = function (opts) {
  if (!opts) opts = {};

  var defaults = {
    deployData: true,
    globalVar: false,
    preprocessorVars: {},
    web3: 'internal',
    confirmationBlocks: 1
  };

  var _opts = _.assign(defaults, opts);
  return _opts;
};

// Takes built contracts and runs the deployscript
var RunPipeline = function (opts) {
  // Defaults
  opts = _fillOptionDefaults(opts);
  return Combine(
    runscript(opts),
    cli_out()
  );
};


module.exports = {
  RunPipeline
};
