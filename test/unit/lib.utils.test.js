'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let assert = require('assert');
let fs = require("fs");
let helper = require("../helper.js");

let utils = helper.requireModule('./lib/utils');

describe("testing utils", function () {

	describe("testing cloneObj", function () {

		let obj1 = {
			'ts': new Date(),
			'reg': /[a-z]+/,
			'arr': ['foo', 'barr']
		};

		it("testing cloneObj", function (done) {
			let obj2 = utils.cloneObj(obj1);
			assert.ok(obj2);
			assert.deepEqual(obj2, obj1);
			done();
		});
	});

	describe("testing validProperty", function () {
		let obj1 = {
			"antoine": "hage"
		};

		it("testing validProperty", function (done) {
			let obj2 = utils.validProperty(obj1, "antoine");
			assert.ok(obj2);
			done();
		});
	});
});