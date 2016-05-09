## DappleScript
For use for pure awesomenes


## TODO for v0.1
[x] script and constructor

[x] sequences and sequence call

[ ] environment scoping

[ ] type checker
  * on contract constructor
  * on contract function call
  * variables
  * script function calls

[ ] script imports

[ ] on chain interpreter

### Example

The script `./deployscript`
```
// import envObject from the current environment
import envObject

// import pkgObject from the current environment of the package "pkg"
import pkg.pkgObject

// import another script
import VersionUpdate

// a script is a logical unit for interaction, this example script handels
// a deployment
script MyDeployment {

  // define a constructor function for your interaction script
  function MyDeployment () {

    // deploy a new ContractA instance
    var internalObject = new ContractA()

    // string for later use
    var internalString = "objectName"

    // deploy a new ContractB instance with two addresses as parameters
    var externalObject = new ContractB( pkg.pkgObject, envObject, internalObject )

    // call a function on the contract
    externalObject.setName(internalString)

    // run sequence
    updateVersion()

    // persistantly save a value
    export externalObject
  }

  // reads and upates the current version on a registry
  function updateVersion (address externalObject) {

    // reads the current environment and grabs the saved version
    uint8 version = this.version

    // increments the version
    version ++;

    // reads the registry address and saves calls it
    VersionUpdate(externalObject, version);

    // saves the version bump
    export version
  }

}
```


### Operations

#### deploy
```
new <class name> [. gas(<gas>) |. value(<value>) ]* ( <args> )
```
This deploys the class "Contract". A deploy statement is always indicated by
the keyword `new` followed by a class name. The contract class has to be available
in one of the contract source files of the dapple project.
An custom amount of gas and value can be passed during the deploy by specifying
`.gas(<gas>)` and value `.value(<value>)`.

##### example
```
new Contract.value(1000000)("contract name")
```
#### call
```
<object>.<function name> [. gas(<gas>) | .value(<value>)]* ( <args> )
```
This send a transaction to an object by calling the specified function name.
Gas and Value can be passed much like during a deploy.
If the function is static, the call don't triggers a transaction and returns a value
which can be saved to a variable.

##### example
```
object.setName.value(100000)("name")
```

#### import
```
import [pkg .]* <var>
```
This imports a variable out of the current environment of the specified package tree.

##### example
```
import pkg1.pkg2.contract
```
#### export
```
export <var>
```
This persistently saves a variable out of the current script scope to
the current environment in the dappfile.

##### example
```
var var = 2
export var
```

#### log
```
var fortytwo = 42
log fortytwo
```
This logs an arbitrary variable to stdout.



run with:
`dapple run ./deployscript -e morden`

will produce the following output:
```
DEPLOYED: ContractA = 0x89e020ed6a30e8d5a05f6c6ee77a81c46934ba25
GAS COST: 510111 for "new ContractA"
Waiting for 4 confirmations: .... confirmed!
DEPLOYED: ContractB = 0x17d41b0d0e290f9c6be4c610b7db654464ee6425
GAS COST: 1666288 for "new ContractB"
Waiting for 4 confirmations: .... confirmed!
CALLED: ContractB("externalObject").setName(internalString)
GAS COST: 18348 for "call ContractB.setName(internalString)"
Waiting for 4 confirmations: .... confirmed!
```

and save the exports to the current dappfile under the executed environment:
The dappfile `/dappfile`
```
[...]
environments:
  morden:
    objects:
      externalObject:
        class: ContractB
        address: '0x17d41b0d0e290f9c6be4c610b7db654464ee6425'
[...]
```

## Roadmap
The following planned features will get implemented next (not ordered):

* Simulating the deployment on a real chain fork.
* assertions
* Type checking the script on compile time + type inference.
    * This will reduce possible errors done while writing a script.
* Call and return values from non-static functions.
* Call functions which return multiple values
* Saving and resuming a scripts state on every step.
    * This prevents losing any information during a deploy.
* Managing different addresses out of the coinbase which are performing operations.
* Script subroutines and importing/calling the subroutinges from packages.
