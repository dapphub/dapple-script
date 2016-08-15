"use strict";

var _ = require('lodash');
var RunPipeline = require('./pipelines.js').RunPipeline;

/*
 * DAPPLE CONTROLLER - standalone command line handler for dapple chain
 *
 */

module.exports = {

  cli: function (state, cli, workspace, env, BuildPipeline) {
    if(cli.run) {
      let scriptname = cli['<script>'];

      var chainenv = state.state.pointers[state.state.head];
      let confirmationBlocks = env.environment.confirmationBlocks;
      if (typeof confirmationBlocks === 'undefined') confirmationBlocks = 1;
      // TODO - refactor build pipeline to own module
      BuildPipeline({
        modules: env.modules,
        packageRoot: workspace.package_root,
        subpackages: cli['--subpackages'] || cli['-s'],
        state,
        env
      })
      .pipe(RunPipeline({
        environment: env.name,
        scriptname,
        packageRoot: workspace.package_root,
        simulate: !cli['--no-simulation'],
        throws: !cli['--force'],
        web3: (env.environment.ethereum || 'internal'),
        workspace: workspace,
        confirmationBlocks: confirmationBlocks,
        state: state,
        db: state.db,
        chainenv: chainenv
      }));
    }
  }

}
