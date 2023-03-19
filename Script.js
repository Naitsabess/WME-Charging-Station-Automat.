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

/* global W, $, WazeWrap*/


(function() {
    'use strict';


    // -------------------------- Basic settings -------------------------------------------
    const SCRIPT_NAME = GM_info.script.name;
    const SCRIPT_VERSION = GM_info.script.version;
    const SCRIPT_AUTHOR = GM_info.script.author;
    const RELEASE_NOTES = "Initial version of the script";
    const DEBUG = true;
    const SETTINGS = {
        default: {
            language: "en",
        }
    }
    const STRINGS = {
        "en": {
            scan_area: "Scan area",
            no_results_found: "No results found",
            choose_network: "Choose network",
            charging_stations_found: "Charging stations found",
            venue_no_name: "No name",
            venue_no_street_name: "No street",
            start_edit_all: "edit all",
            scan_again: "scan again"
        },
        "de": {
            scan_area: "Suche im Gebiet",
            no_results_found: "Keine Ergebnisse",
            choose_network: "Wähle Betreiber",
            charging_stations_found: "Ladestationen gefunden",
            venue_no_name: "Ohne Name",
            venue_no_street_name: "keine Straße",
            start_edit_all: "alle bearbeiten",
            scan_again: "scanne erneut"
        }
    }

    // -------------------------- Variables needed for functionality -------------------------
    let tabLabel, tabPane;

    let mapScanResult = null;
    let chargingStationsInView = [];
    let chargingStationsWithUpdateRequests = [];
    let chargingStationNetworks = [];
    let language = SETTINGS.default.language;

    // -------------------------- Functions --------------------------------------------------

    function loadResultsSidebar() {
        DEBUG && console.log(SCRIPT_NAME + ": Loading results sidebar...");

        // check if results sidebar is already created by a previous search -> then delete it before recreation
        let resultsSidebar = document.getElementById("results-sidebar-state");
        if (resultsSidebar) {
            tabPane.removeChild(resultsSidebar);
        }
        resultsSidebar = document.createElement("div");
        resultsSidebar.id = "results-sidebar-state";
        tabPane.appendChild(resultsSidebar);

        const networksFilter = document.createElement("fieldset");
        networksFilter.style = "margin-bottom: 30px;";
        resultsSidebar.appendChild(networksFilter);

        const selectNetwork = document.createElement("select");
        selectNetwork.id = "select-network";
        selectNetwork.name = "provider";
        selectNetwork.style = "margin-right: 30px; padding: 2px 0; text-align: center";
        networksFilter.appendChild(selectNetwork);
        selectNetwork.innerHTML = `<option value="default">${STRINGS[language].choose_network}</option>`;
        for (let i = 0; i < chargingStationNetworks.length; i++) {
            selectNetwork.innerHTML += `<option value="${chargingStationNetworks[i]}">${chargingStationNetworks[i]}</option>`;
        }

        const startEditButton = document.createElement("button");
        startEditButton.id ="start-edit-button";
        startEditButton.innerText = STRINGS[language].start_edit_all;
        //startEditButton.addEventListener("click",
        networksFilter.appendChild(startEditButton);

        const rescanButton = document.createElement("button");
        rescanButton.innerText = STRINGS[language].scan_again;
        rescanButton.style = "border: none";
        rescanButton.addEventListener("click", () => {
            if(mapScan()) {
                loadResultsSidebar();
            } else {
                tabPane.removeChild(resultsSidebar);
                loadDefaultSidebar();
            }
        });
        networksFilter.appendChild(rescanButton);

        // ------------------------------- Beginn drawing the result table ---------------------------------------------
        console.log(chargingStationsInView[0].getAddress());//testing only
        const resultsTable = document.createElement("div");
        resultsTable.id = "results-table";
        resultsSidebar.appendChild(resultsTable);
        let tableHTML =
            `<h2>${STRINGS[language].charging_stations_found} (${chargingStationsInView.length}):</h2>
            <table style="background-color: #eeeee4; font-size: 0.9em;";">
                <tbody>`;
        // one row for each charging station entry
        for (let i = 0; i < chargingStationsInView.length; i++) {
            const venueName = (chargingStationsInView[i].getName() === null) ? STRINGS[language].venue_no_name : chargingStationsInView[i].getName();
            const venueStreetName = (chargingStationsInView[i].getAddress().isEmptyStreet()) ? STRINGS[language].venue_no_street_name : chargingStationsInView[i].getAddress().getStreetName();
            const venueHouseNumber = (chargingStationsInView[i].getAddress().getHouseNumber() === null) ? "" : " " + chargingStationsInView[i].getAddress().getHouseNumber();
            // adds number at the beginn of the row with some styling
            tableHTML +=
                `<tr style="border: 1px solid black;">
                     <td style="min-width: 25px; text-align: center; border-right: 1px solid black;">${i + 1}</td>`;

            // adds the search results with name and street name / house number (if available)
            tableHTML +=
                `<td style="padding: 0 10px;">${venueName}<br><i>(${venueStreetName}${venueHouseNumber})</i></td></tr>`;
        }// end for
        tableHTML +=
            `</tbody>
            </table>`;
        resultsTable.innerHTML = tableHTML;
        DEBUG && console.log(SCRIPT_NAME + ": Results sidebar successfully loaded!");

        // ------------------------------- End drawing the result table ---------------------------------------------------
    }

    function mapScan() {
        // search should produce a unique search result
        if (chargingStationsInView.length !== 0) {
            chargingStationsInView.length = 0;
        }
        if (chargingStationsWithUpdateRequests.length !== 0) {
            chargingStationsWithUpdateRequests.length = 0;
        }
        if(chargingStationNetworks.length !== 0) {
            chargingStationNetworks.length = 0;
        }

        chargingStationsInView = W.model.venues.getObjectArray().filter(obj => obj.isChargingStation() && obj.outOfScope === false);
        chargingStationNetworks = chargingStationsInView.map(obj => obj.attributes.categoryAttributes.CHARGING_STATION.network).filter((obj, index, array) => array.indexOf(obj) === index);
        chargingStationsWithUpdateRequests = chargingStationsInView.filter(obj => !obj.hasUpdateRequests());

        if (chargingStationsInView.length > 0) {
            DEBUG && console.log(SCRIPT_NAME + ": Map scan completed. Results found: ");
            DEBUG && console.dir(chargingStationsInView);
            mapScanResult = true;
            return true;
        } else {
          DEBUG && console.log(SCRIPT_NAME + ": Map scan completed. No results found!");
            mapScanResult = false;
            return false;
        }
    }

    /*function scanButtonBehavior() {
        const defaultSidebar = document.getElementById("default-sidebar-state");
        const resultsSidebar = document.getElementById("results-sidebar-state");
        if (mapScan()) { // TO-DO: map scan checks only if EVCS were found at all. Should support results where there are EVCS but without update request
            defaultSidebar.style.display = "none"// the sidebar div the script loads initially, make sure it's hidden
            loadResultsSidebar();
        } else { // if no results are found
            resultsSidebar.style.display = "none";
            loadDefaultSidebar();
        }
    }*/

    function loadDefaultSidebar() {
        let defaultSidebar = document.getElementById("default-sidebar-state");
        if (defaultSidebar) { //if loaded before
            tabPane.removeChild(defaultSidebar)
        }

        defaultSidebar = document.createElement("div");
        defaultSidebar.id = "default-sidebar-state";
        tabPane.appendChild(defaultSidebar);

        const scanButton = document.createElement("button");
        scanButton.id = "scan-button";
        scanButton.innerText = STRINGS[language].scan_area;
        scanButton.style = "display: block; margin: 40% auto 85% auto; padding: 0 20px; background-color: limegreen; color: white; border-radius: 4px; border: none";
        scanButton.addEventListener("click", () => {
            if(mapScan()) {
                tabPane.removeChild(defaultSidebar);
                loadResultsSidebar();
            } else {
                showErrorMessage();
            }
        });
        defaultSidebar.appendChild(scanButton);

        if (mapScanResult === false) {
            showErrorMessage();
        }

        function showErrorMessage() {
            let scanInfoMessage = document.getElementById("scan-info-message");
            if (!scanInfoMessage) { // only if scan message is not there yet
                scanInfoMessage= document.createElement("p");
                scanInfoMessage.id = "scan-info-message";
                scanInfoMessage.style = "color: rgb(255, 0, 0)";
                scanInfoMessage.innerHTML = STRINGS[language].no_results_found + "!";
                scanButton.appendChild(scanInfoMessage);
            }
        }
    }

    function initialize() {

        // dertermine language
        const hyperlink = window.location.href;
        for (const key of Object.keys(STRINGS)) {
            const languageRegex = new RegExp(".*" + key + ".*", "");
            if (languageRegex.test(hyperlink)) {
                language = key;
                break;
            }
       }
        DEBUG && console.log(SCRIPT_NAME + ": language: " + language);

        WazeWrap.Interface.ShowScriptUpdate("WME Charging.Station-Automat.", SCRIPT_VERSION, RELEASE_NOTES, "Greasyfork Link", "Forum Link");

        let style = document.createElement("style");
        style.type = "text/css";
        style.append("#CSA-tab > * {margin-bottom: 0;}");
        style.append(".spacer {padding-bottom: 10px;}");
        style.append("#CSA-tab > h1 {font-size: 1.3rem; margin-top: -20px;}");
        style.append("#CSA-tab h2 {font-size: 1.1rem;}");
        style.append("#CSA-tab > div > h2 {font-size: 1.1rem;}");
        document.getElementsByTagName("head")[0].appendChild(style);

        ({tabLabel, tabPane} = W.userscripts.registerSidebarTab("Charging-Station-Automat."));
        W.userscripts.waitForElementConnected(tabLabel).then(() => {
            tabLabel.innerText = "CSA Script";
        });

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            // -------------------------create header that stays on top----------------------------------------
            tabPane.id = "CSA-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.innerHTML += `<p>version: ${SCRIPT_VERSION}<br>by ${SCRIPT_AUTHOR}</p>`;
            tabPane.innerHTML += `<hr class="spacer">`;
            // -------------------------create header that stays on top----------------------------------------

            loadDefaultSidebar();
            DEBUG && console.log(SCRIPT_NAME + ": Initialized");
            DEBUG && console.dir(W.model.venues); //test only
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
