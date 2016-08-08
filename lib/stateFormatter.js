"use strict";

var CLI = require('clui');
var clc = require('cli-color');
var _ = require('lodash');
var Line = CLI.Line;
var inquirer = require('inquirer');
var async = require('async');

// The formatter can be in two modes:
// 1. with simulation
// 2. without simulation
//
// 1.
// With simulation the whole process is seen out of a superposition
// and is supervised interactivelly.
// 1.1 First a simulation text is displayed to inform the user about the
//     current simulation process.
// 1.2 The whole Process is displayed at once including a summary.
//     The user is asket to confirm.
// 1.3 Feedback of each step is displayed
//
// 2.
// Without simulation the whole process is done on the fly and printed out
// as soon as the information gets aviable.
//
//
class StateFormatter {

  constructor(state) {
    // memory - lines to escape on the next canvas update
    this.canvasHeight = 0;
    // currept step in the script execution process (State 1.3)
    this.currentStep = -1;
    // current step in the overall process
    this.state = state;
    this.status = '';
    // reset the console
    console.log(clc.reset);
    // draw the first canvas
    this.draw();
  }

  // TODO - deprecated?
  // learn (obj) {
  //   this.logtranslator = obj.logtranslator;
  //   this.expert = obj.expert;
  //   this.coder = obj.coder;
  // }

  draw (cb) {
    // Get the report
    var report = "";
    switch (this.state) {
      case '1.1':
        report = "Simulate...";
        break;
      case '1.2':
        report = this.getReport();
        break;
      case '1.3':
        report = this.getReport();
        break;
      default:
        throw new Error(`State "${this.state}" not supported!`);
    }
    report += this.status;
    // delete canvas
    var flush = true;
    let oldCanvasHeight;
    if(flush) {
      console.log(`\x1b[${this.canvasHeight}A`)
      // count and save the lines for later escape
      oldCanvasHeight = this.canvasHeight;
      this.canvasHeight = report.split(/\r\n|\r|\n/).length+1;
    }
    // draw
    process.stdout.write(report);
    if(flush) {
      process.stdout.write(clc.erase.lineRight+'\n');
      let difference = oldCanvasHeight - this.canvasHeight;
      if(difference > 0) {
        for (var i = 0; i < difference; i++) {
          process.stdout.write(clc.erase.lineRight);
          process.stdout.write(clc.move.down(1));
        }
        process.stdout.write(`\x1b[${difference}A`);
      }
    } else {
      console.log('\n');
    }

    // Only on state 1.2 we need to ask for a user confirmation:
    if(this.state === '1.2') {
      this.getSummary()
      .then((report) => {
        this.canvasHeight += report.split(/\r\n|\r|\n/).length + 1;
        console.log(report);
        return inquirer.prompt([{
          type: 'confirm',
          message: 'Do you want to execute this against the real chain?',
          name: 'confirm'
        }]);
      })
      .then((res) => {
        if(res.confirm) {
          this.state = '1.3';
          this.currentStep = 0;
          this.draw();
          cb();
        } else {
          process.exit();
        }
      })
    }
  }

  getReport () {
    // console.log(this.steps);
    var report = this.steps.map((step, i) => {
      var type = step.type.toUpperCase();
      var msg = '';
      var status = ' ';
      if(i === this.currentStep) status = clc.cyanBright('>');
      if(i < this.currentStep) status = clc.greenBright('✔');
      switch (type) {
        case 'NEW':
          msg = this.formatDeploy(step);
          break;
        case 'TXR':
          msg = this.formatTxr(step);
          break;
        default:
          msg = '--------------------------TODO '+type;
      }
      return `${status}  ${clc.yellow(type)}   ${msg}`;
    }).join('\n');
    return report;
  }

  getSummary() {
    const gas = this.steps
    // get only chain relevant actions
    .filter(l=>l.type === 'new' || l.type === 'txr')
    // get the gas value
    .map(l=>l.receipt.gasUsed)
    // sum all gas values
    .reduce((a,b) => a+b, 0);

    const totalBlocks = this.steps.length*(2+this.env.chainenv.confirmationBlocks);

    const gasSpending = this.steps.reduce((a, step) => {
      if(typeof a[step.from] === 'number') {
        a[step.from] += step.receipt.gasUsed;
      } else {
        a[step.from] = step.receipt.gasUsed;
      }
      return a;
    }, {});
    const accounts = Object.keys(gasSpending);

    var summary = `--------------------------------------------\n`;
    summary += `Running script aganst a ${clc.bold(this.env.chainenv.type)} chain at ${clc.bold(this.env.chainenv.network.host+':'+this.env.chainenv.network.port)}\n`;
    summary += `Accounts:\n`;
    // console.log(this.env);

    var web3 = this.env.web3Interface._web3;
    var eth = web3.eth;
    return new Promise((resolve, reject) => {
      async.map(accounts, eth.getBalance.bind(eth), (err, res) => {
        var gasPrice = eth.gasPrice;
        var balances = res.map(b => web3.fromWei(b,'ether').toString(10));

        summary += accounts
        .map((acc, i) => `${acc}   ${balances[i]}eth   ${web3.fromWei(gasSpending[acc]*gasPrice,'ether')}eth`)
        .join('\n')+'\n';

        summary += `Total Gas: ${gas}\n`;
        summary += `This script will take at least ${totalBlocks} Blocks and ${clc.bold(( totalBlocks*15 )+'s')}\n`;
        resolve(summary);
      });
    });
  }

  endSimulation (steps, env, cb) {
    this.steps = steps;
    this.state = '1.2';
    this.env = env;
    this.draw(cb);
  }

  incStep (obj) {
    this.steps[this.currentStep++] = obj;
    this.draw();
  }

  formatDeploy (step) {
    var logs = this.genLogs(step.logs);
    var address = '';
    if(this.state === '1.3' && !step.simulation) address = ` ->  ${step.address}`;
    return  `new ${step.className}(${step.params}) ${address}\n${logs}`;
  }

  formatTxr (step) {
    var logs = this.genLogs(step.logs);
    return `${step.className}(${step.to}).${step.fname}(${step.params})\n${logs}`;
  }

  genLogs (logs) {
    return logs.map(l =>
      `   ${clc.yellow('LOG')}   ${l.event}${JSON.stringify(l.args,null,2).replace(/\"|\{|\}/g,'').replace(/\n/g,'\n       ')}`).join('\n');
  }

  setStatus (status) {
    this.status = status.length > 0 ? '\nStatus: ' + status : '';
    this.draw();
  }

}
module.exports = StateFormatter;
