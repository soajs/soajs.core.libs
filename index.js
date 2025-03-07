'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 *
 * @type {{registry: exports}}
 */
module.exports = {
    "registry": require("./lib/registry.js"),
    "utils": require("./lib/utils.js"),
    "version": require("./lib/version.js")
};