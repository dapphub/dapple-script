var cliSpec = require('../spec/cli.json');
var File = require('vinyl');
var through = require('through2');
var fs = require('dapple-core/file.js');
var pipelines = require('./pipelines.js');
var Controller = require('./controller.js');
var _ = require('lodash');


DappleScript = {

  controller: Controller,
  cliSpec: cliSpec,
  name: "script",

  inject: (opts) => {
    var paths = [];
    var envs = opts.state.state.pointers;
    envs.env = envs[opts.state.state.head];
    var environments_init = Object.keys(envs).map(name => `  Environment ${name};`).join('\n');
    // TODO - test here wether two objects with the same name but different types exist
    var signatures = _.flatten(_.map(envs, env => _.map(env.env, (obj, name) => `    ${obj.type} ${name};`))).join('\n');
    var environment_spec =
      _.flatten(
        _.map(envs, (env, envName) =>
              _.map( env.env, (obj, name) => `    ${envName}.${name} = ${obj.type}(${obj.value});`))).join('\n');

    return through.obj(

    // No-op. We aren't interested in transforming...
    (file, enc, cb) => {
      // import all solidity files which are not provided by dapple and are
      // not solidity scripts
      var isSolidity = /\.sol$/.test(file.path);
      var isDapple = /^dapple/.test(file.path);
      var isScript = /\.ds\.sol$/.test(file.path);

      if( isSolidity && !isDapple && !isScript) {
        paths.push(file.path);
      }
      cb(null, file);
    },

    // ...we're more interested in injecting.
    function (cb) {
      var template = _.template(fs.readFileStringSync(__dirname + '/../spec/env.sol'));
      var imports = paths.map(p => `import "${p}";`).join('\n');
      var compiledFile = template({
        imports,
        signatures,
        environments_init,
        environment_spec
      });
      this.push(new File({
        path: 'dapple/script.sol',
        contents: new Buffer(fs.readFileStringSync(__dirname + '/../spec/script.sol'))
      }));
      this.push(new File({
        path: 'dapple/environment.sol',
        contents: new Buffer(compiledFile)
      }));
      cb();
    });
  },

  pipelines

}

module.exports = DappleScript;
