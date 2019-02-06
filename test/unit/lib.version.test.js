"use strict";
let assert = require('assert');
let helper = require("../helper.js");

var utils = helper.requireModule('./lib/version');

describe("testing version", function () {


    let version1 = "1.0";
    let version2 = "1.2";
    let wrongVersion = "b.a.3";

    it("testing getLatest", function (done) {
        let ver = utils.getLatest(version1, version2);
        assert.ok(ver);
        assert.equal(ver, version2);
        done();
    });
    it("testing getLatest with null version", function (done) {
        let ver = utils.getLatest(null, version2);
        assert.ok(ver);
        assert.equal(ver, version2);
        done();
    });
    it("testing getLatest with wrong version", function (done) {
        let ver = utils.getLatest(wrongVersion, version2);
        assert.ok(ver);
        assert.equal(ver, wrongVersion);
        done();
    });


    it("testing isLatest - false", function (done) {
        let ver = utils.isLatest(version1, version2);
        assert.ok(!ver);
        done();
    });
    it("testing isLatest - true", function (done) {
        let ver = utils.isLatest(version2, version1);
        assert.ok(ver);
        done();
    });
    it("testing isLatest with null", function (done) {
        let ver = utils.isLatest(null, version2);
        assert.ok(!ver);
        done();
    });


    it("testing validate not string", function (done) {
        let ver = utils.validate(1);
        assert.ok(ver);
        done();
    });
    it("testing validate null", function (done) {
        let ver = utils.validate(null);
        assert.ok(!ver);
        done();
    });

    it("testing sanitize null", function (done) {
        let ver = utils.sanitize(null);
        assert.ok(!ver);
        done();
    });
    it("testing sanitize number", function (done) {
        let ver = utils.sanitize(1.1);
        assert.ok(ver);
        done();
    });
    it("testing sanitize string", function (done) {
        let ver = utils.sanitize("1.2");
        assert.ok(ver);
        done();
    });
    it("testing unsanitize null", function (done) {
        let ver = utils.unsanitize(null);
        assert.ok(!ver);
        done();
    });
    it("testing unsanitize number", function (done) {
        let ver = utils.unsanitize(1);
        assert.ok(ver);
        done();
    });
    it("testing unsanitize string", function (done) {
        let ver = utils.unsanitize("1x2");
        assert.ok(ver);
        done();
    });
});