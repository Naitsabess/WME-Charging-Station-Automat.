// ==UserScript==
// @name         WME Charging-Station-Automat.
// @version      v0.1
// @namespace    http://tampermonkey.net/
// @description  Scans screen for open charaging station PURs
// @author       FasterinoSpeederino
// @match        *.waze.com/*editor*
// @exclude      *.waze.com/*user/editor
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @require https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js?version=1161728
// @grant        none
// ==/UserScript==

// Version history
// v 0.1 - Initial version of the script

/* global W, $ */


(function() {
    'use strict';

    const SCRIPT_VERSION = GM_info.script.version;
    const SETTINGS = {
        default: {
            language: "en",
        }
    }
    const STRINGS = {
        "en": {
            scanArea: "Scan Area",
        },
        "de": {
            scanArea: "Suche im Gebiet",
        }
    }

    let openUpdateRequests = [];
    let language = SETTINGS.default.language;
    let style = document.createElement("style");
    style.type = "text/css";
    //style.append("#CSA-tab {heigth: 100%}");
    style.append("#CSA-tab > h1 {font-size: 1.2em; margin-top: -20px;}");
    document.getElementsByTagName("head")[0].appendChild(style);



    function getOpenUpdateRequests() {
    const updateRequests = W.model.mapUpdateRequests.getObjectArray();
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

        if (openUpdateRequests.length > 0) {
            document.getElementById("scan-button").style = "display: none";
        }

        const list = document.createElement("ul");
        openUpdateRequests.forEach(request => {
            const listItem = document.createElement("li");
            listItem.innerText = `${request.name} (${request.address})`;
            list.appendChild(listItem);
        });
        return list;
    }

    function initialize() {
        const {tabLabel, tabPane} = W.userscripts.registerSidebarTab("Charging-Station-Automat.");
        W.userscripts.waitForElementConnected(tabLabel).then(() => {
            tabLabel.innerText = "CSA Script";
        });

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            tabPane.id = "CSA-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.innerHTML += `version: ${SCRIPT_VERSION}`;
            tabPane.append(document.createElement("hr"));
            tabPane.appendChild(document.createElement("div"));

            let scanButton = document.createElement("button");
            scanButton.id = "scan-button";
            scanButton.innerText = STRINGS[language].scanArea;
            scanButton.style = "display: block; margin: 40% auto 50% auto; background-color: limegreen; color: white; border-radius: 4px; border: none";
            scanButton.addEventListener("click", populateOpenUpdateRequestsList);
            tabPane.appendChild(scanButton);
        })
    }

    (function Bootstrap() {
        if(W?.userscripts?.state?.isready) {
            initialize();
        }
        else {
            document.addEventListener("wme-ready", initialize, {once: true});
        }
    })();
})();
