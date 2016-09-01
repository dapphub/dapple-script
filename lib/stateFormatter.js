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

  static countHeight (str) {
    let width = process.stdout.columns;
    return str.split(/\r\n|\r|\n/)
    .map(l => Math.max(1, Math.ceil(l.length/width)))
    .reduce((a,e) => {
      return a + e;
    }, 0);
  }

  constructor(state) {
    // memory - lines to escape on the next canvas update
    this.canvasHeight = 0;
    // currept step in the script execution process (State 1.3)
    this.currentStep = (state === '2.1') ? 0 : -1;
    // current step in the overall process
    this.state = state;
    this.status = '';
    this.smsgs = [];
    this.steps = [];
    // reset the console
    console.log(clc.reset);
    // draw the first canvas
    // this.draw();
  }

  draw (cb) {
    // Get the report
    var report = "";
    var outputBuffer = new CLI.LineBuffer({
      x: 0,
      y: 0,
      width: 'console',
      height: 'console'
    });
    switch (this.state) {
      case '1.1':
        report = "Simulate...";
        break;
      case '1.2':
        report = 'Report:    \n\n';
        report += this.getReport();
        break;
      case '1.3':
        report = 'Report:    \n\n';
        report += this.getReport();
        break;
      case '2.1':
        report = "Running...\n\n";
        report += this.getReport();
        break;
      default:
        throw new Error(`State "${this.state}" not supported!`);
    }
    report += this.status + clc.erase.lineRight + '\n';
    // delete canvas
    // var flush = true;
    // let oldCanvasHeight;
    // if(flush) {
    //   console.log(`\x1b[${this.canvasHeight}A`)
    //   for (var i = 0; i < this.canvasHeight; i++) {
    //     process.stdout.write(clc.erase.lineRight);
    //     process.stdout.write(clc.move.down(1));
    //   }
    //   console.log(`\x1b[${this.canvasHeight}A`)
    //   // count and save the lines for later escape
    //   oldCanvasHeight = this.canvasHeight;
    //   this.canvasHeight = StateFormatter.countHeight(report) + 1;
    //   // let height = process.stdout.rows;
    //   // if(this.canvasHeight > height) this.canvasHeight = height;
    //   // report =
    // }
    // draw
    process.stdout.write(report);

    // Only on state 1.2 we need to ask for a user confirmation:
    if(this.state === '1.2') {
      this.getSummary()
      .then((report) => {
        this.canvasHeight = StateFormatter.countHeight(report) + 1;
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
          console.log(`\x1b[${this.canvasHeight}A\n-----`)
          cb();
        } else {
          process.exit();
        }
      })
    }
  }

  getReport () {
    var report = this.steps.map((step, i) => {
      var type = step.type.toUpperCase();
      var msg = '';
      var status = '';
      switch (type) {
        case 'NEW':
          msg = this.formatDeploy(step);
          break;
        case 'TXR':
          msg = this.formatTxr(step);
          break;
        case 'LOG':
          msg = this.formatLog(step);
          break;
        case 'EXP':
          msg = this.formatExp(step);
          break;
        case 'GET':
          msg = this.formatGet(step);
          break;
        default:
          msg = '--------------------------TODO '+type;
      }
      return `   ${clc.yellow(type)}   ${msg}\n`;
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

    const gasSpending = this.steps
    .filter(l=>l.type === 'new' || l.type === 'txr')
    .reduce((a, step) => {
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
        summary += this.smsgs.join('\n')+'\n';
        resolve(summary);
      });
    });
  }

  addSummaryMsg (msg) {
    this.smsgs.push(msg);
  }

  endSimulation (steps, env, cb) {
    this.steps = steps;
    this.state = '1.2';
    this.env = env;
    console.log(this.getReport());
    this.getSummary()
    .then((report) => {
      this.canvasHeight = StateFormatter.countHeight(report) + 1;
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
        console.log(`\x1b[${this.canvasHeight}A`)
        for (var i = 0; i < this.canvasHeight; i++) {
          process.stdout.write(clc.erase.lineRight);
          process.stdout.write(clc.move.down(1));
        }
        console.log(`\x1b[${this.canvasHeight}A`)
        console.log(`--------------------------------------------\n`);
        cb();
      } else {
        process.exit();
      }
    })
    // this.draw(cb);
  }

  formatStep( step ) {
    var type = step.type.toUpperCase();
    var msg = '';
    var status = '';
    switch (type) {
      case 'NEW':
        msg = this.formatDeploy(step);
        break;
      case 'TXR':
        msg = this.formatTxr(step);
        break;
      case 'LOG':
        msg = this.formatLog(step);
        break;
      case 'EXP':
        msg = this.formatExp(step);
        break;
      case 'GET':
        msg = this.formatGet(step);
        break;
      default:
        msg = '--------------------------TODO '+type;
    }
    console.log(`   ${clc.yellow(type)}   ${msg}\n\n`);
  }

  incStep (obj) {
    // if( this.status.length > 0 ) console.log(`\x1b[2A`)
    this.steps[this.currentStep++] = obj;
    this.formatStep( obj );
  }

  formatDeploy (step) {
    var logs = this.genLogs(step.logs).join('\n');
    var address = '';
    var gas = `   |     ${clc.yellow('GAS')} ${step.receipt.gasUsed}\n`;
    if((this.state === '1.3' || this.state === '2.1') && !step.simulation) address = ` ->  ${step.address}`;
    return  `new ${step.className}(${step.params}) ${address}\n${gas}${logs}`;
  }

  formatGet(step) {
    var result = '   |         ' + step.result.map(o => `${o.type} ${o.name} = ${o.value}`).join('\n   |         ');
    return `${step.className}(${step.to}).${step.fname}(${step.params})
   |     ${clc.yellow('RES')}\n${result}`;
  }

  formatTxr (step) {
    var logs = this.genLogs(step.logs).join('\n');
    var gas = `   |     ${clc.yellow('GAS')}   ${step.receipt.gasUsed}\n`;
    return `${step.className}(${step.to}).${step.fname}(${step.params})\n${gas}${logs}`;
  }

  formatLog (step) {
    var l = step.log;
    var args = (l)=> '   |     ' + _.map(l.args, (value, key) => `${key}: ${value}`).join('\n       ');
    return `${l.event}\n${args(l)}`;
  }

  formatExp (step) {
    return JSON.stringify(step.log, false, 2);
  }

  genLogs (logs) {
    var args = (l)=> '   |         ' + _.map(l.args, (value, key) => `${key}: ${value}`).join('\n   |         ');
    return logs.map(l =>
      `   |     ${clc.yellow('LOG')} ${l.event}\n${args(l)}`);
  }

  setStatus (status) {
    // if( this.status.length > 0 ) console.log(`\x1b[2A`)
    if( status.length > 0 ) {
      console.log(status);
    }
    this.status = status; //.length > 0 ? '\nStatus: ' + status : '';
    // this.draw();
  }

}
module.exports = StateFormatter;
