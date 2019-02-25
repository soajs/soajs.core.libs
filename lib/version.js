"use strict";

let version = {
    'getLatest': (vPre, vNew) => {
        if (!vPre)
            return vNew;

        if (version.validate(vPre) && version.validate(vNew)) {
            let vNewNb = parseFloat(vNew);
            let vPreNb = parseFloat(vPre);

            if (vNewNb > vPreNb)
                return vNew;
        }
        return vPre;
    },

    'isLatest': (vSrc, vCom) => {
        if (version.validate(vSrc) && version.validate(vCom)) {
            let vSrcNb = parseFloat(vSrc);
            let vComNb = parseFloat(vCom);

            if (vSrcNb > vComNb)
                return true;
        }
        return false;
    },

    'validate': (ver) => {
        if (ver) {
            if (typeof ver !== 'string')
                ver = "" + ver;
            ver = version.unsanitize(ver);
            let matches = ver.match(/[0-9]+(.[0-9]+)?/);
            if (matches && matches.length > 0) {
                return true;
            }
        }
        return false
    },

    'sanitize': (ver) => {
        if (ver) {
            if (typeof ver !== 'string')
                ver = "" + ver;
            if (ver.indexOf(".") != -1)
                ver = ver.replace(".", "x");
        }
        return ver;
    },

    'unsanitize': (ver) => {
        if (ver) {
            if (typeof ver !== 'string')
                ver = "" + ver;
            if (ver.indexOf("x") != -1)
                ver = ver.replace("x", ".");
        }
        return ver;
    }

};

module.exports = version;