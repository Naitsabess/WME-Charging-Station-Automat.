// ==UserScript==
// @name         WME Charging-Station-Automat.
// @version      v0.1
// @namespace    http://tampermonkey.net/
// @description  Scans screen for open EVCS PURs and lets you edit multiple PURs in one panel by provider
// @author       FasterinoSpeederino
// @match        *.waze.com/*editor*
// @exclude      *.waze.com/*user/editor
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @require https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js?version=1161728
// @grant        none
// ==/UserScript==

// Version history
// v 0.1 - Initial version of the script

/* global W, $, WazeWrap, require */


(function() {
    'use strict';


    // -------------------------- Basic settings -------------------------------------------
    const SCRIPT_NAME = GM_info.script.name;
    const SCRIPT_VERSION = GM_info.script.version;
    const SCRIPT_AUTHOR = GM_info.script.author;
    const GREASYFORK_LINK = "";
    const FORUM_LINK = "";
    const RELEASE_NOTES = "Initial version of the script";
    const DEBUG = true;
    const SETTINGS = {
        default: {
            language: "en",
        }
    }

    // -------------------------- Strings for each supported language -----------------------
    const STRINGS = {
        "en": {
            access_type: "access type",
            alt_name: "alternative name",
            charging_stations_found: "Charging stations found",
            choose_network: "Choose network",
            cost: "cost",
            decline_request: "decline request",
            description: "description",
            edit: "Edit",
            house_number: "house number",
            location_in_venue: "location in venue",
            name: "name",
            network: "Network",
            no_results_found: "No results found",
            opening_hours: "opening hours",
            payment_methods: "payment methods",
            phone: "phone",
            scan_again: "Scan again",
            scan_area: "Scan area",
            start_edit_all: "edit all",
            street: "street",
            venue_no_name: "No name",
            venue_no_street_name: "No street",
            website: "website",
        },
        "de": {
            access_type: "Art der Zufahrt",
            alt_name: "Alternativname",
            charging_stations_found: "Ladestationen gefunden",
            choose_network: "Wähle Betreiber",
            cost: "Kosten",
            decline_request: "Update ablehnen",
            description: "Beschreibung",
            edit: "Bearbeiten",
            house_number: "Hausnummer",
            location_in_venue: "Ort innerhalb eines anderen Orts",
            name: "Name",
            network: "Betreiber",
            no_results_found: "Keine Ergebnisse",
            opening_hours: "Öffnungszeiten",
            payment_methods: "Zahlungsmethoden",
            phone: "Telefon",
            scan_again: "Suche erneut",
            scan_area: "Suche im Gebiet",
            start_edit_all: "alle bearbeiten",
            street: "Straße",
            venue_no_name: "Ohne Name",
            venue_no_street_name: "keine Straße",
            website: "Website",
        }
    }

    // -------------------------- Variables needed for functionality -------------------------
    let tabLabel, tabPane; //sidepane variables
    let AcceptVenueUpdate, UpdateObject, RemoveObject; // Waze action variables
    let language = SETTINGS.default.language;
    let mapScanResult = null; // Not yet used
    let chargingStationsInView = [];
    let chargingStationsWithUpdateRequests = [];
    let chargingStationNetworks = [];
    let selectedNetwork = "default";


    // -------------------------- Style ------------------------------------------------------
    let style = document.createElement("style");
    style.type = "text/css";
    style.append("#csa-tab * {margin-bottom: 0}");
    style.append(".spacer {padding-bottom: 10px;}");
    style.append("#csa-tab > h1 {font-size: 1.3rem; margin-top: -20px;}");
    style.append("#csa-tab h2 {font-size: 1.1rem;}");
    style.append("#csa-edit-popup * {margin-bottom: 2px}");
    style.append(".venue-property-string {display: inline-block; min-width: 150px}");
    style.append(".wide-input {width: 50%}");
    document.getElementsByTagName("head")[0].appendChild(style);

    // -------------------------- Functions --------------------------------------------------

    function loadPopup() {

        const mouseClick = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelabel: true
        });

        let defaultName = "";
        let defaultAlternativeName = "";
        let defaultDescription = "";
        let defaultLocationInVenue = "";
        let defaultCost;
        let defaultPaymentMethods;
        let defaultExternalProviders;
        let defaultAccessType;
        let defaultWebsite = "";
        let defaultPhone = "";
        let defaultOpeningHours;
        let chargingStationCounter = 1;

        let popup = document.getElementById("csa-edit-popup");
        if(!popup) {
            popup = document.createElement("div");
        }
        popup.id = "csa-edit-popup";
        popup.style = "position: fixed; visibility: visible; top:90px; left: 750px; z-index: 50; width: 40vw; max-width: 1000px; heigth: 400px; background-color: white; border-radius: 5px";
        popup.innerHTML = `<h1 style=" margin: 15px 15px 0 15px; font-size: 1.5em; text-align: center">${STRINGS[language].edit}</h1>`;
        document.getElementsByTagName("body")[0].appendChild(popup);

        const closeButton = document.createElement("button");
        closeButton.id = "close-button";
        closeButton.innerText = "close";
        closeButton.style = "position: absolute; top: 20px; right: 20px";
        closeButton.addEventListener("click", () => document.getElementsByTagName("body")[0].removeChild(popup));
        popup.appendChild(closeButton);

        drawPopupContent(chargingStationsWithUpdateRequests[0]);

        function drawPopupContent(currentChargingStationUpdateRequest) {
            DEBUG && console.log(SCRIPT_NAME + ": popup drawn with following chargingStation");
            DEBUG && console.dir(currentChargingStationUpdateRequest);
            const venueStreetName = (currentChargingStationUpdateRequest.getAddress().getStreetName() !== null) ? currentChargingStationUpdateRequest.getAddress().getStreetName() : STRINGS[language].venue_no_name;
            const venueHouseNumber = (currentChargingStationUpdateRequest.getAddress().getHouseNumber() !== null) ? currentChargingStationUpdateRequest.getAddress().getHouseNumber() : "";
            const venueName
            
            // draw popup next to the native place update panel
            W.map.setCenter(W.map.placeUpdatesLayer.featureMarkers[currentChargingStationUpdateRequest.attributes.id].marker.lonlat);

            // accept PUR to edit
            document.querySelector(`div[data-id="${currentChargingStationUpdateRequest.attributes.id}"]`).dispatchEvent(mouseClick);
            document.querySelector(`input[id="approved-true"]`).dispatchEvent(mouseClick);

            // ----------------------------variant 1, create panel with own input fields-----------------------------------------
            let contentWrapper = document.getElementById("content-wrapper");
            if (contentWrapper) {
                popup.removeChild(contentWrapper);
            }
            contentWrapper = document.createElement("div");
            contentWrapper.id = "content-wrapper";
            contentWrapper.style="padding: 0 15px 15px 15px; text-align: left";
            //style.append(".venue-property-string {display: inline-block}");
            popup.appendChild(contentWrapper);
            let popupHTML = `<p>${chargingStationCounter}/${chargingStationsWithUpdateRequests.length}: ${selectedNetwork}</p>`;
            popupHTML += `<hr class="spacer">`;
            //top line is unique from style because two inputs for the address are placed in the same line
            popupHTML += `<label for="venueStreetInput">${STRINGS[language].street}:</label> <input type="text" id="venueStreetInput" style="width: 50%" value="${venueStreetName}" />`;
            popupHTML += `<span style="float: right; margin-right: 25px"><label for="venueHouseNumberInput" style= "margin-right: 2px;">${STRINGS[language].house_number}:</label><input type="text" id="venueHouseNumberInput" style="width: 40px" value="${venueHouseNumber}" /></span><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-name" />`;
            popupHTML += `<label for="venueNameInput" class="venue-property-string">${STRINGS[language].name}: </label> <input type="text" class="wide-input" id="venueNameInput" value="${defaultName}" /><<br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-alternate-name" />`;
            popupHTML += `<label for="venueAltNameInput" class="venue-property-string">${STRINGS[language].alt_name}: </label> <input type="text" class="wide-input" id="venueAltNameInput" value="${defaultAlternativeName}" /><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-description" />`;
            popupHTML += `<label for="venueDescriptionInput" class="venue-property-string">${STRINGS[language].description}: </label> <input type="text" class="wide-input" id="venueDescriptionInput" value= ${defaultDescription} /><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-location-in-venue" />`;
            popupHTML += `<label for="venueLocationInVenueInput" class="venue-property-string">${STRINGS[language].location_in_venue}: </label> <input type="text" class="wide-input" id="venueLocationInVenueInput" value=${defaultLocationInVenue} /><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-cost" />`;
            popupHTML += `<label for="venueCostInput" class="venue-property-string">${STRINGS[language].cost}: </label> <input type="text" class="wide-input" id="venueCostInput" value=${defaultCost} /><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-payment-methods" />`;
            popupHTML += `<label for="venuePaymentMethodsInput" class="venue-property-string">${STRINGS[language].payment_methods}: </label> <input type="text" class="wide-input" id="venuePaymentMethodsInput" value=${defaultPaymentMethods} /><br>`;
            // popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-external-provider" />`;
            //popupHTML += `<label for="venueExternalProviderInput" class="venue-property-string">${STRINGS[language].external_provider}: </label> <input type="text" class="wide-input" id="venueExternalProviderInput" value=${defaultExternalProviders}></input>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-access-type" />`;
            popupHTML += `<label for="venueAccessTypeInput" class="venue-property-string">${STRINGS[language].access_type}: </label> <input type="text" class="wide-input" id="venueAccessTypeInput"></input><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-website" />`;
            popupHTML += `<label for="venueWebsiteInput" class="venue-property-string">${STRINGS[language].website}: </label> <input type="text" class="wide-input" id="venueWebsiteInput" /><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-phone" />`;
            popupHTML += `<label for="venuePhoneInput" class="venue-property-string">${STRINGS[language].phone}: </label> <input type="text" class="wide-input" id="venuePhoneInput" /><br>`;
            popupHTML += `input text="checkbox" class="is-default-checkbox" id="checkbox-default-venue-opening-hours" />`;
            popupHTML += `<label for="venueOpeningHoursInput" class="venue-property-string">${STRINGS[language].opening_hours}: </label> <input type="text" class="wide-input" id="venueOpeningHoursInput" />`;

            contentWrapper.innerHTML += popupHTML;

            // ------------------------------ logic ----------------------------------------------------------------------

            const checkboxDefaultVenueName = document.getElementById("checkbox-default-venue-name");
            checkboxDefaultVenueName.addEventListener("click", () => {
                if (checkboxDefaultVenueName.checked) {
                    if (venueStreetName !== defaultName) {
                        venueStreetName = defaultName;
                        drawPopupContent(currentChargingStationUpdateRequest);
                    }
                }
            })
            
            const editSubmitButton = document.createElement("wz-button");
            editSubmitButton.id = "edit-submit-button";
            editSubmitButton.addEventHandler("click", () => {


                // key variables of current charging station
                const WMEstreetNameRowElement = document.getElementsByClassName("street-name-row")[0];
                const WMEstreetNameInputElement = WMEstreetNameRowElement.getElementsByTagName("input")[0];
                const WMEhouseNumberElement = document.querySelector(".house-number");
                const WMEhouseNumberInputElement = WMEhouseNumberElement.querySelector("input");
                let AlternativeName;
                let Description;
                let LocationInVenue;
                let Cost;
                let PaymentMethods;
                let ExternalProviders;
                let AccessType;
                let Website;
                let Phone;
                let OpeningHours;


                WMEstreetNameInputElement.value = document.getElementById("venueStreetInput").value; // street name
                WMEhouseNumberInputElement = document.getElementById("venueStreetInput").value; // house number
            });
            // to-do: functionality not finished yet
            const declinePurButton = document.createElement("button");
            declinePurButton.id = "decline-pur-button";
            declinePurButton.innerText = STRINGS[language].decline_request;
            declinePurButton.addEventListener("click", () => {
                let deleteConfirmPopup = document.getElementById("csa-delete-confirm-popup");
                if (!deleteConfirmPopup) {
                    deleteConfirmPopup = document.createElement("div");
                    deleteConfirmPopup.innerHTML = `[PLACEHOLDER] Are you sure to delete the request?`;
                    document.getElementsByTagName("body")[0].appendChild(deleteConfirmPopup);
                    // document.querySelector(`input[id="approved-false"]`).dispatchEvent(mouseClick);
                }
            });
            contentWrapper.appendChild(declinePurButton);
        }
    }

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
        const networksFilter = document.createElement("form");
        networksFilter.style = "margin-bottom: 30px;";
        resultsSidebar.appendChild(networksFilter);

        const selectNetwork = document.createElement("select");
        selectNetwork.id = "select-network";
        selectNetwork.name = "network";
        selectNetwork.style = "width: 190px; margin-right: 10px; padding: 2px 0; text-align: center";
        selectNetwork.addEventListener("click", () => {selectNetwork.style.borderColor = "black";}); // in case border is highlighted red before because input was missing
        networksFilter.appendChild(selectNetwork);
        selectNetwork.innerHTML = `<option value="default">${STRINGS[language].choose_network}</option>`;
        for (let i = 0; i < chargingStationNetworks.length; i++) {
            selectNetwork.innerHTML += `<option value="${chargingStationNetworks[i]}">${chargingStationNetworks[i]}</option>`;
        }

        const startEditButton = document.createElement("wz-button");
        startEditButton.id = "start-edit-button";
        startEditButton.style = "size: sm";
        startEditButton.innerText = STRINGS[language].start_edit_all;
        startEditButton.addEventListener("click", () => {
            selectedNetwork = selectNetwork.value;
            console.log(selectedNetwork);

            if (selectedNetwork !== "default") {
                loadPopup();
            }
            else {
                selectNetwork.style.borderColor = "red";
            }
        })
        networksFilter.appendChild(startEditButton);

        const rescanButton = document.createElement("button");
        rescanButton.innerText = STRINGS[language].scan_again;
        rescanButton.style = "background-color: none; border: none";
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

            // adds the search results with name and street name and house number (if available)
            tableHTML +=
                `<td style="padding: 0 10px;">${venueName}<br><i>(${venueStreetName}${venueHouseNumber})</i></td></tr>`;
        }// end for
        tableHTML +=
            `</tbody>
            </table>`;
        resultsTable.innerHTML = tableHTML;
        DEBUG && console.log(SCRIPT_NAME + ": Results sidebar loaded successfully!");

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
        chargingStationsWithUpdateRequests = chargingStationsInView.filter(obj => obj.hasUpdateRequests());

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
    // deprecated
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

        // dertermine language, default is English (en)
        const hyperlink = window.location.href;
        for (const key of Object.keys(STRINGS)) {
            const languageRegex = new RegExp(".*" + key + ".*", "");
            if (languageRegex.test(hyperlink)) {
                language = key;
                break;
            }
        }
        DEBUG && console.log(SCRIPT_NAME + ": language: " + language);

        WazeWrap.Interface.ShowScriptUpdate("WME Charging.Station-Automat.", SCRIPT_VERSION, RELEASE_NOTES, GREASYFORK_LINK, FORUM_LINK);

        ({tabLabel, tabPane} = W.userscripts.registerSidebarTab("Charging-Station-Automat."));
        W.userscripts.waitForElementConnected(tabLabel).then(() => {
            tabLabel.innerText = "CSA Script";
        });

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            // ------------------------- create header that stays on top ----------------------------------------
            tabPane.id = "csa-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.innerHTML += `<p>version: ${SCRIPT_VERSION}<br>by ${SCRIPT_AUTHOR}</p>`;
            tabPane.innerHTML += `<hr class="spacer">`;
            // ------------------------- end header -------------------------------------------------------------

            loadDefaultSidebar();
            DEBUG && console.log(SCRIPT_NAME + ": Initialized");
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
