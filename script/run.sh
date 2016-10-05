#!/bin/bash

rm -rf /var/hyperledger/production

#Redirect output to a text file and handle deletion of the same
CORE_LOGGING_LEVEL=debug peer node start --peer-chaincodedev > peer_log.txt 2>&1 &

go build art_app.go

sleep 5

#Redirect output to a text file and handle deletion of the same
CORE_CHAINCODE_ID_NAME=mycc CORE_PEER_ADDRESS=0.0.0.0:7051 ./art_app dev > chaincode_log.txt 2>&1 & 

 sleep 5

#Deploy
peer chaincode deploy -l golang -n mycc -c '{"Function": "init", "Args":[]}'

sleep 3
#Post User
peer chaincode invoke -l golang -n mycc -c '{"Function": "PostUser", "Args":["100", "USER", "Ashley Hart", "TRD",  "Morrisville Parkway, #216, Morrisville, NC 27560", "9198063535", "ashley@itpeople.com", "SUNTRUST", "0001732345", "0234678"]}'
