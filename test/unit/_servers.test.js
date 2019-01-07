"use strict";
var assert = require('assert');

describe("importing sample data", function () {
    it("do import", function (done) {

        done();
    });

    after(function (done) {
        console.log('test data imported.');
        require("./lib.utils.test.js");
        require("./lib.version.test.js");
        done();
    });
});