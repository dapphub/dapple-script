var cliSpec = require('../spec/cli.json');
var File = require('vinyl');
var through = require('through2');
var fs = require('dapple-core/file.js');
var Controller = require('./controller.js');
var _ = require('lodash');
var export_sol = require('dapple-core/export.js').export_sol;

DappleScript = {

  controller: Controller,
  cliSpec: cliSpec,
  name: "script",

  inject: (opts) => {
    var paths = [];
    return through.obj(

    // No-op. We aren't interested in transforming...
    (file, enc, cb) => {
      // import all solidity files which are not provided by dapple and are
      // not solidity scripts
      var isSolidity = /\.sol$/.test(file.path);
      var isDapple = /^dapple/.test(file.path);
      var isScript = /\.ds\.sol$/.test(file.path);
      var isTest = /\.t\.sol$/.test(file.path);

      if( !isDapple && !isScript && !isTest) {
        paths.push(file.path);
      }
      cb(null, file);
    },

    // ...we're more interested in injecting.
    function (cb) {
      var compiledFile = export_sol(paths, opts.state);
      this.push(new File({
        path: 'dapple/script.sol',
        contents: new Buffer(fs.readFileStringSync(__dirname + '/../spec/script.sol'))
      }));
      this.push(new File({
        path: 'dapple/env.sol',
        contents: new Buffer(compiledFile)
      }));
      cb();
    });
  }

}

module.exports = DappleScript;
