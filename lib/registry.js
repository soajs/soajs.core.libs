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
 * @type {{getServiceConf: getServiceConf}}
 */
module.exports = {
    getServiceConf: function (service, registry) {
        let serviceConf = null;
        if (service && registry && registry.services && registry.services[service] && registry.services[service].port) {
            serviceConf = {};
            serviceConf.info = registry.services[service];
            serviceConf._conf = registry.serviceConfig;
        }

        return serviceConf;
    },
    getDaemonServiceConf: function (daemon, registry) {
        let daemonServiceConf = null;
        if (daemon && registry && registry.daemons && registry.daemons[daemon] && registry.daemons[daemon].port) {
            daemonServiceConf = {};
            daemonServiceConf.info = registry.daemons[daemon];
            daemonServiceConf._conf = registry.serviceConfig;
        }

        return daemonServiceConf;
    }
};