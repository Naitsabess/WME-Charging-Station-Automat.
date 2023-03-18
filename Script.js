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
            scan_Area: "Scan Area",
            results_table_heading: "Charging stations:",
            venue_no_name: "No name",
            venue_no_street_name: "No street",
        },
        "de": {
            scanArea: "Suche im Gebiet",
            results_table_heading: "Ladestationen:",
            venue_no_name: "Ohne Name",
            venue_no_street_name: "keine Straße",
        }
    }

    // -------------------------- Variables needed for functionality -------------------------
    let chargingStationsInView = [];
    let chargingStationsUpdateRequests = [];
    let language = SETTINGS.default.language;

    // -------------------------- Functions --------------------------------------------------

    function showResultsInSidebar(tabPane) {
        DEBUG && console.log(SCRIPT_NAME + ": Loading results sidebar...");
        document.getElementById("scan-button").style = "display: none";
        // check if it's already created by a previous search
        let resultsSidebar = document.getElementById("results-sidebar-state");
        if (resultsSidebar) {
            tabPane.removeChild(resultsSidebar);
        }
        resultsSidebar = document.createElement("div");
        resultsSidebar.id = "results-sidebar-state";
        tabPane.appendChild(resultsSidebar);

        const selectProvider = document.createElement("select");
        selectProvider.id = "select-provider";
        selectProvider.name = "provider";
        resultsSidebar

        // ------------------------------- Beginn drawing the result table ---------------------------------------------

        console.log(chargingStationsInView[0].getAddress());
        let searchResultsListHTML =
            `<h2>${STRINGS[language].results_table_heading}</h2>
            <table style="background-color: #eeeee4; font-size: 0.9em;">
                <tbody>`;

        // one row for each charging station entry
        for (let i = 0; i < chargingStationsInView.length; i++) {
            const venueName = (chargingStationsInView[i].getName() === null) ? STRINGS[language].venue_no_name : chargingStationsInView[i].getName();
            const venueStreetName = (chargingStationsInView[i].getAddress().isEmptyStreet()) ? STRINGS[language].venue_no_street_name : chargingStationsInView[i].getAddress().getStreetName();
            const venueHouseNumber = (chargingStationsInView[i].getAddress().getHouseNumber() === null) ? "" : " " + chargingStationsInView[i].getAddress().getHouseNumber();

            // adds number at the beginn of the row with some styling
            searchResultsListHTML +=
                `<tr style="border: 1px solid black;">
                     <td style="min-width: 25px; text-align: center; border-right: 1px solid black;">${i + 1}</td>`;

            // adds the search results with name and street name / house number (if available)
            searchResultsListHTML += `<td style="padding: 0 10px;">${venueName}<br><i>(${venueStreetName}${venueHouseNumber})</i></td>`;
                 `</tr>`;
        }// end for
        searchResultsListHTML +=
                `</tbody>
            </table>`;
        resultsSidebar.innerHTML += searchResultsListHTML;

        // ------------------------------- End drawing the result table ---------------------------------------------------
    }

    function mapScan() {
        // search should produce a unique search result
        if (chargingStationsInView.length !== 0) {
            chargingStationsInView.length = 0;
        }

        chargingStationsInView = (W.model.venues.getObjectArray().filter(obj => obj.isChargingStation() && obj.outOfScope === false));
        chargingStationsUpdateRequests = chargingStationsInView.filter(obj => !obj.isApproved());
        DEBUG && console.log(SCRIPT_NAME + ": Map scan completed. Results found: ");
        DEBUG && console.dir(chargingStationsInView);
        }

    function loadDefaultSidebar(tabPane) {
        const defaultSidebar = document.createElement("div");
        defaultSidebar.id = "default-sidebar-state";
        tabPane.appendChild(defaultSidebar);

        const scanButton = document.createElement("button");
        scanButton.id = "scan-button";
        scanButton.innerText = STRINGS[language].scan_Area;
        scanButton.style = "display: block; margin: 40% auto 85% auto; background-color: limegreen; color: white; border-radius: 4px; border: none";
        scanButton.addEventListener("click", () => {
            mapScan();
            showResultsInSidebar(tabPane);
        });
        defaultSidebar.appendChild(scanButton);
    }

    function initialize() {

        WazeWrap.Interface.ShowScriptUpdate("WME Charging.Station-Automat.", SCRIPT_VERSION, RELEASE_NOTES, "Greasyfork Link", "Forum Link");

        let style = document.createElement("style");
        style.type = "text/css";
        style.append("#CSA-tab > * {margin-bottom: 0;}");
        style.append(".spacer {padding-bottom: 10px;}");
        style.append("#CSA-tab > h1 {font-size: 1.3rem; margin-top: -20px;}");
        style.append("#CSA-tab > div > h2 {font-size: 1.1rem;}");
        style.append("#CSA-tab > div > h2 {font-size: 1.1rem;}");
        document.getElementsByTagName("head")[0].appendChild(style);

        const {tabLabel, tabPane} = W.userscripts.registerSidebarTab("Charging-Station-Automat.");
        W.userscripts.waitForElementConnected(tabLabel).then(() => {
            tabLabel.innerText = "CSA Script";
        });

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            // create header that stays on top
            tabPane.id = "CSA-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.innerHTML += `<p>version: ${SCRIPT_VERSION}<br>by ${SCRIPT_AUTHOR}</p>`;
            tabPane.innerHTML += `<hr class="spacer">`;
            loadDefaultSidebar(tabPane);
            DEBUG && console.log(SCRIPT_NAME + ": Initialized");
            DEBUG && console.dir(W.model.venues);
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
