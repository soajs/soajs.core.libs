'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

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