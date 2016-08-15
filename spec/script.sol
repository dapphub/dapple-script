import "dapple/environment.sol";

contract Script is DappleEnvironment {
  // bunch of events which direct the interaction
  event exportNumber(string name, uint number);
  event exportObject(string name, address addr);

  event setCalls(bool flag);
  event setOrigin(address origin);

  event shUint(bytes input, uint result);

  modifier static {
    setCalls(true);
    _
    setCalls(false);
  }
}
