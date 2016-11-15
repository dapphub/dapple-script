pragma solidity >=0.4.0;
import "dapple/env.sol";

contract Script is DappleEnv {
  // bunch of events which direct the interaction
  event exportNumber(bytes32 name, uint number);
  event exportObject(bytes32 name, address addr);

  event setCalls(bool flag);
  event setOrigin(address origin);

  event assertChain(bytes32 chaintype);

  function txon() { setCalls(false); }
  function txoff() { setCalls(true); }

  event pushEnv(bytes32 env);
  event popEnv(bytes32 env);

  function export(bytes32 name, address addr) {
    exportObject(name, addr);
  }

  function export(bytes32 name, uint number) internal {
    exportNumber(name, number);
  }

  // NSS stuff
  event on(address addr, string eventName, string functioncall);

  System system;
  SMS sms;
  function Script() {
    system = System(0x007202eeaad2c871c74c094231d1a4d28028321b);
    sms = SMS(0x127202eeaad2c871c74c094231d1a4d28028321b);
  }

  // function export(string name, address origin) {
  //   exportObject(name, origin);
  // }
  //
  // function export(string name, uint number) {
  //   exportNumber(name, number);
  // }

  event shUint(bytes input, uint result);

  modifier assertETH {
    assertChain('ETH');
    _;
  }

  // execute the function on the given environment
  modifier from(bytes32 environment) {
    pushEnv(environment);
    // todo - set env to the given environment
    _;
    popEnv(environment);
  }

  modifier notx {
    setCalls(true);
    _;
    setCalls(false);
  }

  function() {}
}

contract System {
  function to_uint(string input) returns (uint output){
    return 11;
  }
}

contract SMS {
  function send(string number, string message) {}
}

contract Callback {
  function on(address addr, string eventName, string functioncall) {
  }
}
