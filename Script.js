const SCRIPT_VERSION = 0.1;

(function() {
    'use strict';

    (function Bootstrap() {
        if(W?.userscripts?.state?.isready) {
            initialize();
        }
        else {
            document.addEventListener("wme-ready", initialize, {once: true});
        }
    })();

    function initialize() {
        const {tabLabel, tabPane} = W.userscripts.registerSidebarTab("Charging-Station-Automat.");
        W.userscripts.waitForElementConnected(tabLabel).then(() => {
            tabLabel.innerText = "CSA Script";
            tabPane.id = "CSA-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.append(document.createElement("hr"));

            console.log(getPlaceUpdateRequests());
        });
    }

    let style = document.createElement("style");
    style.type = "text/css";
    style.innerHTML = "#CSA-tab > h1 {font-size: 1.2em; margin-top: -20px;}";
    document.getElementsByTagName("head")[0].appendChild(style);


    function getPlaceUpdateRequests() {
        const updateRequests = W.model.venues.objects;
        updateRequests.filter(obj => obj.isUpdateRequest);
        return updateRequests;
    }

})();
