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
            access_type: "Access type",
            alt_name: "Alternative name",
            app: "app",
            charging_stations_found: "Charging stations found",
            choose_network: "Choose network",
            close: "Close",
            cost: "Cost",
            cost_type_unspecified: "unknown",
            credit_card: "credit card",
            debit_card: "debit card",
            // decline_request: "decline request", not needed
            description: "Description",
            edit: "Edit",
            fee: "fee",
            free: "free",
            house_number: "House number",
            location_in_venue: "Location in venue",
            maximize: "maximize",
            membership_card: "membership card",
            minimize: "minimize",
            name: "Name",
            network: "Network",
            next: "next",
            no_results_found: "No results found",
            none_left_save: "none left - save",
            online_payment: "online payment",
            opening_hours: "Opening hours",
            other: "other",
            payment_methods: "Payment methods",
            phone: "Phone",
            plugin_autocharge: "plug-in autocharge",
            private: "private",
            public: "public",
            restricted: "restricted",
            scan_again: "Scan again",
            scan_area: "Scan area",
            start_edit: "edit",
            street: "Street",
            venue_no_name: "No name",
            venue_no_street_name: "No street",
            website: "Website",
        },
        "de": {
            access_type: "Art der Zufahrt",
            alt_name: "Alternativname",
            app: "App",
            charging_stations_found: "Ladestationen gefunden",
            choose_network: "Wähle Betreiber",
            close: "schließen",
            cost: "Kosten",
            cost_type_unspecified: "keine Angabe",
            credit_card: "Kreditkarte",
            debit_card: "Debitkarte",
            // decline_request: "Update ablehnen", // not needed
            description: "Beschreibung",
            edit: "Bearbeiten",
            fee: "kostenpflichtig",
            free: "kostenlos",
            house_number: "Hausnummer",
            location_in_venue: "Ort innerhalb eines anderen Orts",
            maximize: "maximieren",
            membership_card: "Mitgliedskarte",
            minimize: "minimieren",
            name: "Name",
            network: "Betreiber",
            next: "Nächster",
            no_results_found: "Keine Ergebnisse",
            none_left_save: "keiner ausstehend - speichern",
            online_payment: "Online-Bezahlung",
            opening_hours: "Öffnungszeiten",
            other: "Andere",
            payment_methods: "Zahlungsmethoden",
            phone: "Telefon",
            plugin_autocharge: "Plugin-autocharge",
            private: "privat",
            public: "öffentlich",
            restricted: "beschränkt",
            scan_again: "Suche erneut",
            scan_area: "Suche im Gebiet",
            start_edit: "bearbeiten",
            street: "Straße",
            venue_no_name: "Ohne Name",
            venue_no_street_name: "keine Straße",
            website: "Website",
        }
    }

    // -------------------------- Variables needed for functionality -------------------------
    let tabLabel, tabPane; //sidepane variables
    //let AcceptVenueUpdate, UpdateObject, RemoveObject; // Waze action variables
    let language = SETTINGS.default.language;
    let mapScanResult = null; // Not yet used
    let chargingStationsInView = [];
    let chargingStationsWithUpdateRequests = [];
    let chargingStationNetworks = [];
    let selectedNetwork = "default";
    let chargingStationLocationMarkers = {};


    // -------------------------- Style ------------------------------------------------------
    let style = document.createElement("style");
    style.type = "text/css";
    style.append("#csa-tab * {margin-bottom: 0}");
    style.append(".spacer-variant-1 {padding-bottom: 10px;}");
    style.append(".spacer-variant-2 {margin-top: 5px}");
    style.append("#csa-tab > h1 {font-size: 1.3rem; margin-top: -20px;}");
    style.append("#csa-tab h2 {font-size: 1.1rem;}");
    style.append("#csa-edit-popup {position: fixed; top:80px; left: 750px; visibility: visible; z-index: 50; width: 40%; max-width: 1000px; background-color: white; border-radius: 5px}");
    style.append("#csa-edit-popup * {margin-bottom: 2px}");
    style.append("#csa-edit-popup .contentWrapper {margin-top: 5px}");
    style.append(".venue-property-string {margin-left: 5 px; display: inline-block; width: 150px}");
    style.append('#csa-edit-popup input[type="checkbox"] {margin-right: 3px}');
    style.append(".property-input {width: 60%}");
    style.append("#csa-edit-popup footer {margin-left: 20px}");
    document.getElementsByTagName("head")[0].appendChild(style);

    // -------------------------- Functions --------------------------------------------------

    function initializeEditPopup() {

        const mouseClick = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelabel: true
        });

        let chargingStationCounter = 1;
        let popupMinimalized = false;
        const chargingStationsBySelectedNetwork = Array.from(chargingStationsWithUpdateRequests.filter(obj => obj.attributes.categoryAttributes.CHARGING_STATION.network === selectedNetwork));
        const totalChargingStationsBySelectedNetwork = chargingStationsBySelectedNetwork.length;

        // for every attribute for which there's a default, set default to the value of the first venue processed
        let defaultName = chargingStationsBySelectedNetwork[0].getName() ? chargingStationsBySelectedNetwork[0].getName() : "";
        let defaultAlternativeName = (chargingStationsBySelectedNetwork[0].attributes.aliases.length === 0) ? "" : chargingStationsBySelectedNetwork[0].attributes.aliases[0]; // to-do: support multiple aliases
        let defaultDescription = chargingStationsBySelectedNetwork[0].attributes.description ? chargingStationsBySelectedNetwork[0].attributes.description : "";
        let defaultLocationInVenue = chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.locationInVenue
            ? chargingStationsWithUpdateRequests[0].attributes.categoryAttributes.CHARGIN_STATION.locationInVenue
            : "";
        let defaultCost = chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.costType
            ? (chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.costType === "FREE")
                ? STRINGS[language].free
                : (chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.costType === "FEE")
                    ? STRINGS[language].fee
                    : STRINGS[language].cost_type_unspecified
            : STRINGS[language].cost_type_unspecified;
        let defaultPaymentMethods = chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.paymentMethods
            ? Array.from(chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.paymentMethods)
            : []; // array
        defaultPaymentMethods.forEach((elem, index) => {
            if (elem === "APP") {
                defaultPaymentMethods[index] = STRINGS[language].app;
            } else if (elem === "CREDIT") {
                defaultPaymentMethods[index] = STRINGS[language].credit_card;
            } else if (elem === "DEBIT") {
                defaultPaymentMethods[index] = STRINGS[language].debit_card;
            } else if (elem === "ONLINE_PAYMENT") {
                defaultPaymentMethods[index] = STRINGS[language].online_payment;
            } else if (elem === "MEMBERSHIP_CARD") {
                defaultPaymentMethods[index] = STRINGS[language].membership_card;
            } else if (elem === "PLUG_IN_AUTO_CHARGE") {
                defaultPaymentMethods[index] = STRINGS[language].plugin_autocharge;
            } else if (elem === "OTHER"){
                defaultPaymentMethods[index] = STRINGS[language].other
            }
            else {
                throw new TypeError(SCRIPT_NAME + ": Could not process payment methods. Abort to prevent false data.");
            }
        })
        //let defaultExternalProviders;
        let defaultAccessType = chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.accessType
            ? (chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.accessType === "PUBLIC")
                ? STRINGS[language].public
                : (chargingStationsBySelectedNetwork[0].attributes.categoryAttributes.CHARGING_STATION.accessType === "RESTRICTED")
                    ? STRINGS[language].restricted
                    : STRINGS[language].private
            : (() => {throw new TypeError(SCRIPT_NAME + ": Could not process access types. Abort to prevent false data.")});
        let defaultWebsite = chargingStationsBySelectedNetwork[0].attributes.url ? chargingStationsBySelectedNetwork[0].attributes.url : "";
        let defaultPhone = chargingStationsBySelectedNetwork[0].attributes.phone ? chargingStationsBySelectedNetwork[0].attributes.phone : "";
        let defaultOpeningHours = (chargingStationsBySelectedNetwork[0].attributes.openingHours.length === 0) ? "" : Array.from(chargingStationsBySelectedNetwork[0].attributes.openingHours); // array

        let popup = document.getElementById("csa-edit-popup");
        if(!popup) {
            popup = document.createElement("div");
        }
        popup.id = "csa-edit-popup";
        popup.innerHTML = `<h1 id="popup-heading" style=" margin-top: 5px; margin-bottom: 2px; font-size: 1.5em; text-align: center">${STRINGS[language].edit}</h1>`; // popup header
        document.getElementsByTagName("body")[0].appendChild(popup);

        const minimizeButton = document.createElement("button");
        minimizeButton.id = "minimize-button";
        minimizeButton.innerText = STRINGS[language].minimize;
        minimizeButton.style = "position: absolute; top: 15px; right: 105px";
        minimizeButton.addEventListener("click", () => {
            if (popupMinimalized === false) {
                popup.style = `overflow: hidden; height: ${document.getElementById("popup-heading").offsetHeight + 12}px`;
                minimizeButton.innerText = STRINGS[language].maximize;
                popupMinimalized = true;
            } else {
                popup.style = `overflow: visible; height: "auto"`;
                minimizeButton.innerText = STRINGS[language].minimize;
                popupMinimalized = false;
            }
        });
        popup.appendChild(minimizeButton);

        const closeButton = document.createElement("button");
        closeButton.id = "close-button";
        closeButton.innerText = STRINGS[language].close;
        closeButton.style = "position: absolute; top: 15px; right: 15px";
        closeButton.addEventListener("click", () => document.getElementsByTagName("body")[0].removeChild(popup));
        popup.appendChild(closeButton);

        // start loading content of the popup with first venue
        drawPopupContent(chargingStationsBySelectedNetwork[0]);

        function drawPopupContent(currentChargingStationUpdateRequest) {
            DEBUG && console.log(SCRIPT_NAME + ": popup drawn with following chargingStation");
            DEBUG && console.dir(currentChargingStationUpdateRequest);

            // combination of street name and house number is unique, load every time from current venue
            const streetName = (currentChargingStationUpdateRequest.getAddress().getStreetName() !== null) ? currentChargingStationUpdateRequest.getAddress().getStreetName() : STRINGS[language].venue_no_name;
            const houseNumber = (currentChargingStationUpdateRequest.getAddress().getHouseNumber() !== null) ? currentChargingStationUpdateRequest.getAddress().getHouseNumber() : "";

            // center on the current venue
            W.map.setCenter(chargingStationLocationMarkers[currentChargingStationUpdateRequest.attributes.id]);

            try {
                // select venue on map
                document.querySelector(`div[data-id="${currentChargingStationUpdateRequest.attributes.id}"]`).click();
            } catch (error) {
                WazeWrap.Alerts.error(SCRIPT_NAME, "Couldn't find charging station. Please zoom out.");
                              // If pin data in WME is not available, reload popup
            }

            let contentWrapper = document.getElementById("content-wrapper");
            if (contentWrapper) {
                popup.removeChild(contentWrapper);
            }
            contentWrapper = document.createElement("div");
            contentWrapper.id = "content-wrapper";
            contentWrapper.style="padding: 0 15px 15px 15px; text-align: left";
            //style.append(".venue-property-string {display: inline-block}");
            popup.appendChild(contentWrapper);

            const statusBar = document.createElement("p");
            statusBar.id = "edit-status-bar";
            statusBar.style = "font-weight: bold";
            statusBar.innerHTML =`${chargingStationCounter}/${totalChargingStationsBySelectedNetwork}: ${selectedNetwork}
            <hr class="spacer-variant-2">`;
            contentWrapper.appendChild(statusBar);

            const attributesForm = document.createElement("form");
            attributesForm.id = "attributesForm";
            contentWrapper.appendChild(attributesForm);

            //top row is unique from style because two inputs for the address are placed in the same line
            let popupHTML = `<label for="venueStreetInput">${STRINGS[language].street}:</label> <input type="text" id="venueStreetInput" style="width: 50%; margin-right: 40px" value="${streetName}" />
            <label for="venueHouseNumberInput" style= "margin-right: 2px;">${STRINGS[language].house_number}:</label><input type="text" id="venueHouseNumberInput" style="width: 40px" value="${houseNumber}" /><br>`;

            // other rows
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-name" style="clear: both" checked />
            <label for="venueNameInput" class="venue-property-string">${STRINGS[language].name}: </label> <input type="text" class="property-input" id="venueNameInput" value="${defaultName}" /><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-alternative-name" checked />
            <label for="venueAltNameInput" class="venue-property-string">${STRINGS[language].alt_name}: </label> <input type="text" class="property-input" id="venueAltNameInput" value="${defaultAlternativeName}" /><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-description" checked />
            <label for="venueDescriptionInput" class="venue-property-string">${STRINGS[language].description}: </label> <textarea type="text" class="property-input" id="venueDescriptionInput" value= "${defaultDescription}"></textarea><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-location-in-venue" checked />
            <label for="venueLocationInVenueInput" class="venue-property-string">${STRINGS[language].location_in_venue}: </label> <textarea type="text" class="property-input" id="venueLocationInVenueInput" value="${defaultLocationInVenue}"></textarea><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-cost" checked />
            <label for="venueCostInput" class="venue-property-string">${STRINGS[language].cost}:</label>
            <select class="property-input" id="venueCostInput" name="venueCost">
            <option value="${STRINGS[language].cost_type_unspecified} ${(defaultCost === STRINGS[language].cost_type_unspecified) ? "selected" : ""}">${STRINGS[language].cost_type_unspecified}</option>
            <option value="${STRINGS[language].free}" ${(defaultCost === STRINGS[language].free) ? "selected" : ""}>${STRINGS[language].free}</option>
            <option value="${STRINGS[language].fee}" ${(defaultCost === STRINGS[language].fee) ? "selected" : ""}>${STRINGS[language].fee}</option></select><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-payment-methods" checked />
            <label for="venuePaymentMethodsInput" class="venue-property-string" margin: auto">${STRINGS[language].payment_methods}: </label>
            <select type="text" class="property-input" id="venuePaymentMethodsInput" name="venuePaymentMethods" value="${defaultPaymentMethods}" multiple>
            <option value="${STRINGS[language].app}" ${defaultPaymentMethods.includes(STRINGS[language].app) ? "selected" : ""}>${STRINGS[language].app}</option>
            <option value="${STRINGS[language].credit_card}" ${defaultPaymentMethods.includes(STRINGS[language].credit_card) ? "selected" : ""}>${STRINGS[language].credit_card}</option>
            <option value="${STRINGS[language].debit_card}" ${defaultPaymentMethods.includes(STRINGS[language].debit_card) ? "selected" : ""}>${STRINGS[language].debit_card}</option>
            <option value="${STRINGS[language].online_payment}" ${defaultPaymentMethods.includes(STRINGS[language].online_payment) ? "selected" : ""}>${STRINGS[language].online_payment}</option>
            <option value="${STRINGS[language].membership_card}" ${defaultPaymentMethods.includes(STRINGS[language].membership_card) ? "selected" : ""}>${STRINGS[language].membership_card}</option>
            <option value="${STRINGS[language].plugin_autocharge}" ${defaultPaymentMethods.includes(STRINGS[language].plugin_autocharge) ? "selected" : ""}>${STRINGS[language].plugin_autocharge}</option>
            <option value="${STRINGS[language].other}" ${defaultPaymentMethods.includes(STRINGS[language].other) ? "selected" : ""}>${STRINGS[language].other}</option>
            </select><br>`;
            // popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-external-provider" />`;
            //popupHTML += `<label for="venueExternalProviderInput" class="venue-property-string">${STRINGS[language].external_provider}: </label> <input type="text" class="property-input" id="venueExternalProviderInput" value=${defaultExternalProviders}></input>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-access-type" checked />
            <label for="venueAccessTypeInput" class="venue-property-string">${STRINGS[language].access_type}: </label>
            <select class="property-input" id="venueAccessTypeInput" name="venueAccessType">
            <option value="${STRINGS[language].public}" ${(defaultAccessType === STRINGS[language].public) ? "selected" : ""}>${STRINGS[language].public}</option>
            <option value="${STRINGS[language].restricted}" ${(defaultAccessType === STRINGS[language].restricted) ? "selected" : ""}>${STRINGS[language].restricted}</option>
            <option value="${STRINGS[language].private}" ${(defaultAccessType === STRINGS[language].private) ? "selected" : ""}>${STRINGS[language].private}</option>
            </select><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-website" checked />
            <label for="venueWebsiteInput" class="venue-property-string">${STRINGS[language].website}: </label> <input type="text" class="property-input" id="venueWebsiteInput" value="${defaultWebsite}" /><br>`;
            popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-phone" checked />
            <label for="venuePhoneInput" class="venue-property-string">${STRINGS[language].phone}: </label> <input type="text" class="property-input" id="venuePhoneInput" value="${defaultPhone}" /><br>`;
            // popupHTML += `<input type="checkbox" class="is-default-checkbox" id="checkbox-default-venue-opening-hours" checked />
            // <label for="venueOpeningHoursInput" class="venue-property-string">${STRINGS[language].opening_hours}: </label> <input type="text" class="property-input" id="venueOpeningHoursInput" value="${defaultOpeningHours}" /><br>`;

            attributesForm.innerHTML = popupHTML;

            // get variables for various input elements
            const venueStreetInput = document.getElementById("venueStreetInput");
            const venueHouseNumberInput = document.getElementById("venueHouseNumberInput");
            const venueNameInput = document.getElementById("venueNameInput");
            const venueAltNameInput = document.getElementById("venueAltNameInput");
            const venueDescriptionInput = document.getElementById("venueDescriptionInput");
            const venueLocationInVenueInput = document.getElementById("venueLocationInVenueInput");
            const venueCostInput = document.getElementById("venueCostInput");
            const venuePaymentMethodsInput = document.getElementById("venuePaymentMethodsInput");
            const venueAccessTypeInput = document.getElementById("venueAccessTypeInput");
            const venueWebsiteInput = document.getElementById("venueWebsiteInput");
            const venuePhoneInput = document.getElementById("venuePhoneInput");
            //const venueOpeningHoursInput = document.getElementById("venueOpeningHoursInput");

            // ------------------------------ logic ----------------------------------------------------------------------
            // -------------------- #1 resetting an input back to default if checkbox is checked -------------------------
            const checkboxDefaultVenueName = document.getElementById("checkbox-default-venue-name");
            checkboxDefaultVenueName.addEventListener("change", () => {
                if (checkboxDefaultVenueName.checked) {
                    if (venueNameInput.value !== defaultName) {
                        venueNameInput.value = defaultName;
                    }
                }
            });
            const checkboxDefaultVenueAlternativeName = document.getElementById("checkbox-default-venue-alternative-name");
            checkboxDefaultVenueAlternativeName.addEventListener("change", () => {
                if (checkboxDefaultVenueAlternativeName.checked) {
                    if (venueAltNameInput !== defaultAlternativeName) {
                    venueAltNameInput.value = defaultAlternativeName;
                    }
                }
            });
             const checkboxDefaultVenueDescription = document.getElementById("checkbox-default-venue-description");
            checkboxDefaultVenueDescription.addEventListener("change", () => {
                if (checkboxDefaultVenueDescription.checked) {
                    if (venueDescriptionInput.value !== defaultDescription) {
                        venueDescriptionInput.value = defaultDescription;
                    }
                }
            });
            const checkboxDefaultVenueLocationInVenue = document.getElementById("checkbox-default-venue-location-in-venue");
            checkboxDefaultVenueLocationInVenue.addEventListener("change", () => {
                if (checkboxDefaultVenueLocationInVenue.checked) {
                    if (venueLocationInVenueInput.value !== defaultLocationInVenue) {
                        venueLocationInVenueInput.value = defaultLocationInVenue;
                    }
                }
            });
            const checkboxDefaultVenueCost = document.getElementById("checkbox-default-venue-cost");
            checkboxDefaultVenueCost.addEventListener("change", () => {
                if (checkboxDefaultVenueCost.checked) {
                    if (venueCostInput.value !== defaultCost) {
                        venueCostInput.value = defaultCost;
                    }
                }
            });
            const checkboxDefaultVenuePaymentMethods = document.getElementById("checkbox-default-venue-payment-methods");
            checkboxDefaultVenuePaymentMethods.addEventListener("change", () => {
                if (checkboxDefaultVenuePaymentMethods.checked) {
                    if (venuePaymentMethodsInput.value !== defaultPaymentMethods) {
                        venuePaymentMethodsInput.value = Array.from(defaultPaymentMethods);
                    }
                }
            });
            const checkboxDefaultVenueAccessType = document.getElementById("checkbox-default-venue-access-type");
            checkboxDefaultVenueAccessType.addEventListener("change", () => {
                if (checkboxDefaultVenueAccessType.checked) {
                    if (venueAccessTypeInput.value !== defaultAccessType) {
                        venueAccessTypeInput.value = defaultAccessType;
                    }
                }
            });
            const checkboxDefaultVenueWebsite = document.getElementById("checkbox-default-venue-website");
            checkboxDefaultVenueWebsite.addEventListener("change", () => {
                if (checkboxDefaultVenueWebsite.checked) {
                    if (venueWebsiteInput.value !== defaultWebsite) {
                        venueWebsiteInput.value = defaultWebsite;
                    }
                }
            });
            const checkboxDefaultVenuePhone = document.getElementById("checkbox-default-venue-phone");
            checkboxDefaultVenuePhone.addEventListener("change", () => {
                if (checkboxDefaultVenuePhone.checked) {
                    if (venuePhoneInput.value !== defaultPhone) {
                        venuePhoneInput.value = defaultPhone;
                    }
                }
            });

            const editPopupFooter = document.createElement("footer");
            contentWrapper.appendChild(editPopupFooter);

            const userMessages = document.createElement("div");
            userMessages.style = "display: inline-block; width: 380px";
            userMessages.innerHTML = `<ul style="color: red"><li>check geometry</li>
            <li>add external provider</li>
            <li>add opening hours</li></ul>`;
            editPopupFooter.appendChild(userMessages);

            // -------------------- #4 apply changes for current venue by pressing button -------------------------
            const editSubmitButton = document.createElement("wz-button");
            editSubmitButton.id = "edit-submit-button";
            editSubmitButton.style = "display: inline-block, margin-bottom: 10px; vertical-align: top";
            if (chargingStationCounter < totalChargingStationsBySelectedNetwork) {
                editSubmitButton.innerText = STRINGS[language].next;
            } else {
                editSubmitButton.innerText = STRINGS[language].none_left_save;
            }
            editSubmitButton.addEventListener("click", () => {


                // applying values
                document.getElementsByClassName("w-icon w-icon-pencil-fill edit-button")[0].dispatchEvent(mouseClick);
                // street name ---does not working yet----
                // const WMEstreetNameInputShadow = document.querySelector("wz-autocomplete.street-name").shadowRoot;
                // const WMEstreetNameInputNestedShadow = WMEstreetNameInputShadow.querySelector("wz-text-input").shadowRoot;
                // WMEstreetNameInputNestedShadow.querySelector("input").value = venueStreetInput.value;

                const WMEhouseNumberInput = document.getElementsByClassName("house-number")[0]; // house number
                WMEhouseNumberInput.value = venueHouseNumberInput.value;
                // close sub-form
                document.getElementsByClassName("save-button")[0].dispatchEvent(mouseClick);

                // name
                const WMEnameInputShadow = document.getElementById("venue-edit-general").getElementsByClassName("form-group")[1].getElementsByTagName("wz-text-input")[0].shadowRoot;
                WMEnameInputShadow.querySelector("input").value = venueNameInput.value;
                // alternative name ---doesn't work yet---
                // if(venueAltNameInput.value !== "") {
                //     document.getElementsByClassName("aliases-add-new")[0].dispatchEvent(mouseClick);
                //     const WMEalternativeNameInputShadow = document.getElementsByClassName("alias-item-edit-form")[0].getElementsByTagName("div")[0].getElementsByTagName("wz-text-input")[0].shadowRoot;
                //     WMEalternativeNameInputShadow.querySelector("input").value = venueAltNameInput.value;
                // }
                // description
                const WMEdescriptionInputShadow = document.querySelector('wz-textarea[name="description"]').shadowRoot;
                WMEdescriptionInputShadow.querySelector("textarea").value = venueDescriptionInput.value;
                // location in venue
                const WMElocationInVenueInputShadow = document.getElementsByClassName("charging-station-location-in-venue-control")[0].getElementsByTagName("wz-textarea")[0].shadowRoot;
                WMElocationInVenueInputShadow.querySelector("textarea").value = venueLocationInVenueInput.value;

                // change to the tab with addtional information
                const WMEtabShadow = document. getElementsByClassName("venue-edit-tabs")[0].shadowRoot;
                WMEtabShadow.querySelector('.wz-tab-label:nth-of-type(3)').dispatchEvent(mouseClick);
                // website
                const WMEwebsiteInputShadow = document.getElementById("venue-url").shadowRoot;
                WMEwebsiteInputShadow.querySelector("input").value = venueWebsiteInput.value;
                // phone
                const WMEphoneInputShadow = document.getElementById("venue-phone").shadowRoot;
                WMEphoneInputShadow.querySelector("input").value = venuePhoneInput.value;

                // Setting default value for each attribute if associated checkbox is checked
                if (checkboxDefaultVenueName.checked) {
                    defaultName = venueNameInput.value;
                }
                if (checkboxDefaultVenueAlternativeName.checked) {
                    defaultAlternativeName = venueAltNameInput.value;
                }
                if (checkboxDefaultVenueDescription.checked) {
                    defaultDescription = venueDescriptionInput.value;
                }
                if (checkboxDefaultVenueLocationInVenue.checked) {
                    defaultLocationInVenue = venueLocationInVenueInput.value;
                }
                if (checkboxDefaultVenueCost.checked) {
                    defaultCost = venueCostInput.value;
                }
                if (checkboxDefaultVenuePaymentMethods.checked) {
                    defaultPaymentMethods = Array.from(venuePaymentMethodsInput.value);
                }
                if (checkboxDefaultVenueAccessType.checked) {
                    defaultAccessType = venueAccessTypeInput.value;
                }
                if (checkboxDefaultVenueWebsite.checked) {
                    defaultWebsite = venueWebsiteInput.value;
                }
                if (checkboxDefaultVenuePhone.checked) {
                    defaultPhone = venuePhoneInput.value;
                }
                // if (checkboxDefaultOpeningHours.checked) {
                //     venueOpeningHoursInput.value = Array.from(defaultOpeningHours);
                // }
                // initiating new iteration with next venue, if not the last one
                if (chargingStationCounter < totalChargingStationsBySelectedNetwork) {
                    chargingStationCounter++;
                    drawPopupContent(chargingStationsBySelectedNetwork[chargingStationCounter - 1]);
                } else if (chargingStationCounter === totalChargingStationsBySelectedNetwork) {
                    //const WMEsaveButton = document.getElementsByClassName("waze-icon-save")[0];
                    console.log("TEST: WME should save");
                }
            });

            editPopupFooter.appendChild(editSubmitButton);
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
        startEditButton.innerText = STRINGS[language].start_edit;
        startEditButton.addEventListener("click", () => {
            selectedNetwork = selectNetwork.value;
            console.log(selectedNetwork);

            if (selectedNetwork !== "default") {
                initializeEditPopup();
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
            const streetName = (chargingStationsInView[i].getAddress().isEmptyStreet()) ? STRINGS[language].venue_no_street_name : chargingStationsInView[i].getAddress().getStreetName();
            const displayHouseNumber = (chargingStationsInView[i].getAddress().getHouseNumber() === null) ? "" : " " + chargingStationsInView[i].getAddress().getHouseNumber();
            // adds number at the beginn of the row with some styling
            tableHTML +=
                `<tr style="border: 1px solid black;">
                     <td style="min-width: 25px; text-align: center; border-right: 1px solid black;">${i + 1}</td>`;

            // adds the search results with name and street name and house number (if available)
            tableHTML +=
                `<td style="padding: 0 10px;">${venueName}<br><i>(${streetName}${displayHouseNumber})</i></td></tr>`;
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
        for (let property in chargingStationLocationMarkers) {
            if (chargingStationLocationMarkers.hasOwnProperty(property)) {
                delete chargingStationLocationMarkers[property];
            }
        };

        chargingStationsInView = W.model.venues.getObjectArray().filter(obj => obj.isChargingStation() && obj.outOfScope === false);
        chargingStationNetworks = chargingStationsInView.map(obj => obj.attributes.categoryAttributes.CHARGING_STATION.network).filter((obj, index, array) => array.indexOf(obj) === index);
        chargingStationsWithUpdateRequests = chargingStationsInView.filter(obj => obj.hasUpdateRequests());

        chargingStationsInView.forEach(elem => {
            chargingStationLocationMarkers[elem.attributes.id] = W.map.placeUpdatesLayer.featureMarkers[elem.attributes.id].marker.lonlat; // contains an object named initialize with properties: lat, lon
        });

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

        if (WazeWrap.ready) {
            WazeWrap.Interface.ShowScriptUpdate("WME Charging.Station-Automat.", SCRIPT_VERSION, RELEASE_NOTES, GREASYFORK_LINK, FORUM_LINK);
        }

        // dertermine language, default is English (en)
        const hyperlink = window.location.href;
        for (const key of Object.keys(STRINGS)) {
            const languageRegex = new RegExp(".*/" + key + "/.*", "");
            if (languageRegex.test(hyperlink)) {
                language = key;
                break;
            }
        }
        DEBUG && console.log(SCRIPT_NAME + ": language: " + language);

        ({tabLabel, tabPane} = W.userscripts.registerSidebarTab("Charging-Station-Automat."));
        W.userscripts.waitForElementConnected(tabLabel).then(() => {
            tabLabel.innerText = "CSA Script";
        });

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            // ------------------------- create header that stays on top ----------------------------------------
            tabPane.id = "csa-tab";
            tabPane.innerHTML = '<h1>CSA-Charging-Station-Automat.</h1>';
            tabPane.innerHTML += `<p>version: ${SCRIPT_VERSION}<br>by ${SCRIPT_AUTHOR}</p>`;
            tabPane.innerHTML += `<hr class="spacer-variant-1">`;
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
