"use strict";

var openingSite = false;
var autoSaveInterval;

var eventTitle = null;
var descriptionFromPage;

// bgobjects
var email;
var cachedFeeds;
var colors;
var writeableCalendars = [];

var betaCalendarFirstLoad = true;
var skinsSettings;
var calendarShowingCurrentDate = true;
var scrollTarget;
const ffPatchForResizeAndMorePopoutDisappearing = DetectClient.isFirefox();
var WHEEL_THRESHOLD = DetectClient.isFirefox() ? 3 : 100;
var contacts = [];
var contactsData;
let calendarMap;
let fullCalendar;
var fetchingAgendaEvents;
var previousScrollTop = 0;
var lastWheelNextPrev = Date.now();
var attemptedToAddSkin;

var MAX_SUGGESTIONS = 4;
var MAX_SUGGESTIONS_BY_CLICK = 8;
var performAutocomplete;
var suggestions = [];
var lastSuggestions = [];
var quickAdds = [];
var customRecurrenceRule;
var recurringEvent;
let _recurrenceDropdownValue;
let _createEvent;
let createEventAllDay;
let createEventRemindersChanged;
let zoomFactor;

const CHROME_HEADER_HEIGHT = 90;
const MAX_POPUP_WIDTH = 800;
const MAX_POPUP_HEIGHT = DetectClient.isFirefox() ? 550 : 600; /* must match height hardcoded in css */


console.time("zoomfactor");
var zoomPromise = getZoomFactor().then(thisZoomFactor => {
	console.timeEnd("zoomfactor");
	zoomFactor = thisZoomFactor;
})

const FullCalendarSourceIds = {
    MAIN: "main-source",
}

var fullCalendarSource;

chrome.runtime.onMessage.addListener(/* DONT USE ASYNC HERE because of return true */function(message, sender, sendResponse) {
    console.info("popup onMessage", message);
    if (message.command == "gcmUpdate") {
        console.log("gcm update");

        (async () => {
            // required to re-initialize variable events
            await getBGObjects();

            if (await getCalendarView() == CalendarView.AGENDA) {
                initAgenda();
                //hideLoading();
            } else {
                fullCalendar?.refetchEvents();
            }
        })();
    } else if (message.command == "getPopupDetails") {
        sendResponse({
            fromToolbar: fromToolbar
        });
    } else if (message.command == "conflicting-event") {
        (async () => {
            await initMisc({UIonly: true});
            console.log("conflicting-event", message)
            parseEventDates(message.newEvent);
            parseEventDates(message.conflictingEvent);

            docReady().then(() => {
                openConflictingEventDialog({
                    newEvent: message.newEvent,
                    conflictingEvent: message.conflictingEvent
                });
            });
        })();
    }
});

function postGrantPermissionToTasksAndPolledServer() {
    location.reload();
}

async function getEventsWrapper() {
    const events = await getEvents();

    if (!window.cacheEventsForGettingSnoozers) {
        window.cacheEventsForGettingSnoozers = true;
        const futureSnoozes = await getFutureSnoozes(await getSnoozers(events), {email:await storage.get("email")});
        if (futureSnoozes.length) {
            console.log("snozzes", futureSnoozes);
    
            onClick(".openSnoozedEvents", function() {
                openReminders({notifications:futureSnoozes.shallowClone()}).then(() => {
                    closeWindow();
                });
            });
        } else {
            const $openSnoozedEvents = selector(".openSnoozedEvents");
            /*
            const $sep = $openSnoozedEvents.previousElementSibling;
            if ($sep?.matches(".separator")) {
                hide($sep);
            }
            */
            hide($openSnoozedEvents);
        }
    }

    return events;
}

function closeWindow() {
	if (fromToolbar) {
		window.close();
	}
}

function showAccountsError() {
    showError(getMessage("accessNotGrantedSeeAccountOptions", ["", getMessage("accessNotGrantedSeeAccountOptions_accounts")]), {
        text: getMessage("accounts"),
        onClick: function() {
            openUrl("options.html?accessNotGranted=true#accounts");
        }
    });
}

async function showCalendarError(error) {
	// todo need to show a link to re-grant
    console.error("showCalendarError", error);

    if (!await isOnline() || error.code == 0) { // must check this before access errors below
        showError(getMessage("yourOffline"));
    } else if (error.toString().includes("401")
        || error.toString().includes("OAuth2 not granted or revoked")
        || error.code == 401) { // invalid grant
		storage.enable("loggedOut");
        showAccountsError();
    } else if (error.code == 403) {
        showAccountsError();
	} else {
		showError(error);
	}
}

function reloadReminders() {
    chrome.runtime.sendMessage({action: "reloadReminders"}).catch(error => {
        // ignore
    });
}

function generateAccountStub(email) {
	return {
		getAddress: function() {
			return email;
		}
	}
}

async function cacheContactsData() {
    if (!globalThis.cacheContactsDataPromise || !contactsData) {
        globalThis.cacheContactsDataPromise = new Promise(async (resolve, reject) => {
            if (!contactsData) {
                contactsData = await storage.get("contactsData");
            }
            globalThis.contactsTokenResponse = await oAuthForContacts.findTokenResponse(email);
            resolve();
        });
    }
    return globalThis.cacheContactsDataPromise;
}

async function getBGObjects() {
    console.time("getBGObjects");
    
    await initUI();
    
    email = await storage.get("email");
    cachedFeeds = await storage.get("cachedFeeds");
    colors = cachedFeeds["colors"];
    calendarMap = await initCalendarMap();
    
    console.timeEnd("getBGObjects");
        
    skinsSettings = await storage.get("skins");

    window.blackFontEvents = skinsSettings.some(skin => {
        if (skin.id == SkinIds.BLACK_FONT_EVENTS) {
            return true;
        }
    });
    window.matchFontColorWithEventColor = skinsSettings.some(skin => {
        if (skin.id == SkinIds.MATCH_FONT_COLOR_WITH_EVENT_COLOR) {
            return true;
        }
    });
}

async function getCalendarView() {
    return getUrlValue("calendarView") ?? await storage.get("calendarView");
}

async function isGmailCheckerInstalled() {
	if (await storage.get("gmailCheckerInstalled")) {
		return true;
	} else {
        try {
            const response = await sendMessageToGmailExtension({action:"getInfo"});
            let installed = false;
			if (response?.installed) {
				installed = true;
				storage.enable("gmailCheckerInstalled");
			}
			return installed;
        } catch (error) {
            return false;
        }
	}
}

async function displayLocations(eventLocation) {
    console.log("displayLocations", eventLocation);
    const url = new URL("/place-autocomplete", Urls.EVENT_LOCATIONS);
    url.searchParams.set("q", eventLocation);
    url.searchParams.set("lang", await storage.get("language"));
    url.searchParams.set("session_token", globalThis.eventLocationSessionToken);

    const $acSuggestions = byId("event-location-suggestions");

    fetchJSON(url).then(data => {
        console.log("predictions", data);

        const predictions = data;

        if (predictions.length) {
            suggestions = [];
            lastSuggestions = [];
            emptyNode($acSuggestions);
            
            predictions.forEach((prediction, index) => {
                const acItem = document.createElement("j-item");
                acItem.classList.add("acItem");
                //acItem.textContent = prediction.description;

                const acItemText = document.createElement("div");
                acItemText.classList.add("acItemText");
                acItemText.textContent = prediction.description;
                acItem.appendChild(acItemText);

                onClick(acItem, function() {
                    byId("eventLocation").value = prediction.description;
                    $acSuggestions.hidePopover();
                    byId("eventLocation").focus();
                });

                $acSuggestions.append(acItem);
            });

            const poweredByGoogle = document.createElement("div");
            poweredByGoogle.classList.add("powered-by-google");
            
            const textItem = document.createElement("div");
            textItem.textContent = "Google";
            textItem.classList.add("google-logo");
            poweredByGoogle.appendChild(textItem);

            $acSuggestions.append(poweredByGoogle);

            $acSuggestions.showPopover({source: byId("eventLocation")});
        } else {
            $acSuggestions.hidePopover();
        }
    }).catch(error => {
        console.error("problem with autocomplete", error);
        $acSuggestions.hidePopover();
    });
}

function convertEventToFullCalendarEvent(params) {
    let fcEvent = {};
    
    const eventEntry = params.eventEntry;
	
	fcEvent.id = getEventID(eventEntry);
	fcEvent.title = eventEntry.title || getSummary(eventEntry);
	
	//fcEvent.url = getEventUrl(eventEntry);

	if (hasUserDeclinedEvent(eventEntry)) {
		fcEvent.isDeclined = true;
	}
	
	if (params.snoozeTime) {		
		fcEvent.isSnoozer = true;
		fcEvent.id += "_snooze";
        
        // v2 let's force the snoozed event to allday - so that the time does not appear, v1 let's force the snoozed event to allday if not today
        if (params.snoozeTime.getHours() == 0 && params.snoozeTime.getMinutes() == 0) {
            fcEvent.allDay = true;
        }
		fcEvent.start = params.snoozeTime;
        if (fcEvent.allDay) {
            fcEvent.end = params.snoozeTime.addDays(1);
            // required for fullcalendar or else it would spread the event across many days
            resetTime(fcEvent.end);
        } else {
            // ignore setting end if snoozing 1.5 for all day events lasting only 1 day days, because it would render the event over 2 days ie. 12pm - 12pm next day
            if (eventEntry.endTime?.diffInDays(eventEntry.startTime) != 1) {
                fcEvent.end = calculateNewEndTime(eventEntry.startTime, eventEntry.endTime, fcEvent.start);
            }
        }
	} else {
        fcEvent.allDay = eventEntry.allDay;
        fcEvent.start = new Date(eventEntry.startTime);
        fcEvent.end = new Date(eventEntry.endTime);
	}

	const eventColors = getEventColors({
        event: eventEntry,
        cachedFeeds: params.cachedFeeds,
        arrayOfCalendars: params.arrayOfCalendars
    });
	fcEvent.textColor = eventColors.fgColor;
    fcEvent.color = eventColors.bgColor;
	fcEvent.jEvent = eventEntry;

	return fcEvent;
}

async function convertAllEventsToFullCalendarEvents(events) {
    const cachedFeeds = await storage.get("cachedFeeds");
    const arrayOfCalendars = await getArrayOfCalendars();
    const calendarSettings = await storage.get("calendarSettings");
    const showDeclinedEvents = calendarSettings.showDeclinedEvents;
    const hideInvitations = calendarSettings.hideInvitations;
    const selectedCalendars = await storage.get("selectedCalendars");

	const fullCalendarEvents = [];

	events.forEach(event => {
		let snoozeTime, jEvent;

		if (event.isSnoozer) {
			jEvent = event.event;			
			snoozeTime = event.time;
		} else {
			jEvent = event;
		}
		
		const calendar = getEventCalendar(jEvent);

		const selected = isCalendarSelectedInExtension(calendar, email, selectedCalendars);
		if (selected && passedVisibilityTests(jEvent, email, showDeclinedEvents, hideInvitations, selectedCalendars)) {
            const fcEvent = convertEventToFullCalendarEvent({
                eventEntry: jEvent,
                snoozeTime: snoozeTime,
                cachedFeeds: cachedFeeds,
                arrayOfCalendars: arrayOfCalendars
            });
            fullCalendarEvents.push(fcEvent);
		}
    });
	return fullCalendarEvents;
}

function openSiteInsteadOfPopup() {
	openingSite = true;
	openGoogleCalendarWebsite();
}

var tooLateForShortcut = false;
setInterval(function() {tooLateForShortcut=true}, 500);
window.addEventListener ("keydown", async e => {
	//console.log("activenode", document.activeElement.nodeName);
	// for bypassing popup and opening google calendar webpage
	if (fromToolbar && !tooLateForShortcut && isCtrlPressed(e)) {
		tooLateForShortcut = true;
		if (await donationClicked("CtrlKeyOnIcon")) {
			openSiteInsteadOfPopup();
			return;
		}
	}
	
	if (isCtrlPressed(e)) {
		byId("betaCalendar")?.classList.add("ctrlKey");
	}
	
	if (e.key === "Escape") {
        console.log("escape keydown", e);

        const $dialog = e.target.closest("dialog");
        if ($dialog) {
            $dialog.close("escape-key");
            e.preventDefault();
        } else {
            const openDialog = document.querySelector('dialog[open]');
            if (openDialog) {
                openDialog.close("escape-key");
                e.preventDefault();
            } else {
                if (htmlElement.classList.contains("searchInputVisible")) {
                    byId("search-input-back").click();
                    e.preventDefault();
                } else if (htmlElement.classList.contains("quickAddVisible")) {
                    closeQuickAdd();
                    e.preventDefault();
                } else {
                    // do nothing and let it chrome close it
                }
            }
        }
    } else if (isFocusOnInputElement()) {
        if (isCtrlPressed(e) && (e.key == "s" || e.key == "Enter")) {
            if (isVisible("#saveEvent")) {
                byId("saveEvent").click();
                e.preventDefault();
            }
        }
	} else {
		if (e.key === "ArrowRight" || e.key === "ArrowDown") {
			fullCalendar?.next();
			e.preventDefault();
		} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { // up arrow or left arrrow
			fullCalendar?.prev();
			e.preventDefault();
		} else if (e.key === "Home") {
			fcChangeView(await getCalendarView());
			fullCalendar?.today();
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "g") {
            openGoToDate();
            e.preventDefault();
        } else if (e.key == "/") {
            showSearch();
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "1") {
            changeCalendarView(CalendarView.DAY);
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "2") {
            changeCalendarView(CalendarView.WEEK);
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "3") {
            changeCalendarView(CalendarView.MONTH);
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "4") {
            changeCalendarView(CalendarView.YEAR);
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "5") {
            changeCalendarView(CalendarView.CUSTOM);
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "6") {
            changeCalendarView(CalendarView.AGENDA);
            e.preventDefault();
        } else if (isCtrlPressed(e) && e.key == "7") {
            changeCalendarView(CalendarView.LIST_WEEK);
            e.preventDefault();
        } else if (e.key == "?") {
            const $dialog = initTemplate("keyboardShortcutDialogTemplate");
            $dialog.querySelectorAll(".ctrlKey").forEach(node => node.textContent = DetectClient.isMac() ? "⌘" : "Ctrl");

            openDialog($dialog, {
                title: getMessage("keyboardShortcuts"),
                buttons: [{
                    label: getMessage("moreInfo"),
                    onClick: function() {
                        openUrl("https://jasonsavard.com/wiki/Keyboard_shortcuts?ref=calendarShortcutDialogMoreInfo");
                    }
                }]
            });
		} else {
			if (!isCtrlPressed(e) && e.key != "Shift" && e.key != "Alt" && e.key != "Tab") {
				console.log("keydown", e);
				console.log("active", document.activeElement.nodeName);
                await initQuickAdd();
                byId("quickAddWrapper").classList.add("inputEntered");
				// patch because sometimes when the keydown happens to quickly while the popup/polymer is loading it would not be communicated to the input tag
				//$("#quickAdd").val( $("#quickAdd").val() + e.key );
				//return false;
			}
        }
	}
	
	// for Dismissing events
	if (e.altKey && e.key == "d") {
		await chrome.runtime.sendMessage({action: "dismissAll"});
        closeWindow();
	}

}, false);

window.addEventListener("keyup", function(e) {
	if (!isCtrlPressed(e)) {
		byId("betaCalendar").classList.remove("ctrlKey");
	}
}, false);

window.addEventListener("wheel", async e => {
    const fullCalendarDiv = e.target.closest("#betaCalendar");
    const calendarView = await getCalendarView();
    const customView = await storage.get("customView");

	if ((calendarView == CalendarView.MONTH || calendarView == CalendarView.YEAR || (calendarView == CalendarView.CUSTOM && isCustomViewInWeeks(customView))) && fullCalendarDiv) {
        if (!isFocusOnInputElement()
            && !hasVerticalScrollbar(e.target)
            && !hasHorizontalScrollbar(e.target)
            && !hasVerticalScrollbar(byId("mainContent"))) {

            // if fullcalendar has scrollbar, note that it has 2 scrollers one for header day names and one for month view
            if (Array.from(selectorAll(".fc-scroller")).some(scroller => hasVerticalScrollbar(scroller))) {
                return;
            }

            console.log("wheel", e);

            if (calendarView == CalendarView.YEAR) {
                // ignore it here because we handle on scroll event instead of wheel event for year view
            } else {
                if (Date.now() - lastWheelNextPrev > 300) {
                    if (e.deltaX <= -WHEEL_THRESHOLD || e.deltaY <= -WHEEL_THRESHOLD) {
                        fullCalendar.prev();
                    } else if (e.deltaX >= WHEEL_THRESHOLD || e.deltaY >= WHEEL_THRESHOLD) {
                        fullCalendar.next();
                    }
                    lastWheelNextPrev = Date.now();
                }
            }
		}
	}
});

window.addEventListener('paste', event => {
    if (!isFocusOnInputElement()) {
        initQuickAdd();
        byId("quickAddWrapper").classList.add("inputEntered");
    }
});

async function reloadCalendar(params) {
    // default atleast in the context of this popup window is to ignorenotification for performance
    params.ignoreNotifications = true;
    
    try {
        const response = await sendMessageToBG("pollServer", params);
        console.log("pollserver response", response);
        if (response?.warning) {
            await showCalendarError(response.warning);
        }
        await getBGObjects();
    } catch (error) {
        await showCalendarError(error);
    } finally {
        if (htmlElement.classList.contains("searchInputVisible")) {
            searchEvents();
        } else {
            if (params.refetchEvents) {
                fullCalendar?.refetchEvents();
            }
            if (await getCalendarView() == CalendarView.AGENDA) {
                initAgenda();
                hideLoading();
            }
        }
    }
}

async function openConflictingEventDialog({newEvent, conflictingEvent}) {
    const link = document.createElement("a");
    link.href = getEventUrl(conflictingEvent, await storage.get("email"));
    link.classList.add("conflicting-event");
    link.setAttribute('tabindex', '-1');
    link.textContent = getSummary(conflictingEvent);
    link.addEventListener("click", (event) => {
        byId("conflicting-event-dialog")?.close();
        showDetailsBubble({event: conflictingEvent});
        event.preventDefault();
    });

    const container = document.createElement("span");
    container.appendChild(document.createTextNode(getMessage("thisEventOverlapsWith")));
    container.appendChild(link);
    container.appendChild(document.createTextNode(`(${generateTimeDurationStr({event: conflictingEvent})})`));

    if (fullCalendar) {
        fcChangeView(CalendarView.DAY);
        fullCalendar.gotoDate(conflictingEvent.startTime);
    }

    const buttons = [];

    buttons.push({
        icon: "settings",
        onClick: function(dialog) {
            dialog.close();
            openUrl("options.html?highlight=eventConflictHandling#general");
        }
    });
    buttons.push(...generateEditUndoButtons(newEvent));
    buttons.push({
        text: getMessage("organize"),
        onClick: function(dialog) {
            dialog.close();
        }
    });

    buttons.push({
        text: getMessage("ok"),
        primary: true,
        onClick: async function(dialog) {
            dialog.close();
            if (fullCalendar) {
                const calendarView = await getCalendarView()
                fcChangeView(calendarView);
            }
        }
    });

    openDialog(container, {
        id: "conflicting-event-dialog",
        noAutoFocus: true,
        buttons: buttons
    });
}

function generateEditUndoButtons(eventEntry) {
    return [
        {
            text: getMessage("edit"),
            onClick: function(dialog) {
                if (dialog) {
                    dialog.close();
                }
                showCreateBubble({event:eventEntry, editing:true});
            }
        }, {
            text: getMessage("undo"),
            onClick: async function(dialog) {
                if (dialog) {
                    dialog.close();
                }
                showProgress();
                deleteEvent(eventEntry).then(async response => {
                    if (fullCalendar) {
                        if (eventEntry.recurrence) {
                            fullCalendar.getEvents().forEach(event => {
                                if (eventEntry.id == event.extendedProps.jEvent.recurringEventId) {
                                    event.remove();
                                }
                            });
                        } else {
                            fullCalendar.getEventById(getEventID(eventEntry)).remove();
                        }
                    }
                    showToast(getMessage("eventDeleted"));
                    
                    if (await getCalendarView() == CalendarView.AGENDA) {
                        initAgenda();
                    }
                }).catch(error => {
                    showError("Error deleting event: " + error);
                }).then(() => {
                    hideProgress();
                });
            }
        }
    ]
}

async function setEventDateMessage(eventEntry) {
	let $message;

	if (eventEntry.inputSource == InputSource.QUICK_ADD) {
		var message = await formatEventAddedMessage("<span class='eventTitle' style='color:#fff38a;font-size:120%'>" + eventEntry.summary.trim() + "</span>", eventEntry);
	
		// for safe Firefox DOM insertion
		var messageNode = new DOMParser().parseFromString(message, "text/html").body;
		$message = document.createElement("span");
		Array.from(messageNode.childNodes).forEach(node => {
			const $eventTitle = document.createElement("span");
			$eventTitle.textContent = node.textContent;
			if (node.className) {
				$eventTitle.classList.add(node.className);
			}
			if (node.style?.cssText) {
				$eventTitle.style.cssText = node.style.cssText;
			}
			$message.append( $eventTitle );
		});
	} else {
        let message;
        if (eventEntry.kind == TASKS_KIND) {
            message = getMessage("taskSaved");
        } else {
            message = getMessage("eventSaved");
        }
        $message = document.createElement("span");
        $message.style.cssText = "display:inline-block;min-width:100px";
        $message.textContent = message;
	}

    const buttons = generateEditUndoButtons(eventEntry);

    const arrayOfCalendars = await getArrayOfCalendars();
	if (eventEntry.kind != TASKS_KIND && eventEntry.calendarId != await getDefaultCalendarId(arrayOfCalendars)) {
        buttons.push({
            text: getMessage("defaultCalendar"),
            onClick: async function() {
                if (await donationClicked("defaultCalendar")) {
                    await storage.set("defaultCalendarId", eventEntry.calendarId);
                    let calendar = getCalendarById(eventEntry.calendarId);
                    let calendarName = getCalendarName(calendar);
                    showToast(getMessage("defaultCalendar") + ": " + calendarName);
                }
            }
        });
	}
	
    showToast($message, {
        buttons: buttons,
        duration: seconds(5)
    });
}

function maybePerformUnlock(processor, callback) {
	callback();
}

function initReminderLine($createEventDialog, $calendarReminder, allDay) {
	const $eventReminders = $createEventDialog.querySelector("#event-reminders");

	const $reminderMinutes = $calendarReminder.querySelector(".reminderMinutes");
	const $reminderValuePerPeriod = $calendarReminder.querySelector(".reminderValuePerPeriod");
	const $reminderPeriod = $calendarReminder.querySelector(".reminderPeriod");

	initReminderPeriod($reminderValuePerPeriod, $reminderPeriod, $reminderMinutes, allDay);
	
    replaceEventListeners($calendarReminder.querySelectorAll("select"), "change", function() {
		updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod);
		createEventRemindersChanged = true;
	});
	
	replaceEventListeners($calendarReminder.querySelectorAll("j-input"), "change", function() {
		updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod);
		createEventRemindersChanged = true;
	});
	
    onClickReplace($calendarReminder.querySelector(".deleteReminder"), function() {
        $calendarReminder.remove();
        /*
        const index = getNodeIndex($calendarReminder, $eventReminders.querySelectorAll(".calendarReminder"))
		// patch using .splice would corectly remove right item in the polymer object but was visually removing the last node, so must call initAllReminders
		$createEventDialog.querySelector("event-reminders").splice("reminders", index, 1);
		initAllReminders($createEventDialog, allDay);
        */
        createEventRemindersChanged = true;
	});
}

function initAllReminders($createEventDialog, allDay) {
    const $eventReminders = $createEventDialog.querySelector("#event-reminders");

    createEventRemindersChanged = false;
    $eventReminders.querySelectorAll(".calendarReminder").forEach($calendarReminder => {
        initReminderLine($createEventDialog, $calendarReminder, allDay);
    });

    const $addReminder = $eventReminders.querySelector(".addReminder");
    //$addReminder.textContent = getMessage("addNotification"); // doing it here, for some reason msg were not being replace inside the custom node
    onClickReplace($addReminder, function () {
        let reminder;
        if (allDay) {
            reminder = { method: "popup", minutes: 1440 }; // 1 day
        } else {
            reminder = { method: "popup", minutes: 10 };
        }

        //$createEventDialog.querySelector("event-reminders").push("reminders", reminder);
        
        const reminderLine = generateReminderLine(reminder);
        
        $addReminder.before(reminderLine);
        createEventRemindersChanged = true;

        initReminderLine($createEventDialog, reminderLine, allDay);
        $createEventDialog.querySelector("#native-dialog-message").scrollTop += 40;
    });
}

function changeReminders(allDay, $createEventDialog, allDayReminders, timedReminders) {
    const $eventReminders = $createEventDialog.querySelector("#event-reminders");

    removeAllNodes($eventReminders.querySelectorAll(".calendarReminder"));

	if (allDay) {
		allDayReminders.forEach(reminder => {
			$eventReminders.querySelector(".addReminder").before(generateReminderLine(reminder));
		});
		initAllReminders($createEventDialog, true);
		createEventAllDay = true;
	} else {
		timedReminders.forEach(reminder => {
			$eventReminders.querySelector(".addReminder").before(generateReminderLine(reminder));
		});
		initAllReminders($createEventDialog, false);
		createEventAllDay = false;
	}
}

function initColorChoice($content, colorId, color) {
	const $color = document.createElement("div");
    $color.classList.add("colorChoice");
    $color.style.background = color;
    $color._colorId = colorId;
    onClick($color, function() {
        const $eventColor = byId("eventColor");
        if ($eventColor) {
            $eventColor.style.background = color;
            $eventColor._colorId = colorId;
        }
		byId("eventColorsDialog")?.close();
	});

    const $ripple = document.createElement("j-ripple");
    $ripple.setAttribute("center", "");
    $ripple.style.color = "white";

    $color.append($ripple);
	$content.append($color);
}

function showEventColors(colors, calendar) {
	const $content = document.createElement("div");
	
	const bgColor = colors.calendar[calendar.colorId].background;
	initColorChoice($content, null, bgColor);
	
    const $color = document.createElement("div");
    $color.style.cssText = "background:#aaa;width:1px;height:16px;display:inline-block;margin-right:7px";
	$content.append($color);
	
	for (let a in colors.event) {
		initColorChoice($content, a, colors.event[a].background);
	}
	
    openDialog($content, {
        id: "eventColorsDialog",
        title: getMessage("eventColor"),
        closeButton: true,
        ok: false
    })
}

function doesEventTitleHaveTime() {
	if (byId("detectTime").checked) {
		const text = byId("eventTitle").value;
		return text?.match(/\b\d/);
	}
}

function sortReminders(reminders) {
	reminders.sort(function(a, b) {
		if (parseInt(a.minutes) < parseInt(b.minutes)) {
			return -1;
		} else {
			return +1;
		}
	});
}

function isEventTimeSlotted(event) {
    const currentView = fullCalendar?.view.type;
	return !event.allDay && (currentView == getFCViewName(CalendarView.WEEK) || currentView == getFCViewName(CalendarView.DAY));
}

async function showExtraFeaturesDialog() {
    const content = new DocumentFragment();
    content.append("Creating events by clicking in the calendar is an extra feature.");
    content.append(createBR());
    content.append("Use the big red button instead to add events if you don't want to contribute.");

	await openDialog(content, {
		title: getMessage("extraFeatures"),
        cancel: true,
        buttons: [
            {
                label: getMessage("contribute"),
                primary: true,
                onClick: function() {
                    openUrl("contribute.html?action=createEvent");
                }
            }
        ]
	});
}

function resetInviteGuestsDialog() {
    const $inviteGuestsDialog = byId("inviteGuestsDialog");
    if ($inviteGuestsDialog) {
        $inviteGuestsDialog._guestsLoaded = false;
    }
    removeAllNodes("#inviteGuestsDialog .chip");
}

function saveAttendeesToEvent(eventEntry) {
    const $inviteGuestsChips = selectorAll("#inviteGuestsDialog .chip");
    if ($inviteGuestsChips.length) {
        eventEntry.attendees = [];
        $inviteGuestsChips.forEach($chip => {
            let attendeeChipData = $chip._attendee;
            let attendee;
            if (attendeeChipData) { // directly from google event data
                attendee = attendeeChipData;
            } else { // from contacts data object
                attendeeChipData = $chip._data;
                attendee = {
                    displayName: attendeeChipData.name,
                    email: attendeeChipData.email
                }
                if (attendeeChipData.organizer != undefined) {
                    attendee.organizer = attendeeChipData.organizer;
                }
                if (attendeeChipData.responseStatus != undefined) {
                    attendee.responseStatus = attendeeChipData.responseStatus;
                }
            }
            eventEntry.attendees.push(attendee);
        });
    }
}

async function grantContactPermission(event) {
    const tokenResponses = await oAuthForDevices.getTokenResponses();
    const tokenResponse = tokenResponses[0];
    const thisTokenResponse = await requestPermission({
        email: tokenResponse.userEmail,
        initOAuthContacts: true,
        useGoogleAccountsSignIn: !tokenResponse.chromeProfile
    });

    if (thisTokenResponse) {
        hideLoading();
        showInviteGuestsDialog(event);
    }
}

async function showCreateBubble(params) {
	console.time("create");
    console.log("showCreateBubble", params);
    
    function autoSave() {
        const eventEntry = initEventEntry();
        if (eventEntry.summary || eventEntry.description) {

            saveAttendeesToEvent(eventEntry);

            const autoSaveObj = {
                autoRestore: true,
                event: eventEntry,
                editing: params.editing,
                recurringEventDetails: {
                    dropdownValue: byId("repeat-dropdown").value,
                    customRecurrenceRule: customRecurrenceRule
                }
            };

            storage.set("autoSave", autoSaveObj);
        }
    }

    clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        if ($createEventDialog?.hasAttribute("open")) {
            autoSave();
        } else {
            clearInterval(autoSaveInterval);
        }
    }, seconds(3));

    // reset guests dialog
    resetInviteGuestsDialog();

	var event = params.event;

	var allDayReminders = [{
        method: "popup",
        minutes: 0
    }];

	var timedReminders = [];

    let $createEventDialog;
	const $createEventDialogContent = initTemplate("createEventDialogTemplate");
	_createEvent = event;

	if (params.editing) {
		const calendar = getEventCalendar(event);
		if (calendar?.defaultReminders) {
			timedReminders = deepClone(calendar.defaultReminders);
		}
	} else {
        if (event.allDay && !await storage.get("selectAllDay")) {
            event.allDay = false;
            if (event.startTime.isToday()) {
                event.startTime = getNearestHalfHour();
            } else {
                event.startTime.setHours(DEFAULT_HOUR_FOR_TIMED_EVENT);
            }
        }

        const arrayOfCalendars = await getArrayOfCalendars();
		const calendar = getPrimaryCalendar(arrayOfCalendars)
		if (calendar?.defaultReminders) {
			timedReminders = deepClone(calendar.defaultReminders); // used to be writeableCalendars.first()
		}
	}

	function initAllDay(allDay) {
		if (allDay) {
			hide("#eventStartTime");
			hide("#eventEndTime");
			hide("#timezone-button"); // hide timezone button when all-day event is selected
		} else {
			show("#eventStartTime");
			show("#eventEndTime");
			show("#timezone-button"); // show timezone button when all-day event is not selected
		}
	}
	
	function initEndTime(deltaMinutes) {
        const start = eventStartTimePicker.dateTime;
        
        const endTime = start.addMinutes(deltaMinutes);
        eventEndTimePicker.dateTime = endTime;
        
        // if duration times goes over the midnight then +1 to the end date
        if (!start.isSameDay(endTime)) {
            console.log("duration over midnight! add a day")
            eventEndDatePicker.dateTime = eventEndDatePicker.dateTime.addDays(1);
        }
	}
	
	function initEventRemindersNode() {
        let reminders;
        if (params.autoRestore && params.event.reminders) {
            reminders = params.event.reminders.overrides;
        } else {
            if (params.editing) {
                if (!event.reminders || event.reminders.useDefault) {
                    if (event.allDay) {
                        reminders = deepClone(allDayReminders);
                    } else {
                        reminders = deepClone(timedReminders);
                    }
                } else {
                    reminders = event.reminders.overrides;
                }
            } else {
                if (event.allDay) {
                    reminders = deepClone(allDayReminders);
                } else {
                    reminders = deepClone(timedReminders);
                }
            }
            
            if (!reminders) {
                reminders = [];
            }
            
            sortReminders(reminders);
        }

        const eventReminders = selector("#createEventDialog #event-reminders");
        emptyAppend(eventReminders, generateReminderSection(reminders));
	}

	// need to re-initialize Date object here because .format was not found
	event.startTime = new Date(event.startTime);

    let selectedCalendarId;
    if (params.copyToMyCalendar) {
        selectedCalendarId = await getDefaultCalendarId( await getArrayOfCalendars() );
    } else {
        selectedCalendarId = getEventCalendarId(event);
    }

    await initCalendarDropDown("createEventCalendarsMenu", {selectedCalendarId: selectedCalendarId});

    async function initTaskLists(event) {
        const taskLists = cachedFeeds["taskLists"];
        const taskListToSelect = getTaskList(event) || taskLists.items.first();
        const dropdown = byId("createEventTaskList");

        if (!dropdown._initDropDownDone) {
            taskLists.items.forEach(taskList => {
                const option = document.createElement("option");
                const textNode = document.createTextNode(taskList.title);
                option.appendChild(textNode);
                option.setAttribute("value", taskList.id);
                dropdown.appendChild(option);
            });

            dropdown._initDropDownDone = true;
        }

        dropdown.value = taskListToSelect.id;
    }

	byId("createEventCalendarsMenu").addEventListener("change", function(e) {
        const calendarId = e.target.value;

        if (event.kind != TASKS_KIND) {
		    initEventColor(event);
        }
		
		// init reminders
		let allDay;
		if (params.editing) {
			allDay = byId("eventAllDay").checked;
		} else {
			if (isEventTimeSlotted(event)) {
				allDay = false;
			} else {
                if (isVisible("#detectTime") && byId("detectTime").checked) {
                    allDay = !doesEventTitleHaveTime();
                } else {
                    allDay = byId("eventAllDay").checked;
                }
			} 
		}

		const calendar = getCalendarById(calendarId);
		
        allDayReminders = [{
            method: "popup",
            minutes: 0
        }];

		if (calendar.defaultReminders) {
			timedReminders = deepClone(calendar.defaultReminders);
		}
		
		console.log("timedReminders", timedReminders);
		
		sortReminders(timedReminders);
		
		initEventRemindersNode();

		changeReminders(allDay, $createEventDialog, allDayReminders, timedReminders);
	});
	
	createEventAllDay = event.allDay;

	let eventEndTime = event.endTime;
	if (!eventEndTime) {
		eventEndTime = new Date(event.startTime);
		if (event.allDay) {
            eventEndTime.setDate(event.startTime.getDate() + 1);
		} else {
			eventEndTime.setMinutes(eventEndTime.getMinutes() + await getDefaultEventLength());
		}
	}

	const deltaDays = Math.round(eventEndTime.diffInDays(event.startTime));
    let deltaMinutes = eventEndTime.diffInMinutes(event.startTime);
	if (deltaMinutes >= 60 * 24) { // if 1+ days then just use default length
        deltaMinutes = await getDefaultEventLength();
    }

    globalThis.eventStartDatePicker = new DatePicker(byId("eventStartDate"), {
        fullCalendarParams: await generateFullCalendarParams(),
        changeDate: function() {
            console.log("changedate", deltaDays, event, this.dateTime);
            const start = this.dateTime;
            const end = eventEndDatePicker.dateTime;
    
            // google calendar all day events actually end the next day, so for displaying purposes we display the day before
            const date = start.addDays(deltaDays);
            if (byId("eventAllDay")._originalAllDayFlag || byId("eventAllDay").checked) {
                date.setDate(date.getDate() - 1);
            }
            eventEndDatePicker.dateTime = date;
        }
    });
    eventStartDatePicker.dateTime = event.startTime;


	// must re-init (because we could have created dialog twice by clicking several events in the same popup window session and compounding datepicker calls)
	//$("#eventStartDate").datepicker("destroy");
	//$("#eventStartDate").datepicker(datePickerStartParams);
	//$("#eventStartDate").datepicker("setDate", event.startTime);

    globalThis.eventStartTimePicker = new TimePicker(byId("eventStartTime"), {
        changeTime: function() {
            console.log("changetime")
            if (!globalThis._changedEndTime && this.dateTime) {
                initEndTime(deltaMinutes);
            }
        }
    });
    if (event.allDay) {
        eventStartTimePicker.dateTime = getNearestHalfHour();
    } else {
        eventStartTimePicker.dateTime = event.startTime;
    }

    globalThis.eventEndDatePicker = new DatePicker(byId("eventEndDate"), {
        fullCalendarParams: await generateFullCalendarParams(),
        changeDate: () => {
            // assume user chose a different day then the start day and thus this will cancel durations and dropdown start time will reset to 12:00
            eventEndTimePicker.startTimePicker = null;
        }
    });

    let newEndDate;
	if (event.allDay) {
		// google calendar all day events actually end the next day, so for displaying purposes we display the day before
		const date = new Date(eventEndTime);
        date.setDate(date.getDate() - 1);
        newEndDate = date;
	} else {
        newEndDate = eventEndTime;
    }
    eventEndDatePicker.dateTime = newEndDate;
    eventEndDatePicker._originalDate = newEndDate;

    globalThis._changedEndTime = false;
    const endTimePickerParams = {
        changeTime: function() {
            console.log("changetime end");
            globalThis._changedEndTime = true;
        }
    };
    // only show durations if start and end day are same day
    if (!event.endTime || event.startTime.isSameDay(event.endTime)) {
        endTimePickerParams.startTimePicker = eventStartTimePicker;
    }

    globalThis.eventEndTimePicker = new TimePicker(byId("eventEndTime"), endTimePickerParams);

	if (event.allDay) {
		initEndTime(0);
	} else {
        eventEndTimePicker.dateTime = eventEndTime;
	}

	byId("eventAllDay").checked = event.allDay;
	initAllDay(event.allDay);

    byId("eventAllDay")._originalAllDayFlag = event.allDay;

    replaceEventListeners("#eventAllDay", "change", function () {
        if (params.editing) {
            const originalDate = eventEndDatePicker._originalDate;
            //eventEndDatePicker.dateTime = originalDate; // commented to fix this issue: https://bitbucket.org/jasonsav/checker-plus-for-google-calendar/issues/412/end-date-doesnt-change-when-modifying-all and https://jasonsavard.com/forum/discussion/comment/33749#Comment_33749
        }

        event.allDay = byId("eventAllDay").checked;
        if (event.allDay) {
            initEndTime(0);
        } else {
            console.log("deltaminutes", deltaMinutes);
            if (!params.editing && !event.startTime.isToday()) {
                const time = new DateZeroTime();
                time.setHours(DEFAULT_HOUR_FOR_TIMED_EVENT);
                eventStartTimePicker.dateTime = time;
            }
            initEndTime(deltaMinutes);
        }
		initAllDay(event.allDay);

        if (!params.editing) {
            byId("event-transparency").value = event.allDay ? EventTransparency.FREE : EventTransparency.BUSY;
        }

		changeReminders(event.allDay, $createEventDialog, allDayReminders, timedReminders);
	});

    show("#timezone-button");
    hide("#timezone-dropdown-wrapper");
    
    if (await storage.get("displaySecondaryTimezone")) {
        const $timezoneDropdown = byId("timezone-dropdown-wrapper");
        emptyNode($timezoneDropdown.querySelector("option"));
    }

    onClickReplace("#timezone-button", async function() {
        hide(this);
        const $dropdownWrapper = byId("timezone-dropdown-wrapper");
        show($dropdownWrapper);
        await generateTimezoneDropdown("timezone-dropdown-wrapper", true);
        $dropdownWrapper.showPicker();
    });

    function initDetectTimeAndReminders({ showDetectTime, skipReminders, skipRecurringInit, userGesture } = {}) {
        let recurrenceDropdownValue;

        const $clickedEventDialog = byId("clickedEventDialog");

        // not sure why i had this with polymer but now i made it true all the time
        if (true || $clickedEventDialog) {
            if (params.editing) {
                recurrenceDropdownValue = _recurrenceDropdownValue;
            } else {
                _recurrenceDropdownValue = "";
            }
        }

        if (params.autoRestore) {
            console.log("autorestore", params);
            recurrenceDropdownValue = params.recurringEventDetails.dropdownValue;
            customRecurrenceRule = params.recurringEventDetails.customRecurrenceRule;
            if (customRecurrenceRule) {
                recurringEvent = {
                    recurrence: [customRecurrenceRule]
                }
            }
        }

        if (!recurrenceDropdownValue) {
            recurrenceDropdownValue = "";
        }
        
        const $repeatDropdown = byId("repeat-dropdown");

        if (!skipRecurringInit) {
            console.log("recurrenceDropdownValue", recurrenceDropdownValue)
            $repeatDropdown.value = recurrenceDropdownValue;
        }

		if (showDetectTime) {
            selector("#detectTimeWrapper .repeat-placeholder").append($repeatDropdown);

			hide("#eventStartEndTimeWrapper");
			show("#detectTimeWrapper");
			if (!skipReminders && createEventAllDay) {
				changeReminders(false, $createEventDialog, allDayReminders, timedReminders);
			}
		} else {
            selector("#eventStartEndTimeWrapper .repeat-placeholder").append($repeatDropdown);

            show("#eventStartEndTimeWrapper");
			hide("#detectTimeWrapper");
			if (!skipReminders && !createEventAllDay) {
				changeReminders(true, $createEventDialog, allDayReminders, timedReminders);
			}
		}

        function setMonthlyOnDayPaperItem(selectedValue, message) {
            const $repeatMonthlyOn = byId("repeatMonthlyOn");
            const dayName = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(event.startTime);
            const $option = $repeatMonthlyOn.querySelector(`option[value='${selectedValue}']`);
            $option.textContent = getMessage(message, dayName);
            show($option);
        }

        function initRepeatOnWrapper(value, byday, byMonthDay, bysetpos) {
            if (!value || value == "WEEKLY") {
                show("#repeatOnWrapper");
                hide("#repeatMonthlyOnWrapper");
            } else {
                hide("#repeatOnWrapper");
                if (value == "MONTHLY") {
                    const $repeatMonthlyOn = byId("repeatMonthlyOn");
                    $repeatMonthlyOn.querySelectorAll("option[value='1'], option[value='2'], option[value='3'], option[value='4'], option[value='last'], option[value='-1']").forEach(item => {
                        hide(item);
                    });

                    if (byMonthDay == -1 || isLastDayOfMonth(event.startTime)) {
                        const option = $repeatMonthlyOn.querySelector("option[value='-1']");
                        show(option);
                        if (byMonthDay == -1) {
                            $repeatMonthlyOn.value = -1;
                        }
                    }

                    if (!byMonthDay) {
                        byMonthDay = event.startTime.getDate();
                    }
                    
                    const option = $repeatMonthlyOn.querySelector("option[value='dayX']");
                    option.textContent = getMessage("monthlyOnDayX", byMonthDay);
                    show(option);

                    if (bysetpos == 1 || event.startTime.getDate() <= 7) {
                        setMonthlyOnDayPaperItem(1, "monthlyOnTheFirstX");
                    } else if (bysetpos == 2 || event.startTime.getDate() <= 14) {
                        setMonthlyOnDayPaperItem(2, "monthlyOnTheSecondX");
                    } else if (bysetpos == 3 || event.startTime.getDate() <= 21) {
                        setMonthlyOnDayPaperItem(3, "monthlyOnTheThirdX");
                    }
                    
                    if (bysetpos == 4 || (21 < event.startTime.getDate() && event.startTime.getDate() <= 28)) {
                        setMonthlyOnDayPaperItem(4, "monthlyOnTheFourthX");
                    }
                    if (bysetpos == -1 || event.startTime.getDate() >= 25) {
                        setMonthlyOnDayPaperItem("last", "monthlyOnTheLastX");
                    }

                    const matches = parseRRuleForByDay(byday);
                    let relativeByDay;
                    if (matches) {
                        relativeByDay = matches[1];
                    }

                    if (relativeByDay == "-1") {
                        $repeatMonthlyOn.value = "last";
                    } else if (relativeByDay) {
                        $repeatMonthlyOn.value = relativeByDay;
                    } else {
                        $repeatMonthlyOn.value = "dayX";
                    }
                    show("#repeatMonthlyOnWrapper");
                } else {
                    hide("#repeatMonthlyOnWrapper");
                }
            }
        }

        // using click on option instead of change because want to be able to reclick "custom" (Note this only works cause i'm using appearance: base-select)
        replaceEventListeners($repeatDropdown.querySelector("[value='custom']"), "click", async function(e) {
            const value = $repeatDropdown.value;
            if (value == "custom") {

                const recurrenceDialog = byId("recurrenceDialog");
                if (recurrenceDialog && recurrenceDialog.classList.contains("hide-temporarily")) {
                    recurrenceDialog.classList.remove("hide-temporarily");
                    return;
                }

                const existingRule = getRRule(recurringEvent);
                const frequency = getRRuleCondition(existingRule, "FREQ");
                const byday = getRRuleCondition(existingRule, "BYDAY");
                const bydayArray = byday?.split(',');
                const byMonthDay = getRRuleCondition(existingRule, "BYMONTHDAY");
                const bysetpos = getRRuleCondition(existingRule, "BYSETPOS");

                const weekdayInitials = getWeekdayInitials();

                const $dialogContent = initTemplate("recurrenceDialogTemplate");

                initRepeatOnWrapper(frequency, byday, byMonthDay, bysetpos);
                replaceEventListeners("#repeatEveryPeriod", "change", function(e) {
                    const value = e.target.value;
                    initRepeatOnWrapper(value, byday, byMonthDay, bysetpos);
                });

                $dialogContent.querySelectorAll("#repeatOnDays j-button").forEach(($button, index) => {
                    $button.textContent = weekdayInitials[index];
                    $button.title = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(getSundayRelativeDate(index));
                    replaceEventListeners($button, "click", function() {
                        $button.classList.toggle("active-state");
                    });

                    if (existingRule) {
                        if (byday) {
                            if (bydayArray.includes(RRULE_DAYS[index])) {
                                $button.classList.add("active-state");
                            }
                        }
                    } else {
                        if (event.startTime.getDay() === index) {
                            $button.classList.add("active-state");
                        }
                    }
                });

                globalThis.repeatEndsOnDatePicker = new DatePicker(byId("repeatEndsOnDate"), {
                    fullCalendarParams: await generateFullCalendarParams(),
                    changeDate: function() {
                        const end = this.dateTime;
                        console.log("end", end);
                    }
                });
                repeatEndsOnDatePicker.dateTime = event.startTime.addDays(90);

                if (existingRule) {
                    const interval = getRRuleCondition(existingRule, "INTERVAL");
                    if (interval) {
                        selector("#repeatEveryValue").value = interval;
                    }

                    if (frequency) {
                        selector("#repeatEveryPeriod").value = frequency;
                    }

                    const untilDate = getRRuleUntilDate(existingRule);
                    const count = getRRuleCondition(existingRule, "COUNT");

                    if (untilDate) {
                        repeatEndsOnDatePicker.dateTime = untilDate;
                        setSelectedRadioValue("repeat-ends-dropdown", "on");
                    } else if (count) {
                        setSelectedRadioValue("repeat-ends-dropdown", "after");
                        selector("#repeatEndsAfterOccurrences").value = count;
                    } else {
                        setSelectedRadioValue("repeat-ends-dropdown", "never");
                    }
                } else {
                    // set default because it we open the dialog and change it to daily and then close and return to it then circles for days of the weekly option will be there but the dropdown says daily
                    selector("#repeatEveryPeriod").value = "WEEKLY";
                    setSelectedRadioValue("repeat-ends-dropdown", "never");
                }

                function initRepeatEndsDropdown(value) {
                    if (value == "never") {
                        byId("repeatEndsOnDate").setAttribute("disabled", "");
                        byId("repeatEndsAfterOccurrences").setAttribute("disabled", "");
                    } else if (value == "on") {
                        byId("repeatEndsOnDate").removeAttribute("disabled");
                        byId("repeatEndsAfterOccurrences").setAttribute("disabled", "");
                    } else {
                        byId("repeatEndsOnDate").setAttribute("disabled", "");
                        byId("repeatEndsAfterOccurrences").removeAttribute("disabled");
                    }
                }

                initRepeatEndsDropdown(getSelectedRadioValue("repeat-ends-dropdown"));
                replaceEventListeners($dialogContent.querySelectorAll("[name='repeat-ends-dropdown']"), "change", function(e) {
                    console.log("selected-changed", e.target.value);
                    initRepeatEndsDropdown(e.target.value);
                });

                openDialog($dialogContent, {
                    id: "recurrenceDialog",
                    cancel: true,
                    modal: false,
                    closeByOutsideClick: false,
                    buttons: [
                        {
                            label: getMessage("done"),
                            primary: true,
                            onClick: (dialog) => {
                                const days = [];
                                selectorAll("#repeatOnDays j-button").forEach(($button, index) => {
                                    if ($button.classList.contains("active-state")) {
                                        days.push(index);
                                    }
                                });

                                const interval = selector("#repeatEveryValue").value;
                                const frequency = selector("#repeatEveryPeriod").value;
                                const occurrences = selector("#repeatEndsAfterOccurrences").value;
                                const endsChoice = getSelectedRadioValue("repeat-ends-dropdown");

                                let rrule = `RRULE:FREQ=${frequency}`;

                                if (interval != 1) {
                                    rrule += `;INTERVAL=${interval}`;
                                }
                                
                                if (frequency == "WEEKLY" && days.length) {
                                    const byweekday = days.map(day => RRULE_DAYS[day]).join(',');
                                    rrule += `;BYDAY=${byweekday}`;
                                }

                                const monthyOn = selector("#repeatMonthlyOn").value;
                                if (frequency == "MONTHLY") {
                                    if (monthyOn == -1) {
                                        rrule += `;BYMONTHDAY=-1`;
                                    } else if (monthyOn == "dayX") {
                                        rrule += `;BYMONTHDAY=${event.startTime.getDate()}`;
                                    } else {
                                        const bysetpos = monthyOn == "last" ? "-1MO" : `${monthyOn}TH`;
                                        rrule += `;BYDAY=${bysetpos}`;
                                    }
                                }

                                if (endsChoice == "on") {
                                    rrule += `;UNTIL=${repeatEndsOnDatePicker.dateTime.format("yyyymmdd")}`;
                                } else if (endsChoice == "after") {
                                    rrule += `;COUNT=${occurrences}`;
                                }
                            
                                customRecurrenceRule = rrule;

                                dialog.classList.add("hide-temporarily");
                            }
                        }
                    ]
                });
            }
        });
	}

	// remember this because we can't detect time using quickadd when spanning multiple days
    const spansMultipeDays = event.allDay && event.startTime && event.endTime && !event.startTime.isSameDay(event.endTime);
    const detectTime = await storage.get("detectTime") && !params.autoRestore;

    if (params.editing) {
        initDetectTimeAndReminders({ skipReminders: true });
    } else {
        const detectTimeFlag = detectTime && !spansMultipeDays && !isEventTimeSlotted(event);
        initDetectTimeAndReminders({ showDetectTime: detectTimeFlag, skipReminders: true });

		// default to checked
		byId("detectTime").checked = true;
        replaceEventListeners("#detectTime", "change", function (e) {
            if (!this.checked) {
                byId("eventTitle").setAttribute("placeholder", getMessage("quickAddDefaultTextMultipleDays"));
                initDetectTimeAndReminders({userGesture: true});
                byId("eventTitle").focus();
            }
        });
    }
	
	console.timeEnd("create")
	
    // must use keypress to detect enter (not keyup because ime japanense issue: https://jasonsavard.com/forum/discussion/comment/8236#Comment_8236)
    // v2 hopefully resolved by checking isComposing
    replaceEventListeners($createEventDialogContent.querySelector("#eventTitle"), "keyup", function(e) { // use keyup to detect backspace/cleared text
        if (e.key === "Escape") {
            $createEventDialog.close("escape-key");
        } else {
            // check that we are not in weekview ie. must be a allDay event
            if (event.allDay && this.id == "eventTitle") {
                let showDetectTimeParam;
                let transparencyValue;
                if (detectTime && !spansMultipeDays && doesEventTitleHaveTime()) {
                    showDetectTimeParam = true;
                    transparencyValue = EventTransparency.BUSY;
                } else {
                    showDetectTimeParam = false;
                    transparencyValue = EventTransparency.FREE;
                }
                if (!params.editing) {
                    byId("event-transparency").value = transparencyValue;
                }
                initDetectTimeAndReminders({ showDetectTime: showDetectTimeParam, skipRecurringInit: true, userGesture: true });
            }
        }
    });

    replaceEventListeners($createEventDialogContent.querySelector("#eventTitle"), "keydown", function(e) { // use keyup to detect backspace/cleared text
        console.log("keydown", e);
        if (!isCtrlPressed(e) && e.key === "Enter" && !e.isComposing) {
            //$createEventDialog.querySelector("paper-button[dialog-confirm]").click();
            // patch: seems when select time slots in weekview and pressing enter, that the dialog would not close
            $createEventDialog.close("escape-key");
        }
    });
	
	function initEventEntry() {
		let eventEntry;

		if (isVisible("#detectTime") && doesEventTitleHaveTime()) {
			eventEntry = new EventEntry();
			eventEntry.startTime = event.startTime;
		} else {
            eventEntry = deepClone(event);
			eventEntry.allDay = byId("eventAllDay").checked;
			eventEntry.startTime = eventStartDatePicker.dateTime;
            if (!byId("createEventDialog").classList.contains("task-selected")) {
                eventEntry.endTime = eventEndDatePicker.dateTime;

                // google calendar all day events actually end the next day, so for displaying purposes we display the day before - now we must submit as next day
                if (byId("eventAllDay").checked) {
                    eventEntry.endTime.setDate(eventEntry.endTime.getDate() + 1);
                }
            }

			function mergeTime(date, time) {
                date.setHours(time.getHours());
                date.setMinutes(time.getMinutes());
                date.setSeconds(time.getSeconds());
                date.setMilliseconds(time.getMilliseconds());
			}
			// since timepicker always returns current date we must instead use the date from the date picked and merge the time from the time picked
            const startTime = eventStartTimePicker.dateTime;
            if (startTime) {
                mergeTime(eventEntry.startTime, startTime);
            }

            if (!byId("createEventDialog").classList.contains("task-selected")) {
                const endTime = eventEndTimePicker.dateTime;
                if (endTime) {
                    mergeTime(eventEntry.endTime, endTime);
                }
            }
        }
        
        eventEntry.summary = byId("eventTitle").value;

        const originalDescHtml = byId("eventDescription").innerHTML; //.replace(/<div>/gi,'<br>').replace(/<\/div>/gi,'')
        const descriptionWithNewLines = originalDescHtml.replace(/<br\s*[\/]?>/gi, "\n"); // replace BRs with newline
        if (hasHtml(descriptionWithNewLines)) { // if there is still html code than revert to original html with BRs
            eventEntry.description = originalDescHtml;
        } else {
            eventEntry.description = descriptionWithNewLines
        }

        const timezoneDropdown = byId("timezone-dropdown-wrapper");
        if (isVisible(timezoneDropdown)) {
            eventEntry.timeZone = timezoneDropdown.value;
            getPrimaryTimezone().then(primaryTimezone => {
                if (eventEntry.timeZone && eventEntry.timeZone != primaryTimezone) {
                    storage.set("_userChosenTimezone", eventEntry.timeZone);
                }
            });
        }

        eventEntry.transparency = byId("event-transparency").value;
        eventEntry.visibility = byId("event-visibility").value;
        
        if (byId("createEventDialog").classList.contains("task-selected")) {
            eventEntry.kind = TASKS_KIND;
            eventEntry.calendarId = TASKS_CALENDAR_OBJECT.id;
            eventEntry.taskListId = byId("createEventTaskList").value;
        } else {
            eventEntry.calendarId = byId("createEventCalendarsMenu").value;
        }
        
        const conferenceData = byId("eventConference")._conferenceData;
        if (conferenceData === null || conferenceData) {
            eventEntry.conferenceData = conferenceData;
        }

		eventEntry.location = byId("eventLocation").value;
        eventEntry.colorId = byId("eventColor")._colorId;

        const previousRecurrenceDropdownValue = _recurrenceDropdownValue ?? "";
        const newRecurrenceDropdownValue = selector("#repeat-dropdown").value;

        const newRule = getRRule(recurringEvent);

        if (previousRecurrenceDropdownValue != newRecurrenceDropdownValue || (previousRecurrenceDropdownValue == "custom" && customRecurrenceRule && customRecurrenceRule != newRule)) {
            if (newRecurrenceDropdownValue == "") {
                eventEntry.recurrence = [];
            } else if (newRecurrenceDropdownValue == "daily") {
                eventEntry.recurrence = ["RRULE:FREQ=DAILY"];
            } else if (newRecurrenceDropdownValue == "weekly") {
                eventEntry.recurrence = ["RRULE:FREQ=WEEKLY"];
            } else if (newRecurrenceDropdownValue == "every-2-weeks") {
                eventEntry.recurrence = [`RRULE:FREQ=WEEKLY;${EventRecurrence.EVERY_2_WEEKS}`];
            } else if (newRecurrenceDropdownValue == "monthly") {
                eventEntry.recurrence = ["RRULE:FREQ=MONTHLY"];
            } else if (newRecurrenceDropdownValue == "yearly") {
                eventEntry.recurrence = ["RRULE:FREQ=YEARLY"];
            } else if (newRecurrenceDropdownValue == "every-weekday") {
                eventEntry.recurrence = [`RRULE:FREQ=WEEKLY;${EventRecurrence.EVERY_WEEKDAY}`];
            } else if (newRecurrenceDropdownValue == "custom") {
                eventEntry.recurrence = [customRecurrenceRule];
            }
        }

        if (createEventRemindersChanged) {
            eventEntry.reminders = generateRemindersForEventEntry();
        }

		return eventEntry;
	}

    byId("createEventDialog")?.close();

    openDialog($createEventDialogContent, {
        id: "createEventDialog",
        closeButton: true,
        ok: false,
        modal: false,
        maximizeHeight: true,
        closeByOutsideClick: false,
        buttons: [
            {
                id: "inviteGuests",
                label: getMessage("guests"),
                icon: "group",
                onClick: async () => {
                    await cacheContactsData();
                    if (contactsData && globalThis.contactsTokenResponse) {
                        showInviteGuestsDialog(_createEvent);
                    } else {
                        grantContactPermission(_createEvent);
                    }
                }
            },
            {
                id: "openEventInCalendar",
                label: getMessage("open"),
                icon: "launch",
                onClick: async () => {
                    const eventEntry = initEventEntry();

                    if (params.editing) {
                        openUrl(getEventUrl(event));
                    } else {
                        // user has NOT "selected" the time in the calendar - so parse the time from string
                        if (isVisible("#detectTime") && doesEventTitleHaveTime()) {
                            try {
                                const response = await googleCalendarParseString({
                                    text: byId("eventTitle").value,
                                    startTime: event.startTime,
                                    endTime: event.endTime
                                });
                                eventEntry.summary = response.summary;
                                eventEntry.allDay = response.allDay;
                                if (response.startTime) {
                                    eventEntry.startTime = response.startTime;
                                    eventEntry.endTime = response.endTime;
                                }
                            } catch (error) {
                                console.warn("googleCalendarParseString: " + error);
                                eventEntry.allDay = true;
                                eventEntry.startTime = event.startTime;
                            }
                        }
                        await storage.remove("autoSave");
                        openGoogleCalendarEventPage(eventEntry);
                    }
                }
            },
            {
                id: "saveEvent",
                label: getMessage("save"),
                primary: true,
                classList: !params.editing && !await storage.get("donationClicked") ? ["extraFeature"] : [],
                onClick: async dialog => {
                    dialog.classList.add("hide-temporarily");

                    const eventEntry = initEventEntry();

                    if (byId("createEventDialog").classList.contains("task-selected")) {
                        if (params.editing) {
                            showProgress();

                            const updateEventParams = {
                                eventEntry: eventEntry,
                                event: event
                            };

                            try {

                                const taskList = getTaskList(eventEntry);

                                // Changing task list: since API doesn't support this action, we must delete and recreate it.
                                if (taskList.id != eventEntry.taskListId) {
                                    await deleteEvent(eventEntry);
                                    fullCalendar.getEventById(eventEntry.id).remove();
                                    insertAndLoadInCalendarAndCloseDialog(eventEntry, dialog);
                                } else {
                                    const response = await updateEvent(updateEventParams);
                                    if (response.cancel) {
                                        dialog.classList.remove("hide-temporarily");
                                    } else {
                                        dialog.close();
                                        fullCalendar?.refetchEvents();
                
                                        showToast(getMessage("eventUpdated"));
                    
                                        // then must pass bypassCache or else we would override the updated event seconds later
                                        // seems we need this line if we move and event and then edit it - or else the display is not refreshed in the betacalendar??
                                        const reloadParams = {
                                            source: "editEvent",
                                            bypassCache: true,
                                            refetchEvents: true,
                                        }
                    
                                        reloadParams.skipSync = true;
                    
                                        await reloadCalendar(reloadParams);
                                    }
                                }
                            } catch (error) {
                                await showCalendarError(error);
                            } finally {
                                hideProgress();
                            }
                        } else {
                            insertAndLoadInCalendarAndCloseDialog(eventEntry, dialog);
                        }
                    } else {
                        // Regular event
                        const source = $createEventDialog._source;
                        if (source) {
                            eventEntry.source = source;
                        }
                
                        if (createEventRemindersChanged) {
                            eventEntry.reminders = generateRemindersForEventEntry();
                        }
                
                        if (byId("currentPage")._currentPageClicked) {
                            const favIconUrl = byId("currentPage").getAttribute("src");
                            if (favIconUrl) {
                                eventEntry.extendedProperties = {};
                                eventEntry.extendedProperties.private = { favIconUrl: favIconUrl };
                            }
                        }
                
                        saveAttendeesToEvent(eventEntry);
                
                        console.log("evententry", eventEntry);

                        if (params.copying && eventEntry.recurringEventId && !eventEntry.recurrence) { // checking !eventEntry.recurrence to make sure it wasn't modified by the user
                            delete eventEntry.recurringEventId;
                            eventEntry.recurrence = recurringEvent?.recurrence;
                        }
                
                        const editing = params.editing && !params.copying;
                        // passing eventEntry instead because want to detect attendee
                        const sendNotificationsResponse = await ensureSendNotificationDialog({ event: eventEntry, action: editing ? SendNotificationsAction.EDIT : SendNotificationsAction.CREATE });
                        if (!sendNotificationsResponse.cancel) {
                            if (editing) {
                                showProgress();
                
                                let timeChanged = true;
                
                                if (byId("eventAllDay")._originalAllDayFlag == eventEntry.allDay) {
                                    if (eventEntry.allDay) {
                                        if (event.startTime.isSameDay(eventEntry.startTime) && event.endTime.isSameDay(eventEntry.endTime)) {
                                            timeChanged = false;
                                        }
                                    } else {
                                        if (event.startTime.isEqual(eventEntry.startTime) && event.endTime.isEqual(eventEntry.endTime)) {
                                            timeChanged = false;
                                        }
                                    }
                                }
                
                                const updateEventParams = {
                                    eventEntry: eventEntry,
                                    event: event
                                };
                
                                // patch #1 to avoid deleting recurring events when specifying a start date, do not set dates and only PATCH other details
                                if (event.recurringEventId && !timeChanged) {
                                    console.log("patch update for recurring events");
                                    const patchFields = deepClone(eventEntry);
                                    delete patchFields.start;
                                    delete patchFields.end;
                                    delete patchFields.recurringEventId;
                                    delete patchFields.etag;
                                    delete patchFields.originalStartTime;
                    
                                    updateEventParams.patchFields = patchFields;
                                }
                
                                updateEventParams.eventEntry.sendNotifications = sendNotificationsResponse.sendNotifications;
                                try {
                                    const response = await updateEvent(updateEventParams);
                                    if (response.cancel) {
                                        dialog.classList.remove("hide-temporarily");
                                    } else {
                                        dialog.close();
                                        fullCalendar?.refetchEvents();
                
                                        showToast(getMessage("eventUpdated"));
                    
                                        // then must pass bypassCache or else we would override the updated event seconds later
                                        // seems we need this line if we move and event and then edit it - or else the display is not refreshed in the betacalendar??
                                        const reloadParams = {
                                            source: "editEvent",
                                            bypassCache: true,
                                            refetchEvents: true,
                                        }
                    
                                        // seems when modifying a recurring event to non-recurring that it would not refresh, possibly because the event id goes from id_instance to just id
                                        if (eventEntry.recurrence?.length == 0) {
                                            reloadParams.skipSync = true;
                                        }
                    
                                        await reloadCalendar(reloadParams);
                                    }
                                } catch (error) {
                                    console.error(error);
                                    dialog.classList.remove("hide-temporarily");
                                    await showCalendarError(error);
                                } finally {
                                    hideProgress();
                                }
                            } else {
                                eventEntry.sendNotifications = sendNotificationsResponse.sendNotifications;
                
                                insertAndLoadInCalendarAndCloseDialog(eventEntry, dialog);
                
                                if (!await storage.get("donationClicked")) {
                                    setTimeout(() => {
                                        showExtraFeaturesDialog();
                                    }, 2200);
                                }
                                storage.setDate("_createEventTested");
                            }
                        }
                    }
                }
            },
        ]
    });

    $createEventDialog = byId("createEventDialog");

    if (event.kind != TASKS_KIND) {
        initEventColor(event);
    }

    $createEventDialog.querySelector("#eventTitle").focus();

    $createEventDialog.addEventListener('close', function(e) {
        storage.remove("autoSave");

        // clean up .hide-temporarily dialogs
        const guestsDialog = byId("inviteGuestsDialog");
        guestsDialog?.close();
        const recurrenceDialog = byId("recurrenceDialog")
        recurrenceDialog?.close();
	});
    
    if (!params.editing && !await storage.get("donationClicked") && await storage.get("_createEventTested")) {
        showExtraFeaturesDialog().then(() => {
            $createEventDialog.close();
        });
    }
	
	initEventRemindersNode();
	initAllReminders($createEventDialog, event.allDay);
	
    $createEventDialog.querySelector("#eventTitle").value = event.summary || "";

    const selectedCalendars = await storage.get("selectedCalendars");
    const tasksSelected = isCalendarSelectedInExtension(TASKS_CALENDAR_OBJECT, email, selectedCalendars);
    const tasksUserEmails = await oAuthForTasks.getUserEmails();
    
    if (tasksSelected && tasksUserEmails?.length && !params.editing) {
        show("#event-task-selection");
    } else {
        hide("#event-task-selection");
    }

    function selectEvent() {
        byId("createEventDialog").classList.remove("task-selected");
        byId("task-selection").classList.remove("active-state");
        byId("event-selection").classList.add("active-state");

        initAllDay(event.allDay);
    }

    function selectTask() {
        byId("createEventDialog").classList.add("task-selected");
        byId("event-selection").classList.remove("active-state");
        byId("task-selection").classList.add("active-state");
        byId("detectTime").checked = false;
        initDetectTimeAndReminders({ skipReminders: true, skipRecurringInit: true });
        initTaskLists(event);

        initAllDay(true);
    }

    if (event.kind == TASKS_KIND) {
        selectTask();
    } else {
        selectEvent();
    }

    onClickReplace("#event-selection", function() {
        selectEvent();
    });

    onClickReplace("#task-selection", function() {
        selectTask();
        byId("eventTitle").focus();
    });
    
    if (event.conferenceData?.conferenceSolution) {
        byId("event-conference-icon").removeAttribute("icon");
        byId("event-conference-icon").setAttribute("src", event.conferenceData.conferenceSolution.iconUri);

        const video = event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "video");

        if (video) {
            show("#eventConferenceWrapper");
            byId("eventConference").textContent = getMessage("joinWithX", event.conferenceData.conferenceSolution.name);
            byId("eventVideoLabel").textContent = video.label;

            onClickReplace(".copy-conference-link", () => {
                navigator.clipboard.writeText(maybeSetAuthUser(event, video.uri, email));
                showToast(getMessage("copiedToClipboard"));
            });
        } else {
            hide("#eventConferenceWrapper");
        }
    } else {
        hide("#eventVideoLabelWrapper");
    }

    globalThis.eventLocationSessionToken = crypto.randomUUID();

    $createEventDialog.querySelector("#eventLocation").value = event.location || "";

    const $acSuggestions = byId("event-location-suggestions");
    replaceEventListeners("#eventLocation", "click", function(e) {
        if (this.value) {
            displayLocations(this.value);
        }
    });

    replaceEventListeners("#eventLocation", "blur", function(e) {
        // Note I had to set the tabindex on the $acSuggestions for relatedTarget to be properly set or else it defaulted to the dialog window
        if (e.relatedTarget === $acSuggestions) {
            return;
        }
        $acSuggestions.hidePopover();
    });

    replaceEventListeners("#eventLocation", "keydown", function(e) {
        const key = e.key;
        if (key === "Tab") {
            const $selectedItem = $acSuggestions.querySelector(".selected");
            if (isVisible($acSuggestions) && $selectedItem) {
                e.preventDefault();
                e.stopPropagation();
            } else {
                $acSuggestions.hidePopover();
            }
        } else if (key === "ArrowUp") {
            const $current = $acSuggestions.querySelector(".selected");
            if ($current) {
                const $prev = $current.previousElementSibling;
                if ($prev) {
                    $current.classList.remove("selected");
                    $prev.classList.add("selected");
                }
            }
            e.preventDefault();
            e.stopPropagation();
        } else if (key === "ArrowDown") {
            const $current = $acSuggestions.querySelector(".selected");
            if ($current) {
                const $next = $current.nextElementSibling;
                if ($next && $next.classList.contains("acItem")) {
                    $current.classList.remove("selected");
                    $next.classList.add("selected");
                }
            } else {
                const $first = $acSuggestions.querySelector(".acItem");
                if ($first) {
                    $first.classList.add("selected");
                }
            }
            e.preventDefault();
            e.stopPropagation();
        } else if (key === "Escape") {
            $acSuggestions.hidePopover();
            e.preventDefault();
            e.stopPropagation();
        }        
    });
    
    const debouncedDisplayLocations = debounce(displayLocations, 500);

    replaceEventListeners("#eventLocation", "keyup", function(e) {
        const key = e.key;
        if (key === "Tab" || (!isCtrlPressed(e) && key === "Enter" && !e.isComposing)) { // tab/enter
            console.log("keyup", key)
            if (e.target.value) {
                const $selectedItem = $acSuggestions.querySelector(".selected");
                if (isVisible($acSuggestions) && $selectedItem) {
                    byId("eventLocation").value = $selectedItem.textContent;
                }
                $acSuggestions.hidePopover();

                e.preventDefault();
                e.stopPropagation();
            }
        } else if (key === "ArrowUp" || key === "ArrowDown" || key === "Escape") {
            // do nothing because already intercepted in keydown
        } else {
            const MINIMUM_CHARACTERS_BEFORE_CALLING_API = 3; // overwritten on server side
            if (this.value?.length >= MINIMUM_CHARACTERS_BEFORE_CALLING_API) {
                debouncedDisplayLocations(this.value);
            } else {
                $acSuggestions.hidePopover();
            }
        }
    });


    let htmlDescription;
    if (event.description) {
        htmlDescription = prepareForContentEditable(event.description);
    } else {
        htmlDescription = "";
    }
    $createEventDialog.querySelector("#eventDescription").innerHTML = htmlDescription;

    let eventTransparency;
    if (!params.editing && event.allDay && !event.transparency) {
        eventTransparency = EventTransparency.FREE;
    } else {
        eventTransparency = event.transparency || EventTransparency.BUSY;
    }

    byId("event-transparency").value = eventTransparency;
    byId("event-visibility").value = event.visibility || EventVisibility.DEFAULT;

	function initEventColor(event) {
        if (colors) {
            const $eventColor = $createEventDialog.querySelector("#eventColor");
            if (params.editing && event.colorId) {
                var color = colors.event[event.colorId].background;
                $eventColor.style.background = color;
                $eventColor._colorId = event.colorId;
            } else {
                const calendar = getSelectedCalendar("createEventCalendarsMenu");
                const calendarColorObj = colors.calendar[calendar.colorId];
                if (calendarColorObj) {
                    $eventColor.style.background = calendarColorObj.background;
                    $eventColor._colorId = null;
                }
            }
        }
	}

	const tab = await getActiveTab();

    const $currentPage = byId("currentPage");
    if (tab?.favIconUrl) {
        onClickReplace($currentPage, () => {
            // disable action
        });
        $currentPage.setAttribute("src", tab.favIconUrl);
    } else {
        $currentPage.setAttribute("icon", "link");
    }
    
    if (tab) {
        onClickReplace($currentPage, async () => {
            $currentPage._currentPageClicked = true;
            const response = await getEventDetailsFromPage(tab);
            byId("eventTitle").value ||= response.title;
            descriptionFromPage = response.description;
            const url = response.url ?? tab.url;
            byId("eventLocation").value = url;
            if (url != response.description) {
                byId("eventDescription").innerHTML = response.description;
            }
            $createEventDialog._source = {
                title: response.title,
                url: url
            };
        });
    }

	var placeHolder;
	if (event.endTime) {
		if (event.allDay) {
			placeHolder = getMessage("quickAddDefaultTextMultipleDays");
		} else {
			placeHolder = getMessage("quickAddDefaultTextMultipleHours");
		}
	} else {
		placeHolder = getMessage("quickAddDefaultText");
	}
	byId("eventTitle").setAttribute("placeholder", placeHolder);
	
    onClickReplace("#eventColor", function() {
		const calendar = getSelectedCalendar("createEventCalendarsMenu");
		showEventColors(colors, calendar);
    });

    function initConferenceDisplay(enabled, allowedConferenceType) {
        const $eventConference = byId("eventConference");
        console.log("initConferenceDisplay", enabled, allowedConferenceType);

        if (enabled) {
            if (event.conferenceData?.conferenceSolution) {
                // already created
                $eventConference._conferenceData = event.conferenceData;
                $eventConference.removeAttribute("disabled")
                $eventConference.setAttribute("raised", "");
                $eventConference.textContent = getMessage("joinWithX", event.conferenceData.conferenceSolution.name);

                const video = event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "video");
                show(".copy-conference-link");
                show("#eventVideoLabelWrapper");
                byId("eventVideoLabel").textContent = video.label;
            } else { // newly created
                $eventConference._conferenceData = {
                        createRequest: {
                            requestId: getUniqueId()
                        },
                        conferenceSolutionKey: {
                            type: allowedConferenceType
                        }
                    };
                $eventConference.setAttribute("disabled", "");
                $eventConference.removeAttribute("raised");
                $eventConference.textContent = getMessage("videoConferencingAdded");
                show(".copy-conference-link");
                hide("#eventVideoLabelWrapper");
            }
            
            show(".eventConferenceRemove");
        } else {
            $eventConference._conferenceData = null;
            $eventConference.removeAttribute("disabled");
            $eventConference.setAttribute("raised", "");
            $eventConference.textContent = getMessage("addVideoConferencing");
            hide(".copy-conference-link");
            hide(".eventConferenceRemove");
            hide("#eventVideoLabelWrapper");
        }
    }

    const calendar = getSelectedCalendar("createEventCalendarsMenu");
    const allowedConferenceType = calendar?.conferenceProperties?.allowedConferenceSolutionTypes?.[0];

    initConferenceDisplay(event.conferenceData, allowedConferenceType);

    if (allowedConferenceType) {
        onClickReplace("#eventConference", function() {
            if (isVisible("#detectTime") && doesEventTitleHaveTime()) {
                niceAlert("You must uncheck the Detect Time checkbox to add video conferencing");
            } else {
                initConferenceDisplay(true, allowedConferenceType);
            }
        });

        onClickReplace(".eventConferenceRemove", function() {
            initConferenceDisplay(false, allowedConferenceType);
        });

        show("#eventConferenceWrapper");
    } else {
        hide("#eventConferenceWrapper");
    }
}

function fetchAndDisplayEvent(url) {
    fetchJSON(url).then(data => {
        console.log("fbdata", data);
        docReady().then(async () => {
            const $fbOverlay = initTemplate("fbOverlayTemplate");
        
            try {
                const iCalObj = new iCalendar();
                const ical = iCalObj.parse(data);
                console.log(ical, ical.vevent)
            
                const events = await getEventsWrapper();

                // look for specific event - might have several with same name, but just copies ref https://jasonsavard.com/forum/discussion/comment/23963
                let foundEvent = events.find(event => {
                    let fbUID;
                    if (event.extendedProperties?.private) {
                        fbUID = event.extendedProperties.private.fbUID;
                    }
                    if (ical.vevent.uid && ical.vevent.uid == fbUID) {
                        return event;
                    }
                });

                if (!foundEvent) {
                    foundEvent = events.find(event => event.summary == ical.vevent.summary);
                }

                const eventEntry = new EventEntry();
                eventEntry.allDay = ical.vevent.allDay;

                if (foundEvent) {
                    
                    console.log("foundEvent", foundEvent)
                    console.warn("facebook event already exists!")

                    if (foundEvent.startTime.toString() != ical.vevent.dtstart.toString()
                        || foundEvent.description != ical.vevent.description
                        || foundEvent.location != ical.vevent.location) {

                        const calendar = getEventCalendar(foundEvent);
                        if (isCalendarWriteable(calendar)) {
                            showToast("Facebook event details are different", {
                                duration: seconds(6),
                                buttons: [
                                    {
                                        text: getMessage("update"),
                                        onClick: function() {
                                            hideToast();
                                            showProgress();

                                            const patchFields = {
                                                description: ical.vevent.description,
                                                location: ical.vevent.location
                                            }
                                            fillTimesForPatchFields({
                                                startTime: ical.vevent.dtstart,
                                                endTime: ical.vevent.dtend
                                            }, patchFields);

                                            updateEvent({
                                                event: foundEvent,
                                                patchFields: patchFields
                                            }).then(response => {
                                                hideProgress();
                                                if (!response.cancel) {
                                                    showToast(getMessage("done"));
                                                }
                                            }).catch(error => {
                                                showError("Error: " + error);
                                                hideProgress();
                                            });
                                        }
                                    }
                                ]
                            });
                        } else {
                            console.warn("not showing fb update because calendar is not writeable")
                        }
                    }
                } else {
                    const $findDate = byId("fbFindDate");
                    if (await getCalendarView() == CalendarView.AGENDA) {
                        hide($findDate);
                    } else {
                        show($findDate);
                        onClickReplace($findDate, async () => {
                            $fbOverlay.style.opacity = "0.9";
                            await gotoDate({date: ical.vevent.dtstart});
                            const node = getDayNode(ical.vevent.dtstart);
                            if (node) {
                                quickAddAnimation(node);
                            }
                        });
                    }

                    eventEntry.quickAdd = false;
                    eventEntry.summary = ical.vevent.summary;
                    eventEntry.description = ical.vevent.description;
                    eventEntry.location = ical.vevent.location;

                    eventEntry.startTime = ical.vevent.dtstart;
                    eventEntry.endTime = ical.vevent.dtend;

                    eventEntry.extendedProperties = {
                        private: {
                            fbUID: ical.vevent.uid
                        }
                    };

                    //byId("fbEventDate").textContent = ical.vevent.allDay ? ical.vevent.dtstart.toLocaleDateStringJ() : ical.vevent.dtstart.toLocaleStringJ();
                    byId("fbEventDate").textContent = generateTimeDurationStr({event: eventEntry});

                    await initCalendarDropDown("fbAddCalendarsMenu");

                    openDialog($fbOverlay, {
                        id: "fbOverlay",
                        title: ical.vevent.summary,
                        closeButton: true,
                        buttons: [
                            {
                                id: "addFBEventButton",
                                label: getMessage("addToGoogleCalendar"),
                                primary: true,
                                onClick: function(dialog) {
                                    dialog.close();
                                    eventEntry.calendarId = byId("fbAddCalendarsMenu").value;

                                    insertAndLoadInCalendar(eventEntry).catch(error => {
                                        // do nothing already caught inside
                                    });
                                }
                            }
                        ]
                    });

                    // Move the calendar dropdown before the button
                    const $addFBEventButton = byId("addFBEventButton");
                    const $fbAddCalendarsMenu = byId("fbAddCalendarsMenu");
                    $addFBEventButton.parentElement.insertBefore($fbAddCalendarsMenu, $addFBEventButton);
                }
            } catch (error) {
                console.error("fb fetch error: ", error);
                if (DetectClient.isFirefox()) {
                    showToast("To detect Facebook events you need to disable third-party cookie blocking in Firefox", {
                        text: getMessage("moreInfo"),
                        onClick: function() {
                            openUrl("https://support.mozilla.org/kb/content-blocking");
                        }
                    });
                } else {
                    showError("Could not detect Facebook event");
                }
            }
        });
    });
}

function getDayNode(date) {
    return selector(`[data-date="${date.format("yyyy-mm-dd")}"]`);
}

function quickAddAnimation(node) {
    node.classList.add("quick-add-animation");
    node.addEventListener('animationend', () => {
        node.classList.remove('quick-add-animation');
    });
}

function emphasizeEvent(fcEvent) {
    const newlyAddedEventNode = fullCalendar.getEventById(fcEvent.id);
    if (newlyAddedEventNode) {
        newlyAddedEventNode.setProp('classNames', ['newly-added-event']);

        let eventNode = selector(".newly-added-event");
        if (eventNode) {
            eventNode.classList.remove("newly-added-event");

            console.log("emphasizeEvent", eventNode);
            if (!eventNode.checkVisibility({visibilityProperty: true})) {
                eventNode = getDayNode(fcEvent.start);
            }

            if (eventNode) {
                quickAddAnimation(eventNode);
                return true;
            }
        }
    }
}

async function insertAndLoadInCalendarAndCloseDialog(eventEntry, dialog) {
    insertAndLoadInCalendar(eventEntry).then(() => {
        dialog.close();
    }).catch(error => {
        // do nothing already caught inside
        dialog.classList.remove("hide-temporarily");
    });
}

async function insertAndLoadInCalendar(eventEntry) {
    fullCalendar?.unselect();

    console.log("insertAndLoadInCalendar: ", eventEntry);

    showProgress();
    try {
        const response = await saveEvent(eventEntry);

        if (response.conflictingEvent) {
            // don't show toast
        } else {
            setEventDateMessage(eventEntry);
        }
        
        const $eventTitle = byId("eventTitle");
        if ($eventTitle) {
            $eventTitle.value = "";
        }

        // add to events
        //events.push(eventEntry);
        //await sortEvents(events);

        const cachedFeeds = await storage.get("cachedFeeds");
        const arrayOfCalendars = await getArrayOfCalendars();

        if (eventEntry.recurrence) {
            reloadCalendar({source:"recurringEventAdded", bypassCache:true, refetchEvents:true});
        } else {
            if (await getCalendarView() == CalendarView.AGENDA) {
                initAgenda();
            } else {
                const fcEvent = convertEventToFullCalendarEvent({
                    eventEntry: eventEntry,
                    cachedFeeds: cachedFeeds,
                    arrayOfCalendars: arrayOfCalendars
                });
                fullCalendar.addEvent(fcEvent, FullCalendarSourceIds.MAIN);

                if (!emphasizeEvent(fcEvent)) {
                    await gotoDate({date: fcEvent.start});
                    setTimeout(() => {
                        emphasizeEvent(fcEvent);
                    }, 500);
                }
            }
            
            await updateCachedFeed(eventEntry, {
                operation: "add",
                cachedFeeds: cachedFeeds
            });
        }

        return response;
    } catch (error) {
        // seems like status 500 errors are not returning details about the error and so the oauth just returns the statusText "error"
        if (error == "error") {
            showError("Intermittent error, please try again!");
        } else {
            await showCalendarError(error);
        }
        throw error;
    } finally {
        hideProgress();
    }
}

async function fetchEvents(events, start, end) {
    console.log("fetchEvents");
    if (events.length == 0 || start.isBefore(getStartDateBeforeThisMonth()) || end.isAfter(await getEndDateAfterThisMonth())) {
        showSpinner();
        
        try {
            const response = await sendMessageToBG("fetchAllCalendarEvents", {email:email, startDate:start, endDate:end, source:"popup", bypassCache:false});
            var newEvents = [];
            if (response?.events) {
                newEvents = response.events.slice();
                newEvents.forEach(event => {
                    parseEventDates(event);
                });
            } else if (events) {
                newEvents = events.slice();
            }

            if (response.warning) {
                showToast(response.warning);
            }

            return newEvents;
        } catch (error) {
            hideSpinner();
            showError("Try reload button or " + getMessage("accessNotGrantedSeeAccountOptions_accounts") + " options!", {
                text: getMessage("accessNotGrantedSeeAccountOptions_accounts"),
                onClick: function() {
                    openUrl("options.html?accessNotGranted=true#accounts");
                }
            });
            console.error("fetchEvents error", error);
        }
    } else {
        const eventsInRange = events.shallowClone();

        // filter events between start and end
        for (var i=eventsInRange.length-1; i>=0; i--) {
            const event = eventsInRange[i];
            if (event.startTime.isAfter(end) || event.endTime?.isBefore(start)) {
                eventsInRange.splice(i, 1);
            }
        }

        return eventsInRange;
    }
}

function getSelectedCalendar(calendarId) {
	return getCalendarById(byId(calendarId).value);
}

function convertFullCalendarCurrentDateToDate() {
    const date = fullCalendar.getDate();
    // commented due to this bug: https://jasonsavard.com/forum/discussion/comment/33469#Comment_33469
	// date.addMinutes( date.getTimezoneOffset() );
    return date;
}

async function saveQuickAdd(text) {
	byId("save-quick-add").classList.add("disabled");

    const calendarId = byId("quickAddCalendarsMenu").value || await getDefaultCalendarId(await getArrayOfCalendars());

	// Must match what timeFilte and formatContent returns
	const eventEntry = new EventEntry();
	
	if (fullCalendar?.view.type == getFCViewName(CalendarView.DAY)) {
		// use currently selected day in day view
		eventEntry.startTime = convertFullCalendarCurrentDateToDate();
	} else if (calendarId == TASKS_CALENDAR_OBJECT.id) {
        eventEntry.startTime = new Date();

        const taskLists = cachedFeeds["taskLists"];
        eventEntry.taskListId = taskLists.items.first().id;
    }
	
	const summary = text || byId("quickAdd").value || getMessage("noTitle");
	eventEntry.summary = summary;
	eventEntry.userInputSummary = summary;
	eventEntry.allDay = true; // default to this
    eventEntry.calendarId = calendarId;
	eventEntry.inputSource = InputSource.QUICK_ADD;

	sendGA('quickadd', 'click');
	
	insertAndLoadInCalendar(eventEntry).then(async response => {
		byId("quickAdd").setAttribute("placeholder", "");
        byId("quickAdd").value = "";

        const calendarView = await getCalendarView();
        if (calendarView == CalendarView.AGENDA || calendarView == CalendarView.CUSTOM) {
            // do nothing
        } else if (globalThis.fullCalendarDateRange) {
            console.log(response.startTime);
            if (response.startTime.isBefore(globalThis.fullCalendarDateRange.start) || response.startTime.isEqualOrAfter(globalThis.fullCalendarDateRange.end)) {
                await gotoDate({date: response.startTime});
            }
        }
        return response;
	}).catch(error => {
        // do nothing because error is handled in insertAndLoadInCalendar
        console.log("error", error);
	}).then(async response => {
        closeQuickAdd();
    })
}

function closeQuickAdd() {
    byId("save-quick-add").classList.remove("disabled");
    htmlElement.classList.remove("quickAddVisible");
    byId("quickAddWrapper").classList.remove("inputEntered");
}

async function searchEvents() {
    showProgress();

    const searchStr = byId("searchInput").value;
    const calendarId = byId("searchCalendarsMenu").value;

    let calendarIdsToSearch = [];
    if (calendarId == "active-calendars") {
        const calendars = await getSelectedCalendarsInGoogleCalendar();
        calendarIdsToSearch = calendars.map(calendar => calendar.id);
    } else if (calendarId == "all-calendars") {
        const arrayOfCalendars = await getArrayOfCalendars({excludeTasks: true});
        calendarIdsToSearch = arrayOfCalendars.map(calendar => calendar.id);
    } else {
        calendarIdsToSearch.push(calendarId);
    }

    const promises = calendarIdsToSearch.map(calendarId => {
        return oauthDeviceSend({
            userEmail: email,
            url: `/calendars/${encodeURIComponent(calendarId)}/events`,
            data: {
                q: searchStr,
                eventTypes: EventType.DEFAULT,
                singleEvents: true,
                orderBy: "startTime",
                maxResults: 1000
            }
        })
    });

    Promise.all(promises).then(async responses => {
        const searchResultEvents = [];

        // search tasks
        const selectedCalendars = await storage.get("selectedCalendars");
        const tasksSelected = isCalendarSelectedInExtension(TASKS_CALENDAR_OBJECT, email, selectedCalendars);

        if (tasksSelected) {
            const events = await getEvents();
            events.forEach(event => {
                if (event.kind == TASKS_KIND) {
                    const regex = new RegExp(searchStr, "i");
                    if (regex.test(event.summary) || regex.test(event.description)) {
                        searchResultEvents.push(event);
                    }
                }
            });
        }


        // regular events
        responses.forEach((response, index) => {
            if (response.items.length) {
                response.items.forEach(event => {
                    console.log("result", event);
                    initEventObj(event, calendarIdsToSearch[index]);
                    searchResultEvents.push(event);
                });
            }
        });
        
        if (searchResultEvents.length) {
            searchResultEvents.sort((eventA, eventB) => {
                return eventA.startTime - eventB.startTime;
            });
            displayAgenda({
                events: searchResultEvents,
                showPastEvents: true,
                hideCurrentDay: true,
                search: true
            });
        } else {
            showError("No results");
        }
    }).catch(error => {
		showCalendarError(error);
	}).then(() => {
		hideProgress();
	});
}

async function fetchAgendaEvents(params) {
	showLoading();
    console.log("start: " + params.start + " end: " + params.end);
    const events = await getEventsWrapper();
    let newEvents = await fetchEvents(events, params.start, params.end);
    if (newEvents) {
        // deep down ... fetchCalendarEvents could pull events (cached, invisible etc.) that are outside of the start/stop parameters here
        // so let's restrict it here
        var indexOfEventWhichObeysStartTime = null;
        newEvents.some(function(newEvent, index) {
            const multidayInRange = newEvent.endTime?.isEqualOrAfter(params.start);
            if (indexOfEventWhichObeysStartTime == null && (newEvent.startTime.toJSON() == params.start.toJSON() || newEvent.startTime.isAfter(params.start) || multidayInRange)) {
                indexOfEventWhichObeysStartTime = index;
                return true;
            }
        });

        console.log("indexOfEventWhichObeysStartTime: " + indexOfEventWhichObeysStartTime);
        if (indexOfEventWhichObeysStartTime != null) {
            newEvents = newEvents.slice(indexOfEventWhichObeysStartTime);
        }

        params.newEvents = newEvents;
        displayAgenda(params);
        hideLoading();
    }
}

async function initAgenda() {
    fetchingAgendaEvents = true;
    // tried using asyncs for displayAgenda but caused flicker issue when scrollToToday
	await docReady();
	await displayAgenda({showStartingToday:true});
    // IF agenda has more events then load all the rest
    if (scrollTarget?.scrollHeight > window.innerHeight) {
        await displayAgenda({scrollToToday:true});
    }
    fetchingAgendaEvents = false;
}

async function displayAgenda(params = {}) {
   	// patch to prevent empty scrollbar in Chrome 72
	byId("mainContent").style.height = calculateCalendarHeight() + "px";

    const cachedFeeds = await storage.get("cachedFeeds");
	const selectedCalendars = await storage.get("selectedCalendars");
    const calendarSettings = await storage.get("calendarSettings");
    const showDeclinedEvents = calendarSettings.showDeclinedEvents;
    const hideInvitations = calendarSettings.hideInvitations;
    const arrayOfCalendars = await getArrayOfCalendars();
    const defaultCalendarId = await getDefaultCalendarId(arrayOfCalendars);
    const dimPastEvents = await storage.get("dimPastEvents");
    const showEventIcons = await storage.get("showEventIcons");

	console.log("displayagenda params", params);

	var eventsToDisplay;
	var dateToDisplay;
	if (params.newEvents) {
		eventsToDisplay = params.newEvents;
		if (eventsToDisplay.length) {
			dateToDisplay = eventsToDisplay.first().startTime;
		} else {
			dateToDisplay = new Date();
		}
	} else {
		if (params.events) {
			eventsToDisplay = params.events;
		} else {
			eventsToDisplay = await getEventsWrapper();

            const DAYS_IN_THE_PAST = params.prepend ? 999 : 7;
            const DAYS_IN_THE_FUTURE = 20; // optimize speed cause was slow for recurring events, so only show up to x ahead
            eventsToDisplay = eventsToDisplay.filter((event) => {
				if (event.startTime.diffInDays() >= -DAYS_IN_THE_PAST && event.startTime.diffInDays() <= DAYS_IN_THE_FUTURE) {
					return true;
				}
			});
		}
		dateToDisplay = new Date();

        displayAgendaHeaderDetails(dateToDisplay);
	}

	byId("calendarTitleToolTip")?.remove();
	
	const $agendaEvents = byId("agendaEvents");
	const $agendaEventsForThisFetch = document.createElement("div");

	if ((!params.append && !params.prepend) || params.forceEmpty) {
		emptyNode($agendaEvents);
	}
	
	var previousEvent;
	var $agendaDay;
	var $firstEventOfTheDay;
	var hasAnEventToday;
	var addedPlaceHolderForToday;
    var $currentOrFutureDay;

    if (dimPastEvents) {
        $agendaEvents.classList.add("dim-past-events");
    } else {
        $agendaEvents.classList.remove("dim-past-events");
    }

    function displayAgendaEvents(eventParams) {
        const events = eventParams.events;

        console.log("displayAgendaEvents", events);
        
        events.forEach((event, index) => {
			
			if (params.hideCurrentDay !== true && !params.newEvents && !hasAnEventToday && !addedPlaceHolderForToday && (event.startTime.isTomorrow() || event.startTime.isAfter(tomorrow()))) {
				addedPlaceHolderForToday = true;
				
				const placeHolderForTodayEvent = new EventEntry();
				placeHolderForTodayEvent.summary = getMessage("nothingPlanned");
				placeHolderForTodayEvent.startTime = today();
				placeHolderForTodayEvent.endTime = tomorrow();
				placeHolderForTodayEvent.allDay = true;
				placeHolderForTodayEvent.calendarId = defaultCalendarId;
				placeHolderForTodayEvent.placeHolderForToday = true;
				
				displayAgendaEvents({events:[placeHolderForTodayEvent]});
			}
			
			if (index >= 20) {
				//return false;
			}

            // just hide multi days on 1st load
            const multiDayEvent = isMultiDayEvent(event);

            if (params.gotoDate && event.startTime.isBefore(params.start)) {
                // ignore multi-day events that started before the goto date
                return true;
            } else {
    			// optimize for speed by skipping over before today events
                if (params.showStartingToday && (event.endTime?.isEqualOrBefore(today()) || (multiDayEvent && event.startTime.isBefore(today())))) { // (event.endTime?.isEqualOrBefore(today()) || multiDayEvent)
                    console.log("ignore", event.summary, event)
                    return true;
                } else {
                    console.log("after", event.summary, event)
                }
            }
			
			const calendar = getEventCalendar(event);
			const eventTitle = getSummary(event);
			const calendarSelected = isCalendarSelectedInExtension(calendar, email, selectedCalendars);
			
			if ((eventTitle && (calendarSelected || params.search) && passedVisibilityTests(event, email, showDeclinedEvents, hideInvitations, selectedCalendars)) || event.placeHolderForToday) {

				if (event.startTime.isToday()) {
					hasAnEventToday = true;
				}
				
                if (!previousEvent || event.startTime.toDateString() != previousEvent.startTime.toDateString()) {
                    
                    // different month detection
                    if (!previousEvent) {
                        if (!params.prepend) {
                            const lastEventDataEvent = lastNode($agendaEvents.querySelectorAll(".agendaDay"))?._event;
                            if (lastEventDataEvent) {
                                previousEvent = lastEventDataEvent;
                                console.log("previous event", previousEvent.summary);
                            }
                        }
                    }
                    
                    if (previousEvent && previousEvent.startTime.isBefore(event.startTime) && (previousEvent.startTime.getMonth() != event.startTime.getMonth() || previousEvent.startTime.getYear() != event.startTime.getYear())) {
                        console.log("prev event: ", previousEvent.summary, event.startTime.format("mmm"));
                        
                        const formatOptions = {
                            month: "short"
                        }

                        if (event.startTime.getYear() != new Date().getYear()) {
                            formatOptions.year = "numeric";
                        }
                        
                        const $agendaMonthHeader = document.createElement("div");
                        $agendaMonthHeader.classList.add("agendaMonthHeader");
                        $agendaMonthHeader.textContent = event.startTime.toLocaleDateString(locale, formatOptions);

                        $agendaEventsForThisFetch.append($agendaMonthHeader);
                    }
                    
                    const $agendaDateWrapper = document.createElement("div");
                    $agendaDateWrapper.classList.add("agendaDateWrapper");

                    const $agendaDate = document.createElement("div");
                    $agendaDate.classList.add("agendaDate");

                    if (params.showPastEvents) {
                        $agendaDate.textContent = event.startTime.format("d mmm yyyy, ddd");
                        $agendaDateWrapper.append( $agendaDate );
                    } else {
                        $agendaDate.textContent = event.startTime.getDate();
                        $agendaDateWrapper.append( $agendaDate );

                        const $agendaDateDay = document.createElement("div");
                        $agendaDateDay.textContent = dateFormat.i18n.dayNamesShort[event.startTime.getDay()];

                        $agendaDateWrapper.append( $agendaDateDay );
                    }
                    
                    $agendaDay = document.createElement("div");
                    $agendaDay.classList.add("agendaDay", "horizontal", "layout")
                    
                    $agendaDay.append($agendaDateWrapper);

                    const $agendaDayEvents = document.createElement("div");
                    $agendaDayEvents.classList.add("agendaDayEvents", "flex")

                    $agendaDay.append( $agendaDayEvents );
                    $agendaDay._event = event;

                    if (event.startTime.isToday()) {
                        $agendaDay.classList.add("today", "current-or-future");
                        $currentOrFutureDay ||= $agendaDay;
                    } else if (event.startTime.isBefore() && !params.showPastEvents) {
                        //$agendaDay.attr("hidden", "");
                    }

                    // for search
                    if (event.startTime.isAfter() && !$currentOrFutureDay) {
                        $agendaDay.classList.add("current-or-future");
                        $currentOrFutureDay ||= $agendaDay;
                    }
                    
                    $agendaEventsForThisFetch.append($agendaDay);
                }
				
                const $agendaEventTitleWrapper = document.createElement("div");
                $agendaEventTitleWrapper.classList.add("agendaEventTitleWrapper");
                const $eventTitleOnly = document.createElement("div");

                const $eventIcon = document.createElement("span");
                $eventIcon.classList.add("eventIcon");
				
				if (event.startTime.diffInDays() >= 0 && event.startTime.diffInDays() <= 3) { // only 3 days because the regex filtering for words slows down the display
                    if (showEventIcons) {
                        setEventIcon({
                            event: event,
                            $eventIcon: $eventIcon,
                            cachedFeeds: cachedFeeds,
                            arrayOfCalendars: arrayOfCalendars
                        });
                    }
					$eventTitleOnly.append( $eventIcon );
				}
                
                const $agendaEventTitle = document.createElement("span");
                $agendaEventTitle.classList.add("agendaEventTitle");
                if (event.kind == TASKS_KIND) {
                    $agendaEventTitle.classList.add("task");
                }
                $agendaEventTitle.textContent = eventTitle;

				$eventTitleOnly.append( $agendaEventTitle );
				if (event.originalMultiDayEvent) {
                    const $cont = document.createElement("span");
                    $cont.style.cssText = "margin-left:5px";
                    $cont.textContent = `(${getMessage("cont")})`;

					$eventTitleOnly.append( $cont );
                }

                if (event.recurringEventId) {
                    const $recurringImg = document.createElement("img");
                    $recurringImg.classList.add("repeating");
                    $recurringImg.src = "images/repeating.png";
                    $recurringImg.title = getMessage("recurringEvent");
                    $eventTitleOnly.append( $recurringImg );
                }
                
                $agendaEventTitleWrapper.append($eventTitleOnly);
				
				if (!event.allDay) {
                    const $agendaEventTime = document.createElement("div");
                    $agendaEventTime.classList.add("agendaEventTime");
                    $agendaEventTime.textContent = generateTimeDurationStr({event:event, hideStartDay:true});
					$agendaEventTitleWrapper.append( $agendaEventTime );
				}

                if (event.location) {
                    const $agendaEventLocation = document.createElement("div");
                    $agendaEventLocation.classList.add("agendaEventLocation");

                    let locationDisplayed = event.location;
                    if (event.location.startsWith("http")) {
                        locationDisplayed = locationDisplayed.summarize(50);
                    }
                    $agendaEventLocation.textContent = locationDisplayed;
                    $agendaEventTitleWrapper.append( $agendaEventLocation );
                }

				if (event.hangoutLink || event.conferenceData || isMeetingLink(event.location) || getMeetingLink(event.description)) {
                    const $agendaEventVideo = document.createElement("div");
                    $agendaEventVideo.classList.add("agendaEventVideo");
                    $agendaEventVideo.textContent = getMessage("videoCall");

					$agendaEventTitleWrapper.append( $agendaEventVideo );
				}

                const $eventNode = document.createElement("div");

                if (event.status == TaskStatus.COMPLETED) {
                    $eventNode.classList.add("task-completed");
                }

                const currentUserAttendeeDetails = getCalendarAttendee(event);
                if (currentUserAttendeeDetails) {
                    const className = getClassForAttendingStatus(currentUserAttendeeDetails.responseStatus);
                    $eventNode.classList.add(className);
                }

				$eventNode.append( $agendaEventTitleWrapper );
				if (event.placeHolderForToday) {
					$eventNode.classList.add("placeHolderForToday");
					$eventNode.append(document.createElement("j-ripple"));
				} else {
					const eventColors = getEventColors({
                        event: event,
                        cachedFeeds: cachedFeeds,
                        arrayOfCalendars: arrayOfCalendars
                    });

					$eventNode.classList.add("agendaEvent")
					css($eventNode, {
                        "color": eventColors.fgColor,
                        "background-color": eventColors.bgColor
                    });

                    if (event.kind == TASKS_KIND) {
                        if (!window.setTaskTextColor) {
                            const root = document.documentElement;
                            root.style.setProperty('--task-text-color', eventColors.fgColor);
                            window.setTaskTextColor = true;
                        }
                    }
				}

                onClick($eventNode, function() {
					if (event.placeHolderForToday) {
						const eventEntry = new EventEntry();
						eventEntry.allDay = true;
						eventEntry.startTime = today();
						showCreateBubble({event:eventEntry});
					} else {
						//if (document.body.clientWidth >= 500) {
							showDetailsBubble({event: event.originalMultiDayEvent ?? event, $eventNode:$eventNode});
						//} else {
							//openUrl(getEventUrl(event));
						//}
					}
				})
                
				if (event.endTime?.isBefore()) {
                    $eventNode.classList.add("pastEvent");
				}
				
				$agendaDay.querySelector(".agendaDayEvents").append($eventNode);
				
				if (!$firstEventOfTheDay && (event.startTime.isToday() || event.startTime.isAfter())) {
					$firstEventOfTheDay = $agendaDay;
				}
				
				previousEvent = event;
			}
		});
	}

    // expand multiday events to insert several individual events that link to the original event
    let multiDayEventsFound = false;
    eventsToDisplay.forEach((event, index) => {
        if (isMultiDayEvent(event)) {
            const diffInDays = event.endTime?.diffInDays(event.startTime);
            for (let i = 1; i < diffInDays; i++) {
                const continuedEvent = deepClone(event);
                continuedEvent.originalMultiDayEvent = event;
                continuedEvent.startTime = event.startTime.addDays(i);
                continuedEvent.endTime = continuedEvent.startTime.addDays(1);
                eventsToDisplay.splice(index+i, 0, continuedEvent);
            }
        }

        multiDayEventsFound = true;
    });

    if (multiDayEventsFound) {
        await sortEvents(eventsToDisplay);
    }

	console.time("displayAgendaEvents");
	displayAgendaEvents({events:eventsToDisplay});
	console.timeEnd("displayAgendaEvents");
	
	var BUFFER = 0;
	
	if (params.prepend) {
		$agendaEvents.prepend($agendaEventsForThisFetch);
		//scrollTarget.scrollTop += $agendaEventsForThisFetch.height() + BUFFER;
	} else {
		$agendaEvents.append($agendaEventsForThisFetch);
	}
	
	// only scroll into view first time (when no data().events) exist)
	if ((!$agendaEvents._events && $firstEventOfTheDay && $firstEventOfTheDay.length) || params.scrollToToday) {
		window.autoScrollIntoView = true;
		
		$firstEventOfTheDay.scrollIntoView();
		// patch: seems that .scrollIntoView would scroll the whole body up and out of frame a bit so had to execute a 2nd one on the panel
		//selector("app-header-layout").scrollIntoView();
		
		// commented because using padding-top on .today event instead
		/*
		var currentScrollTop = $('[main]')[0].scroller.scrollTop;
		if (currentScrollTop >= BUFFER) {
			$('[main]')[0].scroller.scrollTop -= BUFFER;
		}
		*/
		
		// patch: seems that in the detached window the .scrollIntoView would scroll the whole body up and out of frame a bit, so just repaint the body after a little delay and the issue is fixed
		/*
		htmlElement.hide();
		setTimeout(function() {
			htmlElement.show();
		}, 1)
		*/
		
		// make sure the .scroll event triggers before i set it to false
		setTimeout(function() {
			window.autoScrollIntoView = false;
		}, 50);
	}

    if (params.search && $currentOrFutureDay) {
        $currentOrFutureDay.scrollIntoView();
		// patch: seems that .scrollIntoView would scroll the whole body up and out of frame a bit so had to execute a 2nd one on the panel
		//selector("app-header-layout").scrollIntoView();
    }
	
	$agendaEvents._events = eventsToDisplay;
}

function initCalendarView(viewName) {
	var calendarViewValue;
	
	if (viewName == CalendarView.AGENDA) {
		calendarViewValue = "agenda";
	} else {
		calendarViewValue = viewName;
	}
	htmlElement.setAttribute("calendarView", calendarViewValue);
}

function fcChangeView(viewName, dateOrRange) {
    fullCalendar.changeView(getFCViewName(viewName), dateOrRange);
}

async function changeCalendarView(viewName) {
	const previousCalendarView = await getCalendarView();

    if (viewName == CalendarView.YEAR && !await storage.get("donationClicked")) {
        openContributeDialog("yearView");
        return;
    }

    // commented because user can now temporarily click day header to sneak preview day view without really wanteding to permenatly change the preset view ie. month
	//if (viewName != previousCalendarView) {
		await storage.set("calendarView", viewName);

        // set calendarView in url because it will be fetched faster at load than storage
        await initPopup();
        history.pushState({}, "", setUrlParam(location.href, "calendarView", viewName));
		
		// patch if previous view was basicDay (ie. my custom agenda view) then we must reload the betaCalendar because it was hidden and not properly initialized
		if ((previousCalendarView == CalendarView.AGENDA && viewName != CalendarView.AGENDA) || previousCalendarView == CalendarView.LIST_WEEK || viewName == CalendarView.LIST_WEEK) {
			location.reload();
		} else {
			
			initCalendarView(viewName);
			
			if (viewName == CalendarView.AGENDA) {
				initAgenda();
			} else {
				fcChangeView(viewName);
			}
		}
	//}
	
	initOptionsMenu();
}

async function initOptionsMenu() {
	selectorAll("#options-menu j-icon-item").forEach(el => el.classList.remove("selected"));
	
	const calendarView = await getCalendarView();
	
	if (calendarView == CalendarView.AGENDA) {
		byId("viewAgenda").classList.add("selected");
	} else if (calendarView == CalendarView.LIST_WEEK) {
		byId("viewListWeek").classList.add("selected");
	} else if (calendarView == CalendarView.DAY) {
		byId("viewDay").classList.add("selected");
	} else if (calendarView == CalendarView.WEEK) {
		byId("viewWeek").classList.add("selected");
	} else if (calendarView == CalendarView.MONTH) {
		byId("viewMonth").classList.add("selected");
	} else if (calendarView == CalendarView.YEAR) {
		byId("viewYear").classList.add("selected");
	} else if (calendarView == CalendarView.CUSTOM) {
		byId("viewCustom").classList.add("selected");
	}
}

function closeMenu(thisNode) {
	var node = thisNode.closest("[popover]");
	if (node) {
		node.hidePopover();
	}
}

function hasHtml(str) {
    return str && (str.includes("<") || str.includes(">"));
}

function hasEmbeddedLinks(str) {
    return str.includes("<https:");
}

function prepareForContentEditable(str) {
    if (str) {
        if (hasHtml(str) && !hasEmbeddedLinks(str)) {
            return str;
        } else {
            str = str.replaceAll("\n", "<br>");

            if (hasEmbeddedLinks(str)) {
                const obj = formatMeetingLinks(str);
                str = obj.str;
            }

            return str;
        }
    }
}

function sortAttendees(event) {
    event.attendees.sort((a, b) => {
        const displayName = a.displayName ?? a.email;
        const displayName2 = b.displayName ?? b.email;
        if (a.organizer && !b.organizer) {
            return -1;
        } else if (!a.organizer && b.organizer) {
            return +1;
        } else {
            return displayName.localeCompare(displayName2, locale, {ignorePunctuation: true});
        }
    });
}

async function getContactDisplayName(contact) {
    let displayName = contact.displayName;
    if (!displayName) {
        const account = generateAccountStub(email);
        if (typeof contacts === "undefined") {
            contacts = await getContacts({ account: account });
        }
        const contactData = await getContact({email: contact.email, account: account});
        if (contactData) {
            displayName = contactData.name;
        } else {
            displayName = contact.email;
        }
    }
    return displayName;
}

async function fetchRecurringEventDetails(event) {
    let dropdownValue = "";
    let recurringEventText = "";

    try {
        const response = await oauthDeviceSend({
            userEmail: email,
            url: `/calendars/${encodeURIComponent(await getCalendarIdForAPIUrl(event))}/events/${event.recurringEventId}`
        });
        
        console.log("recurring event", response);
        recurringEvent = response;
        
        let custom = false;

        let byday;
        let count;
        let until;
        let frequencyOnDays;
        let occurs;
        let dayNames;
        let frequencyPlural;
        let byMonthDay;
        let relativeByDay;

        const dayName = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(event.startTime);

        const rule = getRRule(recurringEvent);

        if (rule) {
            byday = getRRuleCondition(rule, "BYDAY");
            count = getRRuleCondition(rule, "COUNT");
            until = getRRuleUntilDate(rule);

            if (byday) {
                if (byday.includes(",") && !rule.includes(EventRecurrence.EVERY_WEEKDAY)) {
                    custom = true;
                } else {
                    // match 2MO or 3WE etc.
                    const matches = parseRRuleForByDay(byday);
                    if (matches) {
                        custom = true;
                        relativeByDay = matches[1];
                    }
                }
            }

            occurs = getRRuleCondition(rule, "INTERVAL");
            if (occurs >= 2) {
                custom = true;
            } else if (count) {
                custom = true;
            } else if (until) {
                custom = true;
            }

            byMonthDay = getRRuleCondition(rule, "BYMONTHDAY");
            if (byMonthDay) {
                custom = true;
            }

            let frequency;
            if (rule?.includes("DAILY")) {
                frequency = getMessage("daily");
                frequencyPlural = getMessage("days");
            } else if (rule?.includes("WEEKLY")) {
                frequency = getMessage("weekly");
                frequencyPlural = getMessage("weeks");
            } else if (rule?.includes("MONTHLY")) {
                frequency = getMessage("monthly");
                frequencyPlural = getMessage("months");
            } else if (rule?.includes("YEARLY")) {
                frequency = getMessage("annually");
                frequencyPlural = getMessage("years");
            }

            if (byday && !relativeByDay) {
                const bydayArray = byday.split(',');
                const listFormat = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
                dayNames = listFormat.format(bydayArray.map(day => {
                    const date = new Date();
                    const dayIndex = RRULE_DAYS.indexOf(day);
                    date.setDate(date.getDate() + ((dayIndex - date.getDay() + 7) % 7));
                    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
                }));

                frequencyOnDays = getMessage("frequencyOnDays", [frequency, dayNames]);
            } else if (!custom) {
                frequencyOnDays = getMessage("frequencyOnDays", [frequency, dayName]);
            }
        }

        if (custom) {
            dropdownValue = "custom";
            
            const customDetails = [];

            if (occurs >= 2) {
                if (byday) {
                    customDetails.push(getMessage("everyX_YOnDays", [occurs, frequencyPlural, dayNames]));
                } else {
                    customDetails.push(getMessage("everyX_Y", [occurs, frequencyPlural]))
                }
            } else if (frequencyOnDays) {
                customDetails.push(frequencyOnDays);
            }

            if (count >= 2) {
                customDetails.push(getMessage("xTimes", count));
            }

            if (until) {
                customDetails.push(getMessage("untilX", until.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })));
            }

            if (byMonthDay == -1) {
                customDetails.push(getMessage("lastDayOfMonth"));
            } else if (byMonthDay) {
                customDetails.push(getMessage("monthlyOnDayX", byMonthDay));
            }

            if (relativeByDay) {
                if (relativeByDay == "-1") {
                    customDetails.push(getMessage("monthlyOnTheLastX", dayName));
                } else if (relativeByDay == "1") {
                    customDetails.push(getMessage("monthlyOnTheFirstX", dayName));
                } else if (relativeByDay == "2") {
                    customDetails.push(getMessage("monthlyOnTheSecondX", dayName));
                } else if (relativeByDay == "3") {
                    customDetails.push(getMessage("monthlyOnTheThirdX", dayName));
                } else if (relativeByDay == "4") {
                    customDetails.push(getMessage("monthlyOnTheFourthX", dayName));
                }
            }

            const formatter = new Intl.ListFormat(locale, { style: 'short', type: 'unit' });
            recurringEventText = formatter.format(customDetails);
        } else if (rule?.includes("DAILY")) {
            dropdownValue = "daily";
            recurringEventText = getMessage("daily");
        } else if (rule?.includes("WEEKLY") && !rule?.includes(EventRecurrence.EVERY_WEEKDAY) && !rule?.includes(EventRecurrence.EVERY_2_WEEKS)) {
            dropdownValue = "weekly";
            recurringEventText = frequencyOnDays;
        } else if (rule?.includes("WEEKLY") && rule?.includes(EventRecurrence.EVERY_2_WEEKS)) {
            dropdownValue = "every-2-weeks";
            recurringEventText = getMessage("every2Weeks");
        } else if (rule?.includes("MONTHLY")) {
            dropdownValue = "monthly";
            recurringEventText = getMessage("monthly");
        } else if (rule?.includes("YEARLY")) {
            dropdownValue = "yearly";
            recurringEventText = getMessage("annually");
        } else if (rule?.includes("WEEKLY") && rule?.includes(EventRecurrence.EVERY_WEEKDAY) && !rule?.includes(EventRecurrence.EVERY_2_WEEKS)) {
            dropdownValue = "every-weekday";
            recurringEventText = getMessage("everyWeekday");
        }
    } catch (error) {
        console.warn("issue fetching recurring event", error);
        recurringEventText = error;
    }

    return {
        dropdownValue: dropdownValue,
        recurringEventText: recurringEventText
    }
}

async function showDetailsBubble(params) {
	console.log("showdetailsbubble", params);
	
	var event = params.event;
	var calendar = getEventCalendar(event);
    var isSnoozer;

    // commented to prevent delay in opening dialog
    //console.time("cachedfeeds")
    //const cachedFeeds = await storage.get("cachedFeeds");
    //console.timeEnd("cachedfeeds")

    console.time("getarrayofcalendars")
    const arrayOfCalendars = await getArrayOfCalendars();
    console.timeEnd("getarrayofcalendars")

    console.time("rest")

	if (params.calEvent?.extendedProps?.isSnoozer) {
		isSnoozer = true;
	}
	
    const $dialog = initTemplate("clickedEventDialogTemplate");
    const $dialogInner = $dialog.querySelector("#clickedEventDialogInner");
    recurringEvent = null;

    const dialogButtons = [];
    const goingYesNoMaybeButtons = [];
    let copyToMyCalendarButton;
    let duplicateEventButton;
    let eventColorButton;
    let editEventButton;
    let deleteButton;
    
	var title = getSummary(event);
	
	if (isSnoozer) {
		title += " (snoozed)";
	}

    function setDeleteButton() {
        deleteButton = {
            title: getMessage("delete"),
            icon: "delete",
            onClick: async (dialog) => {
                console.log("del event");
                dialog.close();

                if (isSnoozer) {
                    var snoozers = await getSnoozers();
                    for (var a=0; a<snoozers.length; a++) {
                        var snoozer = snoozers[a];
                        console.log("snooze found")
                        if (isSameEvent(event, snoozer.event)) {
                            console.log("remove snooze");
                            // remove it in local context here of popup
                            snoozers.splice(a, 1);
                            // remove it also from storage also!
                            await chrome.runtime.sendMessage({command:"removeSnoozer", eventId:snoozer.event.id});
                            if (fullCalendar) {
                                fullCalendar.getEventById(params.calEvent.id)?.remove();
                            }
                            break;
                        }
                    }
                } else {
                    let response = await ensureSendNotificationDialog({ event: event, action: SendNotificationsAction.DELETE});
                    if (!response.cancel) {
                        showProgress();
                        try {
                            response = await deleteEvent(event, response.sendNotifications, globalThis.recurringEvent);
                            if (!response.cancel) {
                                let message;
                                if (event.kind == TASKS_KIND) {
                                    message = getMessage("taskDeleted");
                                } else {
                                    message = getMessage("eventDeleted");
                                }
                                showToast(message);
            
                                if (response.changeAllRecurringEvents || response.thisAndFollowingEvents) {
                                    reloadCalendar({source:"eventDeleted", bypassCache:true, refetchEvents:true});
                                } else if (fullCalendar) {
                                    fullCalendar.getEventById(event.id)?.remove();
                                }
                
                                if (await getCalendarView() == CalendarView.AGENDA) {
                                    initAgenda();
                                }
                                
                                if (htmlElement.classList.contains("searchInputVisible")) {
                                    params.$eventNode.remove();
                                }
                            }
                        } catch (error) {
                            await showCalendarError(error);
                        } finally {
                            hideProgress();
                        }
                    }
                }
            }
        };
    }
	
	if (isCalendarWriteable(calendar)) {

        editEventButton = {
            id: "clickedEventEdit",
            title: getMessage("editEventDetails"),
            icon: "edit",
            onClick: async (dialog) => {
                dialog.close();
                if (isSnoozer) {
                    openReminders({notifications:[{event:event}]}).then(function() {
                        closeWindow();
                    });
                } else {
                    showCreateBubble({event:event, editing:true});
                }
            }
        };

        setDeleteButton();

        if (calendar.id != TASKS_CALENDAR_OBJECT.id) {
            duplicateEventButton = {
                id: "clickedEventDuplicate",
                title: getMessage("duplicate"),
                icon: "content-copy",
                onClick: async (dialog) => {
                    dialog.close();
		            showCreateBubble({ event: event, editing: true, copying: true, duplicateEvent: true });
                }
            };

            eventColorButton = {
                id: "clickedEventColor",
                title: getMessage("eventColor"),
                icon: "color-lens",
                onClick: async (dialog) => {
                    if (colors) {
                        showEventColors(colors, getEventCalendar(event));

                        onClickReplace("#eventColorsDialog .colorChoice", function() {
                            const newColorId = this._colorId;
            
                            const patchFields = {};
                            patchFields.colorId = newColorId;
                            
                            if (newColorId) {
                                event.colorId = newColorId;
                            } else {
                                delete event.colorId;
                            }
                            
                            showProgress();
                            updateEvent({event:event, patchFields:patchFields}).then(async response => {
                                if (!response.cancel) {
                                    if (await getCalendarView() == CalendarView.AGENDA) {
                                        initAgenda();
                                    } else {
                                        fullCalendar.refetchEvents();
                                        await sleep(100);
                                        reloadCalendar({source:"editEventColor", bypassCache:true, refetchEvents:true});
                                    }
                                }
                                hideProgress();
                            }).catch(error => {
                                showCalendarError(error);
                            });
                        });
                    } else {
                        niceAlert("You need to grant calendar permissions to use this feature.");
                    }
                }
            };
        }
	} else {
		// exeption we can delete snoozes
		if (isSnoozer) {
			setDeleteButton();
		} else {
            if (event.eventType != EventType.BIRTHDAY) {
                copyToMyCalendarButton = {
                    label: getMessage("copyToMyCalendar"),
                    icon: "content-copy",
                    onClick: async (dialog) => {
                        dialog.close();
                        showCreateBubble({ event: event, editing: true, copying: true, copyToMyCalendar: true });
                    }
                }
            }
		}
	}
	
	const $eventIcon = $dialog.querySelector(".eventIcon");
    emptyNode($eventIcon);
    if (await storage.get("showEventIcons")) {
        setEventIcon({
            event: event,
            $eventIcon: $eventIcon,
            cachedFeeds: cachedFeeds,
            arrayOfCalendars: arrayOfCalendars
        });
    }
	
    const $clickedEventTitle = $dialog.querySelector("#clickedEventTitle");
    $clickedEventTitle.style.color = getEventColors({
        event: event,
        darkenColorFlag: true,
        cachedFeeds: cachedFeeds,
        arrayOfCalendars: arrayOfCalendars
    });
    $clickedEventTitle.textContent = title;
    onClickReplace($clickedEventTitle, function() {
        if (isCalendarWriteable(calendar)) {
            selector("#clickedEventEdit").click();
        } else {
            niceAlert("You can't edit this event!");
        }
    });

    const $clickedEventRecurring = $dialog.querySelector("#clickedEventRecurring");
    
    if (event.recurringEventId) {
        $clickedEventRecurring.innerHTML = "&nbsp;"; // placeholder
        show($clickedEventRecurring);

        fetchRecurringEventDetails(event).then(recurringEventDetails => {
            _recurrenceDropdownValue = recurringEventDetails.dropdownValue;
            $clickedEventRecurring.textContent = recurringEventDetails.recurringEventText;
        });
    } else {
        _recurrenceDropdownValue = "";
        hide($clickedEventRecurring);
    }
    
	$dialog.querySelector("#clickedEventDate").textContent = generateTimeDurationStr({event:event});

	if ((calendar.primary && event.eventType != EventType.BIRTHDAY) || event.kind == TASKS_KIND) {
		hide($dialog.querySelector("#clickedEventCalendarWrapper"));
	} else {
		$dialog.querySelector("#clickedEventCalendar").textContent = calendar.summary;
		show($dialog.querySelector("#clickedEventCalendarWrapper"));
	}

    // show if not me or if created more than 30 days ago
    const DAYS_TO_SHOW_CREATOR = 30;
    const passedSelfCreatorFlag = calendar.primary || email == event.creator?.email;
    // check for event.creator because for tasks it may not exist
	if ( (!passedSelfCreatorFlag && event.creator) || (passedSelfCreatorFlag && event.created?.diffInDays() < -DAYS_TO_SHOW_CREATOR) ) {
        cacheContactsData().then(async () => {
            console.log("creator", event);
            const displayName = await getContactDisplayName(event.creator);
            const $creator = document.createElement("a");
            $creator.textContent = displayName ?? event.creator.email;
            $creator.href = "mailto:" + event.creator.email;
            $creator.target = "_blank";
            $creator.title = event.creator.email;

            emptyAppend($dialog.querySelector("#clickedEventCreatedBy"), $creator);
            emptyAppend($dialog.querySelector("#clickedEventCreatedDate"), `• ${event.created.toLocaleDateStringJ({compact: true})}`);

            show($dialog.querySelector("#clickedEventCreatedByWrapper"));
        });
	} else {
        hide($dialog.querySelector("#clickedEventCreatedByWrapper"));
    }

	const eventSource = getEventSource(event, false);

	var locationUrl;
	var locationTitle;
	
	// if source and location are same then merge them
	if (eventSource?.url == event.location) {
		hide($dialog.querySelector("#clickedEventLocationWrapper"));
	} else {
		if (usefulLocation(event)) {
            if (isMeetingLink(event.location)) {
                hide($dialog.querySelector("#clickedEventLocationWrapper"));
            } else {
                locationUrl = event.location;
                locationTitle = event.location;
    
                const $clickedEventLocationMapLink = $dialog.querySelector("#clickedEventLocationMapLink");
                $clickedEventLocationMapLink.textContent = locationTitle;
                $clickedEventLocationMapLink.href = generateLocationUrl(event);
                $clickedEventLocationMapLink.title = generateLocationUrl(event);
                show($dialog.querySelector("#clickedEventLocationWrapper"));
            }
		} else {
			hide($dialog.querySelector("#clickedEventLocationWrapper"));
		}
	}

	if (eventSource) {
		// show logo for this type of source 
		var $fieldIcon = $dialog.querySelector("#clickedEventSourceWrapper .fieldIcon");
		$fieldIcon.removeAttribute("icon");
		$fieldIcon.removeAttribute("src");

		if (eventSource.isGmail) {
			$fieldIcon.setAttribute("icon", "mail");
		} else if (event.extendedProperties?.private?.favIconUrl) {
			$fieldIcon.setAttribute("src", event.extendedProperties.private.favIconUrl);
		} else {
			$fieldIcon.setAttribute("icon", "place");
		}
		
		const $clickedEventSourceLink = $dialog.querySelector("#clickedEventSourceLink")
		$clickedEventSourceLink.textContent = eventSource.title;
        $clickedEventSourceLink.href = eventSource.url
        $clickedEventSourceLink.title = eventSource.url
		show($dialog.querySelector("#clickedEventSourceWrapper"));
	} else {
		hide($dialog.querySelector("#clickedEventSourceWrapper"));
	}

    const videoMeetingDetails = await getVideoMeetingDetails(event);

    if (videoMeetingDetails) {
        $dialog.querySelector("#clickedEventVideoLink").href = videoMeetingDetails.videoUrl;
        byId("joinVideoCallButton").textContent = videoMeetingDetails.label;

        if (videoMeetingDetails.otherVideo) {
            onClickReplace(".copy-conference-link", () => {
                navigator.clipboard.writeText(videoMeetingDetails.videoUrl);
                showToast(getMessage("copiedToClipboard"));
            });
        }

        show($dialog.querySelector("#clickedEventVideoWrapper"));
    } else {
        hide($dialog.querySelector("#clickedEventVideoWrapper"));
    }

    onClickReplace($dialog.querySelector("#clickedEventVideoLink"), function(e) {
        // using openUrl because <a target="_blank" wrapping a paper-button did not work in firefox
        openUrl(this.href);
        sendGA("meeting", "click-in-popup", new URL(this.href).hostname);
        e.preventDefault();
        e.stopPropagation();
    });

    if (event.conferenceData?.createRequest?.status?.statusCode == "pending") {
        byId("joinVideoCallButton").textContent = "";
        byId("clickedEventVideoLabel").textContent = "Refresh to see conference data";
        show("#clickedEventVideoLinkWrapper");

        hide("#clickedEventVideoWrapper");
        hide("#clickedEventPhoneWrapper");
        hide("#clickedEventConferenceMoreWrapper");
    } else if (event.conferenceData?.conferenceSolution) {
        byId("conference-icon").removeAttribute("icon");
        byId("conference-icon").setAttribute("src", event.conferenceData.conferenceSolution.iconUri);
    
        const phone = event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "phone");
        const more = event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "more");

        if (videoMeetingDetails.conferenceVideo) {
            show("#clickedEventVideoLinkWrapper");
            if (videoMeetingDetails.videoUrl) {
                byId("clickedEventVideoLink").href = videoMeetingDetails.videoUrl;
            }
            byId("joinVideoCallButton").textContent = videoMeetingDetails.label;
            show("#clickedEventVideoWrapper");
            
            let label = videoMeetingDetails.conferenceVideo.label ?? "";

            // patch don't dislay zoom links they are long and ugly, but it's ok to display meets links (just like google calendar does)
            if (label.includes("zoom.")) {
                label = "";
            }

            label = getConferenceCodes(label, videoMeetingDetails.conferenceVideo);
            byId("clickedEventVideoLabel").innerHTML = label;

            onClickReplace(".copy-conference-link", () => {
                navigator.clipboard.writeText(videoMeetingDetails.videoUrl);
                showToast(getMessage("copiedToClipboard"));
            });
        } else {
            hide("#clickedEventVideoLinkWrapper");
        }

        if (phone) {
            show("#clickedEventPhoneWrapper");
            byId("clickedEventPhone").href = phone.uri;

            let label = phone.label ?? "";
            label = getConferenceCodes(label, phone);
            byId("clickedEventPhoneLabel").innerHTML = label;
        } else {
            hide("#clickedEventPhoneWrapper");
        }

        if (more) {
            show("#clickedEventConferenceMoreWrapper");
            byId("clickedEventConferenceMoreLabel").href = more.uri;
        } else {
            hide("#clickedEventConferenceMoreWrapper");
        }
    } else {
        hide("#clickedEventVideoLinkWrapper");
        hide("#clickedEventPhoneWrapper");
        hide("#clickedEventConferenceMoreWrapper");
    }

    if (event.conferenceData?.notes) {
        $dialog.querySelector("#clickedEventVideoNotes").innerHTML = event.conferenceData?.notes;
        show($dialog.querySelector("#clickedEventVideoNotesWrapper"));
    } else {
        hide($dialog.querySelector("#clickedEventVideoNotesWrapper"));
    }

	if (event.attendees) {
		const $attendees = $dialog.querySelector("#clickedEventAttendeesWrapper .clickedEventSubDetails");
        emptyNode($attendees);
        
        const attendeesCount = event.attendees?.length;
        if (attendeesCount) {
            const CHIP_HEIGHT = 28;
            const MAX_HEIGHT = 140;
            if (CHIP_HEIGHT * attendeesCount < MAX_HEIGHT) {
                $attendees.style["min-height"] = `${CHIP_HEIGHT * attendeesCount}px`;
            } else {
                $attendees.style["min-height"] = `${MAX_HEIGHT}px`;
            }
            $attendees.style["max-height"] = `${MAX_HEIGHT}px`;
        }

        cacheContactsData().then(async () => {
            sortAttendees(event);
            for (const attendee of event.attendees) {
                await addChip({
                    $container: 	$attendees,
                    attendee: 		attendee,
                    skipAddOrganiser: 	true
                });
            }
        });
		
		//$dialog.querySelector("#clickedEventGoingWrapper .goingStatusHighlighted")?.classList.remove("goingStatusHighlighted");

        function goingButtonClicked(responseStatus, buttonId) {
			eventAttendee.responseStatus = responseStatus;

			const patchFields = {
                attendeesOmitted: true,
                attendees: [eventAttendee]
            };
			
			console.log("patch fields", patchFields, eventAttendee);
			
			showProgress();
			updateEvent({event: event, patchFields: patchFields, skipRecurringEventPrompt: true}).then(response => {
				// success
                if (!response.cancel) {
                    document.querySelector(".going-button.active-state")?.classList.remove("active-state");
                    byId(buttonId).classList.add("active-state");
                    
                    if (params.jsEvent) {
                        params.jsEvent.target.classList.toggle("fcAcceptedEvent", responseStatus == AttendingResponseStatus.ACCEPTED);
                        params.jsEvent.target.classList.toggle("fcTentativeEvent", responseStatus == AttendingResponseStatus.TENTATIVE);
                        params.jsEvent.target.classList.toggle("fcDeclinedEvent", responseStatus == AttendingResponseStatus.DECLINED);
                    }
                    
                    selectorAll("#clickedEventAttendeesWrapper .chip").forEach(chip => {
                        const chipData = chip._data;
                        if (chipData.email == email) {
                            const $attendeeStatus = chip.querySelector(".attendee-status");
                            $attendeeStatus.classList.remove(getClassForAttendingStatus(AttendingResponseStatus.ACCEPTED))
                            $attendeeStatus.classList.remove(getClassForAttendingStatus(AttendingResponseStatus.TENTATIVE))
                            $attendeeStatus.classList.remove(getClassForAttendingStatus(AttendingResponseStatus.DECLINED))
                            $attendeeStatus.classList.remove(getClassForAttendingStatus(AttendingResponseStatus.NEEDS_ACTION))
                            $attendeeStatus.classList.add(getClassForAttendingStatus(responseStatus));
                        }
                    });

                    if (fullCalendar) {
                        fullCalendar.render();
                    }
                }
                
				console.log(response);
				hideProgress();
			}).catch(error => {
				showError("Error: " + error);
				hideProgress();
			});
        }

        let goingYes, goingMaybe, goingNo;
		
		let eventAttendee;
		// fill out "Going" status etc.
		const showGoingButtons = event.attendees.some(attendee => {
			console.log("attendee", attendee);
			if (attendee.email == email) {
				eventAttendee = attendee;
				if (attendee.responseStatus == AttendingResponseStatus.ACCEPTED) {
					//$dialog.querySelector("#goingYes").classList.add("goingStatusHighlighted");
                    goingYes = true;
				} else if (attendee.responseStatus == AttendingResponseStatus.TENTATIVE) {
					//$dialog.querySelector("#goingMaybe").classList.add("goingStatusHighlighted");
                    goingMaybe = true;
				} else if (attendee.responseStatus == AttendingResponseStatus.DECLINED) {
					//$dialog.querySelector("#goingNo").classList.add("goingStatusHighlighted");
                    goingNo = true;
				}
				//$dialog.querySelector("#clickedEventGoingWrapper").removeAttribute("hidden");
				return true;
			}
		});

        if (showGoingButtons) {
            const goingYesButtonId = "going-yes-button";
            goingYesNoMaybeButtons.push({
                id: goingYesButtonId,
                label: getMessage("yes"),
                classList: goingYes ? ["going-button", "active-state"] : ["going-button"],
                onClick: () => {
                    goingButtonClicked(AttendingResponseStatus.ACCEPTED, goingYesButtonId);
                }
            });

            const goingNoButtonId = "going-no-button";
            goingYesNoMaybeButtons.push({
                id: goingNoButtonId,
                label: getMessage("no"),
                classList: goingNo ? ["going-button", "active-state"] : ["going-button"],
                onClick: () => {
                    goingButtonClicked(AttendingResponseStatus.DECLINED, goingNoButtonId);
                }
            });

            const goingMaybeButtonId = "going-maybe-button";
            goingYesNoMaybeButtons.push({
                id: goingMaybeButtonId,
                label: getMessage("maybe"),
                classList: goingMaybe ? ["going-button", "active-state"] : ["going-button"],
                onClick: () => {
                    goingButtonClicked(AttendingResponseStatus.TENTATIVE, goingMaybeButtonId);
                }
            });
        }
		
		show($dialog.querySelector("#clickedEventAttendeesWrapper"));
	} else {
		hide($dialog.querySelector("#clickedEventAttendeesWrapper"));
		hide($dialog.querySelector("#clickedEventGoingWrapper"));
	}
	
	if (event.description) {
		let description = event.description;
		if (description) {
            description = prepareForContentEditable(description);
		}
		
		description = Autolinker.link(description, {
			//truncate: {length: 30},
			stripPrefix : true,
			email: false,
			mention: false,
			phone: false,
			hashtag: false,
		});
        
        const $desc = $dialog.querySelector("#clickedEventDescriptionWrapper .clickedEventSubDetails");
		$desc.innerHTML = description;
        $desc.querySelectorAll("a").forEach(node => {
            node.setAttribute("target", "_blank");
        });
		show($dialog.querySelector("#clickedEventDescriptionWrapper"));
	} else {
		hide($dialog.querySelector("#clickedEventDescriptionWrapper"));
    }

    // note that the field transparency is blank and that means default is BUSY
    if (event.kind != TASKS_KIND && event.allDay && event.transparency != EventTransparency.FREE) {
        $dialog.querySelector("#clickedEventTransparencyWrapper .clickedEventSubDetails").textContent = getMessage("busy");
		show($dialog.querySelector("#clickedEventTransparencyWrapper"));
	} else if (event.kind != TASKS_KIND && !event.allDay && event.transparency == EventTransparency.FREE) {
        $dialog.querySelector("#clickedEventTransparencyWrapper .clickedEventSubDetails").textContent = getMessage("transparencyFree");
		show($dialog.querySelector("#clickedEventTransparencyWrapper"));
    } else {
        hide($dialog.querySelector("#clickedEventTransparencyWrapper"));
    }

    if (event.kind == TASKS_KIND || event.visibility == EventVisibility.DEFAULT || !event.visibility) {
        hide($dialog.querySelector("#clickedEventVisibilityWrapper"));
    } else {
        $dialog.querySelector("#clickedEventVisibilityWrapper .clickedEventSubDetails").textContent = event.visibility == EventVisibility.PUBLIC ? getMessage("public"): getMessage("private");
        show($dialog.querySelector("#clickedEventVisibilityWrapper"));
    }

    if (event.kind == TASKS_KIND) {
        if (event.links?.length) {
            const $details = $dialog.querySelector("#clickedEventTaskLinkWrapper .clickedEventSubDetails");
            emptyNode($details);
            event.links.forEach(linkObj => {
                const $link = document.createElement("a");
                $link.classList.add("task-link");
                $link.href = linkObj.link;
                $link.target = "_blank";
                $link.textContent = linkObj.type == "email" ? getMessage("viewRelatedEmail") : linkObj.description;

                $details.append( $link );
            });
            show($dialog.querySelector("#clickedEventTaskLinkWrapper"));
        } else {
            hide($dialog.querySelector("#clickedEventTaskLinkWrapper"));
        }

        const taskList = getTaskList(event);
        if (taskList) {
            const $desc = $dialog.querySelector("#clickedEventTaskListWrapper .clickedEventSubDetails");
            $desc.innerHTML = taskList.title;
            show($dialog.querySelector("#clickedEventTaskListWrapper"));
        }
    } else {
        hide($dialog.querySelector("#clickedEventTaskLinkWrapper"));
        hide($dialog.querySelector("#clickedEventTaskListWrapper"));
    }

    if (event.attachments) {
        const $attachmentsNode = $dialog.querySelector("#clickedEventAttachmentsWrapper .clickedEventSubDetails");
        emptyNode($attachmentsNode);

        event.attachments.forEach(attachment => {
            const $link = document.createElement("a");
            $link.classList.add("attachment");
            $link.href = attachment.fileUrl;
            $link.target = "_blank";

            const button = document.createElement("j-button");
            button.setAttribute("src", attachment.iconLink);
            button.textContent = attachment.title;
            button.classList.add("attachment-icon-button", "raised");
            $link.appendChild(button);

            $attachmentsNode.append($link);
        });
        show($dialog.querySelector("#clickedEventAttachmentsWrapper"));
    } else {
        hide($dialog.querySelector("#clickedEventAttachmentsWrapper"));
    }

    console.timeEnd("rest")

    console.time("rest2")

    const $clickedEventNotifications = byId("clickedEventNotifications");
    emptyNode($clickedEventNotifications);

    console.time("rest2b")
    getDefaultEventNotificationTime().then(defaultEventNotificationTime => {
        const response = generateReminderTimes(event, defaultEventNotificationTime);
        response.reminderTimes.forEach(reminderTime => {
            const $div = document.createElement("div");
            $div.textContent = reminderTime;
            $clickedEventNotifications.append($div);
        });

        if (event.kind != TASKS_KIND && response.reminderFound) {
            show($dialogInner.querySelector("#clickedEventNotificationsWrapper"));
        } else {
            hide($dialogInner.querySelector("#clickedEventNotificationsWrapper"));
        }
        console.timeEnd("rest2b")
    });

    onClickReplace($dialog.querySelector("#clickedEventClose"), function() {
		$dialog.close();
	});

    console.timeEnd("rest2")

    console.time("rest3")

    async function changeTaskStatus(status, params) {
        dialog.close();

        showProgress();

        await setTaskStatus(event, status);

        if (params.jsEvent) {
            const $fcEvent = params.jsEvent.target.closest(".fc-event")
            $fcEvent.classList.toggle("task-completed", status == TaskStatus.COMPLETED);
        }

        // clicked on agenda node
        if (params.$eventNode) {
            params.$eventNode.classList.toggle("task-completed", status == TaskStatus.COMPLETED);
        }

        hideProgress();

        const reloadParams = {
            source: "editEvent",
            bypassCache: true,
            refetchEvents: true,
        }

        reloadParams.skipSync = true;

        await reloadCalendar(reloadParams);
    }

    dialogButtons.push(...goingYesNoMaybeButtons);

    if (copyToMyCalendarButton) {
        dialogButtons.push(copyToMyCalendarButton);
    }

    if (duplicateEventButton) {
        dialogButtons.push(duplicateEventButton);
    }

    if (eventColorButton) {
        dialogButtons.push(eventColorButton);
    }

    if (editEventButton) {
        dialogButtons.push(editEventButton);
    }

    if (deleteButton) {
        dialogButtons.push(deleteButton);
    }

    dialogButtons.push({
        id: "clickedEventMarkCompleted",
        label: getMessage("markCompleted"),
        onClick: (dialog) => {
            dialog.close();
            changeTaskStatus(TaskStatus.COMPLETED, params);
        }
    });

    dialogButtons.push({
        id: "clickedEventMarkUncompleted",
        label: getMessage("markUncompleted"),
        onClick: (dialog) => {
            dialog.close();
            changeTaskStatus(TaskStatus.NEEDS_ACTION, params);
        }
    });

    console.timeEnd("rest3")

	openDialog($dialog, {
        id: "clickedEventDialog",
        closeButton: true,
        ok: false,
        modal: false,
        buttons: dialogButtons
    });

    if (calendar.id == TASKS_CALENDAR_OBJECT.id) {
        byId("clickedEventDialog").classList.add("task-selected");
        byId("clickedEventDialog").classList.toggle("task-completed", event.status == TaskStatus.COMPLETED);
    } else {
        byId("clickedEventDialog").classList.remove("task-selected");
    }

    const dialog = byId("clickedEventDialog");
    const controller = new AbortController();
    const signal = controller.signal;

    dialog.addEventListener('close', function onClose() {
        controller.abort();
    }, { once: true});

    const $openInCalendarButton = document.createElement("j-button");
    $openInCalendarButton.id = "clickedEventOpenInCalendar";
    $openInCalendarButton.setAttribute("icon", "open-in-new");
    $openInCalendarButton.addEventListener("click", function() {
		if (isSnoozer) {
			openReminders({notifications:[{event:event}]}).then(function() {
				closeWindow();
			});
		} else {
            openEventUrl(event);
		}
	}, { signal });

    selector("#clickedEventDialog .dialog-close-button").before($openInCalendarButton);
}

function displayAgendaHeaderDetails(date) {
    const $calendarTitle = byId("calendarTitle");
	$calendarTitle.textContent = date.toLocaleDateString(locale, {
        month: "long",
    });
    $calendarTitle._date = date;
}

function openOptions() {
	openUrl("options.html?ref=popup");
}

function openContribute() {
	openUrl("contribute.html?ref=CalendarCheckerOptionsMenu");
}

function openHelp() {
	openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar?ref=CalendarCheckerOptionsMenu");
}

function calculateCalendarHeight() {
	const TOP_HEIGHT = DetectClient.isFirefox() ? 65 : 61;

    let windowHeight;
    if (window.innerHeight < 400) {
        console.log("small height detected, using default 600");
        windowHeight = 600;
    } else {
        windowHeight = window.innerHeight;
    }
    return windowHeight - TOP_HEIGHT;
    // v6 commented stopped working with jdom: return document.body.clientHeight - TOP_HEIGHT;
    // v5 reverted v4 because clipping bottom events when calendar was full
    // v4 reduced chrome from 64 to 61 so I can modify eventLimit without scrollbar
    // v3: back to 64 - had empty space i could use at bottom
    // v2: 82 v1: zoom issue was stuck and i had to reload extension or else use 64??;
    // 82 = header       $("#main paper-toolbar").height() + 18
}

async function initQuickAdd() {
	// patch: because auto-bind did not work when loading polymer after the dom (and we I use a 1 millison second timeout before loading polymer to load the popup faster)
	// note: we are modifying the template and not the importedDom because that wouldn't work, polymer wouldn't process the paper-item nodes proplerly
	// note2: I moved this code from startup to the .click event because it was consuming more and more memory everytime I opened the popup window
	
	htmlElement.classList.add("quickAddVisible");
    byId("quickAdd").value = "";
    byId("quickAdd").focus();

    // after adding await, I had to move this below .focus() because it wasn't capturing first key press
    await initCalendarDropDown("quickAddCalendarsMenu", {doNotExcludeTasks: true});

    storage.get("quickAdds").then(texts => {
        if (texts) {
            quickAdds = texts.split('\n');
        }
    });
}

async function openGoogleCalendarEventPage(eventEntry) {
	const actionLinkObj = await generateActionLink("TEMPLATE", eventEntry);
	openUrl(`${actionLinkObj.url}?${actionLinkObj.data}`);
}

function ensureSendNotificationDialog(params) {
	return new Promise((resolve, reject) => {
		if (params.event.attendees?.length) {
			if (params.action == SendNotificationsAction.CREATE || (params.event.organizer?.self)) {
				let content;
				if (params.action == SendNotificationsAction.CREATE) {
					content = getMessage("sendInviteToGuests");
				} else if (params.action == SendNotificationsAction.DELETE) {
					content = getMessage("sendUpdateAboutCancelingEvent");
				} else {
					content = getMessage("sendUpdateToExistingGuests");
				}
				openDialog(content, {
                    buttons: [
                        {
                            label: getMessage("dontSend"),
                            onClick: (dialog) => {
                                dialog.close();
                                resolve({});
                            }
                        },
                        {
                            label: getMessage("send"),
                            primary: true,
                            onClick: (dialog) => {
                                dialog.close();
                                resolve({ sendNotifications: true });
                            }
                        }
                    ]
				});
			} else {
				openDialog(getMessage("changesOnlyReflectedOnCalendarX", getCalendarName(getEventCalendar(params.event))), {
					buttons: [
                        {
                            label: getMessage("cancel"),
                            onClick: (dialog) => {
                                dialog.close();
                                resolve({ cancel: true });
                            }
                        },
                        {
                            label: getMessage("continue"),
                            primary: true,
                            onClick: (dialog) => {
                                dialog.close();
                                resolve({});
                            }
                        }
                    ]
				});
			}
		} else {
			resolve({});
		}
	});
}

function removeSkin(skin) {
    byId("skin_" + skin.id)?.remove();
    document.body.classList.remove("skin_" + skin.id);

    if (skinsSettings.some(thisSkin => shouldApplyDarkTheme(thisSkin)) || shouldApplyDarkTheme(skin)) {
        htmlElement.classList.remove("apply-dark-theme");
    }

	if (shouldWatermarkImage(skin)) {
		byId("skinWatermark").classList.remove("visible");
	}

    initDarkFlags();
}

function removePreviewSkin() {
    byId("previewSkin")?.remove();
    initDarkFlags();
}

function setSkinDetails($dialog, skin) {
	byId("skinAuthorInner").classList.add("visible");

	selector("#skinAuthor").textContent = skin.author;
	if (skin.author_url) {
		selector("#skinAuthor").href = skin.author_url;
	} else {
		selector("#skinAuthor").removeAttribute("href");
	}
}

function getSkin(skins, $paperItem) {
	return skins.find(skin => skin.id == $paperItem.getAttribute("skin-id"));
}

function maybeRemoveBackgroundSkin(skinsSettings) {
	const oneSkinHasAnImage = skinsSettings.some(skin => {
	   if (skin.image) {
		   return true;
	   }
   });

   if (!oneSkinHasAnImage) {
	   document.body.classList.remove("background-skin");
   }
}

function addNightModeIcon($paperItem) {
    const $nightModeIcon = document.createElement("j-icon");
    $nightModeIcon.id = "nightModeIcon";
    $nightModeIcon.setAttribute("icon", "watch-later"); // image:brightness-2
    $nightModeIcon.setAttribute("style", "margin-inline-start: 8px;--icon-padding: 0px;");
    $nightModeIcon.title = getMessage("nightMode");
    onClickReplace($nightModeIcon, function() {
        storage.remove("nightModeSkin");
        this.remove();
    });
    $paperItem.append($nightModeIcon);
}

function showSkinsDialog() {
	showSpinner();
	
	Controller.getSkins().then(async skins => {
        const donationClickedFlag = await storage.get("donationClicked");
		const $dialog = initTemplate("skinsDialogTemplate");
		const $availableSkins = $dialog.querySelector("#availableSkins");
        emptyNode($availableSkins);

		attemptedToAddSkin = false;

        if (!$availableSkins._attachedEvents) {
            onDelegate($availableSkins, "click", ".addButton", function(e) {
				const $addButton = e.target;
				const $paperItem = $addButton.closest("j-item");
				const skin = getSkin(skins, $paperItem);

                removePreviewSkin();

				if ($addButton.classList.contains("selected")) {
					console.log("remove skin: ", skin);
					$addButton.classList.remove("selected");
					removeSkin(skin);
					skinsSettings.some(function (thisSkin, index) {
						if (skin.id == thisSkin.id) {
							skinsSettings.splice(index, 1);
							return true;
						}
					});

					maybeRemoveBackgroundSkin(skinsSettings);

					storage.set("skins", skinsSettings).then(() => {
                        reloadReminders();
						Controller.updateSkinInstalls(skin.id, -1);
					}).catch(error => {
						showError(error);
					});
				} else if (donationClickedFlag) {
                    console.log("add skin");
                    $addButton.classList.add("selected");
                    addSkin(skin);
                    skinsSettings.push(skin);
                    storage.set("skins", skinsSettings).then(() => {
                        reloadReminders();
                        Controller.updateSkinInstalls(skin.id, 1);
                    }).catch(error => {
                        showError(error);
                    });
				} else {
                    $addButton.checked = false;
                    openContributeDialog("skins");
                }

                //$paperItem.removeAttribute("focused");
                //$paperItem.blur();

                //e.preventDefault();
                e.stopImmediatePropagation();
            });

            onDelegate($availableSkins, "click", "j-item", function(e) {
                attemptedToAddSkin = true;

                maybeRemoveBackgroundSkin(skinsSettings);

                const $paperItem = e.target.closest("j-item");
                $paperItem.parentElement.querySelectorAll("j-item").forEach(item => {
                    item.classList.remove("selected");
                });
                $paperItem.classList.add("selected");

                // patch to remove highlighed gray
                $paperItem.removeAttribute("focused");
                $paperItem.blur();

                byId("skinWatermark").classList.remove("visible");
                const skin = getSkin(skins, $paperItem);
                console.log("$paperItem", $paperItem);

                addSkin(skin, "previewSkin");
                setSkinDetails($dialog, skin);

                e.preventDefault();
                e.stopPropagation();
            });

            $availableSkins._attachedEvents = true;
        }

        const nightModeSkin = await storage.get("nightModeSkin");

        const availableSkinsFragment = new DocumentFragment();
		skins.forEach(skin => {
			const paperItem = document.createElement("j-item");
            paperItem.setAttribute("skin-id", skin.id);
            
			const skinAdded = skinsSettings.some(thisSkin => skin.id == thisSkin.id);
			
			const addButton = document.createElement("input");
            addButton.type = "checkbox";
			let className = "addButton";
			if (skinAdded) {
				className += " selected";
				addButton.checked = true;
			} else {
				addButton.checked = false;
			}
			addButton.setAttribute("class", className);
			addButton.setAttribute("title", "Add it");
			paperItem.appendChild(addButton);

			const textNode = document.createTextNode(skin.name);
			paperItem.appendChild(textNode);

            if (nightModeSkin?.id == skin.id) {
                addNightModeIcon(paperItem);
            }

			availableSkinsFragment.appendChild(paperItem);
        });
        $availableSkins.append(availableSkinsFragment);
        
        openDialog($dialog, {
            id: "skinsDialog",
            modal: false,
            buttons: [{
                title: getMessage("reset"),
                icon: "power-settings-new",
                onClick: async function() {
                    await storage.remove("skins");
                    await storage.remove("customSkin");
                    await storage.remove("popup-bg-color");
                    reloadReminders();
                    await niceAlert(getMessage("reset"));
                    location.reload();
                }
            },
            {
                title: getMessage("refresh"),
                icon: "refresh",
                onClick: async function() {
                    skinsSettings.forEach(skinSetting => {
                        skins.forEach(skin => {
                            if (skinSetting.id == skin.id) {
                                copyObj(skin, skinSetting);
                                
                                // refresh skin
                                addSkin(skin);
                            }
                        });
                    });
                    await storage.set("skins", skinsSettings);

                    const nightModeSkin = deepClone(await storage.get("nightModeSkin"));
                    if (nightModeSkin) {
                        const nightSkinFromDB = skins.find(skin => skin.id == nightModeSkin.id);
                        if (nightSkinFromDB) {
                            copyObj(nightSkinFromDB, nightModeSkin);
                            addSkin(nightModeSkin);
                            await storage.set("nightModeSkin", nightModeSkin);
                        }
                    }

                    reloadReminders();
                    showToast(getMessage("done"));
                }
            }, {
                title: getMessage("skin"),
                icon: "code",
                onClick: function() {
                    const $textarea = document.createElement("textarea");
                    $textarea.setAttribute("readonly", "");
                    $textarea.setAttribute("no-outline", "")
                    $textarea.style.cssText = "width:400px;height:200px";

                    const $paperItem = selector("#skinsDialog #availableSkins j-item.selected");
                    if ($paperItem) {
                        const skin = getSkin(skins, $paperItem);
                        $textarea.textContent = skin.css;
                        openDialog($textarea, {
                            title: "Skin details",
                        });
                    } else {
                        niceAlert("Select a skin first to see the CSS.");
                    }
                }
            }, {
                title: getMessage("nightMode"),
                icon: "watch-later",
                onClick: async function() {
                    if (donationClickedFlag) {
                        attemptedToAddSkin = false;

                        const $paperItem = selector("#skinsDialog #availableSkins j-item.selected");
                        if ($paperItem) {
                            const skin = getSkin(skins, $paperItem);
                            const nightModeSkin = await storage.get("nightModeSkin");

                            byId("nightModeIcon")?.remove();

                            if (nightModeSkin?.id == skin.id) {
                                storage.remove("nightModeSkin");
                            } else {
                                storage.set("nightModeSkin", skin);
                                addNightModeIcon($paperItem);
                            }
                        } else {
                            niceAlert("Select a theme first to set as night mode.");
                        }
                    } else {
                        openContributeDialog("nightMode");
                    }
                }
            }, {
                title: getMessage("backgroundColor"),
                icon: "format-color-fill",
                onClick: async function() {
                    const color = await openColorChooser();
                    if (await donationClicked("background-color")) {
                        setPopupBgColor(color);
                        await storage.set("popup-bg-color", color);
                        if (document.body.classList.contains("background-skin")) {
                            showToast("Remove image to see background color.");
                        }
                    }
                }
            }, {
                icon: "create",
                label: getMessage("custom"),
                onClick: async function() {
                    removePreviewSkin();
			
                    const $customContent = initTemplate("customSkinDialogTemplate");
                    
                    const textarea = $customContent.querySelector("textarea");

                    textarea.addEventListener('keydown', (e) => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            // Insert a tab character at cursor position
                            const start = e.target.selectionStart;
                            const end = e.target.selectionEnd;
                            const value = e.target.value;
                            
                            e.target.value = value.substring(0, start) + '\t' + value.substring(end);
                            e.target.selectionStart = e.target.selectionEnd = start + 1;
                        }
                    });

                    const customBackgroundImageUrl = $customContent.querySelector("#customBackgroundImageUrl");

                    const customSkin = deepClone(await storage.get("customSkin"));

                    function canLoadBackgroundImage() {
                        const imageUrl = customBackgroundImageUrl.value;
                        if (!imageUrl) {
                            return true;
                        }
                        return new Promise((resolve, reject) => {
                            const image = new Image();
                            image.src = imageUrl;
                            image.onload = resolve;
                            image.onerror = reject;
                        }).then(() => {
                            return true;
                        }).catch(error => {
                            console.warn(error);
                            niceAlert("Image could not be loaded - might require signing in, try a publicly available image.");
                            return false;
                        });
                    }

                    openDialog($customContent, {
                        id: "customSkinDialog",
                        modal: false,
                        buttons: [{
                            label: "Suggest it to Jason",
                            onClick: function() {
                                openUrl("https://jasonsavard.com/forum/t/checker-plus-for-google-calendar?ref=shareSkin");
                            }
                        }, {
                            label: getMessage("testIt"),
                            classList: ["filled"],
                            onClick: async function() {
                                if (await canLoadBackgroundImage()) {
                                    byId("customSkin")?.remove();
                                    addSkin({
                                        id:"customSkin",
                                        css: textarea.value,
                                        image: customBackgroundImageUrl.value
                                    });
                                    if (!await storage.get("donationClicked")) {
                                        showToast(getMessage("donationRequired"));
                                    }
                                }
                            }
                        }, {
                            label: getMessage("ok"),
                            primary: true,
                            onClick: async function(dialog) {
                                if (await canLoadBackgroundImage()) {
                                    if (donationClickedFlag) {
                                        customSkin.css = textarea.value;
                                        customSkin.image = customBackgroundImageUrl.value;
                                        
                                        addSkin(customSkin);
                                        await storage.set("customSkin", customSkin);
                                        reloadReminders();
                                    } else {
                                        textarea.value = "";
                                        removeSkin(customSkin);
                                        if (!donationClickedFlag) {
                                            showToast(getMessage("donationRequired"));
                                        }
                                    }
                                    dialog.close();
                                }
                            }
                        }]
                    });

                    textarea.value = customSkin.css || "";
                    customBackgroundImageUrl.value = customSkin.image || "";
                }
            }, {
                label: getMessage("ok"),
                primary: true,
                onClick: function(dialog) {
                    initNightMode();

                    if (byId("previewSkin")) {
                        removePreviewSkin();

                        maybeRemoveBackgroundSkin(skinsSettings);

                        if (attemptedToAddSkin) {
                            const content = new DocumentFragment();

                            const $checkbox = document.createElement("input");
                            $checkbox.type = "checkbox";
                            $checkbox.setAttribute("disabled", "");
                            $checkbox.setAttribute("style", "margin-left:8px;vertical-align: middle; opacity: 1");
                            
                            content.append("Use the checkbox", $checkbox, "to add skins!");

                            openDialog(content).then(response => {
                                if (response == "ok") {
                                    attemptedToAddSkin = false;
                                }
                            });
                            const $addButton = selector("#skinsDialog #availableSkins j-item.selected .addButton");
                            $addButton.scrollIntoViewIfNeeded?.();
                            $addButton.addEventListener("transitionend", () => {
                                $addButton.classList.toggle("highlight");
                            }, {once: true});
                            $addButton.classList.toggle("highlight");
                        } else {
                            dialog.close();
                        }
                        
                    } else {
                        dialog.close();
                    }
                }
            }]
        });

        const skinDetails = document.createElement("div");
        skinDetails.id = "skinAuthorWrapper";
        skinDetails.classList.add("flex");

        const skinAuthorInner = document.createElement("div");
        skinAuthorInner.id = "skinAuthorInner";

        const skinBy = document.createElement("span");
        skinBy.classList.add("skin-by");

        const skinText = document.createElement("span");
        skinText.setAttribute("msg", "skin");
        skinText.textContent = getMessage("skin") + " " + getMessage("by");

        skinBy.appendChild(skinText);

        const skinAuthor = document.createElement("a");
        skinAuthor.id = "skinAuthor";
        skinAuthor.target = "_blank";

        skinAuthorInner.append(skinBy, skinAuthor);
        skinDetails.append(skinAuthorInner);

        selector("#skinsDialog #native-dialog-menu").prepend(skinDetails);
	}).catch(error => {
		console.error(error);
		showError("There's a problem, try again later or contact the developer!");
	}).finally(() => {
        hideSpinner();
    });
}

function getClassForAttendingStatus(status) {
    let className;
    if (status == AttendingResponseStatus.ACCEPTED) {
        className = "going";
    } else if (status == AttendingResponseStatus.TENTATIVE) {
        className = "tentative";
    } else if (status == AttendingResponseStatus.DECLINED) {
        className = "declined";
    } else if (status == AttendingResponseStatus.NEEDS_ACTION) {
        className = "needs-action";
    }
    return className;
}

async function addChip(params) {
	const account = generateAccountStub(email);

    // first time must auto insert the organiser
	if (!selector("#inviteGuestsDialog .chip") && !params.addOrganiser && !params.skipAddOrganiser) {
        const calendar = getSelectedCalendar("createEventCalendarsMenu");
        if (calendar.primary) {
            await addChip({
                $container: 	byId("chips"),
                $inputNode:		byId("addGuestInput"),
                $acSuggestions:	params.$acSuggestions,
                addOrganiser:		true
            });
        }
	}

    const $chip = document.createElement("div");
    $chip.classList.add("chip", "layout", "horizontal", "center");

    const $attendeePhotoWrapper = document.createElement("div");
    $attendeePhotoWrapper.classList.add("attendee-photo-wrapper");

    const $contactPhoto = document.createElement("j-icon");
    $contactPhoto.classList.add("contactPhoto");
    $contactPhoto.setAttribute("src", '/images/noPhoto.svg');

    const $attendeeStatus = document.createElement("div");
    $attendeeStatus.classList.add("attendee-status");

    $attendeePhotoWrapper.append($contactPhoto, $attendeeStatus);

    const $chipName = document.createElement("span");
    $chipName.classList.add("chipName");

    const $chipDetails = document.createElement("span");
    $chipDetails.classList.add("chipDetails");

    const $removeChip = document.createElement("j-button");
    $removeChip.classList.add("removeChip");
    $removeChip.setAttribute("icon", "close");

    $chip.append($attendeePhotoWrapper, $chipName, " ", $chipDetails, " ", $removeChip);

	let chipData = {};

	if (params.attendee) {
		chipData.email = params.attendee.email;
		chipData.name = await getContactDisplayName(params.attendee);
		$chip._attendee = params.attendee;
	} else if (params.addOrganiser) {
        chipData.email = window.email;
        chipData.name = globalThis.contactsTokenResponse?.name ?? window.email;
        chipData.organizer = true;
        chipData.responseStatus = AttendingResponseStatus.ACCEPTED;
	} else if (params.$acSuggestions && isVisible(params.$acSuggestions) && params.$acSuggestions.querySelector(".selected")) {
		chipData = params.$acSuggestions.querySelector(".selected")._data;
		params.$acSuggestions.hidePopover();
	} else {
		chipData.email = params.$inputNode.value;
	}

	$chip._data = chipData;

	const contactPhotoData = {
		account:	account,
		name:		chipData.name,
		email:		chipData.email,
		alwaysShow:	true
	};
	setContactPhoto(contactPhotoData, $contactPhoto);

	if (params.attendee) {
        const className = getClassForAttendingStatus(params.attendee.responseStatus);
        $attendeeStatus.classList.add(className);
	}

    $chipName.textContent = chipData.name ?? chipData.email;
    $chipName.title = chipData.email;

	if (params.attendee?.organizer) {
		$chipDetails.textContent = getMessage("organiser");
	}

    onClick($removeChip, function () {
		$chip.remove();
		byId("addGuestInput").focus();
	});

	params.$container.append($chip);
    
	if (!params.addOrganiser && params.$inputNode) {
		params.$inputNode.value = "";
		params.$inputNode.setAttribute("placeholder", "");
	}
}

async function showInviteGuestsDialog(event) {
	const account = generateAccountStub(email);

    const inviteGuestsDialog = byId("inviteGuestsDialog");
    if (inviteGuestsDialog && inviteGuestsDialog.classList.contains("hide-temporarily")) {
        inviteGuestsDialog.classList.remove("hide-temporarily");
        return;
    }

	const $dialog = initTemplate("inviteGuestsDialogTemplate");
    const wrapperNode = $dialog.firstElementChild;

    if (!wrapperNode._guestsLoaded) {
        if (event.attendees?.length) {
            const $acSuggestions = byId("guest-suggestions");
            sortAttendees(event);
            for (const attendee of event.attendees) {
                await addChip({
                    $container: 	byId("chips"),
                    $inputNode:		byId("addGuestInput"),
                    $acSuggestions:	$acSuggestions,
                    attendee: 		attendee,
                    skipAddOrganiser: 	true
                });
            }
        }
        wrapperNode._guestsLoaded = true;
    }

    openDialog($dialog, {
        id: "inviteGuestsDialog",
        modal: false,
        closeByOutsideClick: false,
        buttons: [
            {
                label: getMessage("refresh"),
                icon: "refresh",
                onClick: async function() {
                    showLoading();

                    // remove contacts data
                    const dataIndex = getContactDataItemIndexByEmail(contactsData, email);
                    if (dataIndex != -1) {

                        if (contactsData[dataIndex].version == CONTACTS_STORAGE_VERSION) {
                            showLoading();
                            try {
                                await sendMessageToBG("updateContacts");
                                contactsData = await storage.get("contactsData");
                                byId("inviteGuestsOkButton").click();
                                byId("inviteGuests").click();
                            } catch (error) {
                                console.warn("error", error);
                                console.warn("error", error.code);
                                console.warn("error", error.cause);
                                console.warn("error", error.errorCode);
                                if (error.code == 403) {
                                    grantContactPermission(_createEvent);
                                }
                            } finally {
                                hideLoading();
                            }
                            return;
                        }

                        contactsData.splice(dataIndex, 1);
                        await storage.set("contactsData", contactsData);
                    }

                    contactsData = null;

                    grantContactPermission(_createEvent);
                }
            },
            {
                id: "inviteGuestsOkButton",
                label: getMessage("ok"),
                primary: true,
                onClick: function(dialog) {
                    dialog.classList.add("hide-temporarily");
                }
            }
        ]
    });

	const $fetchContacts = byId("fetchContacts");
    onClickReplace($fetchContacts, function () {
        requestPermission({ email: account.getEmail(), initOAuthContacts: true, useGoogleAccountsSignIn: true });
	});

	var $acSuggestions = byId("guest-suggestions");
	
	function addSuggestion(params) {
        const $acItem = document.createElement("j-item");
        $acItem.classList.add("acItem", "layout", "horizontal", "center");

        const $contactPhoto = document.createElement("j-icon");
        $contactPhoto.classList.add("contactPhoto");
        $contactPhoto.setAttribute("src", '/images/noPhoto.svg');

        const $acName = document.createElement("div");
        $acName.classList.add("acName");
        $acName.textContent = params.name || params.email.split("@")[0];

        const $acEmail = document.createElement("div");
        $acEmail.classList.add("acEmail");
        $acEmail.textContent = params.email;

        $acItem.append($contactPhoto, $acName, $acEmail);

		$acItem._data = params;

        $acItem.addEventListener("mouseenter", function() {
            $acSuggestions.querySelector(".selected")?.classList.remove("selected");
            this.classList.add("selected");
        });

        $acItem.addEventListener("mouseleave", function() {
            this.classList.remove("selected");
        })

        onClick($acItem, function() {
            addChip({
                $container: 	byId("chips"),
                $inputNode:		byId("addGuestInput"),
                $acSuggestions: $acSuggestions
            });
            byId("addGuestInput").focus();
        });
		
		params.delay = 1; // I tried 100 before
		setContactPhoto(params, $contactPhoto);
		
		$acSuggestions.append($acItem);
	}

	function showSuggestions() {
		suggestions.forEach(function (suggestion) {
			addSuggestion(suggestion);
		});
		lastSuggestions.forEach(function (suggestion) {
			addSuggestion(suggestion);
		});

		$acSuggestions.querySelector(".acItem")?.classList.add("selected");
		//show($acSuggestions);
        $acSuggestions.showPopover({source: byId("addGuestInput")});
	}

	function generateSuggestionDataFromContact(account, contact, emailIndex) {
		var email = contact.emails[emailIndex].address;
		var name = contact.name;
		var updated = contact.updatedDate;
		return { account: account, email: email, name: name, updated: updated };
	}

    // prefetch for speed
    cacheContactsData().then(async () => {
        contacts = await getContacts({ account: account });
    });

    const $addGuestInput = byId("addGuestInput");

    $addGuestInput.setAttribute("disable-auto-submit", "");

    $addGuestInput.setAttribute("placeholder", getMessage("guests"));
    onClickReplace($addGuestInput, function(event) {
        if (!$addGuestInput.value) {
            suggestions = [];
            emptyNode($acSuggestions);
            contacts.every(function (contact, index) {
                if (index < MAX_SUGGESTIONS_BY_CLICK) {
                    for (var b = 0; contact.emails && b < contact.emails.length; b++) {
                        var suggestion = generateSuggestionDataFromContact(account, contact, b);
                        if (contact.emails[b].primary) {
                            suggestions.push(suggestion);
                        }
                    }
                    return true;
                } else {
                    return false;
                }
            });
            showSuggestions();
        }
        event.preventDefault();
        event.stopPropagation();
    });

    replaceEventListeners($addGuestInput, function () {
        setTimeout(function () {
            hide("#fetchContacts");
        }, 200);
    });
    
    replaceEventListeners($addGuestInput, "keydown", function(e) {
        const key = e.key;
        if (key === "Tab" || (key === "Enter" && !e.isComposing)) { // tab/enter
            if (e.target.value) {
                addChip({
                    $container: 	byId("chips"),
                    $inputNode:		e.target,
                    $acSuggestions: $acSuggestions
                });
                e.preventDefault();
                e.stopPropagation();
            }
            performAutocomplete = false;
        } else if (key === "Backspace") {
            /*
            if ($(this).val() == "") {
                $(".chips").find(".chip").last().remove();
                performAutocomplete = false;
            } else {
                performAutocomplete = true;
            }
            */
        } else if (key === "ArrowUp") {
            const $current = $acSuggestions.querySelector(".selected");
            if ($current) {
                const $prev = $current.previousElementSibling;
                if ($prev) {
                    $current.classList.remove("selected");
                    $prev.classList.add("selected");
                }
            }
            performAutocomplete = false;
            e.preventDefault();
            e.stopPropagation();
        } else if (key === "ArrowDown") {
            var $current = $acSuggestions.querySelector(".selected");
            if ($current) {
                const $next = $current.nextElementSibling;
                if ($next) {
                    $current.classList.remove("selected");
                    $next.classList.add("selected");
                }
            }
            performAutocomplete = false;
            e.preventDefault();
            e.stopPropagation();
        } else {
            performAutocomplete = true;
        }
    });

    replaceEventListeners($addGuestInput, "keyup", function(e) {
        if (performAutocomplete) {
            if (contacts.length) {
                suggestions = [];
                lastSuggestions = [];
                emptyNode($acSuggestions);
                if (e.target.value) {
                    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    var firstnameRegex = new RegExp("^" + escapeRegex(e.target.value), "i");
                    var lastnameRegex = new RegExp(" " + escapeRegex(e.target.value), "i");
                    var emailRegex = new RegExp("^" + escapeRegex(e.target.value), "i");
                    var matchedContacts = 0;
                    for (var a = 0; a < contacts.length; a++) {
                        var contact = contacts[a];
                        var firstnameFound = firstnameRegex.test(contact.name);
                        var lastnameFound;
                        if (!firstnameFound) {
                            lastnameFound = lastnameRegex.test(contact.name);
                        }
                        if (firstnameFound || lastnameFound) {
                            if (contact.emails && contact.emails.length) {
                                //console.log("contact", contact);
                                matchedContacts++;
                                for (var b = 0; b < contact.emails.length; b++) {
                                    var suggestion = generateSuggestionDataFromContact(account, contact, b);
                                    if (contact.emails[b].primary && firstnameFound) {
                                        suggestions.push(suggestion);
                                    } else {
                                        lastSuggestions.push(suggestion);
                                    }
                                }
                            }
                        } else {
                            if (contact.emails && contact.emails.length) {
                                for (var b = 0; b < contact.emails.length; b++) {
                                    if (emailRegex.test(contact.emails[b].address)) {
                                        //console.log("contact email", contact);
                                        matchedContacts++;
                                        var suggestion = generateSuggestionDataFromContact(account, contact, b);
                                        if (contact.emails[b].primary && contact.name) {
                                            suggestions.push(suggestion);
                                        } else {
                                            lastSuggestions.push(suggestion);
                                        }
                                    }
                                }
                            }
                        }

                        if (matchedContacts >= MAX_SUGGESTIONS) {
                            break;
                        }
                    }

                    showSuggestions();
                } else {
                    $acSuggestions.hidePopover();
                }
            } else {
                show($fetchContacts);
            }
        }
    });
}

function setNoPhoto(imageNode) {
    imageNode.setAttribute("src", "images/noPhoto.svg");
    imageNode.classList.add("noPhoto");
}

async function setContactPhoto(params, imageNode) {

	// contact photo
	const contactPhoto = await getContactPhoto(params);
    imageNode.setAttribute("setContactPhoto", "true");

    if (params.useNoPhoto && !contactPhoto.realContactPhoto) {
        setNoPhoto(imageNode);
    } else if (contactPhoto.photoUrl) {
        imageNode.addEventListener("error", function() {
            setNoPhoto(imageNode);
        });

        // used timeout because it was slowing the popup window from appearing
        setTimeout(function () {
            if (params.alwaysShow || isVisible(imageNode)) {
                imageNode.setAttribute("src", contactPhoto.photoUrl);
            }
        }, params.delay ? params.delay : 20);
    } else {
        if (params.useNoPhoto) {
            setNoPhoto(imageNode);
        } else {
            var name;
            if (params.name) {
                name = params.name;
            } else if (params.mail) {
                name = params.mail.getName();
            }

            var letterAvatorWord;
            if (name) {
                letterAvatorWord = name;
            } else {
                letterAvatorWord = params.email;
            }
            imageNode.removeAttribute("fade");
            setLetterAvatar(imageNode, letterAvatorWord);
        }
    }
}

async function setLetterAvatar(imageNode, name, color) {
	const colours = ["#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#34495e", "#16a085", "#27ae60", "#2980b9", "#8e44ad", "#2c3e50", "#f1c40f", "#e67e22", "#e74c3c", "#ecf0f1", "#95a5a6", "#f39c12", "#d35400", "#c0392b", "#bdc3c7", "#7f8c8d"];

    //name = "oなßüab"
    if (!name) {
        setNoPhoto(imageNode);
        return;
    }

    let nameCharIndex = 0;
    let firstChar = name.charAt(nameCharIndex);
    
    // If first character is not a letter or number, try second character
    const letterOrNumberRegex = /^[\p{L}\p{N}]/u;
    if (!letterOrNumberRegex.test(firstChar)) {
        nameCharIndex = 1;
        firstChar = name.charAt(nameCharIndex);
        
        // If second character also fails, show no photo
        if (!letterOrNumberRegex.test(firstChar)) {
            setNoPhoto(imageNode);
            return;
        }
    }
     
    let letter = name.charAt(nameCharIndex).toUpperCase();
    if (letter == "SS") {
        letter = "ß";
    }
    const letterCode = letter.charCodeAt();

	const charIndex = letterCode - 64,
		colourIndex = charIndex % 20;

	let canvas;
	const CANVAS_XY = 256;
	if (typeof OffscreenCanvas != "undefined") {
		canvas = new OffscreenCanvas(CANVAS_XY, CANVAS_XY);
	} else if (typeof document != "undefined") {
		canvas = document.createElement("canvas");
		canvas.width = canvas.height = CANVAS_XY;
	}

	const context = canvas.getContext("2d");

	if (color) {
		context.fillStyle = color;
	} else {
		context.fillStyle = colours[colourIndex];
	}
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.font = "128px Arial";
	context.textAlign = "center";
	context.fillStyle = isColorTooLight(context.fillStyle, 0.60) ? "#000" : "#FFF";
	context.fillText(letter, CANVAS_XY / 2, CANVAS_XY / 1.5);

	let dataUrl;
    try {
        dataUrl = await getDataUrl(canvas);
        imageNode.setAttribute("src", dataUrl);
    } catch (error) {
        // refer to https://jasonsavard.com/forum/discussion/6072/error-when-reading-from-canvas-is-disabled
        console.warn("Canvas writing disabled for privacy so returning empty");
        dataUrl = "";
    }
}

async function gotoDate(params) {
    const calendarView = await getCalendarView();
    if (calendarView == CalendarView.CUSTOM && /^4$|^5$|^6$/.test(await storage.get("customView")) && await storage.get("jumpToStartOfMonthForNextPrev")) {
        showLoading();
        await sleep(1);
        temporarilyDisableFetching(() => {
            let date;
            if (params.next) {
                date = fullCalendar.getDate();
                date.setMonth(date.getMonth() + 1);
            } else {
                date = params.date;
            }
            fullCalendar.gotoDate(date);
            // temporarily switch over to month view
            fcChangeView(CalendarView.MONTH);
        })
    } else if (calendarView == CalendarView.AGENDA) {
        var start = params.date;
        var end = start.addDays(21);
        
        displayAgendaHeaderDetails(start);
        
        window.autoScrollIntoView = true;
        fetchAgendaEvents({start:start, end:end, forceEmpty:true, gotoDate: true}).then(function() {
            // do nothing
            //window.autoScrollIntoView = false;
        });
        scrollTarget.scrollTop = 0;
    } else {
        if (params.next) {
            fullCalendar.next();
        } else {
            fullCalendar.gotoDate(params.date);
            const scrollers = document.querySelectorAll(".fc-scroller");
            scrollers.forEach(scroller => {
                scroller.scrollTop = 0;
            });
        }
    }
    calendarShowingCurrentDate = false;
}

function temporarilyDisableFetching(func) {
	// temporarily remove source and re-add it below because fullCalendar("gotoDate") below will fetch events
    window.disableHideLoading = true;
    const thisSource = fullCalendar.getEventSourceById(FullCalendarSourceIds.MAIN); 
	thisSource.remove();

	func();

	window.disableHideLoading = false;
	fullCalendar.addEventSource(fullCalendarSource);
}

async function setSelectedCalendars(calendar, arrayOfCalendars, displayThisOnly) {
    const excludedCalendars = await storage.get("excludedCalendars");
    const selectedCalendars = await storage.get("selectedCalendars");
    const desktopNotification = await storage.get("desktopNotification");
						
	if (!selectedCalendars[email]) {
		selectedCalendars[email] = {};
	}

	if (displayThisOnly) {
		arrayOfCalendars.forEach(thisCalendar => {
			let visibleFlag;
			if (calendar.id == thisCalendar.id) {
				visibleFlag = true;
			} else {
				visibleFlag = false;
			}
            selectedCalendars[email][thisCalendar.id] = visibleFlag;

            if (!visibleFlag && isCalendarExcludedForNotifsByOptimization(thisCalendar, excludedCalendars) && !isGadgetCalendar(thisCalendar)) {
                console.info("optimize and remove from cache: " + thisCalendar.id);
                delete cachedFeeds[thisCalendar.id];
            }
		});
	} else {
        selectedCalendars[email][calendar.id] = !isCalendarSelectedInExtension(calendar, email, selectedCalendars);
        
        if (!isCalendarUsedInExtension(calendar, email, selectedCalendars, excludedCalendars, desktopNotification)) {
            console.info("optimize and remove from cache: " + calendar.id);
            delete cachedFeeds[calendar.id];
        }
    }

    await storage.set("cachedFeeds", cachedFeeds);
    
    showSpinner();
	storage.set("selectedCalendars", selectedCalendars).then(() => {
        reloadCalendar({
            source: "selectedCalendars",
            refetchEvents: true,
            reInitCachedFeeds: true // used because we might have removed unused calendars above
        });
    });
}

function openGoToDate() {
    const currentDate = fullCalendar.getDate();

    const $dialogContent = initTemplate("gotoDateDialogTemplate");
    const $dialogContentWrapper = $dialogContent.firstElementChild
    $dialogContentWrapper.querySelectorAll("#gotoDate_month option").forEach(el => {
        el.textContent = dateFormat.i18n.monthNamesShort[el.getAttribute("value")];
    });
    $dialogContentWrapper.querySelector("#gotoDate_month").value = currentDate.getMonth();
    $dialogContentWrapper.querySelector("#gotoDate_day").value = currentDate.getDate();
    $dialogContentWrapper.querySelector("#gotoDate_year").value = currentDate.getFullYear();
    openDialog($dialogContent, {
        noAutoFocus: true,
    }).then(response => {
        if (response == "ok") {
            const newDate = new Date($dialogContentWrapper.querySelector("#gotoDate_year").value, $dialogContentWrapper.querySelector("#gotoDate_month").value, $dialogContentWrapper.querySelector("#gotoDate_day").value);
            gotoDate({date: newDate});
        }
    });
}

async function showSearch() {
    await initCalendarDropDown("searchCalendarsMenu", {selectedCalendarId: "active-calendars"});
    
    emptyNode("#agendaEvents");
    htmlElement.classList.add("searchInputVisible");
    byId("searchInput").focus();
}

function initCalendarColorChanger($rightSideWrapper, storageKey, arrayOfCalendars) {
    const $changeColor = document.createElement("j-button");
    $changeColor.classList.add("task-color-picker");
    $changeColor.setAttribute("icon", "palette");
    $rightSideWrapper.append($changeColor);

    replaceEventListeners($changeColor, "click", async function() {
        const color = await openColorChooser();
        showProgress();
        await storage.set(storageKey, color);
        byId("side-rail-menu").hidePopover();
        await initColorsForNonStandardCalendars();
        initCalendarColorsInCSS(cachedFeeds, arrayOfCalendars);
        await sendMessageToBG("resetInitMiscWindowVars");
        await reloadCalendar({
            source: "changed-calendar-color",
            refetchEvents: true
        });
        setTimeout(() => {
            initVisibleCalendarsList();
        }, 1000);
        hideProgress();
    });
}

async function initVisibleCalendarsList() {
    const selectedCalendars = await storage.get("selectedCalendars");
    const arrayOfCalendars = await getArrayOfCalendars({
        includeBirthdays: true,
        includeTasks: true
    });
    writeableCalendars = getWriteableCalendars(arrayOfCalendars);
    
    const tasksUserEmails = await oAuthForTasks.getUserEmails();

    emptyNode("#visibleCalendars");
    arrayOfCalendars.forEach(calendar => {
        const calendarName = getCalendarName(calendar);
        
        if (isGadgetCalendar(calendar)) {
            // exclude the weather etc. because i am not integrating it into calendar display
        } else {
            const $checkbox = document.createElement("input");
            $checkbox.type = "checkbox";

            const $visibleCalendarLabel = document.createElement("label");
            $visibleCalendarLabel.classList.add("visibleCalendarLabel");
            $visibleCalendarLabel.title = calendarName;

            const $calendarNameSpan = document.createElement("span");
            $calendarNameSpan.classList.add("calendarName");
            $calendarNameSpan.textContent = calendarName;

            $visibleCalendarLabel.append($checkbox, $calendarNameSpan);

            $checkbox._calendar = calendar;
            $checkbox.classList.add("jdom-checkbox");
            $checkbox.setAttribute("color-id", calendar.colorId);

            onClick($checkbox, async function(e) {
                console.log("checkbox", e);
                const calendar = e.currentTarget._calendar;

                if (calendar.id == TASKS_CALENDAR_OBJECT.id) {
                    if (await storage.firstTime("_tasksWarning")) {
                        const content = new DocumentFragment();

                        const $link = document.createElement("a");
                        $link.href = "https://issuetracker.google.com/issues/166896024";
                        $link.target = "_blank";
                        $link.textContent = "here";

                        content.append("Due to popular requests I have integrated Google Tasks into this calendar extension to see them in the calendar and get notified on their due date. However, you can only create tasks by adding them to a calendar day.");
                        content.append(createBR(), createBR());
                        content.append("There are Google Tasks API limitations:");
                        content.append(createBR(), createBR());
                        content.append("1) Real-time syncing is not supported for Tasks so the extension must poll every few hours to fetch tasks you may have created outside of the extension or you can simply click the Refresh button");
                        content.append(createBR(), createBR());
                        content.append("2) Developers cannot set or get the specific time of tasks, only the day, so every task will be treated as an all day task. You can star the issue with Google ", $link);

                        await niceAlert(content);
                    }
                    if (await donationClicked("tasks")) {
                        if (tasksUserEmails?.length) {
                            setSelectedCalendars(calendar, arrayOfCalendars);
                        } else {
                            const tokenResponses = await oAuthForDevices.getTokenResponses();
                            const tokenResponse = tokenResponses[0];
    
                            const thisTokenResponse = await openPermissionsDialog({
                                email: tokenResponse.userEmail,
                                initOAuthTasks: true,
                                useGoogleAccountsSignIn: !tokenResponse.chromeProfile
                            });

                            if (thisTokenResponse) {
                                postGrantPermissionToTasksAndPolledServer();
                            }
                        }
                    } else {
                        this.checked = false;
                    }
                } else {
                    setSelectedCalendars(calendar, arrayOfCalendars);
                }
            });
            
            if (isCalendarSelectedInExtension(calendar, email, selectedCalendars)) {
                if (calendar.id == TASKS_CALENDAR_OBJECT.id) {
                    if (tasksUserEmails?.length) {
                        $checkbox.checked = true;
                    }
                } else {
                    $checkbox.checked = true;
                }
            }

            const $rightSideWrapper = document.createElement("div");
            $rightSideWrapper.classList.add("rightSideWrapper");
            
            const $visibleCalendar = document.createElement("div");
            $visibleCalendar.classList.add("visible-calendar");
            $visibleCalendar.append($visibleCalendarLabel);

            if (calendar.id == TASKS_CALENDAR_OBJECT.id) {
                initCalendarColorChanger($rightSideWrapper, "tasks-bg-color", arrayOfCalendars);
            } else if (calendar.id == BIRTHDAYS_CALENDAR_OBJECT.id) {
                initCalendarColorChanger($rightSideWrapper, "birthdays-bg-color", arrayOfCalendars);
            }

            const $displayThisOnly = document.createElement("j-button");
            $displayThisOnly.classList.add("displayThisCalendarOnly");
            $displayThisOnly.title = getMessage("displayThisOnly");
            $displayThisOnly.setAttribute("icon", "remove-red-eye");
            onClick($displayThisOnly, function(e) {
                // remove all
                selectorAll("#visibleCalendars input[type='checkbox']").forEach(el => {
                    el.checked = false;
                });

                // recheck selected
                const $visibleCalendarCheckbox = this.closest(".visible-calendar").querySelector("input[type='checkbox']");
                $visibleCalendarCheckbox.checked = true;

                setSelectedCalendars($visibleCalendarCheckbox._calendar, arrayOfCalendars, true);

                e.preventDefault();
                e.stopPropagation();
            });

            $rightSideWrapper.appendChild($displayThisOnly);
            $visibleCalendar.append($rightSideWrapper);
            
            byId("visibleCalendars").append($visibleCalendar);
        }
    });
}

async function initNightMode() {
    const nightModeSkin = await storage.get("nightModeSkin");
    if (nightModeSkin) {
        const currentHour = new Date().getHours();
        if (currentHour < 7 || currentHour >= 19) {
            addSkin(nightModeSkin);
        } else {
            removeSkin(nightModeSkin);
        }
    }
}

async function init() {
    console.log("client width: " + document.body.clientWidth);
    console.log("client height: " + document.body.clientHeight);

    // had to move this up in the code or else scrollbars were appearing regardless
    new Promise(async (resolve, reject) => {
        // should have prefected getZoomFactor before ready, if not do it again, but might have FOUC
        if (!zoomFactor) {
            zoomFactor = await getZoomFactor();
        }
        resolve();
    }).then(() => {
		if (fromToolbar) {
            if (MAX_POPUP_HEIGHT < screen.availHeight - CHROME_HEADER_HEIGHT) {
                document.body.style.height = `${MAX_POPUP_HEIGHT / zoomFactor}px`;
            } else {
                document.body.style.height = `${(screen.availHeight - CHROME_HEADER_HEIGHT) / zoomFactor}px`;
            }
            document.body.style.width = `${MAX_POPUP_WIDTH / zoomFactor}px`;
		}
    });

    let calendarView = await getCalendarView();
    initCalendarView(calendarView);

    await storage.initStorageCache();

    console.log("client width2: " + document.body.clientWidth);
    console.log("client height2: " + document.body.clientHeight);

    await getBGObjects();
    //await docReady();

    docReady().then(async () => {
        console.log("client width3: " + document.body.clientWidth);
        console.log("client height3: " + document.body.clientHeight);
        skinsSettings.forEach(skin => {
            addSkin(skin);
        });

        initNightMode();
        setInterval(initNightMode, minutes(1));

        addSkin(await storage.get("customSkin"));
    });

    console.log("client width4: " + document.body.clientWidth);
    console.log("client height4: " + document.body.clientHeight);

    let fcLocale = locale.toLowerCase();
    if (fcLocale == "pt-pt") {
        fcLocale = "pt";
    }

    if (fcLocale != "en") {
        insertScript(`fullcalendar/locales/${fcLocale}.js`).catch(error => {});
    }

    // check again after body loaded to see if too narrow
    let calendarViewAgain = await getCalendarView();
    if (calendarView != calendarViewAgain) {
        calendarView = calendarViewAgain;
        initCalendarView(calendarView);
    }

    const arrayOfCalendars = await getArrayOfCalendars({
        includeBirthdays: true
    });
    
    htmlElement.lang = locale;

    if (DetectClient.isFirefox()) {
        onDelegate(document.body, "click", "a[target]", function(e) {
            openUrl(e.target.href);
            e.preventDefault();
            e.stopPropagation();
        });
    }

    oAuthForDevices.findTokenResponse(email).then(async tokenResponse => {
        if (tokenResponse) {
            if ((await getInstallDate()).isToday() && await storage.firstTime("changeViewGuide")) {
                const content = document.createElement("span");
                content.innerHTML = getMessage("useTheXToChangeViews", "<j-icon style='vertical-align:middle' icon='more-vert'></j-icon>");
                openDialog(content);
            }
            byId("bigAddEventButtonWrapper").classList.add("visible");
        } else {
            const tokenResponse = await openPermissionsDialog({modal: true});
            if (tokenResponse) {
                location.reload();
            }
        }
    });    

    if (isDetached && !isRequestingPermission && await storage.firstTime("popoutMessage") && !fromGrantedAccess) {
        docReady().then(() => {
            openDialog("For more popout options like creating shortcuts visit the Popout FAQ", {
                buttons: [{
                    label: getMessage("moreInfo"),
                    onClick: function(dialog) {
                        dialog.close();
                        openUrl("https://jasonsavard.com/wiki/Popout?ref=calendarPopoutDialog");
                    }
                }]
            });
        });
    }

    onClick("#title", async () => {
        openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar?ref=sidebar");
    });

    const sideRailMenu = byId('side-rail-menu');

    const shield = document.getElementById('click-shield');

    // Handler for clicks on the shield (mimics backdrop dismissal)
    const shieldDismissHandler = () => {
        sideRailMenu.hidePopover();
    };

    sideRailMenu.addEventListener("beforetoggle", async function(e) {
        if (e.newState == "open") {
            shield.classList.add('is-active');
            shield.addEventListener('click', shieldDismissHandler);

            const $miniCalendar = byId("miniCalendar");
        
            if (!$miniCalendar.classList.contains("loaded")) {
                // patch for scrollbar issue Oct 2022 because height set to early in drawer
                // set this before rendering minicalendar so it's width takes into account the scrollbar
                //byId("drawer-scrollarea").classList.add("init");

                const params = await generateFullCalendarParams();
                params.dateClick = function (dateClickInfo) {
                    gotoDate({date: dateClickInfo.date});
                    byId("side-rail-menu").hidePopover();
                }

                const miniCalendar = new FullCalendar.Calendar($miniCalendar, params);
                miniCalendar.render();

                formatMiniFullCalendar($miniCalendar);

                $miniCalendar.classList.add("loaded");
            }
        } else if (e.newState === 'closed') {
            shield.classList.remove('is-active');
            shield.removeEventListener('click', shieldDismissHandler);
        }
    });
    
    initVisibleCalendarsList();
    
    if (await isDNDbyDuration()) {
        docReady().then(() => {
            showToast(getMessage("DNDisEnabled"), {
                text: getMessage("turnOff"),
                onClick: function() {
                    sendMessageToBG("setDND_off");
                    hideToast();
                }
            });
        });
    }
    
    initCalendarColorsInCSS(cachedFeeds, arrayOfCalendars);

    if (openingSite) {
        return;
    } else {
        show(document.body);
    }

    if (DetectClient.isOpera()) {
        document.body?.classList?.add("opera");
    }

    storage.get("showCompletedTasks").then((showCompletedTasks) => {
        if (!showCompletedTasks) {
            htmlElement.classList.add("hide-completed-tasks");
        }
    });

    storage.get("displaySecondaryTimezone").then(displaySecondaryTimezone => {
        if (displaySecondaryTimezone) {
            htmlElement.classList.add("secondary-timezone");
        }
    });

    var msgKey;
    if (Math.random() * 5 < 3) {
        msgKey = "quickAddDefaultText";
    } else {
        msgKey = "quickAddTitle";
    }
    byId("quickAdd").setAttribute("placeholder", getMessage(msgKey));

    if (await storage.get("dimPastEvents")) {
        byId("betaCalendar").classList.add("dim-past-events");
    }
    if (await storage.get("highlightWeekends")) {
        byId("betaCalendar").classList.add("highlightWeekends");
    }
    
    if (await storage.get("removeShareLinks") || calendarView == CalendarView.AGENDA) {
        const shareButtons = selectorAll(".share-button");
        removeAllNodes(shareButtons);
    }
    
    const loggedOut = await storage.get("loggedOut");
    console.log("logout state: " + loggedOut);
    if (typeof loggedOut === "undefined" || loggedOut) { // !loggedOut  - commented because issue occured when invalid creditials
        if (await oAuthForDevices.findTokenResponse(email)) {
            await showCalendarError("401");
        }
    } else if (!await isOnline() && arrayOfCalendars.length == 0) {
        showError(getMessage("yourOffline"));
    } else if (arrayOfCalendars.length == 0) { // could be async issue after returning from authorization flow
        showError("Could not load calendars, try granting access again.");
    } else {
        show("#wrapper");
        hide("#calendarWrapper");
        
        const showEventIcons = await storage.get("showEventIcons");
        
        let eventTimeFormat;
        let slotLabelFormat;
        
        if (twentyFourHour) {
            slotLabelFormat = eventTimeFormat = {
                hourCycle: getHourCycle(),
                hour: "numeric",
                minute: "numeric",
            }
        } else {
            slotLabelFormat = eventTimeFormat = {
                hourCycle: getHourCycle(),
                hour: "numeric",
                minute: "2-digit",
                omitZeroMinute: /de|zh/.test(locale) ? false : true, // patch for 1 Uhr being displayed
                meridiem: 'narrow',
            }
        }
        
        const calendarSettings = await storage.get("calendarSettings");
        
        var minTime;
        var maxTime;
        
        try {
            minTime = (await storage.get("hideMorningHoursBefore")).parseTime().format("HH:MM:00");
            var hideNightHoursAfter = await storage.get("hideNightHoursAfter");
            if (hideNightHoursAfter == "24") {
                hideNightHoursAfter = "23:59";
            }
            maxTime = hideNightHoursAfter.parseTime().format("HH:MM:00");
        } catch (e) {
            logError("could not parse 'hide morning' hours: " + e);
        }
        
        // commented with jdom
        //docReady().then(async () => {
            if (calendarView == CalendarView.AGENDA) {
                initAgenda();
                hideLoading();
            } else {
                const views = {
                    day: {
                        dayHeaderFormat: {
                            weekday: 'long',
                            day: 'numeric',
                        },
                    },
                    week: {
                        dayHeaderFormat: {
                            weekday: 'short',
                            day: 'numeric',
                        },
                    },
                    /*
                    multiMonth: {
                        duration: { months: 1 }
                    },
                    */
                    customListWeek: {
                        type: 'list',
                        listDayFormat: {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        },
                        duration: {
                            weeks: LIST_VIEW_WEEKS
                        }
                    },
                }

                const customView = await storage.get("customView");
                if (isCustomViewInDays(customView)) {
                    views.custom = {
                        type: 'timeGridWeek',
                        duration: {
                            days: parseInt(await getValueFromCustomView())
                        },
                    }
                } else {
                    views.custom = {
                        type: 'dayGrid',
                        duration: {
                            weeks: parseInt(await storage.get("customView"))
                        }
                    }
                }
                
                const dimPastEvents = await storage.get("dimPastEvents");

                const showDayOfYear = await storage.get("showDayOfYear");

                let dayMaxEventRows = await storage.get("dayMaxEventRows");
                if (dayMaxEventRows === false || dayMaxEventRows == "false") {
                    dayMaxEventRows = false;
                } else if (!isNaN(parseInt(dayMaxEventRows))) {
                    dayMaxEventRows = parseInt(dayMaxEventRows);
                } else {
                    dayMaxEventRows = true;
                }

                const fullCalendarParams = {
                    locale: locale,
                    views: views,
                    initialView: getFCViewName(calendarView),
                    eventTimeFormat: eventTimeFormat,
                    nowIndicator: true,
                    headerToolbar: false,
                    handleWindowResize: ffPatchForResizeAndMorePopoutDisappearing ? false : true,
                    eventMinHeight: 20,
                    eventOrder: ["-allDay", "start", "-duration", function(a, b) {
                        var aCalendar = getEventCalendar(a.extendedProps.jEvent);
                        var bCalendar = getEventCalendar(b.extendedProps.jEvent);
                        if (aCalendar.primary && !bCalendar.primary) {
                            return -1;
                        } else if (!aCalendar.primary && bCalendar.primary) {
                            return +1;
                        } else {
                            let aCalendarName = getCalendarName(aCalendar);
                            let bCalendarName = getCalendarName(bCalendar);
                            if (aCalendarName == bCalendarName) {
                                return a.title.localeCompare(b.title);
                            } else {
                                if (aCalendar.id == TASKS_CALENDAR_OBJECT.id && bCalendar.id != TASKS_CALENDAR_OBJECT.id) {
                                    return -1;
                                } else if (aCalendar.id != TASKS_CALENDAR_OBJECT.id && bCalendar.id == TASKS_CALENDAR_OBJECT.id) {
                                    return +1;
                                } else if (aCalendarName) {
                                    return aCalendarName.localeCompare(bCalendarName);
                                }
                            }
                        }
                    }],
                    fixedWeekCount: await storage.get("weeksInMonth") == "auto" || (calendarView == CalendarView.CUSTOM && isCustomViewInWeeks(customView)) ? false : true,
                    height: calculateCalendarHeight(),
                    eventMaxStack: await storage.get("maxEventsToStack"),
                    dayMaxEventRows: dayMaxEventRows,
                    slotDuration: {
                        minutes: await storage.get("slotDuration")
                    },
                    defaultTimedEventDuration: {
                        minutes: await getDefaultEventLength()
                    },
                    weekends: !calendarSettings.hideWeekends,
                    selectable: true,
                    select: function(info) { // start, end, jsEvent, view
                        console.log("select", info);
                        // prevent double click
                        if (!window.recentlySelected) {
                            window.recentlySelected = new Date();
                            setTimeout(function() {
                                window.recentlySelected = null;									
                            }, 500);

                            console.log("local: ", info);
                            console.log("start date: ", info.start);

                            if (info.jsEvent.target.classList.contains("fc-daygrid-day-number")) {
                                fcChangeView(CalendarView.DAY, info.start);
                            } else {
                                // patch because fc was set exclusive end date meaning if select only today the end date is tomorrow - so let's subtract 1 day
                                if (info.allDay && (info.end.getTime() - info.start.getTime() <= ONE_DAY)) { // means: all day and one day selection only (note: on DST day itself it seems i had to use <= ONE_DAY in the case of a rolling clock back 1 hour)
                                    const event = {startTime:info.start, allDay:info.allDay};
                                    showCreateBubble({event:event, jsEvent:info.jsEvent});
                                } else {
                                    const event = {startTime:info.start, endTime:info.end, allDay:info.allDay};
                                    showCreateBubble({event:event, jsEvent:info.jsEvent});
                                }
                            }
                        }
                    },
                    editable: true,
                    scrollTime: (new Date().getHours()-1) + ':00:00',
                    slotMinTime: minTime,
                    slotMaxTime: maxTime,
                    direction: getMessage("dir"),
                    weekNumbers: await storage.get("showWeekNumbers"),
                    viewDidMount: function(info) {
                        if (info.view.type == getFCViewName(CalendarView.YEAR)) {
                            const scroller = getFCYearViewScroller();
                            if (scroller) {
                                replaceEventListeners(scroller, "scroll", function(e) {
                                    const fullCalendarScrollTop = getFCYearViewScrollTop();
                                    if (fullCalendarScrollTop < globalThis.yearViewPartTwoInitialScrollTop && globalThis.yearViewPartTwoBeforeTodayDetails) {
                                        fetchEvents(globalThis.yearViewPartTwoBeforeTodayDetails.events, globalThis.yearViewPartTwoBeforeTodayDetails.start, globalThis.yearViewPartTwoBeforeTodayDetails.end).then(async allEvents => {
                                            if (allEvents) {
                                                console.time("addEvent");
                                                const fcEvents = await convertAllEventsToFullCalendarEvents(allEvents);
                                                fullCalendar.batchRendering(() => {
                                                    fcEvents.forEach(fcEvent => {
                                                        fullCalendar.addEvent(fcEvent, FullCalendarSourceIds.MAIN);
                                                    });
                                                });
                                                console.timeEnd("addEvent");
                                            }
            
                                            if (!window.disableHideLoading) {
                                                hideLoading();
                                            }
                                        });
                                        globalThis.yearViewPartTwoBeforeTodayDetails = null;
                                    }
                                });
                            }
                        }
                    },
                    datesSet: function(info) {
                        setTimeout(() => {
                            console.log("title datesset", info)
                            let calendarTitle;

                            // v2 wanted to remove date from string so using my own format range v1 used info.view.title
                            if (["custom", "timeGridWeek", "customListWeek"].includes(info.view.type) && info.end) {
                                const formatter = new Intl.DateTimeFormat(locale, {
                                    month: 'short',
                                    year: 'numeric',
                                });

                                // because info.end is exclusive
                                const end = new Date(info.end.getTime());
                                end.setDate(end.getDate()-1);

                                calendarTitle = formatter.formatRange(info.start, end);
                            } else {
                                calendarTitle = info.view.title;
                            }

                            byId("calendarTitle").textContent = calendarTitle;

                            globalThis.fullCalendarDateRange = {
                                start: info.start,
                                end: info.end
                            }
                        }, 1);
                    },
                    dayCellDidMount: function(info) {
                        if (showDayOfYear) {
                            const a = document.createElement("a");
                            const text = document.createTextNode(info.date.getDayOfYear());
                            a.appendChild(text);
                            a.setAttribute("class", "day-of-year");

                            const top = info.el.querySelector(".fc-daygrid-day-top");
                            if (top) { // only do this for month view
                                top.classList.add("day-of-year-top");
                                top.prepend(a);
                            }
                        }
                    },
                    eventClassNames: function(info) {
                        const fcEvent = info.event;
                        const jEvent = fcEvent.extendedProps.jEvent;

                        const classNames = [];

                        if (fcEvent.extendedProps.isSnoozer) {
                            classNames.push("snoozedEvent");
                        } else if (jEvent.kind == TASKS_KIND) {
                            classNames.push("task");

                            if (jEvent.status == TaskStatus.COMPLETED) {
                                classNames.push("task-completed");
                            }
                        }

                        if (fcEvent.end?.isBefore()) {
                            if (dimPastEvents) {
                                classNames.push("pastEvent");
                            }
                        }

                        if (fcEvent.extendedProps.isDeclined) {
                            classNames.push("fcDeclinedEvent");
                        }

                        let needsAction;
                        jEvent.attendees?.some(attendee => {
                            if (attendee.email == email) {
                                if (attendee.responseStatus == AttendingResponseStatus.NEEDS_ACTION) {
                                    needsAction = true;
                                }
                                return true;
                            }
                        });
                        if (needsAction) {
                            classNames.push("needs-action");
                        }

                        return classNames;
                    },
                    eventDidMount: function(info) {
                        var calendar;
                        const fcEvent = info.event;
                        const element = info.el;
                        const jEvent = fcEvent.extendedProps.jEvent;

                        if (jEvent) {
                            calendar = getEventCalendar(jEvent);
                        }
                        
                        element.addEventListener('dblclick', function() {
                            if (isCalendarWriteable(calendar)) {
                                setTimeout(() => {
                                    byId("clickedEventDialog")?.close();
                                }, 100);
                                showCreateBubble({ event: jEvent, editing: true });
                            }
                        });

                        const eventTitleNode = element.querySelector(".fc-event-title") || element.querySelector(".fc-list-event-title");
                        
                        let title;
                        if (fcEvent.extendedProps.isSnoozer) {
                            title = `${fcEvent.title} (snoozed)`;

                            const snoozeIcon = document.createElement("span");
                            snoozeIcon.classList.add("snooze-icon");

                            if (info.view.type == getFCViewName(CalendarView.LIST_WEEK)) {
                                // ignore
                            } else {
                                // v2 enabled only for all day events because snoozed event in more hover was incorrect
                                if (fcEvent.allDay) {
                                    snoozeIcon.style.backgroundColor = fcEvent.textColor;
                                }
                            }

                            if (eventTitleNode) {
                                eventTitleNode.prepend(snoozeIcon);
                            }
                        } else if (jEvent.kind == TASKS_KIND) {
                            title = fcEvent.title;

                            if (!window.setTaskTextColor) {
                                const root = document.documentElement;
                                root.style.setProperty('--task-text-color', fcEvent.textColor);
                                window.setTaskTextColor = true;
                            }
                        } else {
                            title = fcEvent.title;
                        }
                        element.setAttribute("title", title);

                        // test for jEvent because when doing a drag & drop to creat an event in day view the jEvent does not exist.
                        if (jEvent) {
                            element.setAttribute("calendar", getCalendarName(calendar));

                            if (info.view.type === 'timeGridWeek' || info.view.type === 'timeGridDay') {
                                let $location = document.createElement('div');
                                $location.classList.add("event-location");
                                let location = jEvent?.location;
                                if (location) {
                                    if (location.startsWith("http")) {
                                        location = location.summarize(50);
                                    }
                                    $location.textContent = location;
                                }
                                eventTitleNode.append($location);
                            }

                            if (info.view.type == getFCViewName(CalendarView.DAY) && showEventIcons) {
                                const $eventIcon = document.createElement("span");
                                $eventIcon.classList.add("eventIcon");
                                if (setEventIcon({
                                        event: jEvent,
                                        $eventIcon: $eventIcon,
                                        cachedFeeds: cachedFeeds,
                                        arrayOfCalendars: arrayOfCalendars
                                    })) {
                                    element.querySelector(".fc-event-title")?.prepend($eventIcon);
                                }
                            }

                            if (window.matchFontColorWithEventColor && (info.view.type == getFCViewName(CalendarView.MONTH) || info.view.type == getFCViewName(CalendarView.YEAR) || (info.view.type == getFCViewName(CalendarView.CUSTOM) && isCustomViewInWeeks(customView)))) {
                                if (!fcEvent.allDay && (!fcEvent.end || fcEvent.start.isSameDay(fcEvent.end))) {
                                    if (jEvent) {
                                        element.style.color = darkenColor(calendar.backgroundColor);
                                        //if (jEvent.colorId && colors) {
                                            //const color = colors.event[jEvent.colorId].background;
                                            //$(element).find(".fc-time").before("<span class='eventColorIndicator' style='background-color:" + color + "'>&nbsp;</span>");
                                        //}
                                    }
                                }
                            }
                        }
                    },
                    eventClick: function(info) {
                        console.log("eventClick", info);
                        showDetailsBubble({event:info.event.extendedProps.jEvent, calEvent:info.event, jsEvent:info.jsEvent});
                        // prevents href or url from clicked which caused issue in widget - more info: http://fullcalendar.io/docs/mouse/eventClick/
                        info.jsEvent.preventDefault();
                    },
                    eventDrop: async function(info) {
                        const fcEvent = info.event;
                        const jEvent = fcEvent.extendedProps.jEvent;

                        if (jEvent.kind == TASKS_KIND && !fcEvent.allDay) {
                            niceAlert("Sorry, tasks with times are not supported by the Google Tasks API, only all-day ones.");
                            info.revert();
                        } else if (fcEvent.extendedProps.isSnoozer) {
                            // do nothing seems to work because of rereence
                            console.log("snooze dropped");
                            
                            const snoozers = await getSnoozers();
                            snoozers.some(snoozer => {
                                if (snoozer.event.id == jEvent.id) {
                                    snoozer.time = fcEvent.start;
                                    chrome.runtime.sendMessage({command:"updateSnoozer", eventId:snoozer.event.id, time:fcEvent.start.toJSON()}, function() {});
                                    return true;
                                }
                            });
                        } else {
                            const eventEntry = deepClone(jEvent);

                            if (isCtrlPressed(info.jsEvent)) {
                                // copy event
                                info.revert();
                                
                                eventEntry.quickAdd = false;
                                eventEntry.startTime = fcEvent.start; // new Date(eventEntry.startTime.getTime() + info.delta.getTime());
                                if (eventEntry.endTime) {
                                    eventEntry.endTime = fcEvent.end; // new Date(eventEntry.endTime.getTime() + info.delta.getTime());
                                }
                                
                                insertAndLoadInCalendar(eventEntry).catch(error => {
                                    // do nothing already caught inside
                                });
                            } else {
                                eventEntry.allDay = fcEvent.allDay;
                                eventEntry.startTime = fcEvent.start;
                                eventEntry.endTime = fcEvent.end;
                                
                                ensureSendNotificationDialog({ event: jEvent, action: SendNotificationsAction.EDIT }).then(response => {
                                    if (response.cancel) {
                                        info.revert();
                                    } else {
                                        showProgress();

                                        const updateEventParams = {
                                            eventEntry: eventEntry,
                                            event: jEvent
                                        };
                                        updateEventParams.eventEntry.sendNotifications = response.sendNotifications;

                                        updateEvent(updateEventParams).then(async response => {
                                            if (response.cancel) {
                                                info.revert();
                                            } else {
                                                if (eventEntry.recurringEventId) {
                                                    reloadCalendar({
                                                        source: "recurringEventDragDrop",
                                                        bypassCache: true,
                                                        refetchEvents: true
                                                    });
                                                } else if (eventEntry.kind == TASKS_KIND) {
                                                    console.log("update task event", jEvent);
                                                    await updateCachedFeed(jEvent, {
                                                        operation: "update",
                                                    });
                                                } else {
                                                    reloadCalendar({
                                                        source: "dragDrop"
                                                    });
                                                }
                                                hideProgress();
                                                await sleep(500);
                                                showToast(getMessage("eventUpdated"));
                                            }
                                        }).catch(error => {
                                            showCalendarError(error);
                                            info.revert();
                                        });
                                    }
                                });
                            }
                        }
                    },
                    eventResize: function(info) {
                        const fcEvent = info.event;
                        const jEvent = fcEvent.extendedProps.jEvent;

                        const eventEntry = {
                            allDay:		fcEvent.allDay,
                            startTime:	fcEvent.start,
                            endTime:	fcEvent.end,
                        };
                        
                        ensureSendNotificationDialog({
                            event: jEvent,
                            action: SendNotificationsAction.EDIT
                        }).then(response => {
                            if (response.cancel) {
                                info.revert();
                            } else {
                                const updateEventParams = {
                                    eventEntry: eventEntry,
                                    event: jEvent
                                };
                                updateEventParams.eventEntry.sendNotifications = response.sendNotifications;

                                updateEvent(updateEventParams).then(async response => {
                                    if (response.cancel) {
                                        info.revert();
                                    } else {
                                        reloadCalendar({ source: "eventResize" });
                                        await sleep(500);
                                        showToast(getMessage("eventUpdated"));
                                    }
                                }).catch(error => {
                                    showCalendarError(error);
                                    info.revert();
                                });
                            }
                        });
                    },
                }

                const defaultDate = await storage.get("defaultDate")
                if (calendarView == CalendarView.CUSTOM && defaultDate) {
                    fullCalendarParams.initialDate = today().addDays(defaultDate);
                }

                let firstDay;
                if (calendarView == CalendarView.LIST_WEEK) {
                    firstDay = new Date().getDay();
                } else if (calendarView == CalendarView.CUSTOM && await storage.get("firstDay") != "") { // && isCustomViewInDays(customView))
                    firstDay = new Date().addDays(await storage.get("firstDay")).getDay();
                } else {
                    firstDay = calendarSettings.weekStart;
                }

                if (firstDay != undefined) { // must check or else got an error with fullcalendar
                    fullCalendarParams.firstDay = parseInt(firstDay);
                }

                if (await storage.get("displaySecondaryTimezone")) {
                    const primaryTimezone = await getPrimaryTimezone();
                    const primaryTimezoneLabel = await storage.get("primaryTimezoneLabel");
                    const secondaryTimezone = await storage.get("secondaryTimezone");
                    const secondaryTimezoneLabel = await storage.get("secondaryTimezoneLabel");

                    const formatter = new Intl.DateTimeFormat(locale, { timeZone: secondaryTimezone, timeZoneName: 'short' });
                    const parts = formatter.formatToParts(new Date());
                    const timeZonePart = parts.find(part => part.type === 'timeZoneName');

                    fullCalendarParams.allDayContent = function(arg) {
                        if (arg.view.type == getFCViewName(CalendarView.LIST_WEEK)) {
                            return getMessage("allDayText");
                        } else {
                            return { html: `<span>${secondaryTimezoneLabel ?? timeZonePart?.value ?? "No label"}</span> <span>${primaryTimezoneLabel ?? primaryTimezone ?? "No label"}</span>` };
                        }
                    }

                    fullCalendarParams.slotLabelContent = function(arg) {
                        // v2 july 2025 using convertTimeToTimezone instead of just formatDate with timeZone param because it stopped working 
                        const secondaryDate = convertTimeToTimezone(arg.date, secondaryTimezone);
                        return {
                            html: `<span>${FullCalendar.formatDate(secondaryDate, { ...slotLabelFormat })}</span> <span>${FullCalendar.formatDate(arg.date, slotLabelFormat)}</span>`
                        };
                    }
                } else {
                    fullCalendarParams.allDayContent = getMessage("allDayText");
                    fullCalendarParams.slotLabelFormat = slotLabelFormat;
                }

                if (await storage.get("compressDayHeight")) { // ref: https://bitbucket.org/jasonsav/checker-plus-for-google-calendar/issues/550/compress-day-height-for-better-overview
                    fullCalendarParams.contentHeight = "auto";
                }

                const fullCalendarDiv = byId("betaCalendar");
                fullCalendarDiv.classList.add("loading");
                fullCalendar = new FullCalendar.Calendar(fullCalendarDiv, fullCalendarParams);
                
                fullCalendarSource = {
                    id: FullCalendarSourceIds.MAIN,
                    events: function(fetchInfo, successCallback, failureCallback) {
                        console.log("source.events", fetchInfo);

                        console.time("getEvents");
                        getEventsWrapper().then(async events => {
                            console.timeEnd("getEvents");

                            globalThis.yearViewPartTwoInitialScrollTop = getFCYearViewScrollTop();

                            let start = fetchInfo.start;
                            let end = fetchInfo.end;

                            const calendarView = await getCalendarView();
                            const firstTimeLoadingYear = calendarView == CalendarView.YEAR && !globalThis.yearViewPartTwo;
                            if (firstTimeLoadingYear) {
                                start = getStartDateBeforeThisMonth();
                                end = await getEndDateAfterThisMonth();
                            }

                            console.log("requested start/stop: " + events.length + " start: " + start + " end: " + end, fetchInfo);
                            console.log("current events: " + getStartDateBeforeThisMonth());
                            
                            fetchEvents(events, start, end).then(async allEvents => {
                                if (allEvents) {
                                    //hideLoading();
                                    
                                    if (await storage.get("showSnoozedEvents")) {
                                        console.time("showSnoozedEvents");
                                        // includes snoozes
                                        console.time("getfutureSnooze")
                                        const futureSnoozes = await getFutureSnoozes(await getSnoozers(events), {
                                            includeAlreadyShown: true,
                                            excludeToday: true,
                                            email: await storage.get("email")
                                        });
                                        console.timeEnd("getfutureSnooze")
                                        console.log("future snoozes", futureSnoozes);
                                        allEvents = allEvents.concat(futureSnoozes);
                                        console.timeEnd("showSnoozedEvents");
                                    }
            
                                    console.time("convertAllEventsToFullCalendarEvents");
                                    const fcEvents = await convertAllEventsToFullCalendarEvents(allEvents);
                                    console.log("fcEvents", fcEvents);
                                    console.timeEnd("convertAllEventsToFullCalendarEvents");
                                    
                                    successCallback(fcEvents);
                                    
                                    if (firstTimeLoadingYear) {
                                        globalThis.yearViewPartTwo = true;

                                        requestIdleCallback(() => {
                                            getEventsWrapper().then(async events => {
                                                console.timeEnd("getEvents");

                                                //const calendarView = await getCalendarView();
                                                let start = await getEndDateAfterThisMonth();
                                                let end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
                    
                                                console.log("requested start/stop: " + events.length + " start: " + start + " end: " + end, fetchInfo);

                                                fetchEvents(events, start, end).then(async allEvents => {
                                                    if (allEvents) {
                                                        console.time("addEvent");
                                                        const fcEvents = await convertAllEventsToFullCalendarEvents(allEvents);
                                                        fullCalendar.batchRendering(() => {
                                                            fcEvents.forEach(fcEvent => {
                                                                fullCalendar.addEvent(fcEvent, FullCalendarSourceIds.MAIN);
                                                            });
                                                        });
                                                        console.timeEnd("addEvent");
                                                    }

                                                    // load 2 previous months because they are visible in wider views
                                                    const todayDate = today();
                                                    start = new Date(todayDate.setMonth(todayDate.getMonth()-2));
                                                    start.setDate(1);
                                                    end = getStartDateBeforeThisMonth();
                                                    fetchEvents(events, start, end).then(async allEvents => {
                                                        if (allEvents) {
                                                            console.time("addEvent");
                                                            const fcEvents = await convertAllEventsToFullCalendarEvents(allEvents);
                                                            fullCalendar.batchRendering(() => {
                                                                fcEvents.forEach(fcEvent => {
                                                                    fullCalendar.addEvent(fcEvent, FullCalendarSourceIds.MAIN);
                                                                });
                                                            });
                                                            console.timeEnd("addEvent");
                                                        }

                                                        globalThis.yearViewPartTwoBeforeTodayDetails = {
                                                            start: new Date(start.getFullYear(), 0, 1, 0, 0, 0, 0),
                                                            end: start,
                                                            events: events
                                                        };
                                
                                                        if (!window.disableHideLoading) {
                                                            hideLoading();
                                                        }
                                                    });
                                                });
                                            });
                                        }, {
                                            timeout: 1000
                                        });
                                    }

                                    if (!window.disableHideLoading) {
                                        hideLoading();
                                    }
                                }
                            });                    
                        });
                    }
                }

                // v2 commented with jdom
                // v1 using timeouts because year view in chrome 115 was not rendering popup at until fullcalendar rendered
                //setTimeout(() => {
                    fullCalendar.render();

                    //setTimeout(() => {
                        fullCalendar.addEventSource(fullCalendarSource);
                        requestIdleCallback(() => {
                            fullCalendarDiv.classList.remove("loading");
                        }, {
                            timeout: 1000
                        })
                    //}, 1);
    
                    // click day header to go to that day's view
                    onClick(fullCalendarDiv, function(e) {
                        if (e.target.matches(".fc-timeGridWeek-view") || e.target.matches(".fc-col-header-cell.fc-day") || e.target.matches(".fc-col-header-cell-cushion")) {
                            let date = this.getAttribute("data-date");
                            if (!date) {
                                const header = e.target.closest(".fc-col-header-cell");
                                console.log("header", header);
                                if (header) {
                                    date = header.getAttribute("data-date");
                                }
                            }

                            if (date) {
                                fcChangeView(CalendarView.DAY, date);
                            }
                        }
                    });

                    addEventListeners("#betaCalendar", "mousedown", function(e) {
                        if (e.buttons == 1 && isCtrlPressed(e)) {
                            openDialog("To copy an event drag first then hold Ctrl");
                        }
                    });

                    show("#betaCalendar");

                //}, 100);
            }
        //});

        getImageBitmapFromUrl(Icons.CalendarWindowNoNumber).then(async imageBitmap => {
            if (typeof OffscreenCanvas != "undefined") {
                const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
                const context = canvas.getContext('2d');
                context.drawImage(imageBitmap, 0, 0);

                const heightOffset = 42;
                context.font = `normal 25px "arial", sans-serif`;
                context.fillStyle = '#FFF'
                context.textAlign = "center";
                const day = (new Date).getDate();
                context.fillText(day, (canvas.width / 2) - 0, heightOffset);

                try {
                    const src = await getDataUrl(canvas);
                    selector(".logo").src = src;
                } catch (error) {
                    // refer to https://jasonsavard.com/forum/discussion/6072/error-when-reading-from-canvas-is-disabled
                    console.warn("ignore canvas issue", error);
                }
            }
        }).catch(error => {
            console.warn("getImageBitmapFromUrl issue", error);
        });

        onClick(".logo-and-title", async () => {
            openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar?ref=header");
        });

        onClick("#prev", function() {
            fullCalendar.prev();
            calendarShowingCurrentDate = false;
        });

        onClick("#next", function() {
            gotoDate({next:true});
        });
        
        onClick("#calendarTitle, #calendarTitleDropdown", async () => {
            const calendarView = await getCalendarView();
            if (calendarView == CalendarView.AGENDA) {

                let miniCalendar;
                
                if (!byId("datepicker").classList.contains("hasDatepicker")) {
                    const params = await generateFullCalendarParams();
                    params.dateClick = function (dateClickInfo) {
                        const eventEntry = {};
                        eventEntry.allDay = true;
                        eventEntry.startTime = dateClickInfo.date;
                        chrome.runtime.sendMessage({command:"generateActionLink", eventEntry:eventEntry}, function(response) {
                            showCreateBubble({event:eventEntry});
                        });
                    },
                    params.datesSet = function(info) {
                        if (globalThis.agendaDataPicker_datesSet_triggered) {
                            const date = new Date(info.start.getFullYear(), info.start.getMonth() + 1, 1);
                            gotoDate({date: date});
                        }
                        globalThis.agendaDataPicker_datesSet_triggered = true;
                    }

                    miniCalendar = new FullCalendar.Calendar(byId("datepicker"), params);
                }
                
                if (isVisible("#datepickerWrapper")) {
                    document.body.classList.remove("datePickerVisible");
                    hide("#datepickerWrapper");
                } else {
                    document.body.classList.add("datePickerVisible");
                    fadeIn("#datepickerWrapper");
                    miniCalendar.gotoDate(byId("calendarTitle")._date);
                    miniCalendar.render();

                    formatMiniFullCalendar(byId("datepicker"));
                }
            } else {
                if (calendarShowingCurrentDate) {
                    openGoToDate();
                } else {
                    temporarilyDisableFetching(() => {
                        fcChangeView(calendarView);
                    });

                    fullCalendar.today();
                    calendarShowingCurrentDate = true;
                }
            }
        });

        if (!await isOnline()) {
            showError(getMessage("yourOffline"));
        }
    }

    onClick("#quick-adds", async function() {
        const $dialogContent = initTemplate("quickAddsDialogTemplate");
        byId("quick-adds-text").value = await storage.get("quickAdds") || "";

        openDialog($dialogContent).then(async response => {
            // must capture value before any async code because dialog will close
            const quickAddText = byId("quick-adds-text").value;
            if (response == "ok") {
                if (await donationClicked("QuickAddAutocomplete")) {
                    storage.set("quickAdds", quickAddText);
                }
            }
        });
        byId("quick-adds-text").focus();
    });
    
    onClick(".skins", function() {
        closeMenu(this);
        showSkinsDialog();
    });
    
    onClick(".options", function() {
        openOptions();
    });

    onClick(".contribute", function() {
        openContribute();
    });

    onClick(".help", function() {
        openHelp();
    });
    
    onClick("#goToToday", function() {
        const $today = selector(".today");
        if ($today) {
            $today.scrollIntoView();
        } else {
            gotoDate({date: today()});
        }
    });

    onClick("#showSearch", function() {
        showSearch();
    });
    
    onClick("#search", function() {
        searchEvents();
    });
    
    addEventListeners("#searchInput", "keydown", function(e) {
        // enter pressed
        if (e.key === "Enter" && !e.isComposing) {
            searchEvents();
        }
    });
    
    onClick("#search-input-back", async () => {
        htmlElement.classList.remove("searchInputVisible");
        
        if (await getCalendarView() == CalendarView.AGENDA) {
            initAgenda();
        } else {
            // patch: because a top margin would appear and create vertical scrollbars??
            fullCalendar.refetchEvents();
        }
    });

    onClick("#refresh", function() {
        showProgress();

        const params = {
            source:	"refresh",
            bypassCache: true,
            refetchEvents: true
        };

        // double click
        if (window.lastRefresh && Date.now() - window.lastRefresh.getTime() <= 800) {
            params.skipSync = true;
        }

        // must call this before any await
        window.lastRefresh = new Date();

        (async () => {
            await reloadCalendar(params);
            initVisibleCalendarsList();
    
            hideProgress();
        })();
    });

    onClick(".close", function() {
        window.close();
    });

    async function openFBPermissionDialog(eventID) {
        if (!await storage.get("respondedNoToFBPermission")) {
            docReady().then(() => {
                openDialog(getMessage("allowThisExtensionToReadYourFacebookEvent"), {
                    buttons: [
                        {
                            label: getMessage("moreInfo"),
                            onClick: function(dialog) {
                                dialog.close();
                                openUrl("https://jasonsavard.com/wiki/Adding_Facebook_events_to_Google_Calendar");
                            }
                        },
                        {
                            label: getMessage("cancel"),
                            onClick: function() {
                                storage.setDate("respondedNoToFBPermission");
                            }
                        },
                        {
                            label: getMessage("ok"),
                            primary: true,
                            onClick: async function() {
                                let url = getDetachedUrl();
                                if (eventID) {
                                    url = setUrlParam(url, "fb-event-id", eventID);
                                }
                
                                // patch: FF cannot request permission fromToolbar popup window, so must open detached popup and redo this
                                if (DetectClient.isFirefox() && fromToolbar) {
                                    url = setUrlParam(url, "open-fb-permissions", "true");
                                    openWindowInCenter(url, '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 800, 600);
                                } else {
                                    const granted = await chrome.permissions.request({
                                        origins: [Origins.FACEBOOK]
                                    });
                                    if (granted) {
                                        location.href = url;
                                    }
                                }
                            }
                        }
                    ]
                });
            });
        }
    }

    let fbEventId = getUrlValue("fb-event-id");

    if (location.href.includes("open-fb-permissions=true")) {
        openFBPermissionDialog(fbEventId);
    } else {
        if (!fbEventId) {
            const tab = await getActiveTab();
            if (tab?.url) {
                const matches = tab.url.match(/facebook\.com\/events\/(\d*)/i); 
                if (matches) {
                    fbEventId = matches[1];
                }
            }
        }

        if (fbEventId) {
            const fbEventUrl = `https://www.facebook.com/ical/event.php?eid=${fbEventId}`;
            if (DetectClient.isFirefox()) {
                if (chrome.permissions) {
                    chrome.permissions.contains({
                        origins: [Origins.FACEBOOK]
                    }, function(result) {
                        if (result) {
                            fetchAndDisplayEvent(fbEventUrl);
                        } else {
                            openFBPermissionDialog(fbEventId);
                        }
                    });
                }
            } else {
                fetchAndDisplayEvent(fbEventUrl);
            }
        }
    }
    
    onClick(".share-button", function() {
        storage.enable("followMeClicked");

        const shareMenu = byId("share-menu");

        onClickReplace("#share-menu j-icon-item", event => {
            const value = event.currentTarget.id;
            sendGA('shareMenu', value);
            
            if (value == "facebook") {
                //openUrl("https://www.facebook.com/thegreenprogrammer");
                openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://jasonsavard.com/Checker-Plus-for-Google-Calendar?ref=shareMenu")}`);
            } else if (value == "twitter") {
                //openUrl("https://twitter.com/JasonSavard");
                openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out Checker Plus for Google Calendar")}&url=${encodeURIComponent("https://jasonsavard.com/Checker-Plus-for-Google-Calendar?ref=shareMenu")}`);
            } else if (value == "linkedin") {
                //openUrl("https://www.linkedin.com/in/jasonsavard");
                openUrl(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent("https://jasonsavard.com/Checker-Plus-for-Google-Calendar?ref=shareMenu")}`);
            } else if (value == "email-subscription") {
                openUrl("https://jasonsavard.com/blog/?show-email-subscription=true");
            } else if (value == "share-by-email") {
                const params = {
                    subject: "Check out Checker Plus for Google Calendar",
                    message: "https://jasonsavard.com/Checker-Plus-for-Google-Calendar?ref=shareMenu",
                };
                const url = `mailto:?subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.message)}`;
                openUrl(url);
            } else if (value == "copy-link") {
                const url = "https://jasonsavard.com/Checker-Plus-for-Google-Calendar?ref=shareMenu";
                navigator.clipboard.writeText(url);
                showToast(getMessage("done"));
                shareMenu.hidePopover();
            }
        });
    });
    
    onClick("#quickAddGoBack", function() {
        htmlElement.classList.remove("quickAddVisible");
    });

    addEventListeners("#quickAdd", "keydown", function(e) {
        byId("quickAddWrapper").classList.add("inputEntered");

        const MINIMUM_LETTERS = 3;
        const quickAddValue = byId("quickAdd").value.toLowerCase();

        let matchedOneQuickAdd = false;
        quickAdds.forEach(quickPreselectText => {
            if (quickPreselectText && quickAddValue.startsWith(quickPreselectText.substring(0, MINIMUM_LETTERS - 1).toLowerCase())) {
                const cursorPosition = byId("quickAdd").selectionStart;
                if (quickPreselectText.toLowerCase().startsWith(quickAddValue) && quickPreselectText[cursorPosition] === e.key) {
                    byId("quickAdd").value = quickPreselectText;
                    byId("quickAdd").setSelectionRange(cursorPosition + 1, quickPreselectText.length);
                    e.preventDefault();
                }
    
                if (e.key === "Backspace") {
                    byId("quickAdd").value = byId("quickAdd").value.substring(0, cursorPosition);
                }
    
                if (e.key === "Tab" && byId("quickAdd").selectionStart != quickPreselectText.length) {
                    byId("quickAdd").setSelectionRange(quickPreselectText.length, quickPreselectText.length);
                    e.preventDefault();
                }
    
                matchedOneQuickAdd = true;
                byId("quickAdd").classList.add("preselect");
            } else if (!matchedOneQuickAdd) {
                byId("quickAdd").classList.remove("preselect");
            }
        });

        // enter pressed
        if (e.key === "Enter" && !e.isComposing) {
            if (byId("quickAdd").classList.contains("preselect")) {
                byId("quickAdd").value = byId("quickAdd").value.substring(0, byId("quickAdd").selectionStart);
            }
            saveQuickAdd();
        }
    });

    addEventListeners("#quickAdd", "paste", function() {
        byId("quickAddWrapper").classList.add("inputEntered");
    });

    addEventListeners("#quickAdd", "blur", function(e) {
        console.log("blur", e)
        const $quickAddWrapper = e.relatedTarget?.closest("#quickAddWrapper");
        if ($quickAddWrapper || byId("quickAdd").value) {
            // do nothing
        } else {
            htmlElement.classList.remove("quickAddVisible");
        }
    });

    const notificationsOpened = await storage.get("notificationsOpened");
    if (notificationsOpened.length) {
        byId("pendingNotifications").style.display = "inline-block";
    } else {

        if (await daysElapsedSinceFirstInstalled() >= UserNoticeSchedule.DAYS_BEFORE_SHOWING_FOLLOW_ME && !await storage.get("followMeClicked")) {
            let expired = false;
            const followMeShownDate = await storage.get("followMeShownDate");
            if (followMeShownDate) {
                if (followMeShownDate.diffInDays() <= -UserNoticeSchedule.DURATION_FOR_SHOWING_FOLLOW_ME) {
                    expired = true;
                }
            } else {
                storage.setDate("followMeShownDate");
            }
            if (!expired) {
                selector(".share-button")?.classList.add("swing");
            }
        }
    }
    
    onClick("#pendingNotifications", function() {
        openReminders().then(() => {
            closeWindow();
        });
    });
    
    // need polyer promise because .show() was NOT working before outer paper-toolip was initialized
    docReady().then(async () => {
        const $newsNotification = byId("newsNotification");
        const $newsNotificationReducedDonationMessage = byId("newsNotificationReducedDonationMessage");

        if (await shouldShowExtraFeature()) {
            $newsNotification.setAttribute("icon", "theme");
            onClick($newsNotification, () => {
                showSkinsDialog();
            });
            show($newsNotification);
            $newsNotificationReducedDonationMessage.textContent = getMessage("addSkinsOrThemes");
            show($newsNotificationReducedDonationMessage);
        } else if (await shouldShowReducedDonationMsg(true)) {
            onClick($newsNotification, () => {
                openUrl("contribute.html?ref=reducedDonationFromPopup");
            });
            show($newsNotification);
            Controller.getMinimumPayment().then(minPaymentObj => {
                $newsNotificationReducedDonationMessage.innerHTML = getMessage("reducedDonationAd_popup", [getMessage("extraFeatures"), formatCurrency(minPaymentObj.getOneTimeReducedPayment())]).replace(/([!?])/g, '$1<br>');
                show($newsNotificationReducedDonationMessage);
            });
        } else if (!await storage.get("tryMyOtherExtensionsClicked") && await daysElapsedSinceFirstInstalled() >= UserNoticeSchedule.DAYS_BEFORE_SHOWING_TRY_MY_OTHER_EXTENSION && await daysElapsedSinceFirstInstalled() < (UserNoticeSchedule.DAYS_BEFORE_SHOWING_TRY_MY_OTHER_EXTENSION + UserNoticeSchedule.DURATION_FOR_SHOWING_TRY_MY_OTHER_EXTENSION)) { // previous prefs: writeAboutMeClicked, tryMyOtherExtensionsClicked
            isGmailCheckerInstalled().then(installed => {
                if (!installed) {
                    show($newsNotification);
                    show("#newsNotificationGmailAdMessage");
                    onClick($newsNotification, async () => {
                        await storage.enable("tryMyOtherExtensionsClicked");
                        openUrl("https://jasonsavard.com/Checker-Plus-for-Gmail?ref=calpopup2");
                    })
                }
            });
		} else if (await storage.get("_lastBigUpdate")) {
            onClick($newsNotification, async () => {
                await storage.remove("_lastBigUpdate");
                openChangelog("bigUpdateFromPopupWindow")
            });
            show($newsNotification);
            show("#newsNotificationBigUpdateMessage");
        }
    });		
    
    onClick("#mainOptions", async () => {
        const $optionsMenu = byId("options-menu");
        
        initOptionsMenu();
        
        onClick("#viewAgenda", function() {
            changeCalendarView(CalendarView.AGENDA);
            closeMenu(this);
        });
        onClick("#viewListWeek", function() {
            changeCalendarView(CalendarView.LIST_WEEK);
            closeMenu(this);
        });
        onClick("#viewDay", function() {
            changeCalendarView(CalendarView.DAY);
            closeMenu(this);
        });
        onClick("#viewWeek", function() {
            changeCalendarView(CalendarView.WEEK);
            closeMenu(this);
        });
        onClick("#viewMonth", function() {
            changeCalendarView(CalendarView.MONTH);
            closeMenu(this);
        });
        onClick("#viewYear", function() {
            changeCalendarView(CalendarView.YEAR);
            closeMenu(this);
        });
        
        const customView = await storage.get("customView");
        if (isCustomViewInDays(customView)) {
            byId("viewXWeeksLabel").textContent = getMessage("Xdays", await getValueFromCustomView());
        } else {
            byId("viewXWeeksLabel").textContent = getMessage("Xweeks", await getValueFromCustomView());
        }

        onClick("#viewCustomSettings", function(event) {
            openUrl("options.html?highlight=customView#general");
            event.preventDefault();
            event.stopPropagation();
        });
        
        onClick("#viewCustom", function() {
            changeCalendarView(CalendarView.CUSTOM);
            closeMenu(this);
        });
                    
        onClick($optionsMenu.querySelector(".popout"), function() {
            openUrl(getDetachedUrl());
        });

        onClick($optionsMenu.querySelector(".changelog"), async function() {
            await storage.remove("_lastBigUpdate");
            openChangelog("CalendarCheckerOptionsMenu");
        });

        onClick($optionsMenu.querySelector(".discoverMyApps"), function() {
            openUrl("https://jasonsavard.com?ref=CalendarCheckerOptionsMenu");
        });

        onClick($optionsMenu.querySelector(".feedback"), function() {
            openUrl("https://jasonsavard.com/forum/t/checker-plus-for-google-calendar?ref=CalendarCheckerOptionsMenu");
        });

        onClick($optionsMenu.querySelector(".followMe"), function() {
            openUrl("https://jasonsavard.com/?followMe=true&ref=CalendarCheckerOptionsMenu");
        });

        onClick($optionsMenu.querySelector(".aboutMe"), function() {
            openUrl("https://jasonsavard.com/about?ref=CalendarCheckerOptionsMenu");
        });
    }, null, {once: true});

    onClick("#bigAddEventButton", function() {
        
        initQuickAdd();

        var elem = document.querySelector("#quickAdd");
        var player = elem.animate([
            {opacity: "0.5", transform: "scale(1.2)"},
            {opacity: "1.0", transform: "scale(1)"}
        ], {
            duration: 200
        });

    });
    
    onClick("#save-quick-add", function() {
        saveQuickAdd();
    });
    
    const detachedPopupWidth = await storage.get("detachedPopupWidth");
    const detachedPopupHeight = await storage.get("detachedPopupHeight");
    // patch must use mousedown instead of click because it seems Chrome will open window as tab instead of detached popup window
    byId("maximize").addEventListener(DetectClient.isFirefox() ? "mouseup" : "mousedown", function(e) {
        if (isCtrlPressed(e)) {
            openWindowInCenter(getDetachedUrl(), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', detachedPopupWidth, detachedPopupHeight);
            if (DetectClient.isChromium()) {
                closeWindow();
            }
        } else {
            openGoogleCalendarWebsite().then(async () => {
                if (await isSidePanelOpened()) {
                    window.close();
                }
            })
        }

        e.preventDefault();
        e.stopPropagation();
    });
    
    scrollTarget = byId('mainContent');
    scrollTarget.addEventListener("scroll", async e => {
        const target = e.target;
        console.log("scroll", target.scrollTop);
        
        // ignore this scroll event cause it was initiated automatically by scrollIntoView
        if (window.autoScrollIntoView || htmlElement.classList.contains("searchInputVisible")) {
            return;
        }
        
        if (await getCalendarView() == CalendarView.AGENDA) {
            
            //if (target.scrollTop == 0) {
                const agendaDays = Array.from(selectorAll(".agendaDay"));
                agendaDays.some((agendaDayElement) => {
                    const agendaDayRect = agendaDayElement.getBoundingClientRect();
                    const scrollAreaRect = scrollTarget.getBoundingClientRect();
                    if (agendaDayRect.bottom >= scrollAreaRect.top && agendaDayRect.top <= scrollAreaRect.bottom) {
                        //console.log("Agenda day is partially or fully visible in the scroll area.", agendaDayElement?._event.summary, agendaDayElement?._event);
                        displayAgendaHeaderDetails(agendaDayElement._event.startTime);
                        return true;
                    }
                });
            //}
            
            var BEFORE_END_Y_BUFFER = document.body.clientHeight + 200;
            
            if (!fetchingAgendaEvents) {
                console.log("scrollTop", target.scrollTop, target.scrollHeight, target.clientHeight);
                if (target.scrollTop && target.scrollTop > target.scrollHeight - BEFORE_END_Y_BUFFER && globalThis.previousScrollTop < target.scrollTop) {
                    console.log("scroll down");
                    fetchingAgendaEvents = true;
                    
                    const $agendaEvents = byId("agendaEvents");
                    
                    if ($agendaEvents._events.length) {
                        let lastEventStartDate = $agendaEvents._events.last().startTime;

                        /*
                        // v2 commented because displayed unordered dates: https://jasonsavard.com/forum/discussion/comment/29481#Comment_29481
                        // v1 this logic added because last event might have been added dynamically via a gcm update and not represent all events fetched before that
                        let lastEventStartDate;
                        if (window.scrolledBefore) {
                            lastEventStartDate = $agendaEvents._events.last().startTime;
                        } else {
                            lastEventStartDate = await getEndDateAfterThisMonth();
                        }
                        window.scrolledBefore = true;
                        */
                        
                        const start = lastEventStartDate.addDays(1);
                        const end = lastEventStartDate.addDays(31);
                        fetchAgendaEvents({start:start, end:end, append:true}).then(() => {
                            fetchingAgendaEvents = false;
                        });
                    } else {
                        fetchingAgendaEvents = false;
                    }
                } else if (target.scrollTop < BEFORE_END_Y_BUFFER && globalThis.previousScrollTop > target.scrollTop) {
                    console.log("scroll up");
                    fetchingAgendaEvents = true;
                    
                    const $agendaEvents = byId("agendaEvents");
                    
                    if ($agendaEvents._events.length) {
                        const start = $agendaEvents._events.first().startTime.addDays(-31);
                        const end = $agendaEvents._events.first().startTime;
                        console.log("first event", $agendaEvents._events.first());
                        fetchAgendaEvents({start:start, end:end, prepend:true}).then(() => {
                            fetchingAgendaEvents = false;
                        });
                    } else {
                        fetchingAgendaEvents = false;
                    }
                }
            }
        }

        globalThis.previousScrollTop = target.scrollTop;
    });

    const REPEAT_ACTION_MESSAGE = "Please repeat the action from this window";

    const autoSaveObj = await storage.get("autoSave");
	if (autoSaveObj?.event) {
		docReady().then(() => {
            showCreateBubble(autoSaveObj).then(() => {
                if (isRequestingPermission) {
                    sleep(500).then(() => {
                        niceAlert(REPEAT_ACTION_MESSAGE);
                    });
                } else {
                    showToast("Restored unsaved event!");
                }
            });
        });
    } else if (isRequestingPermission) {
        niceAlert(REPEAT_ACTION_MESSAGE);
    }

    window.onresize = function(e) {
        if (!fromToolbar) {
            console.log("onresize", calculateCalendarHeight())
            fullCalendar?.setOption('height', calculateCalendarHeight());

            storage.set("detachedPopupWidth", window.outerWidth);
            storage.set("detachedPopupHeight", window.outerHeight);
        }
    };

    // must be at end (at least after all templates have been exposed like default calendar dropdown)
    if (await storage.get("donationClicked")) {
        document.querySelectorAll("[mustDonate]").forEach(el => {
            el.removeAttribute("mustDonate");
        });
    }

}

init();