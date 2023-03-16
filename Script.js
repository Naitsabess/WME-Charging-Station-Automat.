const SCRIPT_VERSION = 0.1;

let openUpdateRequests = [];

let style = document.createElement("style");
    style.type = "text/css";
    style.innerHTML = "#CSA-tab > h1 {font-size: 1.2em; margin-top: -20px;}";
    document.getElementsByTagName("head")[0].appendChild(style);

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
        });
        
        W.userscripts.waitForElementConnected(tabPane).then(() => {
            tabPane.id = "CSA-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.append(document.createElement("hr"));
        }
    }
                                                            
    function getPlaceUpdateRequests() {
    const updateRequests = W.model.venues.objects;
    const openRequests = updateRequests.filter(obj => obj.isUpdateRequest && obj.state === 1);
    openUpdateRequests = openRequests.map(obj => {
        return {
            id: obj.attributes.id,
            name: obj.attributes.name,
            address: obj.attributes.street,
            provider: obj.attributes.providerID
        };
    });
    return openUpdateRequests;
}
    
    function populateOpenUpdateRequestsList() {
    const list = document.createElement("ul");
    openUpdateRequests.forEach(request => {
        const listItem = document.createElement("li");
        listItem.innerText = `${request.name} (${request.address})`;
        list.appendChild(listItem);
    });
    return list;
}

})();
