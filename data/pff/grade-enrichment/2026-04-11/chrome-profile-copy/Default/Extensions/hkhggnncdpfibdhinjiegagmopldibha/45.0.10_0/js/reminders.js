"use strict";

var inReminderWindow = true;
var windowOpenedTime = new Date();
var notifications;

var email;
let calendarMap;
var skinsSettings;

if (DetectClient.isMac()) {
    document.body.classList.add("mac");
}

/*
// patch for window not set to visible, only happens when Chrome is not in focus
if (document.visibilityState == "hidden") {
    // delay required or else it would close current Chrome window??
    setTimeout(async () => {
        const windowId = await storage.get("reminderWindowId");
        chrome.windows.update(windowId, {focused: false}, function(response) {
            chrome.windows.update(windowId, {focused: true}, function(response) {});
        });
    }, 100);
}
*/

async function closeWindow(actionPromise) {
    await storage.enable("_remindersWindowClosedByDismissingEvents");
    if (actionPromise) {
        await actionPromise;
    }
	const thisWindow = await chrome.windows.getCurrent();
    chrome.windows.remove(thisWindow.id);
}

function dismissNotification(notifications, $event, allNotificationsFlag) {
    const actionPromise = chrome.runtime.sendMessage({
        command: "closeNotifications",
        notifications: notifications
    });
    
	hideNotification($event, allNotificationsFlag, actionPromise);
}

async function snoozeAndClose(snoozeParams, allNotificationsFlag) {
    // must execute snoozenotifications in bg because window closes and stops exec
    const notifications = allNotificationsFlag ? getRemainingNotifications() : [snoozeParams.$event._notification];
    console.log("snoozeAndClose", snoozeParams, notifications);

    // remove to continue avoid serialize issue with sendMessage;
    const $event = snoozeParams.$event;
    delete snoozeParams.$event;

    const actionPromise = chrome.runtime.sendMessage({
        command: "snoozeNotifications",
        snoozeParams: snoozeParams,
        notifications: notifications
    });

	hideNotification($event, allNotificationsFlag, actionPromise);
}

function tryResizeHeightNative(deltaHeight) {
    try {
        const before = window.outerHeight;
        window.resizeBy(0, deltaHeight);
        const after = window.outerHeight;
        return Math.abs(after - before) > 0;
    } catch (error) {
        console.warn("native resizeBy failed", error);
        return false;
    }
}

function hideNotification($events, allNotificationsFlag, actionPromise) {
	if (allNotificationsFlag) {
		$events = selectorAll(".event");
	} else {
        $events = selectorAll($events);
    }
	
    const hidingAll = selectorAll(".event").length - $events.length == 0;

    if (hidingAll) {
        globalThis["fadeOut"](selectorAll(".event"), "fast");
        closeWindow(actionPromise);
    } else {
        const eventsNode = byId("events");
        const BUFFER_HEIGHT = 10; // might have a scrollbar just for a couple of pixels due to height miscalculation, and we want to still resize window and not leave an empty event slot
        const hadVerticalScrollBar = eventsNode.scrollHeight - BUFFER_HEIGHT > eventsNode.clientHeight;

        $events.forEach($event => {
            $event.classList.add('close-notification');

            globalThis["slideUp"]($event, "fast").then(() => {
                $event.remove();
                const $currentEvents = selectorAll(".event");
                const eventsCount = $currentEvents.length;
                if (eventsCount == 0) {
                    closeWindow(actionPromise);
                } else {
                    const $lastEvent = Array.from($currentEvents).last();
                    if (hadVerticalScrollBar) {
                        // has scroll bar do nothing
                    } else {
                        const resizeHeight = $lastEvent.clientHeight;
                        const deltaHeight = -(resizeHeight - 1);

                        chrome.windows.getCurrent(thisWindow => {
        
                            const windowParams = {
                                height: thisWindow.height - resizeHeight + 1
                            };
                            
                            if (DetectClient.isWindows()) {
                                // only happens laptop so commented for now???
                                /*
                                windowParams.width = thisWindow.width - 2;
                                windowParams.left = thisWindow.left + 1;
                                windowParams.top = thisWindow.top;
                                if (!window.resizedOnce && eventsCount <= 1) {
                                    windowParams.top += 1;
                                }
                                window.resizedOnce = true;
                                */
                            }
        
                            chrome.windows.update(thisWindow.id, windowParams).catch(async error => {
                                console.warn("error updating window size", error, new Date(), thisWindow, thisWindow.top, thisWindow.height, resizeHeight + 1);
                                const message = String(error?.message || error);
                                if (/invalid value for bounds/i.test(message)) {

                                    if (inLocalExtension) {
                                        showError("dev only: error updating window size, retrying after sleep: " + message);
                                    }

                                    const resizedNatively = tryResizeHeightNative(deltaHeight);

                                    /*
                                    // display metrics can settle shortly after wake
                                    await sleep(5000); // v2 2000 v1 350 but it seems it too almost 60 seconds for the onDisplayChanged event to fire in some cases after wake
                                    console.log("retrying window resize after sleep");
                                    chrome.windows.update(thisWindow.id, windowParams).catch(error => {
                                        console.warn("error2 updating window size", error, new Date(), thisWindow, thisWindow.top, thisWindow.height, resizeHeight + 1);

                                    });

                                    if (inLocalExtension) {
                                        showError("dev only: error updating window size, retrying after sleep: " + message);
                                    }
                                    */
                                }
                            });
                        });
                    }
                }
                
                const notifications = [];
                $currentEvents.forEach(eventNode => {
                    const notification = eventNode._notification;
                    if (notification) {
                        notifications.push(notification);
                    }
                });
                storage.get("displayEventTitlesInReminderWindowTitle").then(displayEventTitlesInReminderWindowTitle => {
                    if (displayEventTitlesInReminderWindowTitle) {
                        generateWindowTitle(notifications);
                    }
                });
            });
        });
    }
}

function get$Event(o) {
	return o.closest(".event");
}

function get$EventById(id) {
	return Array.from(selectorAll(".event")).find($event => $event._notification.event.id == id);
}

async function updateTimeElapsed() {
    const defaultEventNotificationTime = await getDefaultEventNotificationTime();

	selectorAll(".event").forEach(async $event => {
		const notification = $event._notification;
		const timeElapsedMsg = await getTimeElapsed(notification.event);
		
		const $timeElapsed = $event.querySelector(".timeElapsed");
		if (timeElapsedMsg) {
            let titleStr;
            if (notification.event.allDay) {
                titleStr = notification.event.startTime.toLocaleDateStringJ();
            } else {
                if (isToday(notification.event.startTime)) {
                    titleStr = notification.event.startTime.toLocaleTimeStringJ(true);
                } else {
                    titleStr = notification.event.startTime.toLocaleStringJ(true);
                }
            }

            titleStr += `\n\n${getMessage("notifications")}:`;

            try {
                const response = generateReminderTimes(notification.event, defaultEventNotificationTime);
                response.reminderTimes.forEach(reminderTime => {
                    titleStr += `\n${reminderTime}`;
                });
            } catch (error) {
                console.error(error);
                const cf = await storage.get("cachedFeeds");
                console.error("cachedfeeds", cf);
                console.error("calendarlist", cf?.["calendarList"]);
                console.error("event", notification.event);
                //customShowError(`Report this issue to the developer @ https://jasonsavard.com/forum cachedfeeds ${cf} list: ${cf?.["calendarList"]} ${error}`);
                titleStr += `\n${error}`;
            }

            $timeElapsed.title = titleStr;
            $timeElapsed.textContent = timeElapsedMsg;
		} else {
            $timeElapsed.textContent = "";
        }

        [-480, -240, -120, -60, -30, -15, -10, -5, -2, -1, 0].forEach(num => {
            if (notification.event.startTime.diffInMinutes() <= Math.abs(num)) {
                hide($event.querySelector(`[snoozeInMinutes='${num}']`));
            }
        });

        const hideDelete = await getHideDeleteFlag();

        // dynamic if far away then hide some small snooze times https://jasonsavard.com/forum/discussion/comment/33568#Comment_33568
        let snoozeBeforeCount = 0;
        $event.querySelectorAll(".snoozeBefore").forEach($snoozeBefore => {
            if (isVisible($snoozeBefore)) {
                snoozeBeforeCount++;
            }
        });

        let maxSnoozeBeforeCount = hideDelete ? 10 : 9;

        if (snoozeBeforeCount > maxSnoozeBeforeCount) {
            hide($event.querySelector(`[snoozeInMinutes='-10']`));
            snoozeBeforeCount--;
        }

        if (snoozeBeforeCount > maxSnoozeBeforeCount) {
            hide($event.querySelector(`[snoozeInMinutes='-2']`));
            snoozeBeforeCount--;
        }

        $event.classList.toggle("no-snooze-before", $event.querySelector(".snooze-before-wrapper").clientHeight == 0);
    });
}

function dismissFirstEvent() {
	selector("#events .dismiss")?.click();
}

document.addEventListener("keydown", function(e) {
    console.log("keydown", e);
    storage.get("disableKeys").then(disableKeys => {
        if (!disableKeys) {
            if (e.key === "Escape") {
                storage.get("reminderWindowId").then(reminderWindowId => {
                    if (reminderWindowId) {
                        chrome.windows.update(reminderWindowId, {state:"minimized"});
                    }
                })
            } else if (e.key === "d") {
                // add buffer to avoid accidental typing dismisals
                const DELAY_IN_MILLIS = 1000;
                if (windowOpenedTime.diffInMillis() < -DELAY_IN_MILLIS) {
                    dismissFirstEvent();
                }
            }
        }
    });
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState == "visible") {
        sendMessageToBG("forgottenReminder.start");
    }
}, false);

window.addEventListener("blur", () => {
	if (selectorAll("#events .event").length == 1 && isVisible("#header")) {
		const headerHeight = byId("header").clientHeight;
		hide("#header");
        byId("events").style.height = `100%`;
		window.resizeBy(0, -(headerHeight));
	}
});

if (chrome.system?.display?.onDisplayChanged) {
    chrome.system.display.onDisplayChanged.addListener(async () => {
        let thisWindow = await chrome.windows.getCurrent();

        console.log("onDisplayChanged: " + thisWindow?.state, devicePixelRatio, new Date(), thisWindow);
        if (thisWindow.state == "normal") {
            clearTimeout(globalThis.lastDisplayChangedTimeout);
            globalThis.lastDisplayChangedTimeout = setTimeout(async () => {
                thisWindow = await chrome.windows.getCurrent();
                if (thisWindow.state == "normal") {
                    const reminderWindowParams = await getReminderWindowParams({previousReminderWindow: thisWindow});
                    try {
                        await chrome.windows.update(thisWindow.id, {
                            width: reminderWindowParams.width,
                            height: reminderWindowParams.height
                        });
                    } catch (error) {
                        console.warn("error updating window size", error, new Date(), thisWindow);
                    }
                }
            }, seconds(4));
        }
    })
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    (async function() {
        if (message.action == "dismissAll") {
            byId("dismissAll").click();
        } else if (message.action == "removeNotificationsFromReminderWindow") {
            // remove any deleted events
            message.notifications.forEach(notification => {
                parseEventDates(notification.event);
                const $event = get$EventById(notification.event.id);
                if ($event) {
                    hideNotification($event);
                }
            });
        } else if (message.action == "reloadReminders") {
            location.reload();
        }
    })();
});

function getRemainingNotifications() {
	return Array.from(selectorAll(".event")).map(el => el._notification);
}

async function resizeToMinimumHeight(height) {
	const thisWindow = await chrome.windows.getCurrent();
    if (thisWindow.state == "normal") {
        if (height > thisWindow.height) {
            globalThis.lastWindowResizeBeforeMinimumHeight = {
                window: thisWindow,
                devicePixelRatio: devicePixelRatio,
            };
            chrome.windows.update(thisWindow.id, {height:height});
        }
    }
}

function generateWindowTitle(notifications) {
    const titles = notifications.map(notification => getSummary(notification.event));
    
    if ("Intl" in window && Intl.ListFormat) {
        const formatter = new Intl.ListFormat(locale, { style: 'short', type: 'unit' });
        document.title = formatter.format(titles);
    } else {
        document.title = titles.join(", ");
    }
}

function setDefaultSnoozeTime($snooze, snoozeValue) {
    let timePeriodSymbol;
    let title;
    let snoozeValueToDisplay;

    if (snoozeValue) {
        if (String(snoozeValue).includes("d")) {
            snoozeValue = String(snoozeValue).replace("d", "");
            snoozeValueToDisplay = snoozeValue;
            timePeriodSymbol = TimePeriodSymbol.DAY;
            title = getMessage(snoozeValue == 1 ? "Xday" : "Xdays", snoozeValue);
        } else if (snoozeValue < 60) {
            snoozeValueToDisplay = snoozeValue;
            timePeriodSymbol = TimePeriodSymbol.MINUTE;
            title = getMessage(snoozeValue == 1 || snoozeValue == -1 ? "Xminute" : "Xminutes", snoozeValue);
        } else {
            snoozeValueToDisplay = snoozeValue / 60;
            timePeriodSymbol = TimePeriodSymbol.HOUR;
            title = getMessage(snoozeValueToDisplay == 1 ? "Xhour" : "Xhours", snoozeValueToDisplay);
        }
    }

    //const $snoozeText = $snooze.querySelector(".text");
    $snooze._defaultSnoozeTime = snoozeValue;
    $snooze._defaultSnoozeTimePeriod = timePeriodSymbol;
    if (snoozeValue) {
        $snooze.classList.add("has-text");
        $snooze.title = `${getMessage("snooze")} ${title}`;
        $snooze.removeAttribute("icon");
        //$snooze.removeAttribute("icon-only");
        //$snoozeText.textContent = snoozeValueToDisplay + getMessage(timePeriodSymbol);
        $snooze.textContent = snoozeValueToDisplay + getMessage(timePeriodSymbol);
    } else {
        $snooze.classList.remove("has-text");
        $snooze.title = "";
        $snooze.setAttribute("icon", "snooze");
        //$snooze.setAttribute("icon-only", "");
        //$snoozeText.textContent = "";
        $snooze.textContent = "";
    }
}

(async () => {

    await storage.initStorageCache();
    
    await initUI();

    email = await storage.get("email");
    calendarMap = await initCalendarMap();

    // patch: reload window because sometimes polymer code would not load and the buttons were not showing - refer to May 16th emails from mecouture
    /*
    let POLYMER_PATCH_URL_PARAM = "reloadedForPolymerPatch";
    if (!location.href.includes(POLYMER_PATCH_URL_PARAM)) {
        polymerPromise.then(() => {
            Array.from(selectorAll("paper-icon-button")).some(el => {
                if (isVisible(el)) {
                    // issue identified by visible button having no width
                    if (el.clientWidth == 0) {
                        setTimeout(() => {
                            location.href = setUrlParam(location.href, POLYMER_PATCH_URL_PARAM, "true");
                        }, 500);
                        sendGA('reminders', "reloadedForPolymerPatch");
                    }
                    return true;
                }
            });
        });
    }
    */
    
    document.body.classList.toggle("hideDelete", await getHideDeleteFlag());

    skinsSettings = await storage.get("skins");
    skinsSettings.forEach(skin => {
        addSkin(skin);
    });
    addSkin(await storage.get("customSkin"));
    
    notifications = await storage.get("_reminderWindowNotifications");

    for (let a=0; a<notifications.length; a++) {
        if (!notifications[a].event.startTime) {
            customShowError(`Event does not have a start time: ${notifications[a].event.title} .. ${notifications[a].event.summary} .. ${notifications[a].event.start}`);
            console.error("Event does not have a start time", notifications[a]);
            notifications.splice(a, 1);
            a--;
        }
    }
    
    if (await shouldShowReducedDonationMsg(true)) {
        const $newsNotificationReducedDonationMessage = byId("newsNotificationReducedDonationMessage");
        Controller.getMinimumPayment().then(minPaymentObj => {
            $newsNotificationReducedDonationMessage.innerHTML = getMessage("reducedDonationAd_popup", [getMessage("extraFeatures"), formatCurrency(minPaymentObj.onetime_payment_reduced)]);
            show($newsNotificationReducedDonationMessage);
        });
        show("#newsNotification");
        onClick("#newsNotification", function() {
            openUrl("contribute.html?ref=reducedDonationFromReminders");
        });
    }
    
    if (await hasRemindersHeader(notifications)) {
        // commented because it "sometimes" wouldn't show??? so using class instead
        //$("#header").show();
        if (notifications.length <= 1) {
            hide("#headerButtons");
        }
        
        byId("header").classList.add("visible");
    }
    
    sortNotifications(notifications);
    
    const HEADER_SELECTOR = "#header";
    const EVENT_SELECTOR = ".event";

    function getClosestSnoozeWrapper(el) {
        return el.closest(EVENT_SELECTOR) ?? el.closest(HEADER_SELECTOR);
    }

    onDelegate(document.body, "click", ".snooze", function(event) {
        const el = event.target.closest(".snooze");
        const defaultSnoozeTime = el._defaultSnoozeTime;
        if (defaultSnoozeTime) {
            let attribute;
            if (el._defaultSnoozeTimePeriod == TimePeriodSymbol.DAY) {
                attribute = "snoozeInDays";
            } else {
                attribute = "snoozeInMinutes";
            }
            const button = getClosestSnoozeWrapper(el).querySelector(`j-button[${attribute}='${defaultSnoozeTime}']`);
            if (button) {
                button.click();
            } else {
                customShowError("Snooze time does not have a corresponding button");
            }
        }
    });

    document.body.addEventListener("mouseenter", async function(event) {
        //console.log("mouseenter", event.target);
        if (event.target.matches(".snooze")) {
            const $snooze = event.target.closest(".snooze");
            //getClosestSnoozeWrapper($snooze).classList.add("snoozeButtonsVisible");
            getClosestSnoozeWrapper($snooze).querySelector(".snoozeButtonsWrapper").showPopover({
                source: $snooze
            });
    
            const notification = $snooze.closest(".event")?._notification;
            const defaultSnoozeBeforeTime = await storage.get("defaultSnoozeBeforeTime");
            const defaultSnoozeTime = await storage.get("defaultSnoozeTime");
    
            if (notification) {
                const diffInMinutes = new Date().diffInMinutes(notification.event.startTime);
                
                // event has passed
                if (diffInMinutes > 0) {
                    setDefaultSnoozeTime($snooze, defaultSnoozeTime);
                } else { // event is coming up
                    if (!notification.event.allDay && diffInMinutes <= defaultSnoozeBeforeTime) {
                        setDefaultSnoozeTime($snooze, defaultSnoozeBeforeTime);
                    } else {
                        setDefaultSnoozeTime($snooze, defaultSnoozeTime);
                    }
                }
            } else {
                // possibly snooze all
                setDefaultSnoozeTime($snooze, defaultSnoozeTime);
            }
        } else if (event.target.matches(".dismiss") || event.target.matches(".delete")) {
            getClosestSnoozeWrapper(event.target).querySelector(".snoozeButtonsWrapper").hidePopover();
        }
    }, true);

    document.body.addEventListener("mouseleave", async function(event) {
        console.log("mouseleave", event)

        function resetSnoozeButton($snooze) {
            $snooze.setAttribute("icon", "snooze");
            $snooze.textContent = "";
        }

        // when mouse moves outside of window then reset and snooze default hovers
        if (event.relatedTarget === null) {
            console.log("mouse outside window");
            selectorAll(".snooze").forEach($wrapper => {
                resetSnoozeButton($wrapper);
            });

            selectorAll(".snoozeButtonsWrapper:popover-open").forEach(snoozeButtons => snoozeButtons.hidePopover());
        } else if (event.target.matches(".snooze")) {
            resetSnoozeButton(event.target);
        } else if (event.target.matches(".snoozeButtons") || event.target.matches(HEADER_SELECTOR) || event.target.matches(EVENT_SELECTOR)) {
            getClosestSnoozeWrapper(event.target).querySelector(".snoozeButtonsWrapper").hidePopover();
        }
    }, true);

    onClick("#settings", function() {
        openUrl(chrome.runtime.getURL("options.html#notifications"), {urlToFind:chrome.runtime.getURL("options.html")});
    });
    
    console.log("before custom-icons")
    //insertScript("js/custom-icons.js", "custom-icons").then(async () => {
        console.log("after custom-icons")
        const $events = byId("events");
        
        if (window.innerHeight != 0 && await hasRemindersHeader(notifications)) {
            /*
            let height = Math.min(ReminderWindow.MAX_NOTIFICATIONS, notifications.length) * ReminderWindow.NOTIFICATION_HEIGHT;
            height /= globalThis.devicePixelRatio;
            $events.style.height = `${height}px`;
            */
            //$events.style.height = `91vh`; // vh is better because it works with reminder window resizing
            $events.style.height = `calc(100vh - ${byId("header").clientHeight}px)`;
        }
        
        // ff patch for empty paper-icon-button: seems when had 3+ test events and calling .clone() on eventTemplate below it was creating the issue - so added a 1ms timeout
        await sleep(1);

        const cachedFeeds = await storage.get("cachedFeeds");
        const arrayOfCalendars = await getArrayOfCalendars();
        const showEventIcons = await storage.get("showEventIcons");
        const displayEventTitlesInReminderWindowTitle = await storage.get("displayEventTitlesInReminderWindowTitle");

        let documentTitleSet = false;
        for (const notificationOpened of notifications) {
            
            const event = notificationOpened.event;
            
            const $event = selector(".eventTemplate").cloneNode(true);
            $event.classList.remove("eventTemplate");
            $event.classList.add("event");
            $event._notification = notificationOpened;
            initMessages($event.querySelectorAll("*"));

            if (showEventIcons) {
                setEventIcon({
                    event: event,
                    $eventIcon: $event.querySelector(".eventIcon"),
                    cachedFeeds: cachedFeeds,
                    arrayOfCalendars: arrayOfCalendars
                });
            }
            
            const eventNotificationDetails = await getEventNotificationDetails(event, {ignoreDuration: true});
            const summary = eventNotificationDetails.title;

            if (notifications.length == 1 && eventNotificationDetails.calendarName && displayEventTitlesInReminderWindowTitle) {
                document.title = `${summary} (${eventNotificationDetails.calendarName})`;
                documentTitleSet = true;
            }
            
            let eventHoverTitle = summary;
            if (event.description) {
                eventHoverTitle += `\n\n${await htmlToText(event.description)}`;
            }
            
            const eventColor = getEventColors({
                event: event,
                darkenColorFlag: true,
                cachedFeeds: cachedFeeds,
                arrayOfCalendars: arrayOfCalendars
            });

            const $title = $event.querySelector(".title");
            $title.style.color = eventColor;
            $title.title = eventHoverTitle;
            $title.textContent = summary;
            onClick($title, function(e) {
                console.log("event", e);
                if (isCtrlPressed(e) || event.button == 1) {
                    chrome.tabs.create({url:getEventUrl(event), active:false});
                } else {
                    openEventUrl(event);
                }
                sendGA('reminders', "title");
            });
            
            const $calendarName = $event.querySelector(".calendar-name");
            if (eventNotificationDetails.calendarName) {
                $calendarName.style.color = eventColor;
                $calendarName.textContent = `(${eventNotificationDetails.calendarName})`;
                show($calendarName);
            } else {
                hide($calendarName);
            }


            let title;
            let sourceUrl;
            
            // location
            const $locationWrapper = $event.querySelector(".locationWrapper");
            let locationVisible = true;

            if (usefulLocation(event)) {
                if (isMeetingLink(event.location)) {
                    hide($locationWrapper);
                    locationVisible = false;
                } else {
                    title = stripUrlPrefix(event.location);
                    const locationUrl = generateLocationUrl(event);
                    if (sourceUrl == locationUrl) {
                        hide($locationWrapper);
                        locationVisible = false;
                    } else {
                        const $link = $locationWrapper.querySelector(".link");
                        $link.href = locationUrl;
                        $link.title = locationUrl;
                        $link.textContent = title;
                    }
                }
            } else {
                hide($locationWrapper);
                locationVisible = false;
            }

            let videoVisible = true;

            const videoMeetingDetails = await getVideoMeetingDetails(event, true);

            // video
            const $videoWrapper = $event.querySelector(".videoWrapper");

            if (videoMeetingDetails) {
                if (event.conferenceData?.conferenceSolution) {
                    const $linkImage = $videoWrapper.querySelector(".linkImage");
                    $linkImage.removeAttribute("icon");
                    $linkImage.setAttribute("src", event.conferenceData.conferenceSolution.iconUri);
                }

                console.log("$videoWrapper", $videoWrapper)
                const videoLink = $videoWrapper.querySelector(".link");
                videoLink.href = videoMeetingDetails.videoUrl;
                videoLink.textContent = videoMeetingDetails.label;
                onClick(videoLink, async () => {
                    sendGA("meeting", "click-in-reminders", new URL(videoLink.href).hostname);

                    if (await storage.get("dismissEventAfterClickingJoinVideo")) {
                        dismissNotification([notificationOpened], $event);
                    }
                });
            } else {
                videoVisible = false;
                hide($videoWrapper);
            }


            // must place this after detecting video detection, because if video than don't show any other links: ref: https://jasonsavard.com/forum/discussion/comment/36524#Comment_36524
            let eventSource = getEventSource(event, !videoVisible);
            let $sourceWrapper = $event.querySelector(".sourceWrapper");
            let sourceVisible = true;
            title = "";

            // if same then just use location further below in code
            if (eventSource && eventSource.url != event.location) {
                // if event source has same title as event then let's use the link url instead
                if (summary == eventSource.title) {
                    title = eventSource.url;
                } else {
                    title = eventSource.title;
                }
                sourceUrl = eventSource.url;
                
                if (event.extendedProperties?.private?.favIconUrl) {
                    const $linkImage = $sourceWrapper.querySelector(".linkImage");
                    $linkImage.removeAttribute("icon");
                    $linkImage.setAttribute("src", event.extendedProperties.private.favIconUrl);
                } else {
                    hide($sourceWrapper.querySelector(".linkImageWrapper"));
                }
            }
            
            // source
            if (eventSource && title) {
                const $link = $sourceWrapper.querySelector(".link");
                $link.href = sourceUrl;
                $link.title = sourceUrl;
                $link.textContent = stripUrlPrefix(title);
            } else {
                hide($sourceWrapper);
                sourceVisible = false;
            }

            // init snooze buttons
            if (event.allDay) {
                hide($event.querySelectorAll(".snoozeBefore"));
            }
            
            if (event.recurringEventId) {
                $event.classList.add("repeatingEvent");
                const $repeating = $event.querySelector(".repeating");
                onClick($repeating, function() {
                    niceAlert("This is a recurring event");
                });
                $repeating.removeAttribute("hidden");
            }
            
            onClick($event.querySelector(".delete"), async e => {
                sendGA('reminders', "delete");
                if (event.test) {
                    // do nothing - just dismiss
                    dismissNotification([notificationOpened], $event);
                } else {
                    if (event.recurringEventId) {

                        const recurringEvent = await oauthDeviceSend({
                            userEmail: email,
                            url: `/calendars/${encodeURIComponent(await getCalendarIdForAPIUrl(event))}/events/${event.recurringEventId}`
                        });

                        // call this from synchonously and from library because we need to show prompt about "only this event or all"
                        resizeToMinimumHeight(370);
                        const response = await deleteEvent(event, false, recurringEvent);
                        globalThis.hideProgress?.();
                        if (response.cancel) {
                            return;
                        }
                    } else {
                        sendMessageToBG("deleteEvent", event);
                    }
                    dismissNotification([notificationOpened], $event);
                }
            });
            
            onClick($event.querySelector(".dismiss"), function(e) {
                sendGA('reminders', "dismiss", "individual", 1);

                dismissNotification([notificationOpened], $event);
            });
            
            $events.append($event);
            $event.removeAttribute("hidden");

            const MINIMUM_TITLE_HEIGHT_WHEN_SPANNING_2_LINES = 50;

            setTimeout(() => {
                const $titleWrapper = $event.querySelector(".titleWrapper");
                // too much, so remove one item, refer: https://bitbucket.org/jasonsav/checker-plus-for-google-calendar/issues/156/better-reminders-spacing
                if ($titleWrapper.offsetHeight > MINIMUM_TITLE_HEIGHT_WHEN_SPANNING_2_LINES && sourceVisible && locationVisible) {
                    sourceVisible = false;
                    hide($sourceWrapper);
                }
                
                if ($titleWrapper.offsetHeight > MINIMUM_TITLE_HEIGHT_WHEN_SPANNING_2_LINES && locationVisible && videoVisible) {
                    hide($calendarName);
                }
            }, 1)

            // use this to progressively load the events
            await new Promise((resolve, reject) => {
                requestIdleCallback(resolve, {
                    timeout: 100
                });
            });
        }

        if (!documentTitleSet && displayEventTitlesInReminderWindowTitle) {
            generateWindowTitle(notifications);
        }

        updateTimeElapsed();

        setInterval(() => {
            updateTimeElapsed();
        }, minutes(1));

        selectorAll("j-button[snoozeInDays]").forEach(async el => {
            const snoozeInDays = el.getAttribute("snoozeInDays");
            const snoozeDate = new Date().addDays(snoozeInDays);
            let tooltipStr;
            if (snoozeInDays == "7") {
                tooltipStr = snoozeDate.toLocaleDateStringJ();
            } else {
                tooltipStr = snoozeDate.toLocaleDateString(locale, {
                    weekday: 'long'
                });
            }

            const $tooltip = el.nextElementSibling?.matches?.('j-tooltip') ? el.nextElementSibling : null;
            if ($tooltip) {
                if (await storage.get("donationClicked")) {
                    $tooltip.textContent = tooltipStr;
                } else {
                    el.classList.add("mustDonate");
                    $tooltip.textContent = getMessage("donationRequired");
                }
            }
        });

        if (!await storage.get("donationClicked")) {
            selectorAll(".more").forEach(el => {
                el.classList.add("mustDonate");
                el.title = getMessage("donationRequired");
            });
        }

        onClick("j-button[snoozeInMinutes], j-button[snoozeInDays]", async function(event) {
            let $event;
            const snoozeAllFlag = this.closest("#header");
            if (!snoozeAllFlag) {
                $event = get$Event(this);
            }
            const snoozeParams = {
                $event: $event,
                inMinutes: this.getAttribute("snoozeInMinutes"),
                inDays: this.getAttribute("snoozeInDays")
            };

            if (snoozeParams.inDays && !await storage.get("donationClicked")) {
                openContributeDialog("snooze");
            } else {
                event.target.closest("[popover]").hidePopover();
                await snoozeAndClose(snoozeParams, snoozeAllFlag);
                if (snoozeParams.inMinutes) {
                    sendGA('reminders', "snooze", `minutes_${snoozeParams.inMinutes}`, 1);
                } else {
                    sendGA('reminders', "snooze", `days_${snoozeParams.inDays}`, 1);
                }
            }
        });

        onClick(".more", async function(event) {
            if (await storage.get("donationClicked")) {
                event.target.closest("[popover]").hidePopover();

                const dialogContent = initTemplate("date-time-snooze-dialog-template");
                openDialog(dialogContent, {
                    id: "dateTimeSnoozeDialog",
                    cancel: true,
                    noAutoFocus: true,
                    buttons: [
                        {
                            id: "date-time-snooze-ok-button",
                            label: getMessage("snooze"),
                            primary: true,
                            onClick: async (dialog) => {
                                if (await donationClicked("snoozeDateTime")) {

                                    if (!byId("dateSnooze").value.trim() && !byId("timeSnooze").value.trim()) {
                                        niceAlert("Must enter either a date and/or time!");
                                        return;
                                    }

                                    const snoozeParams = {
                                        $event: globalThis.dateTimeSnoozeEvent
                                    };

                                    const snoozeTime = dateSnoozePicker.dateTime ?? today();

                                    if (byId("timeSnooze").value.trim()) {
                                        let time;

                                        // see if ie. 24min was entered
                                        const eventEntry = await getEventEntryFromQuickAddText(byId("timeSnooze").value);
                                        if (eventEntry.startTime) {
                                            time = eventEntry.startTime;
                                        } else { // else get time from dropdown
                                            time = snoozeTimePicker.dateTime;
                                        }
                                        snoozeTime.setHours(time.getHours());
                                        snoozeTime.setMinutes(time.getMinutes());
                                        snoozeTime.setSeconds(0, 0);
                                        
                                        snoozeParams.snoozeTime = snoozeTime;
                                    } else {
                                        resetTime(snoozeTime);
                                        snoozeParams.inDays = snoozeTime.diffInDaysForHumans();
                                    }

                                    await snoozeAndClose(snoozeParams);

                                    sendGA('reminders', "more");
                                }

                                dialog.close();
                            }
                        }
                    ],
                    onClose: () => {
                        if (globalThis.lastWindowResizeBeforeMinimumHeight) {
                            chrome.windows.update(globalThis.lastWindowResizeBeforeMinimumHeight.window.id, {
                                height: globalThis.lastWindowResizeBeforeMinimumHeight.window.height,
                                width: globalThis.lastWindowResizeBeforeMinimumHeight.window.width
                            });
                        }
                    }
                });

                if (!globalThis.dateSnoozePicker) {
                    await insertScript("fullcalendar/index.global.js");
                    insertStylesheet("css/datepicker.css");
                }

                globalThis.dateSnoozePicker = new DatePicker(byId("dateSnooze"), {
                    fullCalendarParams: await generateFullCalendarParams(),
                    changeDate: function() {
                        if (!this.dateTime.isToday()) {
                            globalThis.snoozeTimePicker = new TimePicker(byId("timeSnooze"), {
                                defaultHour: DEFAULT_HOUR_FOR_TIMED_EVENT,
                            });
                        }
                    }                
                });

                let timePickerOptions;
                if (!globalThis.dateSnoozePicker.dateTime.isToday()) {
                    timePickerOptions = {
                        defaultHour: DEFAULT_HOUR_FOR_TIMED_EVENT,
                    }
                }
                globalThis.snoozeTimePicker = new TimePicker(byId("timeSnooze"), timePickerOptions);

                addEventListeners('#timeSnooze', "keydown", function(e) {
                    console.log("timesnooze", e)
                    if (e.key == "Enter") {
                        console.log("enter");
                        byId("date-time-snooze-ok-button").click();
                    }
                });

                const $event = get$Event(this);
                resizeToMinimumHeight(370);

                globalThis.dateTimeSnoozeEvent = $event;
            } else {
                openContributeDialog("snoozeMore");
            }
        });

        onClick("#dismissAll", function() {
            const notifications = getRemainingNotifications();

            // cpu intensive so let's delay the execution til after we close the window
            const actionPromise = chrome.runtime.sendMessage({
                command: "closeNotificationsDelayed",
                notifications: notifications
            });

            sendGA('reminders', "dismiss", "dismissAll");
            closeWindow(actionPromise);
        });

        if (getUrlValue("closeWindowGuide")) {
            const $dialog = initTemplate("closeWindowDialogTemplate");
            openDialog($dialog);
        }

        console.log("remove cache")
        storage.clearCache();
    //});

    if (DetectClient.isMac() && window.outerHeight == screen.availHeight && await storage.firstTime("macFullScreen") && await storage.get("notificationWindowSize") != "maximized") {
        niceAlert("Make this reminder window smaller by turning off Full Screen mode for Chrome");
    }
})();