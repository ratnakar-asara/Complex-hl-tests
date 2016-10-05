var hfc = require('hfc');
var util = require('util');
var fs = require('fs');
var testUtils = require('./test-utils.js');

var pid = parseInt(process.argv[2]);
var testChaincodeID = process.argv[3];
var deployer;
var txId = pid * 100000;
var oFile = fs.createWriteStream('results.log');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Create a client chain.
var chain = hfc.newChain(config.chainName);

// Configure the KeyValStore which is used to store sensitive keys
// as so it is important to secure this storage.
var keyValStorePath = __dirname + "/" + config.KeyValStore;
chain.setKeyValStore(hfc.newFileKeyValStore(keyValStorePath));

chain.setMemberServicesUrl(config.ca.ca_url);
chain.addPeer(config.peers[pid%4].peer_url);
var newArgs;
var deployerName = config.users[1].username;
function initProcess() {
  chain.getUser(deployerName, function(err, member) {
      if (err) throw Error("Failed to register and enroll " + deployerName + ": " + err);
      deployer = member;
      //console.log("\n%s is available ... can proceed executing the tests \n", deployerName );
      //invoke();
      newArgs = testUtils.getArgs(config.invokeRequest);
      //newArgs[4] = testUtils.getRandomPayload();
      executeTest();
  });
}

initProcess();

function executeTest() {
  txId++;
  // Construct the invoke request
  var invokeRequest = {
      // Name (hash) required for invoke
      chaincodeID: testChaincodeID,
      // Function to trigger
      fcn: config.invokeRequest.functionName,
      // Parameters for the invoke function
      args: newArgs
  };
  invokeRequest.args[0] = txId.toString();
  invokeRequest.args[4] = testUtils.getRandomPayload();
  // Trigger the invoke transaction
  var invokeTx = deployer.invoke(invokeRequest);
  invokeTx.on('submitted', function(results) {
      // Invoke transaction submitted
      //console.log(util.format("completed chaincode invoke transaction: request=%j, response=%j\n", invokeRequest, results));
      console.log(util.format("completed chaincode invoke transaction: response=%j\n", results));
      executeTest();
  });
  /*invokeTx.on('complete', function(results) {
      // Invoke transaction completed?
      console.log(util.format("completed chaincode invoke transaction: request=%j, response=%j\n", invokeRequest, results));
  });*/
  invokeTx.on('error', function(err) {
      // Invoke transaction submission failed
      console.log(util.format("Failed to submit chaincode invoke transaction: request=%j, error=%j\n", invokeRequest, err));
      fs.appendFile('results.log', util.format("%j\n",err), function(err) {
            console.log(err);
            executeTest();
      });
  });
}
