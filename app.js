// Include the package from npm:
var hfc = require('hfc');
var util = require('util');
var testUtils = require('./test-utils.js');
var fs = require('fs');
const child_process = require('child_process');


var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));


// Create a client chain.
var chain = hfc.newChain(config.chainName);

// Configure the KeyValStore which is used to store sensitive keys
// as so it is important to secure this storage.
var keyValStorePath = __dirname + "/" + config.KeyValStore;
chain.setKeyValStore(hfc.newFileKeyValStore(keyValStorePath));

chain.setMemberServicesUrl(config.ca.ca_url);
for (var i = 0; i < config.peers.length; i++) {
    chain.addPeer(config.peers[i].peer_url);
}

process.env['GOPATH'] = __dirname;
var chaincodeIDPath = __dirname + "/chaincodeID";
var deployerName = config.users[1].username;
var testChaincodeID;
var deployer;
//TODO: take from arguments ?
var totalThreads = parseInt(config.totalThreads);
if (process.argv.length == 4) {
    if (process.argv[2] == "--clean") {
        if (process.argv[3] == "chaincode" && fs.existsSync(chaincodeIDPath)) {
            fs.unlinkSync(chaincodeIDPath);
            console.log("Deleted chaincode ID , Ready to deploy chaincode ");
        } else if (process.argv[3] == "all") {
            if (fs.existsSync(chaincodeIDPath)) {
                fs.unlinkSync(chaincodeIDPath);
                console.log("Deleted the chaincode ID ...");
            }
            try {
                testUtils.deleteDir(keyValStorePath);
                console.log("Deleted crypto keys , Create new network and Deploy chaincode ... ");
            } catch (err) {
                console.log(err);
            }
        }
    } else {
        console.log("Invalid arguments");
        console.log("USAGE: node app.js --clean [chaincode|all]");
        process.exit();
    }
    console.log("USAGE: node app.js");
    process.exit();
} else if (process.argv.length > 2) {
    console.log("Invalid arguments");
    console.log("USAGE: node app.js [--clean [chaincode|all]]");
    process.exit(2)
}

init();

function init() {
    //Avoid enroll and deploy if chaincode already deployed
    if (!testUtils.fileExists(chaincodeIDPath)) {
        //process.exit();
        registerAndEnrollUsers();
    } else {

        // Read chaincodeID and use this for sub sequent Invokes/Queries
        testChaincodeID = fs.readFileSync(chaincodeIDPath, 'utf8');
        console.log("\nchaincode already deployed, If not delete chaincodeID and keyValStore and recreate network");
        console.log("\nGet member %s", deployerName);
        chain.getUser(deployerName, function(err, member) {
            if (err) throw Error("Failed to register and enroll " + deployerName + ": " + err);
            deployer = member;
            console.log("\n%s is available ... can create new users\n", deployerName );
            workerThread();
        });
    }
}

function registerAndEnrollUsers() {
    // Enroll "admin" which is already registered because it is
    // listed in fabric/membersrvc/membersrvc.yaml with it's one time password.
    chain.enroll(config.users[0].username, config.users[0].secret, function(err, admin) {
        if (err) throw Error(util.format("ERROR: failed to register %j, Error : %j \n", config.users[0].username, err));
        // Set this user as the chain's registrar which is authorized to register other users.
        chain.setRegistrar(admin);

        console.log("\nEnrolled %s successfully\n", config.users[0].username);

        // registrationRequest
        var registrationRequest = {
            enrollmentID: deployerName,
            affiliation: config.users[1].affiliation
        };
        chain.registerAndEnroll(registrationRequest, function(err, user) {
            if (err) throw Error(" Failed to register and enroll " + deployerName + ": " + err);
            deployer = user;
            console.log("Enrolled %s successfully\n", deployerName);
            chain.setDeployWaitTime(config.deployWaitTime);
            deployChaincode();
        });
    });
}

function deployChaincode() {
    console.log(util.format("Deploying chaincode ... It will take about %j seconds to deploy \n", chain.getDeployWaitTime()))
    var args = testUtils.getArgs(config.deployRequest);

    // Construct the deploy request
    var deployRequest = {
        chaincodePath: config.deployRequest.chaincodePath,
        // Function to trigger
        fcn: config.deployRequest.functionName,
        // Arguments to the initializing function
        args: args
    };

    // Trigger the deploy transaction
    var deployTx = deployer.deploy(deployRequest);

    // Print the deploy results
    deployTx.on('complete', function(results) {
        // Deploy request completed successfully
        testChaincodeID = results.chaincodeID;
        console.log(util.format("[ Chaincode ID : ", testChaincodeID + " ]\n"));
        console.log(util.format("Successfully deployed chaincode: request=%j, response=%j \n", deployRequest, results));
        fs.writeFileSync(chaincodeIDPath, testChaincodeID);

        //invoke();
        workerThread()
    });
    deployTx.on('error', function(err) {
        // Deploy request failed
        console.log(util.format("Failed to deploy chaincode: request=%j, error=%j \n", deployRequest, err));
    });
}

function workerThread() {
    // Get this as input/config parameter
    var MINUTES = parseInt(config.duration);
    //var MINUTES = 5;
    var execDuration = MINUTES * 60 * 1000;

    setTimeout (function(){
      // Aborting the test execution after duration, Is this the right way ?
      console.log("\n############## Timeout: Stopping the tests gracefully #################\n");
      process.exit();
      //TODO: Should we get the chain heights and should we parse the blocks after termination
    }, execDuration);

    console.log('Starting time (ms) = ', new Date().getTime());

    // Start the transactions
    for (var i = 0; i < totalThreads; i++) {

        var childProcess = child_process.spawn('node', ['./childProcess.js', i, testChaincodeID]);

        childProcess.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
        });

        childProcess.stderr.on('data', function(data) {
            console.log('stderr: ' + data);
        });

        childProcess.on('close', function(code) {
            console.log('child process exited with code ' + code);
        });
    }
}

function invoke() {
    var args = testUtils.getArgs(config.invokeRequest);

    // Construct the invoke request
    var invokeRequest = {
        // Name (hash) required for invoke
        chaincodeID: testChaincodeID,
        // Function to trigger
        fcn: config.invokeRequest.functionName,
        // Parameters for the invoke function
        args: args
    };

    // Trigger the invoke transaction
    var invokeTx = deployer.invoke(invokeRequest);

    invokeTx.on('complete', function(results) {
        // Invoke transaction completed?
        console.log(util.format("completed chaincode invoke transaction: request=%j, response=%j\n", invokeRequest, results));
    });
    invokeTx.on('error', function(err) {
        // Invoke transaction submission failed
        console.log(util.format("Failed to submit chaincode invoke transaction: request=%j, error=%j\n", invokeRequest, err));
    });
}
