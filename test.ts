
// import Http = module('http');
import Http = require('http');

import modWabr = require('./wabr');
import modTest = require('./sample_code');

import WABarcodeReader = modWabr.WABarcodeReader;
import WABarcode = modWabr.WABarcode;
import WAUtils = modWabr.WAUtils;
import Test = modTest.Test;

// ============  Configure server
var serverUrl: string = "";
var authorization: string = "";
var reader = new WABarcodeReader(serverUrl, authorization);

// ============  Configure Test 
var test: Test = new Test();
Test.bShowDiag = true;
/*
test.bTestDropBox = false;
test.bTestSamplesWeb = false;
test.bTestUtf8 = false;
test.bTestUtf8Names = false;
test.bTestBase64 = false;
test.bTestSamplesLocal = false;
*/

// ============  Run Test 
test.Run(reader);

console.log("Hit Ctrl-C > "); WAUtils.pause(); 