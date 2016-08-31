import "dapple/environment.sol";

contract Script is DappleEnvironment {
  // bunch of events which direct the interaction
  event exportNumber(string name, uint number);
  event exportObject(string name, address addr);

  event setCalls(bool flag);
  event setOrigin(address origin);

  function txon() { setCalls(false); }
  function txoff() { setCalls(true); }

  event shUint(bytes input, uint result);

  modifier notx {
    setCalls(true);
    _
    setCalls(false);
  }
}

// contract SH {
//   function to_uint(string input) returns (uint){
//     return 11;
//   }
// }
