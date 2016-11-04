"use strict";

var runscript = require('./runscript.js');
var through = require('through2');

/*
 * DAPPLE CONTROLLER - standalone command line handler for dapple chain
 *
 */

module.exports = {

  cli: function (state, cli, BuildPipeline) {
    if(cli.run) {
      let scriptname = cli['<script>'];

      var chainenv = state.state.pointers[state.state.head];
      // TODO - refactor build pipeline to own module
      BuildPipeline({
        modules: state.modules,
        optimize: !cli['--no-optimize'],
        packageRoot: state.workspace.package_root,
        subpackages: true,
        state
      })
      .pipe(through.obj(function (file, enc, cb) {
        if (file.basename === 'classes.json') {
          runscript({
            scriptname,
            simulate: !cli['--no-simulation'],
            throws: !cli['--force'],
            state: state,
            db: state.db,
            chainenv: chainenv,
            classes: JSON.parse(String(file.contents))
          });
        } else {
          cb();
        }
      })
     )
    }
  }

}
