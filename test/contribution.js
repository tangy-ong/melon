var async = require('async');
var assert = require('assert');
var BigNumber = require('bignumber.js');
var sha256 = require('js-sha256').sha256;

//Config
const startTime = 1477958400; // 11/01/2016 @ 12:00am (UTC)
const SECONDS_PER_WEEK = 604800; // 3600*24*7
const endTime = startTime + 8*SECONDS_PER_WEEK;

function sign(web3, address, value, callback) {
  web3.eth.sign(address, value, (err, sig) => {
    if (!err) {
      try {
        var r = sig.slice(0, 66);
        var s = '0x' + sig.slice(66, 130);
        var v = parseInt('0x' + sig.slice(130, 132), 16);
        if (sig.length<132) {
          //web3.eth.sign shouldn't return a signature of length<132, but if it does...
          sig = sig.slice(2);
          r = '0x' + sig.slice(0, 64);
          s = '0x00' + sig.slice(64, 126);
          v = parseInt('0x' + sig.slice(126, 128), 16);
        }
        if (v!=27 && v!=28) v+=27;
        callback(undefined, {r: r, s: s, v: v});
      } catch (err) {
        callback(err, undefined);
      }
    } else {
      callback(err, undefined);
    }
  });
}

contract('Contribution', (accounts) => {
  //globals
  let contract;
  let melon_contract;
  let dot_contract;
  let contractAddress;
  var accounts;
  let testCases;
  const ETHER = new BigNumber(Math.pow(10,18));
  const UNIT = 1000;
  const melonport = accounts[0];
  const parity = accounts[1];
  const btcs = accounts[2];
  const signer = accounts[3];
  const FOUNDER_LOCKUP = 2252571;
  const TRANSFER_LOCKUP = 370285;

  before('Check accounts', (done) => {
    assert.equal(accounts.length, 10);
    done();
  });

  it('Deploy smart contract', (done) => {
    Contribution.new(melonport, parity, btcs, signer, startTime).then((result) => {
      contract = result;
      contractAddress = contract.address;
      return contract.melonToken();
    }).then((result) => {
      melon_contract = MelonToken.at(result);
      return melon_contract.creator()
    }).then((result) => {
      return contract.dotToken();
    }).then((result) => {
      dot_contract = DotToken.at(result);
      done();
    });
  });

  it('Set up test cases', (done) => {
    testCases = [];
    const numBlocks = 8;
    for (i = 0; i < numBlocks; i++) {
      const blockNumber = Math.round(startTime + (endTime-startTime)*i/(numBlocks-1));
      let expectedPrice;
      if (blockNumber>=startTime && blockNumber<startTime + 2*SECONDS_PER_WEEK) {
        expectedPrice = 1075;
      } else if (blockNumber>=startTime + 2*SECONDS_PER_WEEK && blockNumber < startTime + 4*SECONDS_PER_WEEK) {
        expectedPrice = 1050;
      } else if (blockNumber>=startTime + 4*SECONDS_PER_WEEK && blockNumber < startTime + 6*SECONDS_PER_WEEK) {
        expectedPrice = 1025;
      } else if (blockNumber>=startTime + 6*SECONDS_PER_WEEK && blockNumber < startTime + 8*SECONDS_PER_WEEK) {
        expectedPrice = 1000;
      } else {
        expectedPrice = 0;
      }
      const accountNum = Math.max(1,Math.min(i+1, accounts.length-1));
      const account = accounts[accountNum];
      expectedPrice = Math.round(expectedPrice);
      testCases.push(
        {
          accountNum: accountNum,
          blockNumber: blockNumber,
          expectedPrice: expectedPrice,
          account: account,
        }
      );
    }
    done();
  });

  it('Should sign test cases', (done) => {
    async.mapSeries(testCases,
      function(testCase, callbackMap) {
        const hash = '0x' + sha256(new Buffer(testCase.account.slice(2),'hex'));
        sign(web3, signer, hash, (err, sig) => {
          testCase.v = sig.v;
          testCase.r = sig.r;
          testCase.s = sig.s;
          callbackMap(null, testCase);
        });
      },
      function(err, newTestCases) {
        testCases = newTestCases;
        done();
      }
    );
  });

});
