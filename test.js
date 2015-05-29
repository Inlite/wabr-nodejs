var modWabr = require('./wabr');
var modTest = require('./sample_code');
var WABarcodeReader = modWabr.WABarcodeReader;
var WAUtils = modWabr.WAUtils;
var Test = modTest.Test;
// ============  Configure server
var serverUrl = "";
var authorization = "";
var reader = new WABarcodeReader(serverUrl, authorization);
// ============  Configure Test 
var test = new Test();
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
console.log("Hit Ctrl-C > ");
WAUtils.pause();
//# sourceMappingURL=test.js.map