import "dapple/environment.sol";

contract Script is DappleEnvironment {
  // bunch of events which direct the interaction
  event exportNumber(string name, uint number);
  event exportObject(string name, address addr);

  event setCalls(bool flag);
  event setOrigin(address origin);

  event assertChain(bytes32 chaintype);

  function txon() { setCalls(false); }
  function txoff() { setCalls(true); }

  event onEnv(string env);
  event offEnv(string env);

  System system;
  SMS sms;
  function Script() {
    system = System(0x0000000000000000000000000000000000000001);
    sms = SMS(0x0000000000000000000000000000000000000002);
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
  modifier from(string environment) {
    onEnv(environment);
    _;
    offEnv(environment);
  }

  modifier notx {
    setCalls(true);
    _;
    setCalls(false);
  }
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
