/* global beforeEach, it, describe */
'use strict';

// TODO - sequence can be empty

var assert = require('chai').assert;
var fs = require('fs');
var Parser = require('../lib/DSL.js');
var pipelines = require('../lib/pipelines.js');
var through = require('through2');
var Web3Factory = require('../lib/web3Factory.js');

function wrapScript(script) {
  return `script A { function A() { ${script} } }`;
}

describe('DSL', function () {
  this.timeout(1000000);
  var parser;

  // TODO - pass the real environment
  beforeEach(function () {
    parser = new Parser({
      classes: {
        'Contract': {
          interface: [{'constant': false, 'inputs': [{'name': 'x', 'type': 'uint256'}], 'name': 'set', 'outputs': [], 'type': 'function'}, {'constant': true, 'inputs': [], 'name': 'get', 'outputs': [{'name': 'retVal', 'type': 'uint256'}], 'type': 'function'}],
          bytecode: '606060405260978060106000396000f360606040526000357c01000000000000000000000000000000000000000000000000000000009004806360fe47b11460415780636d4ce63c14605757603f565b005b605560048080359060200190919050506078565b005b606260048050506086565b6040518082815260200191505060405180910390f35b806000600050819055505b50565b600060006000505490506094565b9056'
        }
      },
      environment: 'test',
      environments: {
        'test': {
          'objects': {
            'fizzbuzz': 'buzz buzz'
          }
        }
      },
      web3: 'internal',
      // web3: {host: '192.168.59.103', port:'8545'},
      silent: true,
      confirmationBlocks: 0
    });
  });

  it('should accept a simple script', (done) => {
    parser.parse(wrapScript('var foo = "bar"'), (err, res) => {
      if(err) throw err;
      assert(parser.interpreter.success);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should recognize a constructor sequence', function (done) {
    parser.parse('script A { function A() {var foo = "bar" b()} function b() {var fooo = "baz"} }', function (err, res) {
      if (err) throw err;
      assert(parser.interpreter.success);
      // parser.interpreter.run( parser.interpreter.local['A'], (err2, res2) => {
      //   console.log(parser.interpreter.local);
      //   done();
      // });
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
        console.log(parser.interpreter.local);
      // assert(parser.interpreter.local.foo.value === 'bar');
    });
  });


  // afterEach( function() {
  //   console.log(parser.interpreter.logs.join('\n') )
  // })
  it('should recognize an string assignment', function (done) {
    parser.parse(wrapScript('var foo = "bar"'), function (err, res) {
      if (err) throw err;
      assert(parser.interpreter.success);
      assert(parser.interpreter.local.foo.value === 'bar');
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should recognize an number assignment', function (done) {
    parser.parse(wrapScript('var foo = 42'), function (err, res) {
      if (err) throw err;
      assert(parser.interpreter.success);
      assert(parser.interpreter.local.foo.value === 42);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it.skip('should fail if key is already taken', function (done) {
    parser.parse(wrapScript('var foo = 42'), function (err, res) {
      if (err) throw err;
      assert.ok(parser.interpreter.success);
      assert(parser.interpreter.local.foo.value === 42);
      parser.parse(wrapScript('var foo = 42\nvar foo = 17'), function (err, res) {
        if (err) throw err;
        assert.notOk(parser.interpreter.success);
        assert(parser.interpreter.local.foo.value === 42);
        parser.interpreter.web3Interface._web3.currentProvider.stop(done);
      });
    });
  });

  it('allows importing object values from the dappfile', function (done) {
    parser.parse(wrapScript('import fizzbuzz\nlog fizzbuzz'), function (err, res) {
      if (err) throw err;
      assert.ok(parser.interpreter.success);
      assert.include(parser.interpreter.logs, 'buzz buzz\n');
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should export local variables to global scope', function (done) {
    parser.parse(wrapScript('var foo = 17\nexport foo'), function (err, res) {
      if (err) throw err;
      assert.ok(parser.interpreter.success);
      assert(parser.interpreter.global.foo.value === 17);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should fail export local variables to global scope if its taken', function (done) {
    parser.parse(wrapScript('var foo = 17\nexport foo\nvar foo = 42\nexport foo'), function (err, res) {
      if (err) throw err;
      assert.notOk(parser.interpreter.success);
      assert(parser.interpreter.global.foo.value === 17);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should deploy a class', function (done) {
    parser.parse(wrapScript('var foo = new Contract()'), function (err, res) {
      if (err) throw err;
      assert.ok(parser.interpreter.success);
      assert(parser.interpreter.local.foo.value.length === 42);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should pass an object as a deploy argument', function (done) {
    parser.parse(wrapScript( 'var foo = new Contract()\n var bar = new Contract(foo)' ), function (err, res) {
      // TODO: test if foo got passed as an correct address
      if (err) throw err;
      assert.ok(parser.interpreter.success);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should fail deployment if a class is not known', function (done) {
    parser.parse(wrapScript( 'var foo = new NoContract()' ), function (err, res) {
      if (err) throw err;
      assert.notOk(parser.interpreter.success);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it.skip('should deploy contract with the right value', function (done) {
    parser.parse(wrapScript( 'var foo = new NoContract.value(24)()' ), function (err, res) {
      if (err) throw err;
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should deploy contract with the right gas');

  it('should call an address', function (done) {
    parser.parse(wrapScript( 'var foo = new Contract()\n foo.set(2) \n foo.get()' ), function (err, res) {
      if (err) throw err;
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should fail calling a wrong address', function (done) {
    parser.parse(wrapScript( 'var foo = new NoContract()\n foo.functionCall()' ), function (err, res) {
      if (err) throw err;
      assert.notOk(parser.interpreter.success);
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should allow logging via "log"', function (done) {
    parser.parse(wrapScript( 'log "Logging test!"' ), function (err, res) {
      if (err) throw err;
      assert.ok(parser.interpreter.success);
      assert.include(parser.interpreter.logs, 'Logging test!\n');
      parser.interpreter.web3Interface._web3.currentProvider.stop(done);
    });
  });

  it('should send value to an address');
  it('should call an address with raw args');
  it('should switch between keys');

  it('should assert things');


});
