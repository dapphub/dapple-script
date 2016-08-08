var cliSpec = require('../spec/cli.json');
var File = require('vinyl');
var through = require('through2');
var fs = require('dapple-core/file.js');
var pipelines = require('./pipelines.js');
var Controller = require('./controller.js');


DappleScript = {

  controller: Controller,
  cliSpec: cliSpec,
  name: "script",

  inject: () => {
    return through.obj(

    // No-op. We aren't interested in transforming...
    (file, enc, cb) => cb(null, file),

    // ...we're more interested in injecting.
    function (cb) {
      this.push(new File({
        path: 'dapple/script.sol',
        contents: new Buffer(fs.readFileStringSync(__dirname + '/../spec/script.sol'))
      }));
      cb();
    });
  },

  pipelines

}

module.exports = DappleScript;
