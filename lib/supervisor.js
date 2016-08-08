"use strict";
var sha3 = require('web3/lib/utils/sha3.js');
var StateFormatter = require('./stateFormatter.js');

// The supervisor can operate in two modes:
// 1. with simulation
// 2. without simulation
//
// With simulation the whole process is seen out of a superposition:
// 1.1 simulate and notify the formatter about the state
// 1.2 notify the formatter about the superposition and ask the user to confirm
// 1.3 before each transaction make an estimate_gas call and compare with
//     the knowledge base. If they are not similar - notify the user.
//     Notify the formatter about the current step.

class Supervisor {

  constructor (processState) {
    this.steps = [];
    this.newSteps = [];
    this.state = {};
    this.stepId = 0;
    this.processState = processState;
    this.currentStep = -1;
    // current step in the overall process
    this.stateFormatter = new StateFormatter(this.processState);
  }

  step(obj) {
    if(this.processState === '1.1') {
      var keyObject = {
        from: obj.from,
        data: obj.data,
        pc: obj.pc,
        step: this.stepId++
      };
      var key = sha3(JSON.stringify(keyObject));
      this.state[key] = obj;
      this.steps.push(obj);
    } else if (this.processState === '1.3') {
      this.currentStep++;
      var oldStep = this.steps[this.currentStep];
      if(oldStep.receipt.gasUsed !== obj.receipt.gasUsed ) {
        // TODO - handle this propperly
        console.log(this.currentStep);
        console.log(this.steps.length);
        console.log(oldStep);
        console.log('----');
        console.log(obj);
        throw new Error('Gas mismatch! Something went wrong!');
      }
      this.stateFormatter.incStep(obj);
    }
  }

  getNextStep() {
    if( this.currentStep + 1 in this.steps) return this.steps[this.currentStep + 1];
    return null;
  }

  startSimulation() {
    // stateFormatter.format();
  }

  endSimulation(obj, cb) {
    this.processState = '1.3';
    this.stateFormatter.endSimulation(this.steps, obj, cb);
  }

  finish(result) {
    // console.log(result);
  }

  setStatus (status) {
    this.stateFormatter.setStatus(status);
  }

  warn (msg) {
    this.stateFormatter.addSummaryMsg( msg );
  }

  // TODO - deprecated?
  // learn (obj) {
  //   this.logtranslator = obj.logtranslator;
  //   this.expert = obj.expert;
  //   this.coder = obj.coder;
  //   // this.stateFormatter.learn(obj);
  // }

}

module.exports = Supervisor;
