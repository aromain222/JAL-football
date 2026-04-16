// Copyright Jason Savard
"use strict";

try {
    if (!globalThis.commonJSLoaded) {
        importScripts(
            "common.js",
            "checkerPlusForCalendar.js",
        );
    }
} catch (error) {
    console.error("error in sw:" + error);
}

var inBackground = true;

// Clear this info
var events = [];

var notificationWindow; // handler for single window like text or html
var notificationsOpened = []; // notifications wrapper objects for each event that is displayed in a notification (not necessarily notification handlers - because of grouped notifications option)
var notificationsQueue = [];
var eventsShown = [];

var webNotification;

var lastBadgeIcon;
var lastNotificationAudioSource;
var forgottenReminderAnimation;
var eventsIgnoredDueToCalendarReminderChangeByUser;
var calendarMap;

var detectSleepMode = new DetectSleepMode();

var IDLE_DETECTION_INTERVAL = 120; // in seconds
var notificationsOpenedCountWhenIdle;

function formatTimeForBadge(date, hideColonInTime) {
    var formattedTime = date.toLocaleTimeStringJ(true);
    // remove any spaces ie. 12 am > 12am
    formattedTime = formattedTime.replace(/ /g, NNBSP);
	if (formattedTime.length >= 6) {
        formattedTime = formattedTime.replace(/am$/, "").replace(/pm$/, "");
    } else if (formattedTime.length >= 5) {
        formattedTime = formattedTime.replace(/am$/, "a").replace(/pm$/, "p");
    }

	if (hideColonInTime) {
		if (formattedTime.length >= 5) {
			formattedTime = formattedTime.replace(":", "");
		}
    }

    if (formattedTime.length >= 6) {
        formattedTime = formattedTime.replaceAll(" ", "");
    }
    
    if (formattedTime.length >= 6) {
        const formatter = new Intl.DateTimeFormat(locale, {
            hour: "numeric",
            minute: "numeric",
            hourCycle: getHourCycle()
        });
        const parts = formatter.formatToParts(date);

        try {
            parts.forEach((part, index) => {
                if (part.type == "hour") {
                    const hour = part.value;
                    const separator = parts[index+1].value.trim();
                    const minute = parts[index+2].value;
                    formattedTime = `${hour}${separator}${minute}`;
                }
            });
            //console.log("from parts", formattedTime);
        } catch (error) {
            console.warn("could not parse time: ", error);
        }
    }

	return formattedTime.trim();
}

function setOmniboxSuggestion(text, suggest) {
	//var tom = /^tom:/.test(text);
	// must be same regex as other references...
	var tom = new RegExp("^" + getMessage("tom") + ":").test(text);
	var plainText = text?.length && !tom;
	var desc = "<match><url>cal</url></match> ";
	desc += plainText ? ('<match>' + text + '</match>') : getMessage("omniboxDefault");
	desc += "<dim> " + getMessage("or") + " </dim>";
	desc += tom ? ('<match>' + text + '</match>') : getMessage("tom") + ":" + getMessage("omniboxDefaultTom");
	if (chrome.omnibox) {
        try {
            chrome.omnibox.setDefaultSuggestion({
                description: desc
            });
        } catch (error) {
            console.warn("v3 bug?", error);
        }
	}
}

const MIN_SECONDS_BETWEEN_MODIFICATIONS_BY_EXTENSION_AND_GCM_MESSAGES = 15;
const MIN_SECONDS_BETWEEN_POLLS = 4;
const MIN_SECONDS_BETWEEN_PROCESSING_GCM_MESSAGES = 1;
var pollServerTimer;

async function pollServerFromFCMUpdate() {
    await pollServer({source:GCM_SOURCE});
    chrome.runtime.sendMessage({command: "gcmUpdate"}).catch(error => {
        // ignore the "Could not establish connection"
    });
}

async function onRealtimeMessageReceived(message, source) {

	function feedMatchesMessage(feedDetails, message) {
        if (feedDetails?.watchResponse) {
            if (source == "gcm") {
                return feedDetails.watchResponse.id == message.data.channelId;
            } else {
                return feedDetails.watchResponse.resourceId == message.resourceId;
            }
        }
    }
    
    // commented because we were overwriting events and losing them when adding them with right click
    //cachedFeeds = await storage.get("cachedFeeds");
    
    var objUpdated;
    var calendarSettings = await storage.get("calendarSettings");
    
    if (feedMatchesMessage(calendarSettings, message)) {
        console.log("calendarSettings changed");
        objUpdated = calendarSettings;
        //sendGA("gcmMessage", "calendarSettings");
    } else if (feedMatchesMessage(cachedFeedsDetails["calendarList"], message)) {
        console.log("calendarList changed");
        objUpdated = cachedFeedsDetails["calendarList"];
        //sendGA("gcmMessage", "calendarList");
    } else {
        for (const feedId in cachedFeeds) {
            if (feedMatchesMessage(cachedFeedsDetails[feedId], message)) {
                console.log("calendar changed: " + cachedFeeds[feedId].summary);
                objUpdated = cachedFeedsDetails[feedId];
                // anonymize
                var feedIdAnon = feedId.split("@")[0].substring(0,3);
                //sendGA("gcmMessage", "calendarEvents", feedIdAnon);
                break;
            }
        }
    }
    
    if (objUpdated) {

        let passedLastProcessMessage;
        let messageDate;
        if (source == "gcm") {
            passedLastProcessMessage = true;
        } else {
            messageDate = new Date(message.date.seconds * 1000);
            passedLastProcessMessage = !objUpdated.CPlastMessageDate || messageDate.isAfter(objUpdated.CPlastMessageDate);
        }
        
        if (passedLastProcessMessage) {
            if (messageDate) {
                objUpdated.CPlastMessageDate = messageDate;
            }
            delete objUpdated.CPlastFetched;
            await storage.set("calendarSettings", calendarSettings);
            await storage.set("cachedFeedsDetails", cachedFeedsDetails);
            const lastPollTime = await storage.get("_lastPollTime");
            const lastCalendarModificationByExtension = await storage.get("_lastCalendarModificationByExtension");

            if (lastCalendarModificationByExtension.diffInSeconds() >= -MIN_SECONDS_BETWEEN_MODIFICATIONS_BY_EXTENSION_AND_GCM_MESSAGES) { // avoid race condition/duplicate events when modifing events in popup by adding a delay when extension modifies calendar
                console.log("delay for 1 minute to avoid race condition");
                chrome.alarms.create(Alarms.POLL_SERVER_FROM_FCM_UPDATE, {delayInMinutes: 1});
            } else {
                chrome.alarms.clear(Alarms.POLL_SERVER_FROM_FCM_UPDATE);

                if (lastPollTime.diffInSeconds() < -MIN_SECONDS_BETWEEN_POLLS) {
                    pollServerFromFCMUpdate();
                } else {
                    clearTimeout(pollServerTimer);
                    pollServerTimer = setTimeout(() => {
                        pollServerFromFCMUpdate();
                    }, seconds(MIN_SECONDS_BETWEEN_PROCESSING_GCM_MESSAGES));
                }
            }
        } else {
            console.log("already processed this message");
        }
    } else {
        console.log("Unknown message", message);
    }
}

async function maybeRegisterId() {
    // sep 2024, google/chrome changed the registrationids (rare) so must rewatch with new ids
    if (chrome.gcm) {
        const oldRegId = await storage.get("registrationId");
        try {
            const newRegId = await ensureGCMRegistration(true);
            if (newRegId && newRegId != oldRegId) {
                const calendarSettings = await storage.get("calendarSettings");
                if (calendarSettings?.watchResponse) {
                    console.info("rewatch calendar settings");
                    try {
                        await stopWatch(calendarSettings.watchResponse);
                    } catch (error) {
                        console.warn("error stopping watch", error);
                    }
                    await watchCalendarSettings();
                }
            
                const calendarList = await storage.get("calendarList");
                if (calendarList?.watchResponse) {
                    console.info("rewatch calendar list");
                    try {
                        await stopWatch(calendarList.watchResponse);
                    } catch (error) {
                        console.warn("error stopping watch", error);
                    }
                    await watchCalendarList();
                }
        
                const cfd = await storage.get("cachedFeedsDetails");
                const cals = await getArrayOfCalendars();
                globalThis.cachedFeeds = await storage.get("cachedFeeds");
                globalThis.cachedFeedsDetails = await storage.get("cachedFeedsDetails");
        
                for (const calendar of cals) {
                    if (cfd[calendar.id]?.watchResponse && cfd[calendar.id].watchResponse.supported !== false) {
                        console.info("rewatch calendar events", calendar.id);
                        try {
                            await stopWatch(cfd[calendar.id].watchResponse);
                        } catch (error) {
                            console.warn("error stopping watch", error);
                        }
    
                        try {
                            await watchCalendarEvents(calendar.id);
                        } catch (error) {
                            console.error("error rewatching events", error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("error rewatching", error);
        }
    }
}

if (chrome.gcm) {
	chrome.gcm.onMessage.addListener(async message => {
        console.log("onGCMMessage", new Date(), message);
        await initMisc();
        await onRealtimeMessageReceived(message, "gcm");
    });
}

if (chrome.instanceID) {
    chrome.instanceID.onTokenRefresh.addListener(async function() {
        await initMisc();
        maybeRegisterId();
    });
}

async function watch(params) {
    const data = {
        id: getUUID(),
        type: "web_hook",
        expiration: new Date().addDays(WATCH_EXPIRATION_IN_DAYS).getTime()
    };

    const watchRetries = await storage.get("_watchRetries");

    try {
        let version;
        if (await isGCMSupported(true)) {
            version = "gcm";
            data.address = Urls.FCM,
            data.token = `registrationId=${await ensureGCMRegistration()}`
        } else {
            version = "firestore";
            data.address = Urls.FIRESTORE;
            data.token = await getInstanceId();
        }
    
        const watchResponse = await oauthDeviceSend({
            type: "post",
            url: params.url,
            data: data
        });
        watchResponse.version = version;
        watchResponse.startDate = new Date();

        startWatchAlarm(params.alarmName, watchResponse);
        // reset retries
        watchRetries[params.url] = 0;
        await storage.set("_watchRetries", watchRetries);
        return watchResponse;
    } catch (error) {
        console.error("error watching", error);
        if (error.code != 400) { // only if supported
            const MAX_RETRIES = 3;
            if (!watchRetries[params.url]) {
                watchRetries[params.url] = 0;
            }
            if (watchRetries[params.url]++ < MAX_RETRIES) {
                console.info("watch retry attempt #" + watchRetries[params.url]);
                const exponentialRetryInSeconds = Math.pow(30, watchRetries[params.url]);
                // minimum 1 min due to chrome alarm limitation
                const delayInMinutes = Math.max(1, exponentialRetryInSeconds / 60);
                chrome.alarms.create(params.alarmName, {delayInMinutes: delayInMinutes});
            }
            await storage.set("_watchRetries", watchRetries);
        }
        throw error;
    }
}

function startWatchAlarm(alarmName, watchResponse) {
	const DELAY_BETWEEN_STOP_AND_START_IN_SECONDS = 5;
	if (watchResponse) {
		const expiration = new Date(parseInt(watchResponse.expiration));
		const nextWatchDate = expiration.addSeconds(DELAY_BETWEEN_STOP_AND_START_IN_SECONDS);
		console.log("nextWatchDate", nextWatchDate);
		chrome.alarms.create(alarmName, {when:nextWatchDate.getTime()});
	} else {
		console.error("Can't startWatchAlarm because no watchResponse");
	}
}

async function watchCalendarSettings() {
	console.log("watchCalendarSettings");
	const watchResponse = await watch({
		url: "/users/me/settings/watch",
		alarmName: Alarms.WATCH_CALENDAR_SETTINGS
	});
    const calendarSettings = await storage.get("calendarSettings");
    calendarSettings.watchResponse = watchResponse;
    await storage.set("calendarSettings", calendarSettings);
}

async function watchCalendarList() {
	console.log("watchCalendarList");
	const watchResponse = await watch({
		url:"/users/me/calendarList/watch",
		alarmName: Alarms.WATCH_CALENDAR_LIST
	});
    if (!cachedFeeds["calendarList"]) {
        cachedFeeds["calendarList"] = {};
    }
    console.log("watchcalendarlist response", watchResponse);
    
    const calendarList = await getCachedFeedDetails("calendarList");
    calendarList.watchResponse = watchResponse;
    
    await storage.set("cachedFeeds", cachedFeeds);
    await storage.set("cachedFeedsDetails", cachedFeedsDetails);
}

async function watchCalendarEvents(calendarId) {
	if (!cachedFeeds[calendarId]) {
		cachedFeeds[calendarId] = {};
	}

	if (!cachedFeedsDetails[calendarId]) {
		cachedFeedsDetails[calendarId] = {};
	}

	console.log("watchCalendarEvents: " + cachedFeeds[calendarId].summary);

    try {
        const watchResponse = await watch({
            url: `/calendars/${encodeURIComponent(calendarId)}/events/watch`, // removed in oct 2024: ?eventTypes=${EventType.DEFAULT}
            alarmName: WATCH_CALENDAR_EVENTS_ALARM_PREFIX + calendarId
        });
        console.log("watchCalendarEvents response", watchResponse);
		cachedFeedsDetails[calendarId].watchResponse = watchResponse;
		await storage.set("cachedFeeds", cachedFeeds);
		await storage.set("cachedFeedsDetails", cachedFeedsDetails);
    } catch (error) {
        console.error("error watching calendar events", error);
		if (error.code == 400) { // watch not supported
			cachedFeedsDetails[calendarId].watchResponse = {supported:false};
			await storage.set("cachedFeeds", cachedFeeds);
			await storage.set("cachedFeedsDetails", cachedFeedsDetails);
		}
		throw error;
    }
}

async function stopWatch(watchResponse) {
    return oauthDeviceSend({
        type: "post",
        url: "/channels/stop",
        data: {
            id: watchResponse.id,
            resourceId: watchResponse.resourceId
        }
    });
}

function isWatchSupported(calendarId, watchResponse) {
	const calendar = getCalendarById(calendarId);
	return (!watchResponse || watchResponse.supported !== false || calendar.primary) && calendar.id != TASKS_CALENDAR_OBJECT.id;
}

function isBeingWatched(watchResponse) {
	if (watchResponse?.startDate && watchResponse?.expiration) {
		return new Date(parseInt(watchResponse.expiration)).isAfter();
	}
}

async function ensureWatchCalendarSettings(params) {
	const calendarSettings = await storage.get("calendarSettings");
	
	if (calendarSettings && isBeingWatched(calendarSettings.watchResponse)) {
		if (params.source == "startup") {
			startWatchAlarm(Alarms.WATCH_CALENDAR_SETTINGS, calendarSettings.watchResponse);
		}
		return Promise.resolve();
	} else {
		return watchCalendarSettings();
	}
}

async function ensureWatchCalendarList(params) {
	const cachedFeedDetails = cachedFeedsDetails["calendarList"];
	
	if (cachedFeedDetails && isBeingWatched(cachedFeedDetails.watchResponse)) {
		if (params.source == "startup") {
			startWatchAlarm(Alarms.WATCH_CALENDAR_LIST, cachedFeedDetails.watchResponse);
		}
	} else {
		return watchCalendarList();
	}
}

async function ensureWatchCalendarEvents(params) {
	const cachedFeedDetails = cachedFeedsDetails[params.calendarId];
	
	if (cachedFeedDetails && (isBeingWatched(cachedFeedDetails.watchResponse) || !isWatchSupported(params.calendarId, cachedFeedDetails.watchResponse))) {
		if (params.source == "startup" && isWatchSupported(params.calendarId, cachedFeedDetails.watchResponse)) {
			startWatchAlarm(WATCH_CALENDAR_EVENTS_ALARM_PREFIX + params.calendarId, cachedFeedDetails.watchResponse);
		}
	} else {
		return watchCalendarEvents(params.calendarId);
	}
}

async function fetchCalendarSettings(params = {}) {
    var calendarSettings = await storage.get("calendarSettings");
    if (params.grantingAccess || params.bypassCache || !calendarSettings || !calendarSettings.CPlastFetched || new Date(calendarSettings.CPlastFetched).diffInDays() < -30 || calendarSettings.email != params.email) {
        if (await isAllowedRealtimeSync()) {
            try {
                await ensureWatchCalendarSettings({source:params.source});
            } catch (error) {
                logError("error ensureWatchCalendarSettings: " + error);
            }
        }
        // must fetch it again because it's updated in ensureWatchCalendarSettings
        calendarSettings = await storage.get("calendarSettings");
        console.info("Fetching settings");
        const response = await oauthDeviceSend({
            userEmail: params.email,
            url: "/users/me/settings",
            roundtripArg: params.email
        });
        const settings = response.items;
        
        calendarSettings.CPlastFetched = new Date();
        if (params.email) {
            calendarSettings.email = params.email;
        } else {
            calendarSettings.email = await storage.get("email");
        }
        calendarSettings.calendarLocale = getSetting(settings, "locale", "en");
        calendarSettings.showDeclinedEvents = getSetting(settings, "showDeclinedEvents", true);
        calendarSettings.hideWeekends = getSetting(settings, "hideWeekends");
        calendarSettings.weekStart = getSetting(settings, "weekStart", 0);
        calendarSettings.timeZone = getSetting(settings, "timezone", "America/Montreal");
        calendarSettings.format24HourTime = getSetting(settings, "format24HourTime", false);
        calendarSettings.dateFieldOrder = getSetting(settings, "dateFieldOrder");
        calendarSettings.defaultEventLength = getSetting(settings, "defaultEventLength");
        calendarSettings.hideInvitations = getSetting(settings, "hideInvitations");
        calendarSettings.remindOnRespondedEventsOnly = getSetting(settings, "remindOnRespondedEventsOnly");
        
        // sync "my" 24 hour format extension option from calendar setting
        if (await storage.get("24hourMode") == undefined && calendarSettings.format24HourTime) {
            await storage.enable("24hourMode");
            twentyFourHour = true;
        }
        
        await storage.set("calendarSettings", calendarSettings);
        return response;
    } else {
        console.info("Fetching settings [CACHE]");
    }
}

async function fetchColors(params = {}) {
    const feedDetails = await getCachedFeedDetails("colors");

    if (params.bypassCache != true && cachedFeeds.colors && await feedUpdatedWithinTheseHours("colors", PollingIntervals.COLORS) && feedDetails.email == params.email) {
        console.info("Fetching colors... [CACHE]");
    } else {
        console.info("Fetching colors...")
        const response = await oauthDeviceSend({
            userEmail: params.email,
            url: "/colors"
        });
        cachedFeeds["colors"] = response;

        feedDetails.CPlastFetched = new Date();
        feedDetails.email = params.email;
        
        return response;
    }
}

function generateEventTag(event) {
    return JSON.stringify({
        id: event.id,
        calendarId: getEventCalendarId(event),
        type: NotificationTags.CONTAINS_JSON_EVENT
    });
}

function shortcutNotApplicableAtThisTime(title) {
    showWebNotification(title, {
        body: "Click here to remove this shortcut.",
        icon: Icons.NotificationLogo,
        tag: NotificationTags.SHORTCUT_NOT_APPLICABLE_AT_THIS_TIME,
        newNotificationOnClick: async () => {
            openUrl("https://jasonsavard.com/wiki/Keyboard_shortcuts");
        }
    });
}

async function closeNotifications(notifications, params = {}) { // lastAction, skipNotificationClear
	await updateNotificationEventsShown(notifications, eventsShown, params.lastAction);
	
	var notificationsCloned = notifications.shallowClone(); // because sometimes the notificationsOpened is passed in as notifications and when looping inside the next loop we modify the notificationsOpened which creates sync issues 
	
	console.log("notificationsCloned length: " + notificationsCloned.length)
	console.log("notificationsCloned: ", notificationsCloned)
	notificationsCloned.forEach(notification => {
		// remove from queue
		for (var a=0; a<notificationsQueue.length; a++) {
			if (isSameEvent(notificationsQueue[a].event, notification.event)) {				
				console.log("removed from queue: " + notification.event.summary);
				notificationsQueue.splice(a, 1);
				a--;
				break;
			}
		}

		// remove from array of opened notifs
		for (var a=0; a<notificationsOpened.length; a++) {
			console.log("notificationsOpened[a].id: " + notificationsOpened[a].id)
			console.log("notificationsOpened[a]: ", notificationsOpened[a])
			console.log("notification.id: " + notification.id);
			if (isSameEvent(notificationsOpened[a].event, notification.event)) {
				console.log("removed from opened", notification.id);
				notificationsOpened.splice(a, 1);
				a--;
				break;
			}
		}
	});
	
	if (await storage.get("desktopNotification") == "rich" && !params.skipNotificationClear) {
		if (await isGroupedNotificationsEnabled()) {
			if (notificationsOpened.length == 0) {
				chrome.notifications.clear(GROUPED_NOTIFICATION_ID, async wasCleared => {
					// patch to force close the notification by unfocusing the notification window
					// Because the notification.clear is not working when the notification has been retoasted by clicking on the bell in the tray
					if (params.source == "notificationButton") {
                        const lastNotificationShownDate = await storage.get("_lastNotificationShownDate");
						if (lastNotificationShownDate.diffInSeconds() < -25) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
							openTemporaryWindowToRemoveFocus();
						}
					}
				});
			} else {
				await updateNotifications();
			}
		} else {
			notifications.forEach(notification => {
				chrome.notifications.clear(notification.id, function(wasCleared) {});
			});
		}
    }
    
    await storage.set("notificationsQueue", notificationsQueue);
    await storage.set("notificationsOpened", notificationsOpened);

    if (params.removeNotificationsFromReminderWindow) {
        // send to reminders popup
        chrome.runtime.sendMessage({action: "removeNotificationsFromReminderWindow", notifications: notifications});
    }

    if (await storage.get("syncDismissedAndSnoozedRemindersAcrossExtensions") && params.source != "sync") {
        try {
            const strippedEvents = notifications.map(notification => {
                return stripEvent(notification.event);
            });
    
            await saveSyncOperation(SyncOperation.CLOSE_NOTIFICATIONS, strippedEvents);
        } catch (error) {
            console.error("error with saveSyncOperation", error);
        }
    }
}

async function closeNotificationsDelayed(notifications) {
    // ff patch seems dismiss all would not work if there was a timeout
    if (!DetectClient.isFirefox()) {
        await sleep(500);
    }
    return closeNotifications(notifications);
}

async function performActionOutsideOfPopup(eventEntry, fromExternal) {
    try {
        const saveEventResponse = await saveEvent(eventEntry);
        // if title is small, empty or just useless than try getting the page details to fill the title
        let shortestTitleLength = 3;
        if (/zh|ja|ko/i.test((await storage.get("calendarSettings")).calendarLocale)) {
            shortestTitleLength = 1;
        }
        if ((eventEntry.inputSource == InputSource.CONTEXT_MENU || eventEntry.inputSource == InputSource.SHORTCUT) && eventEntry.summary.trim().length <= shortestTitleLength) {
            console.log("title too short, trying to get page details");
            const tab = await getActiveTab();
            const response = await getEventDetailsFromPage(tab);
            eventEntry.summary = response.title;
            eventEntry.description = response.description;
            
            await updateEvent({
                eventEntry: eventEntry,
                event: saveEventResponse,
                patchFields: {
                    summary: response.title,
                    description: response.description
                }
            });
        }

        const email = await storage.get("email");
        const title = eventEntry.summary;
        
        let message = await formatEventAddedMessage(getMessage("event").toLowerCase(), eventEntry);
        if (!message) {
            message = "";
        }
        
        const options = {
            type: "basic",
            title: title,
            message: message,
            iconUrl: Icons.NotificationLogo
        }
        
        if (supportsNotificationButtons()) {
            options.buttons = [{
                title: getMessage("undo"),
                iconUrl: Icons.Notification.Undo
            }, {
                title: getMessage("edit"),
                iconUrl: Icons.Notification.Edit
            }];
        }
    
        console.log("eventEntry", eventEntry.summary, eventEntry);
        // if no title found in the result of the quick add then open the edit page
        if (eventEntry.summary) {
            
            const desktopNotification = await storage.get("desktopNotification");
            if (desktopNotification == "text") {
                // text notificaiton
                showWebNotification(title, {
                    body: message,
                    icon: Icons.NotificationLogo,
                    tag: generateEventTag(eventEntry),
                    silent: true,
                    newNotificationOnClick: async () => {
                        openEventUrl(this.eventEntry, email);
                        this.close();
                    }
                });
            } else {
                const notification = {
                    id: generateNotificationIdFromEvent(eventEntry, NotificationType.ADDED_OUTSIDE),
                    event: eventEntry
                };
                console.log("notification", notification, options);
                chrome.notifications.create(notification.id, options, async function(notificationId) {
                    if (chrome.runtime.lastError) {
                        console.error("show notif error: " + chrome.runtime.lastError.message)
                    } else {
                        // close it after a few seconds
                        await sleep(seconds(4));
                        chrome.notifications.clear(notification.id, function(wasCleared) {});
                    }
                });
            }
        } else {
            openUrl(getEventUrl(eventEntry, email));
        }						
        pollServer();

    } catch (error) {
        if (error.jerror == JError.NO_TOKEN) {
            showMessageNotification("Access not granted!", "Go to Options > Accounts", error);
            if (fromExternal) {
                throw Error("Must grant access in calendar extension");
            } else {
                throw error;
            }
        } else {
            showMessageNotification("Error with last action", "Try using the quick add from the popup!", error);
            throw error;
        }
    }
}

function retoastNotifications() {
	console.log("retoast " + new Date());
	updateNotifications({retoast:true})
}

async function updateNotifications(params = {}) {
	if (notificationsOpened.length) {
		
		sortNotifications(notificationsOpened);
		
		if (await isGroupedNotificationsEnabled()) {
			// grouped
			const notificationsOpenedForDisplay = notificationsOpened.shallowClone();
			//notificationsOpenedForDisplay.reverse();
			const options = await generateNotificationOptions(notificationsOpenedForDisplay);
			if (params.retoast) {
				chrome.notifications.clear(GROUPED_NOTIFICATION_ID, function(wasCleared) {
					chrome.notifications.create(GROUPED_NOTIFICATION_ID, options, function(notificationId) {
						if (chrome.runtime.lastError) {
							logError("update create notif: " + chrome.runtime.lastError.message);
						} else {
							storage.setDate("_lastNotificationShownDate");
						}
					});
				});
			} else {
				chrome.notifications.update(GROUPED_NOTIFICATION_ID, options, function(wasUpdated) {});
			}
		} else {
			// dont retoast individual notifs
			if (!params.retoast) {
				// individual
                for (const notification of notificationsOpened) {
					const options = await generateNotificationOptions([notification]);
					// note: chrome.notifications.update calls the notification.onClosed
					chrome.notifications.update(notification.id, options, function(wasUpdated) {});
				}
			}
		}
	}
}

async function quickAddSelectionOrPage(params, tab) {
	console.log("quickAddSelectionOrPage", params, tab);

    const eventEntry = new EventEntry();
    eventEntry.inputSource = params.inputSource;
    
    if (params.template) { // set datetime...using calendar webpage
        eventEntry.allDay = true;
        eventEntry.startTime = new Date();
    } else {
        if (!params.quickAdd) {
            eventEntry.startTime = new Date(params.date.getTime());
            eventEntry.quickAdd = false;
        }
        eventEntry.allDay = params.allDay;  
    }
    
    const response = await getEventDetailsFromPage(tab);
    if (params.selectionText) {
        // Text selected
        eventEntry.summary = params.selectionText;
        if (params.pageUrl) {
            eventEntry.description = params.pageUrl;
        }
    } else if (params.linkUrl) {
        console.log("linkurl details", response);
        // couldn't use prompt in service worker, so let's use the title of the page
        //var title = prompt("Enter a title for this link", response.title);
        const url = new URL(params.linkUrl);
        const title = url.hostname + url.pathname;

        if (title) {
            eventEntry.summary = title;
            eventEntry.source = {title:title, url:params.linkUrl};
            eventEntry.description = params.linkUrl;
        } else {
            return;
        }
    } else {
        eventEntry.extendedProperties = {};
        eventEntry.extendedProperties.private = {favIconUrl:tab.favIconUrl};
        
        eventEntry.summary = response.title;
        if (!params.quickAdd) {
            eventEntry.description = response.description;
        }
        
        // possibly found url in microformat so use it instead
        if (response.url) {
            eventEntry.source = {title:response.title, url:response.url};
        } else if (tab?.url) {
            eventEntry.source = {title:response.title, url:tab.url};
        }
    }

    if (params.template) {
        const actionLinkObj = await generateActionLink("TEMPLATE", eventEntry);
        chrome.tabs.create({url: actionLinkObj.url + "?" + actionLinkObj.data});
    
        // let's sync in this event after we left the user a good amount of time to save the event on the page
        chrome.alarms.create(Alarms.POLL_SERVER_AFTER_RIGHT_CLICK_SET_DATE, {delayInMinutes: 1});
    } else {
        performActionOutsideOfPopup(eventEntry);
    }
}

async function setMenuItemTimes(parentId, startTime) {
    const CONTEXTS = await getContextsContextMenu();
	var offsetTime = new Date(startTime);
	for (var a=0; a<48 && offsetTime.getHours() <= 23 && offsetTime.getMinutes() <= 30 && offsetTime.isSameDay(startTime); offsetTime.setMinutes(offsetTime.getMinutes()+30), a++) {		
		createDynamicContextMenu({date:new Date(offsetTime)}, offsetTime.toLocaleTimeStringJ(), {contexts: CONTEXTS, parentId: parentId});
	}
}

let unusedMenuId = 1;
function generateUnusedMenuId() {
    return "rand" + (unusedMenuId++);
}

async function updateContextMenuItems() {
	if (await storage.get("showContextMenuItem")) {
		console.log("addchange conextmenu: " + new Date())
        addChangeContextMenuItems();
	}
}

function createContextMenu(id, text, params = {}) {
    if (id) {
        params.id = id;
    }

    if (!params.title && text) {
        params.title = text;
    }

    if (!params.contexts) {
        params.contexts = ["action"];
    }

    const menuId = chrome.contextMenus.create(params, () => {
        if (chrome.runtime.lastError) {
            if (!chrome.runtime.lastError.message.includes("duplicate id")) {
                console.error("error with menu id: " + id + " " + chrome.runtime.lastError.message);
            }
        }
    });
    return menuId;
}

async function getContextsContextMenu() {
    const showOnlyQuickWhenTextSelected = await storage.get("showOnlyQuickWhenTextSelected");
    if (showOnlyQuickWhenTextSelected) {
        return MENU_ITEM_CONTEXTS;
    } else {
        return MENU_ITEM_CONTEXTS.concat("selection");
    }
}

function createDynamicContextMenu(id, text, params = {}) {
    return createContextMenu(JSON.stringify(id), text, params);
}

async function addChangeContextMenuItems() {
	// remove past menu items first
	if (chrome.contextMenus?.removeAll) {
		await chrome.contextMenus.removeAll();

        const CONTEXTS = await getContextsContextMenu();
        const FIRST_HOUR_OF_DAY = 7;

        createContextMenu(ContextMenu.OPEN_CALENDAR, getMessage("openCalendar"));
        createContextMenu(ContextMenu.REFRESH, getMessage("refresh"));

        if (DetectClient.isFirefox()) {
            createContextMenu(ContextMenu.OPTIONS, getMessage("options"));
        }

        chrome.contextMenus.create({id: generateUnusedMenuId(), contexts: ["action"], type:"separator"});

        createContextMenu(ContextMenu.DND_MENU, getMessage("doNotDisturb"));
        createContextMenu(ContextMenu.DND_OFF, getMessage("turnOff"), {parentId: ContextMenu.DND_MENU});
        chrome.contextMenus.create({id: generateUnusedMenuId(), contexts: ["action"], parentId: ContextMenu.DND_MENU, type:"separator"});
        createContextMenu(ContextMenu.DND_30_MIN, getMessage("Xminutes", 30), {parentId: ContextMenu.DND_MENU});
        createContextMenu(ContextMenu.DND_1_HOUR, getMessage("Xhour", 1), {parentId: ContextMenu.DND_MENU});
        createContextMenu(ContextMenu.DND_2_HOURS, getMessage("Xhours", 2), {parentId: ContextMenu.DND_MENU});
        createContextMenu(ContextMenu.DND_4_HOURS, getMessage("Xhours", 4), {parentId: ContextMenu.DND_MENU});
        createContextMenu(ContextMenu.DND_8_HOURS, getMessage("Xhours", 8), {parentId: ContextMenu.DND_MENU});
        createContextMenu(ContextMenu.DND_TODAY, getMessage("today"), {parentId: ContextMenu.DND_MENU});
        createContextMenu(ContextMenu.DND_INDEFINITELY, getMessage("indefinitely"), {parentId: ContextMenu.DND_MENU});
        createContextMenu(`sep: ${getUniqueId()}`, null, {parentId:ContextMenu.DND_MENU, type:"separator"});
        createContextMenu(ContextMenu.DND_OPTIONS, getMessage("options") + "...", {parentId:ContextMenu.DND_MENU});

        // If a selection then add this before the other menu items
        createDynamicContextMenu({quickAdd:true, allDay:true}, getMessage("quickAdd") + "  '%s'", {contexts: ["selection"]});

        chrome.contextMenus.create({id: generateUnusedMenuId(), contexts: CONTEXTS, type:"separator"});
        
        // Today all day
        createDynamicContextMenu({date:new Date(), allDay:true}, getMessage("today"), {contexts: CONTEXTS});

        // Today times...
        let offsetTime = new Date();
        if (offsetTime.getMinutes() <= 29) {
            offsetTime.setMinutes(30)
        } else {
            offsetTime.setHours(offsetTime.getHours()+1);
            offsetTime.setMinutes(0);
        }
        offsetTime.setSeconds(0, 0);

        if (isToday(offsetTime) && offsetTime.getHours() <= 23 && offsetTime.getMinutes() <= 30) {
            const menuID = createContextMenu("TODAY_AT", getMessage("todayAt"), {contexts: CONTEXTS});
            setMenuItemTimes(menuID, offsetTime);
        }
        
        chrome.contextMenus.create({id: generateUnusedMenuId(), contexts: CONTEXTS, type:"separator"});
                    
        // Tomorrow
        createDynamicContextMenu({date:tomorrow(), allDay:true}, getTomorrowMessage(), {contexts: CONTEXTS});
        
        // Tomorrow times...
        const menuID = createContextMenu("TOMORROW_AT", getMessage("tomorrowAt"), {contexts: CONTEXTS});
        offsetTime = tomorrow();
        offsetTime.setHours(FIRST_HOUR_OF_DAY);
        offsetTime.setMinutes(0);
        offsetTime.setSeconds(0, 0);
        setMenuItemTimes(menuID, offsetTime);
        
        // Days of week
        offsetTime = tomorrow();
        for (var a=2; a<=12; a++) {
            chrome.contextMenus.create({id: generateUnusedMenuId(), contexts: CONTEXTS, type:"separator"});
            
            offsetTime.setDate(offsetTime.getDate()+1);
            const offsetDate = new Date(offsetTime);
            
            const offsetTimeFormatted = offsetTime.toLocaleDateStringJ();

            createDynamicContextMenu({date:offsetDate, allDay:true}, offsetTimeFormatted, {contexts: CONTEXTS});
            
            const menuID = chrome.contextMenus.create({id: generateUnusedMenuId(), title: getMessage("somedayAt", offsetTimeFormatted), contexts: CONTEXTS});
            offsetDate.setHours(FIRST_HOUR_OF_DAY);
            offsetDate.setMinutes(0);
            offsetTime.setSeconds(0, 0);
            setMenuItemTimes(menuID, offsetDate);
        }
        
        chrome.contextMenus.create({id: generateUnusedMenuId(), contexts: CONTEXTS, type:"separator"});
        
        // Other date
        createDynamicContextMenu({template:true}, getMessage("setDateTime") + "...", {contexts: CONTEXTS});
	}
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("contextmenu.onCLicked", info, tab);

    await initMisc();

    if (ContextMenu.OPEN_CALENDAR == info.menuItemId) {
        openGoogleCalendarWebsite();
    } else if (ContextMenu.REFRESH == info.menuItemId) {
        pollServer({source: "refresh"});
    } else if (ContextMenu.OPTIONS == info.menuItemId) {
        openUrl("options.html");
    } else if (ContextMenu.DND_OFF == info.menuItemId) {
        setDND_off();
    } else if (ContextMenu.DND_30_MIN == info.menuItemId) {
        setDND_minutes(30);
    } else if (ContextMenu.DND_1_HOUR == info.menuItemId) {
        setDND_minutes(60);
    } else if (ContextMenu.DND_2_HOURS == info.menuItemId) {
        setDND_minutes(120);
    } else if (ContextMenu.DND_4_HOURS == info.menuItemId) {
        setDND_minutes(240);
    } else if (ContextMenu.DND_8_HOURS == info.menuItemId) {
        setDND_minutes(480);
    } else if (ContextMenu.DND_TODAY == info.menuItemId) {
        setDND_today();
    } else if (ContextMenu.DND_INDEFINITELY == info.menuItemId) {
        setDND_indefinitely();
    } else if (ContextMenu.DND_OPTIONS == info.menuItemId) {
        openDNDOptions();
    } else {
        let params;
        try {
            params = JSON.parse(info.menuItemId, dateReviver);
        } catch (error) {
            console.error("error parsing menu item id", error);
            showMessageNotification("No code assigned to this menu", "Try re-installing the extension.");
            return;
        }
        params.selectionText = info.selectionText;
        params.linkUrl = info.linkUrl;
        params.pageUrl = info.pageUrl;
        params.inputSource = InputSource.CONTEXT_MENU;
        quickAddSelectionOrPage(params, tab);
    }
});

async function playNotificationSoundFile(source, reminder) {
    try {
        if (await isDND() || source == null || source == "") {
            // do nothing
        } else  {
            
            globalThis.changedSrc = lastNotificationAudioSource != source;
    
            let audioSrc;
            
            // patch for ogg might be crashing extension
            // patch linux refer to mykhi@mykhi.org
            if (DetectClient.isLinux() || changedSrc) {
                if (source == "custom") {
                    audioSrc = await storage.get("notificationSoundCustom");
                } else {
                    audioSrc = "/sounds/" + source;
                }
                
            }
            lastNotificationAudioSource = source;
            
            let volume = await storage.get("notificationSoundVolume");
            
            // if reminder than lower the volume by 75%
            if (reminder) {
                volume = volume * 0.75;
            }
    
            await sendToOffscreenDoc("play-sound", {
                changedSrc: changedSrc,
                src: audioSrc,
                volume: volume / 100
            });
        }
    } catch (error) {
        console.log("caught play sound error", error);
    }
}

async function playVoiceNotification(textToSpeak, params = {}) {
	if (await storage.get("notificationVoice") && !await isDND() && params.source != "startup") {
        const voiceNotificationOnlyIfIdleInterval = await storage.get("voiceNotificationOnlyIfIdleInterval");
		if (voiceNotificationOnlyIfIdleInterval) {
			const state = await chrome.idle.queryState(parseInt(voiceNotificationOnlyIfIdleInterval));
            if (state != "active" && !await detectSleepMode.isWakingFromSleepMode()) {
                console.log("queueing voice notification", textToSpeak + " " + new Date());
                await ChromeTTS.queue(textToSpeak);
            }
		} else {
			await ChromeTTS.queue(textToSpeak);
		}
	}
}

async function stopAudio() {
    sendToOffscreenDoc("stop-audio");
}

function stopAllSounds() {
    stopAudio();
	globalThis.ChromeTTS?.stop?.();
}

// usage: params.badgeText = undefined (don't change anything) badgeText = "" then remove badgeText etc...
async function updateBadge(params = {}) {
	const badgeIcon = await storage.get("badgeIcon");
	const state = await isOnline() ? "" : "_offline";
	const imageSrc = await getBadgeIconUrl(state);
	
	if (await isDND()) {
		storage.enable("_DND_displayed");
		params.badgeText = "🌙";
		params.badgeColor = BadgeColor.EMOJI;
		chrome.action.setTitle({ title: getMessage("doNotDisturb") });
	} else {
		// Should probably force the checkEvents() to restore counter, but I opted to let the interval call it so as to not cause double checkevents calling possible issues
		if (await storage.get("_DND_displayed")) {
			params.badgeText = "";
		}
		storage.disable("_DND_displayed");
		
        if (!params.ignoreTooltip) {
            if (await storage.get("showButtonTooltip") && params.toolTip) {
                chrome.action.setTitle({title:params.toolTip});
            } else {
                chrome.action.setTitle({title:""});
            }
        }
	}

	if (params.badgeColor) {
		chrome.action.setBadgeBackgroundColor({color:params.badgeColor});

        // mainly for firefox because it doesn't auto contrast badgetext
        if (chrome.action.setBadgeTextColor) {
            let color;
            if (isColorTooLight(params.badgeColor)) {
                color = "black";
            } else {
                color = "white";
            }
            chrome.action.setBadgeTextColor({color: color});
        }
	}

	const previousBadgeText = await chrome.action.getBadgeText({});
    var badgeTextVisibilityToggled = false;
    if ((params.forceRefresh && params.badgeText) || (params.badgeText != undefined && params.badgeText != previousBadgeText)) {
        badgeTextVisibilityToggled = true;
        chrome.action.setBadgeText({text:params.badgeText});
    }
    
    // if icon changed from last time or badgeTextVisibilityToggled then update it icon
    const lastBadgeDate = await storage.get("_lastBadgeDate");
    if (params.forceRefresh || imageSrc != lastBadgeIcon || badgeTextVisibilityToggled || !lastBadgeDate.isToday()) {
        const imageBitmap = await getImageBitmapFromUrl(imageSrc);

        var badgeIconCanvas;
        if (typeof OffscreenCanvas != "undefined") {
            badgeIconCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        } else if (typeof document != "undefined") {
            badgeIconCanvas = document.createElement("canvas");
            badgeIconCanvas.width = imageBitmap.width;
            badgeIconCanvas.height = imageBitmap.height;
        }

        // the onload loads again after changing badeicon and document.body is empty, weird, so check for canvas
        if (badgeIconCanvas) {
            const context = badgeIconCanvas.getContext('2d', {willReadFrequently: true});

            let width, height;
            if (imageSrc.includes(Icons.BadgeIcon38Prefixes)) {
                width = 38;
                height = 38;
            } else {
                width = 19;
                height = 19;
            }

            context.drawImage(imageBitmap, 0, 0, width, height);
            
            if (badgeIcon.includes("WithDate")) {
                var heightOffset;

                if (badgeIcon == "default3WithDate" || badgeIcon == "default_monochromeWithDate") {
                    heightOffset = 15;
                    context.font = 'normal 11px "arial", sans-serif';
                    context.fillStyle = '#FFF'
                } else if (badgeIcon == "newWithDate" || badgeIcon == "new2WithDate") {
                    heightOffset = 14;
                    context.font = 'bold 12px "arial", sans-serif';
                    context.fillStyle = '#FFF'
                } else {
                    heightOffset = 14;
                    context.font = 'bold 10px "arial", sans-serif';
                    context.fillStyle = "#333"
                }
                context.textAlign = "center";
                var day = (new Date).getDate();
                
                var hasBadgeText = false;
                if (params.badgeText == undefined) {
                    if (previousBadgeText) {
                        hasBadgeText = true;
                    }
                } else {
                    if (params.badgeText) {
                        hasBadgeText = true;
                    }
                }						
                
                if (hasBadgeText) {
                    if (DetectClient.isFirefox()) {
                        heightOffset += 1;
                    } else {
                        heightOffset -= 3;
                    }
                }
                    
                context.fillText(day, (width / 2) - 0, heightOffset);
                storage.setDate("_lastBadgeDate");
            }

            chrome.action.setIcon({imageData: context.getImageData(0, 0, width, height)});
        }
    }
    lastBadgeIcon = imageSrc;
}

function getSetting(settings, key, defaultValue) {
	let value = null;
	if (settings) {
		const setting = settings.find(setting => {
			return setting.id == key;
        });
        if (setting) {
            value = setting.value;
        }
	}
	if (defaultValue == undefined) {
		defaultValue = false;
	}
	return value == null ? defaultValue : toBool(value);
}

async function feedUpdatedToday(feedId) {
	var lastFetched = await getLastFetchedDate(feedId);
	return lastFetched && lastFetched.isToday();
}

async function feedUpdatedWithinTheseHours(feedId, hours) {
	var lastFetched = await getLastFetchedDate(feedId);
	return lastFetched && lastFetched.diffInHours() >= -hours;
}

async function fetchCalendarList(params = {}) {
    const email = await storage.get("email");
    const feedFromCache = cachedFeeds["calendarList"];
    const feedDetails = await getCachedFeedDetails("calendarList");
    
    if (params.bypassCache != true && feedFromCache && await feedUpdatedToday("calendarList") && feedDetails.email == params.email) {
        console.info("Fetching calendarlist [CACHE]");
    } else {
        if (await isAllowedRealtimeSync()) {
            try {
                await ensureWatchCalendarList({source:params.source});
            } catch (error) {
                logError("error ensureWatchCalendarList: " + error);
            }
        }

        console.info("Fetching calendarlist");

        try {
            const response = await getAllAPIData({
                oauthForDevices: oAuthForDevices,
                userEmail: email,
                url: "/users/me/calendarList",
                data: {
                    //showHidden: true,
                    maxResults: 250,
                },
                itemsRootId: "items"
            });

            cachedFeeds["calendarList"] = response;
            
            // save selected calendars once locally because we don't want to sync this afterwards
            const selectedCalendars = await storage.get("selectedCalendars");
            for (const item of cachedFeeds["calendarList"].items) {
                const calendarId = item.id;
                // never set before
                if (selectedCalendars[email] && selectedCalendars[email][calendarId] == undefined) {
                    selectedCalendars[email][calendarId] = item.selected;
                }
            }
            await storage.set("selectedCalendars", selectedCalendars);
            
            feedDetails.CPlastFetched = new Date();
            feedDetails.email = email;

            return {
                updated: true,
                data: response
            };
        } catch (error) {
            logError("Error fetching feed: ", error);
            if (feedFromCache) {
                console.log("instead we are fetching from cache");
            } else {
                throw error;
            }
        }
    }
}

async function processCalendarListFeed(calendarListResponse) {
    if (!calendarMap || calendarListResponse?.updated)  {
        calendarMap = await initCalendarMap();
    }
}

async function fetchAllCalendarEvents(params) {
	console.log("fetchAllCalendarEvents:", new Date())
    var startDate;
    var endDate;
    
    if (params.startDate) { // override defaults if passed here
        startDate = params.startDate;
        endDate = params.endDate;
    } else { // default dates...
        startDate = getStartDateBeforeThisMonth();
        endDate = await getEndDateAfterThisMonth();
        
        // Must pull all events visible in month view so that the drag drop for moving events can locate the event ids
        // if setting "maxDaysAhead" is larger than this, than use it instead
        const maxDaysAheadDate = new Date().addDays(parseInt(await storage.get("maxDaysAhead"))+1);
        if (maxDaysAheadDate.isAfter(endDate)) {
            endDate = maxDaysAheadDate;
        }
        
        // must do this because or else enddate is always seconds off and i use this enddate diff to determine if i should fetch more feeds
        endDate.setHours(23);
        endDate.setMinutes(0);
        endDate.setSeconds(0, 0);
    }
    
    console.log("startdate: " + startDate);
    
    let tokenResponse;
    try {
        tokenResponse = await oAuthForDevices.ensureTokenForEmail(params.email);
    } catch (error) {
        // forward on because we want to return cached feeds
    }
    const selectedCalendars = await storage.get("selectedCalendars");
    const arrayOfCalendars = await getArrayOfCalendars();

    console.info("arrayOfCalendars", arrayOfCalendars);
    
    const returnObj = {
        events: []
    }
    
    let loggedOut = false;
    const promises = [];
    if (arrayOfCalendars.length) {
        arrayOfCalendars.forEach(calendar => {
            // must clone because .calendar for instance is alway set as the last iterated calendar after looping here
            const moreParams = deepClone(params);
            
            moreParams.calendarId = calendar.id;
            moreParams.startDate = startDate;
            moreParams.endDate = endDate;
            
            const promise = fetchCalendarEvents(moreParams, selectedCalendars);
            promises.push(promise);
        });
    
        const results = await Promise.allSettled(promises);
        const successfulPromises = results.filter(result => result.status === 'fulfilled').map(result => result.value);
        const failedPromises = results.filter(result => result.status === 'rejected').map(result => result.reason);

        const allResponses = successfulPromises.concat(failedPromises);

        let notFounds = 0;
        loggedOut = failedPromises.some(failure => {
            if (failure.error?.code == 401) {
                console.warn("401", failure);
                if (failure.error?.roundtripArg == TASKS_CALENDAR_OBJECT.id) {
                    // ignore task error
                } else {
                    return true;
                }
            } else if (failure.error?.code == 404) { // facebook feed gave this error
                notFounds++;
                console.warn("notfound", failure);
            } else { // 503 could fall here as temporary service unavailable
                console.warn("Failures", failure);
            }
        });

        returnObj.events = await mergeEvents(allResponses);
        if (failedPromises.length && failedPromises.length != notFounds) {
            // change from .error to .warning because .error was to hard was intercepted in sendMessageToBG
            returnObj.warning = "Error fetching " + failedPromises.length + " calendars";
        }
    } else {
        loggedOut = true;
    }
    
    if (loggedOut) {
        await showLoggedOut();
    } else {
        await storage.disable("loggedOut");
    }
    
    return returnObj;
}

function modifyEventInArray(notificationsOpened, item, calendarId) {
    return notificationsOpened.some(notification => {
        if (notification.event.id == item.id) {
            notification.event = item;
            initEventObj(notification.event, calendarId); // v2 had to initiate calendarId with 2nd parameter, v1 don't know if it's necessary but trying to figure this issue: https://jasonsavard.com/forum/discussion/6979/gettime-error-in-checkerplus-for-google-calendar#latest
            return true;
        }
    });
}

async function fetchAllPartialItems(moreParams, params) {
    
    const sendResponse = await getAllAPIData(moreParams);
    
    const cachedCalendarItems = cachedFeeds[params.calendarId].items;

    let setUpdatedField = false;

    if (cachedCalendarItems) {
        for (const item of sendResponse.items) {

            if (!setUpdatedField) {
                cachedFeeds[params.calendarId].updated = new Date();
                setUpdatedField = true;
            }

            if (item.status == "cancelled" && !item.recurrence) {
                const removedSuccessfully = removeItemById(cachedCalendarItems, item.id);
                if (!removedSuccessfully) {
                    console.warn("Already removed?", item);
                }
            } else if (item.recurrence) {
                // Modified some of instances so we must remove them all then re-add later below
                for (let a=0; a<cachedCalendarItems.length; a++) {
                    // modified existing recurring events || changed a single to a recurring event
                    if (item.id == cachedCalendarItems[a].recurringEventId || item.id == cachedCalendarItems[a].id) {
                        cachedCalendarItems.splice(a, 1);
                        a--;
                    }
                }
                
                try {
                    const instanceResponse = await oauthDeviceSend({
                        userEmail: params.email,
                        url: `/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(item.id)}/instances`,
                        data: {
                            showDeleted: true,
                            //singleEvents: true, // should I use this? I commented it but never actually used it
                            timeMin: params.startDate.toJSON(),
                            timeMax: params.endDate.toJSON()
                        }
                    });
                    console.log("instances", instanceResponse);
                    instanceResponse.items.forEach(item => {
                        const index = findIndexById(cachedCalendarItems, item.id);
                        if (item.status == "cancelled") {
                            if (index == -1) {
                                console.warn("Already removed?", item);
                            } else {
                                cachedCalendarItems.splice(index, 1);
                            }
                        } else {
                            if (index == -1) { // add
                                cachedCalendarItems.push(item);
                            } else { // modify
                                cachedCalendarItems[index] = item;
                            }
                        }
                    });
                } catch (error) {
                    logError("error in recurrence send:" + error);
                    fetchEventsObj.error = error;
                    throw fetchEventsObj;
                }
            } else {
                const index = findIndexById(cachedCalendarItems, item.id);
                if (index == -1) { // add
                    cachedCalendarItems.push(item);

                    // patch for when editing a recurring to a single event and the recurring events are not removed
                    if (!item.recurringEventId) {
                        console.time("removeItemByRecurringEventId");
                        let recurrenceFound = false;
                        do {
                            recurrenceFound = removeItemByRecurringEventId(cachedCalendarItems, item.id);
                            if (recurrenceFound) {
                                console.log("recurrenceFound", item.id);
                            }
                        } while (recurrenceFound);
                        console.timeEnd("removeItemByRecurringEventId");
                    }
                } else { // modify
                    console.log("modified item", item);
                    cachedCalendarItems[index] = item;

                    // sync this event in the other arrays
                    if (globalThis.notificationsOpened) {
                        modifyEventInArray(globalThis.notificationsOpened, item, params.calendarId);
                    }

                    const notificationsOpened = await storage.get("notificationsOpened");
                    if (notificationsOpened) {
                        const found = modifyEventInArray(notificationsOpened, item, params.calendarId);

                        if (found) {
                            await storage.set("notificationsOpened", notificationsOpened);
                        }
                    }
                }
            }
        };
    } else {
        logError("cachedCalendarItems null for: " + params.calendarId);
    }

    return sendResponse;
}

async function fetchCalendarEvents(params, selectedCalendars) {
    const email = await storage.get("email");
    const desktopNotification = await storage.get("desktopNotification");
    const excludedCalendars = await storage.get("excludedCalendars");
    var feedFromCache = cachedFeeds[params.calendarId];
    
    // simulate fetchEventsObj and pass this "dummy" roundtripArg because it is fetched in .always 
    var fetchEventsObj = feedFromCache || {};
    fetchEventsObj.roundtripArg = params.calendarId;

    const calendar = getCalendarById(params.calendarId);
    
    if (isCalendarUsedInExtension(calendar, email, selectedCalendars, excludedCalendars, desktopNotification)) {
    
        let calendarThatShouldBeCached =
            calendar.id.includes("holiday.calendar.google.com") ||
            calendar.id.includes("import.calendar.google.com") ||
            calendar.id.includes("group.v.calendar.google.com") || // includes Interesting calendars "more" section ie. Contacts's bdays, Day of the year etc.
            calendar.id.includes("bukmn26vqdvcamgv8fdrs3hhu8@group.calendar.google.com") // manually excluded because lot of users subscribed to this one according to analytics titled: Anniversaries - owner
            // group.calendar.google.com (without the .v. means just regular non-primary calendars
            
            // commented out because these are now excluded via the isGadgetCalenadar with the previous call above to isCalendarUsed...
            //calendar.id.includes("g0k1sv1gsdief8q28kvek83ps4@group.calendar.google.com") || 	// Week Numbers
            //calendar.id.includes("ht3jlfaac5lfd6263ulfh4tql8@group.calendar.google.com") 		// Phases of the Moon
        ;
        
        let expired = false;
        
        if (calendarThatShouldBeCached) {
            expired = !await feedUpdatedWithinTheseHours(calendar.id, PollingIntervals.CALENDARS_OF_INTEREST);
        } else {
            if (isCalendarWriteable(calendar)) {
                // see that we are showing notifications for this calendar (high priority) and that this calendar is "active" and that it's been updated at least in the last 30 days
                const isCalendarRecentlyUpdated = !feedFromCache || new Date(feedFromCache.updated).diffInDays() >= -30;
                if (desktopNotification && !isCalendarExcludedForNotifsByOptimization(calendar, excludedCalendars) && isCalendarRecentlyUpdated) {
                    // added to prevent quota issue when pushing updates that restarted the extension
                    if (params.source == "startup") {
                        calendarThatShouldBeCached = await feedUpdatedWithinTheseHours(calendar.id, PollingIntervals.ACTIVE_CALENDARS);
                    } else {
                        // do nothing as we should continue to fetch this calendar's events
                    }
                } else {
                    // let's reduce it's polling a bit to save quota (successfully reduced quota by 20% !)
                    calendarThatShouldBeCached = await feedUpdatedWithinTheseHours(calendar.id, PollingIntervals.PASSIVE_CALENDARS);
                }
            } else {
                // Pushed Feb 8th - reduced quota by about 30% we used to check every hour, now only once a day 
                // for non main calendars (ie. not owner/writer) let's reduce the polling to 1 day (ie. once per day)
                calendarThatShouldBeCached = await feedUpdatedWithinTheseHours(calendar.id, PollingIntervals.READ_ONLY_CALENDARS);
            }
        }
        
        // one time such as browsing calendar next/prev (let's use cache if possible and NOT override cache with these results)
        const oneTimeFetch = params.source == "popup" || params.source == "agenda" || params.source == "selectedCalendars";
        
        const cachedFeedDetails = await getCachedFeedDetails(calendar.id);
        
        var isWithinLastCachedTimeFrame;
        if (cachedFeedDetails.CPstartDate && cachedFeedDetails.CPendDate) {
            isWithinLastCachedTimeFrame = params.startDate.isEqualOrAfter(cachedFeedDetails.CPstartDate) && params.endDate.isEqualOrBefore(cachedFeedDetails.CPendDate);
        }

        //console.log("feed", params.bypassCache, calendarThatShouldBeCached, oneTimeFetch, params.source, feedFromCache, params, cachedFeedDetails, !expired, isWithinLastCachedTimeFrame);
        if (params.bypassCache != true && feedFromCache && !expired && isWithinLastCachedTimeFrame && (calendarThatShouldBeCached || oneTimeFetch || (params.source == GCM_SOURCE && cachedFeedDetails.CPlastFetched))) {
            console.info("Fetching " + getCalendarName(calendar) + " [CACHED]");
        } else {
            if (await isAllowedRealtimeSync()) {
                try {
                    await ensureWatchCalendarEvents({calendarId:calendar.id, source:params.source});
                } catch (error) {
                    logError("error watchCalendarEvents: " + error + " " + calendar.id);
                }
            } else {
                console.log("realtime watch/sync not enabled");
            }
            const moreParams = deepClone(params);
            moreParams.itemsRootId = "items";
    
            moreParams.userEmail = params.email;
            moreParams.roundtripArg = calendar.id;

            if (calendar.id == TASKS_CALENDAR_OBJECT.id) {
                moreParams.oauthForDevices = oAuthForTasks;
                moreParams.url = `${TASKS_BASE_URL}/users/@me/lists?cachePatch=${Date.now()}`;
                moreParams.data = {
                    maxResults: TASKS_LISTS_MAX
                };

                try {
                    const taskLists = await getAllAPIData(moreParams);
                    cachedFeeds["taskLists"] = taskLists;

                    let feedDetails = await getCachedFeedDetails("taskLists");

                    feedDetails.CPlastFetched = new Date();
                    feedDetails.CPstartDate = params.startDate;
                    feedDetails.CPendDate = params.endDate;

                    console.log("taskLists", taskLists);

                    const tasksPromises = [];
                    taskLists.items.forEach(taskList => {
                        console.log("tasklist", taskList);
                        tasksPromises.push(getAllAPIData({
                            oauthForDevices: oAuthForTasks,
                            itemsRootId: "items",
                            userEmail: params.email,
                            roundtripArg: `taskList_${taskList.id}`,
                            url: `${TASKS_BASE_URL}/lists/${taskList.id}/tasks?cachePatch=${Date.now()}`, // using unique url ie. cachePatch because it seems response would be cached
                            data: {
                                dueMin: params.startDate.toRFC3339(),
                                dueMax: params.endDate.toRFC3339(),
                                showHidden: true,
                                maxResults: TASKS_MAX,
                            }
                        }));
                    });

                    const tasksDataArray = await Promise.all(tasksPromises);

                    let allTaskItems = [];
                    tasksDataArray.forEach(tasksData => {
                        console.log("tasksData", tasksData)
                        allTaskItems = allTaskItems.concat(tasksData.items);
                    });

                    fetchEventsObj = {
                        roundtripArg: TASKS_CALENDAR_OBJECT.id,
                        items: allTaskItems
                    }

                    console.log("before logic to update cache for tasks")
                    if (params.grantingAccess || !oneTimeFetch || (params.source == "selectedCalendars" && !feedFromCache)) {
                        console.log("update cache for tasks")
                        cachedFeeds[TASKS_CALENDAR_OBJECT.id] = fetchEventsObj;
                            
                        feedDetails = await getCachedFeedDetails(TASKS_CALENDAR_OBJECT.id);

                        feedDetails.CPlastFetched = new Date();
                        feedDetails.CPstartDate = params.startDate;
                        feedDetails.CPendDate = params.endDate;
                    }
                } catch (error) {
                    logError("error in send:" + error);
                    // must return cached feeds but append error (if needed)
                    fetchEventsObj.error = error;
                    throw fetchEventsObj;
                }
            } else {
                moreParams.oauthForDevices = oAuthForDevices;
                moreParams.url = `/calendars/${encodeURIComponent(calendar.id)}/events`;
                moreParams.data = {
                    //eventTypes: EventType.DEFAULT, // commented oct 2024
                    maxResults: MAX_RESULTS_FOR_EVENTS // Max results is set by API at 2500 https://developers.google.com/google-apps/calendar/v3/reference/events/list
                };
                
                // important: must check for nextSyncToken check here or we could recurse infinitely with calls to fetchCalendarEvents below
                if (feedFromCache && !params.skipSync && cachedFeedDetails.nextSyncToken && !oneTimeFetch && isWithinLastCachedTimeFrame) {
                    console.info("Fetching " + getCalendarName(calendar) + " [PARTIAL]");
                    
                    moreParams.data.syncToken = cachedFeedDetails.nextSyncToken;
                    moreParams.data.showDeleted = true;
                    moreParams.data.singleEvents = false;
                    
                    try {
                        const partialItemsResponse = await fetchAllPartialItems(moreParams, params);
                        cachedFeedDetails.CPlastFetched = new Date();
                        cachedFeedDetails.nextSyncToken = partialItemsResponse.nextSyncToken;
                    } catch (error) {
                        // Sometimes sync tokens are invalidated by the server, for various reasons including token expiration or changes in related ACLs. In such cases, the server will respond to an incremental request with a response code 410. This should trigger a full wipe of the client’s store and a new full sync.
                        if (error.code == 410) {
                            console.warn("sync token invalidated, do full sync...");
                            
                            delete cachedFeedDetails.nextSyncToken;
                
                            // recurse once
                            fetchEventsObj = await fetchCalendarEvents(params, selectedCalendars);
                        } else {
                            logError("error in oauth partial send:" + error);
                            fetchEventsObj.error = error;
                            throw fetchEventsObj;
                        }
                    }
                } else {
                    //const fetchToken = !oneTimeFetch && (!feedFromCache || !cachedFeedDetails.nextSyncToken);
                    try {
                        //const nextSyncToken = await ensureSyncToken(fetchToken, params.calendarId, moreParams);
    
                        const calendar = getCalendarById(params.calendarId);
                        console.info("Fetching " + getCalendarName(calendar));
                        
                        moreParams.data.singleEvents = true;
                        //moreParams.data.orderBy = "startTime"; // commented along with ensureSyncToken above because nextSyncToken would not be returned
                        moreParams.data.timeMin = params.startDate.toRFC3339();
                        moreParams.data.timeMax = params.endDate.toRFC3339();
                    
                        fetchEventsObj = await getAllAPIData(moreParams);
                        console.log("fetchEventsObj", moreParams.url, fetchEventsObj);
                    
                        if (!oneTimeFetch || (params.source == "selectedCalendars" && !feedFromCache)) {
                            // update cache
                            cachedFeeds[params.calendarId] = fetchEventsObj;
                    
                            const feedDetails = await getCachedFeedDetails(params.calendarId);
    
                            feedDetails.CPlastFetched = new Date();
                            feedDetails.CPstartDate = params.startDate;
                            feedDetails.CPendDate = params.endDate;
                            
                            if (fetchEventsObj.nextSyncToken) {
                                feedDetails.nextSyncToken = fetchEventsObj.nextSyncToken;
                            }
                        }
                    } catch (error) {
                        logError("error in send:" + error);
                        // must return cached feeds but append error (if needed)
                        fetchEventsObj.error = error;
                        throw fetchEventsObj;
                    }
                }
            }
        }
    } else {
        console.info("Fetching " + getCalendarName(calendar) + " [invisible + (notifs off OR excluded OR isGadget]");
    }
    return fetchEventsObj;
}

async function reInitCachedFeeds() {
    cachedFeeds = await storage.get("cachedFeeds");
    console.log("reInitCachedFeeds", cachedFeeds);
}

async function pollServer(params = {}) {
    console.info("pollServer");

    if (params.reInitCachedFeeds) {
        await reInitCachedFeeds();
    }

    storage.setDate("_lastPollTime");

    if (await storage.get("_firstLoad")) {
        chrome.action.setBadgeBackgroundColor({color:BadgeColor.EMOJI});
        await updateBadge({badgeText: "⏳"});
        chrome.action.setTitle({title:getMessage("loading")});
        storage.disable("_firstLoad");
    }

    const tokenResponses = await oAuthForDevices.getTokenResponses();
    if (tokenResponses.length) {
        // get most recent token used
        let mostRecentTokenUsed;
        tokenResponses.forEach(tokenResponse => {
            if (!mostRecentTokenUsed || tokenResponse.expiryDate?.isAfter(mostRecentTokenUsed.expiryDate)) {
                mostRecentTokenUsed = tokenResponse;
            }
        });
        
        const email = mostRecentTokenUsed.userEmail;
        await storage.set("email", email);
        params.email = email;
        
        // update the uninstall url caused we detected an email
        if (email != await storage.get("_uninstallEmail")) {
            setUninstallUrl(email);
        }

        if (await isOnline()) {

            // do this ensureGCMRegistration outside of the loop because concurrent calls to tokeninstance fail with Asynchronous operation is pending
            try {
                await ensureGCMRegistration();
            } catch (error) {
                console.warn("error ensureGCMRegistration", error);
            }

            if (canViewEventsAndCalendars(mostRecentTokenUsed)) {
                const [, , fetchCalendarListResponse] = await Promise.all([
                    fetchCalendarSettings(params),
                    fetchColors(params),
                    fetchCalendarList(params)
                ]);
    
                await storage.set("cachedFeeds", cachedFeeds);
                await storage.set("cachedFeedsDetails", cachedFeedsDetails);
    
                await processCalendarListFeed(fetchCalendarListResponse);
            } else {
                calendarMap = await initCalendarMap();
            }
            const fetchAllResponse = await fetchAllCalendarEvents(params);
            events = fetchAllResponse.events;
            params.events = events; // avoid refetching in checkEvents
            await checkEvents(params);
            await storage.set("cachedFeeds", cachedFeeds);
            await storage.set("cachedFeedsDetails", cachedFeedsDetails);
            console.log("pollserver response", fetchAllResponse);
            return fetchAllResponse;
        } else {
            console.log("offline: so skip ALL fetches");
            await processCalendarListFeed()
            return {offline:true};
        }
    } else {
        console.log("no tokens saved");
        showLoggedOut();
    }
}

function isEventShownOrSnoozed(event, reminderTime, snoozers) {
	
	// Must check snoozers before eventsshown because a snoozed event has remindertime passed as a param
    if (snoozers.some(snoozer => isSameEvent(event, snoozer.event))) {
        return true;
    }

	for (const eventShown of eventsShown) {
		if (isSameEvent(event, eventShown)) {
            if (event.startTime.isBefore(eventShown.startTime)) { // patch for snoozers reapparing because the eventsShown time would have the future snooze date but current event time would be current event time
                //console.log("isEventShownOrSnoozed = true (happens when I snooze+move event): " + event.summary + " _ " + event.startTime + " " + eventShown.startTime)
                return true;
            } else if (event.startTime.getTime() == eventShown.startTime.getTime()) {
                // Check that this particular reminder time has not been shown (may have other reminder times due to the ability to set multiple popup reminder settings per event)
                if (reminderTime) {
                    if (reminderTime.isEqualOrBefore(eventShown.reminderTime)) {
                        return true;
                    }
                } else {
                    return true;
                }
			} else {
                //console.log("isEventShownOrSnoozed: 2 " + event.summary + " " + event.startTime.getTime() + " " + eventShown.startTime.getTime());
				return false;
			}
		}
    }
    //console.log("isEventShownOrSnoozed: 3 " + event.summary);
	return false;
}

function isTimeToShowNotification(params) {
    const event = params.event;
    const reminderTime = params.reminderTime;
    const lastUpdated = params.lastUpdated;

	let createdDate;
	let updatedDate;

    if (params.showNotifsCreatedInPast) {
        createdDate = new Date(1);
        updatedDate = new Date(1);
    } else {
        if (event.kind == TASKS_KIND) {
            createdDate = new Date(1); // since tasks have no creation date then assume it was created in the past
        } else if (event.created) {
            createdDate = new Date(event.created);
        }
        if (event.updated) {
            updatedDate = new Date(event.updated);
        }
    }

	let isTimeToShow = false;
	
	// the journal exception: do not show notification for events created in the past, like when marieve puts past events for the purpose of journaling
	if (event.startTime.isBefore(createdDate)) {
		console.log("%cDON'T SHOW - created in past/journaling: " + event.summary, "font-size:0.7em", event);
	} else {
		let pastDoNotShowPastNotificationsFlag = true;
		if (params.doNotShowPastNotifications) {
	
			// get minimum buffer which is equal to check interval
			let bufferInSeconds = PollingIntervals.CHECK_EVENTS / ONE_SECOND;
			// than add double that buffer (just to make sure)
			bufferInSeconds += bufferInSeconds * 2;

			const allDayEventBuffer = new Date().addSeconds(-bufferInSeconds);
            const timedEventBuffer = new Date().addHours(-2); // someone created an early recurring event like 7-8am and they would open her computer at 9am and miss that one because of the don't show past events, I added 2 hour grace period from the end of the event time
			
			// ** using endTime instead of reminderTime (because if the event is still in progress than still show notification)
			if ((event.allDay && event.endTime?.isBefore(allDayEventBuffer)) || (!event.allDay && event.endTime?.isBefore(timedEventBuffer))) {
                console.log("pastDoNotShowPastNotificationsFlag is false because before endtime", event);
				pastDoNotShowPastNotificationsFlag = false;
			}
		}
		
		if (pastDoNotShowPastNotificationsFlag && reminderTime?.isEqualOrBefore()) {
			// don't show if recurring timed events are created in past (must be recurring) cause we add events from another device and they might only get fetched after there start time in my extension
			// don't show if all day event is created today
			// don't show if recurring events were created before now
			
			function failCreateUpdateCheck(createUpdateDate) {
				return createUpdateDate && (reminderTime.isEqualOrBefore(createUpdateDate) && (event.recurringEventId || event.allDay));
			}
			
			if (failCreateUpdateCheck(createdDate)) {
				console.log("%cDON'T SHOW - because created after reminder passed: " + event.summary, "font-size:0.7em");
				isTimeToShow = false;
			} else if (failCreateUpdateCheck(updatedDate)) {
				console.log("%cDON'T SHOW - because updated today or ealier: " + event.summary, "font-size:0.7em");
				isTimeToShow = false;
			} else if (reminderTime.isBefore(params.installDate)) {
				//console.log("DON'T SHOW - because just installed: " + event.summary);
				isTimeToShow = false;
			} else {
				isTimeToShow = true;
			}
		} else {
			isTimeToShow = false;
		}
		
		// patch: seems Google+ birthday contacts were changing IDs and thus reappering all the time so lets not show them
		var passedGooglePlusContactsBug = true;
		if (getEventCalendarId(event) == "#contacts@group.v.calendar.google.com") {
			if (event.gadget?.preferences?.["goo.contactsIsMyContact"] == "false") {
				//console.warn("google+ contacts bug: ", event);
				passedGooglePlusContactsBug = false;
			}
		}
		
		if (!passedGooglePlusContactsBug) {
			return false;
		}
		
		// we probably just updated the calendar's defaultreminder time (in the extension) so let's ignore this reminder and store it as shown
		// lastUpdated is set in the options > notifications when a user changes the reminder times
		if (isTimeToShow && lastUpdated && reminderTime.isEqualOrBefore(lastUpdated)) {
			//console.log("eventsIgnoredDueToCalendarReminderChangeByUser: ", reminderTime, lastUpdated);
			updateEventShown(event, eventsShown, params.defaultEventNotificationTime);
			eventsIgnoredDueToCalendarReminderChangeByUser = true;
			isTimeToShow = false;
		}
	}

	return isTimeToShow;
}

async function generateNotificationButton(buttons, buttonsWithValues, value, event) {
    const groupedNotification = await isGroupedNotificationsEnabled();
	if (value) {
		
		var button;
		
		if (value == "dismiss") {
			// dismiss
			
			var title;
			if (groupedNotification && notificationsOpened.length >= 2) {
				title = getMessage("dismissAll");
			} else {
				title = getMessage("dismiss");
			}
			button = {title:title, iconUrl:"/images/cancel-white.png"};
			
		} else if (value == "snoozeTimes") {
			button = {title:"Snooze times...", iconUrl:"/images/snooze-white.png"};
		} else if (value == "location|hangout") {
			if (!groupedNotification || (groupedNotification && notificationsOpened.length == 1)) {
				if (event) {
                    const videoMeetingDetails = await getVideoMeetingDetails(event, true);
					const eventSource = getEventSource(event, !videoMeetingDetails);
					
					if (videoMeetingDetails) {
						button = {
                            title: videoMeetingDetails.label,
                            iconUrl:"/images/video.png"
                        };
					} else if (eventSource) {
						let iconUrl;
						if (eventSource.isGmail) {
							iconUrl = "/images/gmail.png";
						} else {
							iconUrl = "/images/link.png";
						}
						button = {
                            title: eventSource.title,
                            iconUrl: iconUrl
                        };
					} else if (event.location) {
						button = {
                            title:event.location,
                            iconUrl: "/images/pin_map.png"
                        };
					}
				}
			}
		} else if (value == "reducedDonationAd") {
			button = {title:getMessage("reducedDonationAd_notification", "50¢")};
			//button = {title:"Extras are only 50c click to see/hide this.", iconUrl:"/images/thumbs_up.png"};
		} else {
			// snooze
			var unit = value.split("_")[0];
			var delay = value.split("_")[1];
			
			var msgId;
			if (unit == "minutes") {
				msgId = "Xminutes"
			} else if (unit == "hours") {
				if (delay == 1) {
					msgId = "Xhour";
				} else {
					msgId = "Xhours";
				}
			} else if (unit == "days") {
				if (delay == 1) {
					msgId = "Xday";
				} else {
					msgId = "Xdays";
				}
			} else {
				console.error("no unit in snooze: " + unit);
			}
			
			var title;
			if (groupedNotification && notificationsOpened.length >= 2) {
				title = getMessage("snoozeAll");
			} else {
				title = getMessage("snooze");
			}
			title += ": " + getMessage(msgId, delay) + "";
			button = {title:title, iconUrl:"/images/snooze-white.png"};
		}

		if (button) {
			buttons.push(button);
			
			const buttonWithValue = deepClone(button);
			buttonWithValue.value = value;
			buttonsWithValues.push(buttonWithValue);
		}
	}
}

async function generateNotificationItem(event) {
	const eventNotificationDetails = await getEventNotificationDetails(event);
	const item = {};
	item.title = eventNotificationDetails.title;
	item.message = "";
	if (eventNotificationDetails.timeElapsed) {
		item.message = ` ${eventNotificationDetails.timeElapsed}`;
	}
	if (eventNotificationDetails.calendarName) {
		if (item.message) {
			item.message += ` `;
		}
		item.message += `(${eventNotificationDetails.calendarName})`;
	}
	return item;
}

async function generateNotificationOptions(notifications) {
	
	const options = {
		type: "",
		title: "",
		message: "",
		iconUrl: Icons.Reminder_ExtensionNotification,
	}

    if (supportsNotificationButtons()) {
        options.buttons = [];
    }
	
	if (notifications.length == 1) {
		options.type = "basic";
		var eventNotificationDetails = await getEventNotificationDetails(notifications[0].event);
		options.title = eventNotificationDetails.title;
        if (eventNotificationDetails.timeElapsed) {
            options.title += ` (${eventNotificationDetails.timeElapsed})`;
        }
        if (eventNotificationDetails.calendarName) {
            options.title += ` (${eventNotificationDetails.calendarName})`;
        }
	} else {
		options.type = "basic";
		var startOfOldNotifications = 0;
		
		// if only 1 new recent event among the old ones than highlight it (bigger font) by putting it in the title of the notification
		if (notifications.length >= 2 && notifications[0].recent && !notifications[1].recent) {
			
			var eventNotificationDetails = await getEventNotificationDetails(notifications[0].event);
			options.title = eventNotificationDetails.title;
			if (eventNotificationDetails.timeElapsed) {
				options.title += ` (${eventNotificationDetails.timeElapsed})`;
			}
			if (eventNotificationDetails.calendarName) {
				options.title += ` (${eventNotificationDetails.calendarName})`;
			}
			
			startOfOldNotifications = 1;
		} else {
			if (DetectClient.isLinux()) {
				// patch because linux gave empty notification unless the title was not empty or not empty string ""
				options.title = notifications.length + " reminders";
			}
		}
		
		var MAX_ITEM_LINES = 3;
		let itemCount = 0;
        for (let index = 0; index < notifications.length; index++) {
            const notification = notifications[index];
			// skip those that have been highlighted already above
			if (index >= startOfOldNotifications) {
				// if on last available line and but there still 2 or more events than put the "more notice"
				if (itemCount == MAX_ITEM_LINES - 1 && notifications.length - index >= 2) {
					options.contextMessage = `${notifications.length - itemCount - startOfOldNotifications} ${getMessage("more")}...`;
					break;
				} else {
					const item = await generateNotificationItem(notification.event);
					options.message += `${item.title} ${item.message}`;
					itemCount++;
					if (index < notifications.length-1) {
						options.message += "\n";
					}
					//options.items.push(item);
				}
			}
		}
		
	}
	

	var buttonsWithValues = []; // used to associate button values inside notification object
	var buttonValue;
	
	var event = notifications.first().event;
	
    if (supportsNotificationButtons()) {
	    buttonValue = await storage.get("notificationButton1");
        await generateNotificationButton(options.buttons, buttonsWithValues, buttonValue, event);

        if (await shouldShowReducedDonationMsg()) {
            buttonValue = "reducedDonationAd";
        } else {
            buttonValue = await storage.get("notificationButton2");
        }
        await generateNotificationButton(options.buttons, buttonsWithValues, buttonValue, event);
    }
	
	if (notifications.length) {
		notifications.forEach(notification => {
			notification.buttons = buttonsWithValues;
		});
	}

	if (DetectClient.isWindows()) {
		options.appIconMaskUrl = Icons.AppIconMaskUrl;
	}
	
	if (options.items && !options.items.length) {
		delete options.items;
	}
	
	const showNotificationDuration = await storage.get("showNotificationDuration");
	if (showNotificationDuration == "6") {
		options.priority = 0;
	} else if (showNotificationDuration == "never") {
        if (DetectClient.isFirefox()) {
            options.priority = 2;
        } else {
            if (!DetectClient.isMac()) {
                options.requireInteraction = true;
            }
        }
	} else {
		options.priority = 2;
	}
	
	return options;
}

function generateNotificationIdFromEvent(event, type) {
	return JSON.stringify({
        eventId: event.id,
        calendarId: getEventCalendarId(event),
        summary: event.summary,
        type: type,
        uniqueIdForNotificationId: Math.floor(Math.random() * 1000000)
    });
}

function getNotificationObj(notificationId) {
	return JSON.parse(notificationId);
}

async function openNotification(notifications) {
	const options = await generateNotificationOptions(notifications);
	
	console.log("create notif: ", notifications, options);
	
	let notificationId;
	if (await isGroupedNotificationsEnabled()) {
		notificationId = GROUPED_NOTIFICATION_ID;
	} else {
		notificationId = notifications.first().id;
    }

    await chrome.notifications.create(notificationId, options);
    storage.setDate("_lastNotificationShownDate");
    
    const newState = await chrome.idle.queryState(IDLE_DETECTION_INTERVAL);
    console.log("idle state when show notif: " + newState);
    if (newState != "active") {
        notificationsOpenedCountWhenIdle = notificationsOpened.length;
    }
    forgottenReminder.start();
}

function ForgottenReminder() {
	return { // public interface
		start: async function() {
            // all private members are accesible here
            this.stop();
            await storage.set("_forgottenReminderCount", 0);
            
            const pendingNotificationsInterval = await storage.get("pendingNotificationsInterval");
            if (pendingNotificationsInterval) {
                chrome.alarms.create(Alarms.FORGOTTEN_REMINDER, {periodInMinutes: parseInt(pendingNotificationsInterval)});
            }
		},
		execute: async (params = {}) => {
			if (params.test || await storage.get("_forgottenReminderCount") == 1) {
                const notificationSound = await storage.get("notificationSound");
				if (notificationSound) {
					console.log("forgotten reminder sound: " + new Date());
					const newState = await chrome.idle.queryState(15);
                    if (newState == "active") {
                        playNotificationSoundFile(notificationSound, true);
                    }
				}
			}
            
            // had to comment this because overtime a bug would happen where it would draw an empty icon animation 
            //if (!forgottenReminderAnimation) {
                forgottenReminderAnimation = new IconAnimation("/images/bell_badge.png");
            //}
			forgottenReminderAnimation.animate(previousBadgeText => {
				updateBadge({forceRefresh:true, badgeText:previousBadgeText, ignoreTooltip: true});
            });
            
            const reminderWindowId = await storage.get("reminderWindowId");
            if (reminderWindowId) {
                chrome.windows.update(reminderWindowId, {drawAttention:true}).catch(error => {
                    console.warn("could not draw attention to reminder window: " + error);
                })
            }
		},
		stop: function() {
			chrome.alarms.clear(Alarms.FORGOTTEN_REMINDER);			
		}
	};
};

function gatherNotifications() {
	var newNotifications = [];
	var oldNotifications = [];
	notificationsQueue.forEach(notification => {
		
		// patch for issue when notification was not being removed when snoozed within remindersWindow because id's were mismatched
		if (!notification.id) {
			notification.id = generateNotificationIdFromEvent(notification.event);						
		}
		
		const found = notificationsOpened.some(notificationOpened => {
			return isSameEvent(notification.event, notificationOpened.event);
		});
		
		if (found) {
			notification.recent = false;
			oldNotifications.push(notification);
		} else {
			notification.recent = true;
			newNotifications.push(notification);
		}
	});
	
	// re-initialize eventsInGroupNotification *after performing code above to identify new notifications
	notificationsOpened = notificationsQueue.shallowClone();
	
	var notificationsInOrder = [];
	notificationsInOrder = notificationsInOrder.concat(newNotifications, oldNotifications);

	sortNotifications(notificationsInOrder);
	
	return {notificationsInOrder:notificationsInOrder, newNotifications:newNotifications, oldNotifications:oldNotifications};
}

function showWebNotification(title, params = {}) {
    if (globalThis.registration) {
        
        webNotification = {
            tag: params.tag
        }

        return registration.showNotification(title, {
            body: params.body,
            icon: params.icon,
            requireInteraction: params.requireInteraction,
            tag: params.tag,
            silent: params.silent
        });
    } else {
        return new Promise((resolve, reject) => {
            webNotification = new Notification(title, {
                body: params.body,
                icon: params.icon,
                requireInteraction: params.requireInteraction,
                tag: params.tag,
            });
            webNotification.onclick = function() {
                params.newNotificationOnClick(params);
                if (webNotification) {
                    webNotification.close();
                }
            }
            webNotification.onshow = function() {
                resolve();
            }
            webNotification.onclose = function() {
                console.log("onclose notification");
                webNotification = null;
            }
            webNotification.onerror = function(e) {
                reject("onerror with notification");
            }
        });
    }
}

async function closeWebNotifications() {
    if (globalThis.registration) {
        const notifs = await registration.getNotifications();
        notifs.forEach(notif => {
            notif.close();
        });
    } else if (webNotification) {
        webNotification.close();
    }
}

async function showNotifications(params = {}) {
    const email = await storage.get("email");
	
	if (await isDND()) {
		return "DND enabled! So cannot show notifications";
	} else {
		if (notificationsQueue.length >= 1) {
			
			const desktopNotification = await storage.get("desktopNotification");

            if (!desktopNotification) {
                return "Notifications need to be enabled in the extension";
            }
			
			var textNotification = params.testType == "text" || (params.testType == undefined && desktopNotification == "text");
			var richNotification = params.testType == "rich" || (params.testType == undefined && desktopNotification == "rich");
			var popupWindowNotification = params.testType == "popupWindow" || (params.testType == undefined && desktopNotification == "popupWindow");
			
			if (textNotification || !chrome.notifications) {
				
                var notificationError = null;

                // text window
                for (const notification of notificationsQueue) {
                    const eventNotificationDetails = await getEventNotificationDetails(notification.event);
                    const title = eventNotificationDetails.title;
                    let message = "";
                    if (eventNotificationDetails.calendarName) {
                        message = "from " + eventNotificationDetails.calendarName;
                    }
    
                    await showWebNotification(title, {
                        body: message,
                        icon: Icons.Reminder_NativeNotification,
                        requireInteraction: !DetectClient.isMac(),
                        tag: generateEventTag(notification.event),
                        silent: true,
                        newNotificationOnClick: async () => {
                            openEventUrl(notification.event);
                        }
                    });

                    // clear queue
                    await updateNotificationEventsShown([notification], eventsShown);
                    notificationsQueue = [];
                }
                
                // let's wait to see if notification.onerror is called before concluding a successful callback here
                await sleep(200);
                if (notificationError) {
                    throw notificationError;
                }
			} else if (richNotification) {
				// rich notification
				
				// notificationsQueue = notifications that should be launched and are acculumated each time checkEvents is passed
				if (await isGroupedNotificationsEnabled()) {
					// group notifications

					var gatheredNotifications = gatherNotifications();
					
					var notificationsInOrder = gatheredNotifications.notificationsInOrder;
					var newNotifications = gatheredNotifications.newNotifications;
					var oldNotifications = gatheredNotifications.oldNotifications;
					
					console.log("new notifs", newNotifications);
					if (newNotifications.length || params.testType) {
                        console.log("clear", newNotifications);
    
                        await new Promise((resolve, reject) => {
                            chrome.notifications.clear(GROUPED_NOTIFICATION_ID, async function(wasCleared) {
                                try {
                                    await openNotification(notificationsInOrder);
                                    resolve();
                                } catch (error) {
                                    console.error("Problem showing notification: ", error);
                                    // reset opened notification flags
                                    closeNotifications(notificationsOpened);
                                    reject(error);
                                }
                            });
                        });
					} else {
						var warning = "No new notifications";
						console.log(warning, newNotifications);
						return {warning:warning};
					}
				} else {
					// Individual Notifications
					// notificationOpened = notification that HAVE been launched
					// this method is used to make we don't relaunch notification that have already been displayed
                    
                    for (const notification of notificationsQueue) {
						const found = notificationsOpened.some(notificationOpened => {
							return isSameEvent(notification.event, notificationOpened.event);
                        });

						if (!found) {
							notification.id = generateNotificationIdFromEvent(notification.event);
                            
                            try {
                                await openNotification([notification]);
                                notificationsOpened.push(notification);
                            } catch (error) {
                                // ignore
                                console.info("Problem showing notification: ", error);
                            }
						}
					}
				}
			} else if (popupWindowNotification) {
				var gatheredNotifications = gatherNotifications();
				
				var notificationsInOrder = gatheredNotifications.notificationsInOrder;
				var newNotifications = gatheredNotifications.newNotifications;
				var oldNotifications = gatheredNotifications.oldNotifications;
				
				notificationsOpened = notificationsQueue.shallowClone();
                
				if (newNotifications.length || params.testType) {
					console.log("open reminders from shownotif");
					openReminders({
						useIdle: !params.testType
					});
					
					const newState = await chrome.idle.queryState(IDLE_DETECTION_INTERVAL);
                    console.log("idle state when show notif: " + newState);
                    if (newState != "active") {
                        notificationsOpenedCountWhenIdle = notificationsOpened.length;
                    }
				}
				
			} else {
				// html window
				// Handle exists
				// not used anymore...
				throw Error("Notification system not recognized!");
			}
		} else {
			throw Error("No events in the queue");
		}
	}
}

async function testNotification(params) {
	const notification = {
        test: true,
		time: new Date(),
		reminderTime: new Date(),
		event: {
            id: `test-notif-${Math.random()}`,
            test: true,
            allDay: false,
            title: getMessage("testEvent"),
            summary: getMessage("testEvent"),
            description: getMessage("testDescription"),
            startTime: new Date(),
            calendar: getPrimaryCalendar(await getArrayOfCalendars())
        }
	};
	notificationsQueue.push(notification);

    const notificationSound = await storage.get("notificationSound");
	playNotificationSoundFile(notificationSound);

	return showNotifications(params);
}

async function getChromeWindowOrBackgroundMode() {
    if (chrome.permissions && !DetectClient.isFirefox()) {
        try {
            const result = await chrome.permissions.contains({ permissions: ["background"] });
            if (result) {
                return;
            }
        } catch (error) {
            console.warn(error);
        }
    }
    
    const windows = await chrome.windows.getAll(null);
    if (windows?.length) {
        return;
    } else {
        throw Error("No windows exist");
    }
}

function queueNotification(params) {
	// checkEvents might have been called several times so let's make sure not to add duplicate entries
	const found = notificationsQueue.some(notificationInQueue => {
		if (notificationInQueue.event.id == params.event.id && notificationInQueue.reminderTime.isEqual(params.reminderTime)) {
			console.warn("already queued this event (bug?)", params);
			return true;
		}
	});
	
	if (!found) {
		notificationsQueue.push(params);
        return true;
	}
}

async function ensurePollServer() {
    const lastPollTime = await storage.get("_lastPollTime");
    const pollingIntervalInMillis = hours(PollingIntervals.ACTIVE_CALENDARS)
    const elapsedTime = Date.now() - lastPollTime.getTime();
    if (elapsedTime >= pollingIntervalInMillis) {
        // logic here: make sure any events added between the 30 min intervals get loaded so idle time should be larger than 30min+buffer
        // because pollinginterval is in MILLIseconds and idle uses seconds!
        const pollingIntervalInSeconds = pollingIntervalInMillis / ONE_SECOND;
        const idleBuffer = 5 * 60; // 5 minutes;
        const idleSeconds = pollingIntervalInSeconds + idleBuffer
        
        const state = await chrome.idle.queryState(idleSeconds);
        console.log("query state: ", state);
        // only poll if active or user just returned from standby is at login screen (note the encapsulating method above must also pass ie. can't poll faster than polling interval)
        if (state == "active" || (state == "locked" && await detectSleepMode.isWakingFromSleepMode())) {
            try {
                await pollServer();
            } catch (error) {
                // return resolve anyways for caller to be able to use .then
                console.warn("pollserver warning", error);
            }
        } else {
            console.log("state: " + state + " don't poll");
        }
    }
}

async function checkEvents(params = {}) {
    try {
        await getChromeWindowOrBackgroundMode();
    } catch (error) {
        console.error("Maybe NO chromeWindowOrBackgroundMode, possible error: " + error);
        return;
    }
	
    // SKIP because interval to short
    if (params.source == "interval") {
        const lastCheckEventsTime = await storage.get("_lastCheckEventsTime");
        if (Math.abs(lastCheckEventsTime.diffInSeconds()) < 5) {
            console.log("skip checkevents");
            return;
        }
        const remindersWindowClosedTime = await storage.get("_remindersWindowClosedTime");
        if (remindersWindowClosedTime && Math.abs(remindersWindowClosedTime.diffInSeconds()) < 2) {
            console.log("skip checkevents, patch for reminders just closed");
            return;
        }
        await storage.setDate("_lastCheckEventsTime");
    }
    
    console.log("checkEvents: " + params.source);
    
    // fetch any new or deleted events before updating visuals
    await ensurePollServer();

    if (!await storage.get("loggedOut")) {
        var nextEvent = null;
        var badgeText = "";
        var badgeColor = null;
        var toolTip = "";
        var previousNextEvent = null;
        var unitOfTimeLeftOnBadge;
        const oldestEventDateToFetch = new Date().subtractDays(DAYS_TO_REMOVE_OLD_EVENTS);
        let eventInProgress;
        eventsIgnoredDueToCalendarReminderChangeByUser = false;

        if (await storage.get("syncDismissedAndSnoozedRemindersAcrossExtensions")) {
            const keys = await chrome.storage.sync.getKeys();
            for (const key of keys) {
                if (key.startsWith(SYNC_OPERATION_PREFIX)) {
                    const objValue = await chrome.storage.sync.get(key);
                    await processSyncOperation(key, objValue[key]);
                }
            }
        }
        
        const [
            email,
            installDate,
            selectedCalendars,
            calendarSettings,
            excludedCalendars,
            desktopNotification,
            hideColonInTime,
            snoozers,
            doNotShowNotificationsForRepeatingEvents,
            doNotShowPastNotifications,
            excludeRecurringEventsButtonIcon,
            excludeHiddenCalendarsFromButton,
            maxDaysAhead,
            showDaysLeftInBadge,
            showMinutesLeftInBadge,
            showHoursLeftInBadge,
            timeRemainingForCurrentEvent,
            showBusyEvents,
            defaultEventNotificationTime,
            onlyShowBadgeEventsWithNotifs,
            showNotifsCreatedInPast
        ] = await Promise.all([
            storage.get("email"),
            getInstallDate(),
            storage.get("selectedCalendars"),
            storage.get("calendarSettings"),
            storage.get("excludedCalendars"),
            storage.get("desktopNotification"),
            storage.get("hideColonInTime"),
            getSnoozers(),
            storage.get("doNotShowNotificationsForRepeatingEvents"),
            storage.get("doNotShowPastNotifications"),
            storage.get("excludeRecurringEventsButtonIcon"),
            storage.get("excludeHiddenCalendarsFromButton"),
            storage.get("maxDaysAhead"),
            storage.get("showDaysLeftInBadge"),
            storage.get("showMinutesLeftInBadge"),
            storage.get("showHoursLeftInBadge"),
            storage.get("timeRemainingForCurrentEvent"),
            storage.get("showBusyEvents"),
            getDefaultEventNotificationTime(),
            storage.get("onlyShowBadgeEventsWithNotifs"),
            storage.get("showNotifsCreatedInPast")
        ]);

        calendarMap = calendarMap || await initCalendarMap();

        events = params.events || await getEvents();

        const eventsToRemoveFromReminders = [];

        events.forEach(event => {
            
            // make sure not excluded AND do not include notifications for free busy calendar (since we have no event titles to display for these events)
            const calendar = getEventCalendar(event);
            if ((showBusyEvents || calendar?.accessRole != CalendarAccessRole.FREE_BUSY)
                && event.startTime.isEqualOrAfter(oldestEventDateToFetch)
                && !hasUserDeclinedEvent(event)
                && (event.kind != TASKS_KIND || (event.kind == TASKS_KIND && event.status == TaskStatus.NEEDS_ACTION) )) {

                // For notifs
                
                if (!isCalendarExcludedForNotifs(calendar, excludedCalendars) && !isGadgetCalendar(calendar)) {
                    let passedDoNotShowNotificationsForRepeatingEvents = true;
                    // if a recurring event (aka. 'originalEvent' because it points to the recurring event) and user set to exclude recurring events then fail this test
                    if (event.recurringEventId && doNotShowNotificationsForRepeatingEvents) {
                        passedDoNotShowNotificationsForRepeatingEvents = false
                    }
                    
                    const passedRemindOnRespondedEventsOnlyFlag = passedRemindOnRespondedEventsOnly(event, calendarSettings);
                    
                    // created this flag to skip this part because it is a CPU intensive loop when there are many events or eventsShown particularly the method isEventShownOrSnoozed()
                    if ((params.ignoreNotifications == undefined || !params.ignoreNotifications) && passedDoNotShowNotificationsForRepeatingEvents && passedRemindOnRespondedEventsOnlyFlag) {
                        const reminders = getEventReminders(event);
                        
                        if (reminders) {

                            let atleastOneReminderStillValidAfterUpdatingEvent = false;
                            let atleastOneReminderNotValidAfterUpdatingEvent = false;

                            reminders.some(reminder => { // used .some instead of .forEach because we want to break out of the loop if we queue a notification, bug introduced when i tried removing events from reminder window which were modified, they would be queued and dismissed in the same loop, refer to https://jasonsavard.com/forum/discussion/8565/not-receiving-accurate-notifications-for-gmail-meeting-invites#latest
                                const reminderTime = getReminderTime(event, reminder, defaultEventNotificationTime);
                                
                                if (reminder.method == "popup" && !isEventShownOrSnoozed(event, reminderTime, snoozers)) {
                                    const params = {
                                        event: event,
                                        reminderTime: reminderTime,
                                        lastUpdated: reminder.lastUpdated,
                                        doNotShowPastNotifications: doNotShowPastNotifications,
                                        installDate: installDate,
                                        defaultEventNotificationTime: defaultEventNotificationTime,
                                        showNotifsCreatedInPast: showNotifsCreatedInPast
                                    }

                                    if (isCurrentlyDisplayed(event, notificationsQueue)) {
                                        let createdTime = new Date(1);
                                        if (event.created) {
                                            createdTime = new Date(event.created);
                                        }

                                        let updatedTime;
                                        if (event.updated) {
                                            updatedTime = new Date(event.updated);
                                        } else {
                                            updatedTime = createdTime;
                                        }

                                        // for redundancy: make sure we are removing events only if they were updated, created and update times could be milliseconds apart when initially created, should check if they are less than x seconds apart then consider the event not modified
                                        const MINUTES_APART = 2;
                                        const eventWasModified = Math.abs(createdTime.diffInMinutes(updatedTime)) > MINUTES_APART;
                                        if (eventWasModified) {
                                            console.log("eventWasModified: ", event);
                                            if (isTimeToShowNotification(params)) {
                                                atleastOneReminderStillValidAfterUpdatingEvent = true;
                                            } else {
                                                atleastOneReminderNotValidAfterUpdatingEvent = true;
                                            }
                                        }
                                    } else if (isTimeToShowNotification(params)) {
                                        const added = queueNotification({event:event, reminderTime:reminderTime});
                                        if (added) {
                                            return true;
                                        }
                                    }
                                }
                            });

                            // might have updated the event or reminder time so might remove it from reminder
                            if (atleastOneReminderNotValidAfterUpdatingEvent && !atleastOneReminderStillValidAfterUpdatingEvent) {
                                console.log("eventsToRemoveFromReminders: ", event);
                                eventsToRemoveFromReminders.push(event);
                            }
                        }
                    }
                }
                
                // For badge

                let passedExcludeRecurringEventsButtonIcon = true;
                // if a recurring event (aka. 'originalEvent' because it points to the recurring event) and user set to exclude recurring events then fail this test
                if (event.recurringEventId && excludeRecurringEventsButtonIcon) {
                    passedExcludeRecurringEventsButtonIcon = false
                }
                
                let passedHiddenCalendarsFromButtonTest = true;
                const selected = isCalendarSelectedInExtension(calendar, email, selectedCalendars);

                if (calendar && !selected && excludeHiddenCalendarsFromButton) {
                    passedHiddenCalendarsFromButtonTest = false;
                }

                const passedBirthdayCalendarShowTest = passedBirthdayCalendarTest(event, email, selectedCalendars);

                const passedAllTests = passedBirthdayCalendarShowTest && passedExcludeRecurringEventsButtonIcon && passedHiddenCalendarsFromButtonTest;

                let currentEventInProgress;

                if (passedAllTests && !event.allDay && event.startTime.isBefore() && event.endTime?.isAfter()) {
                    // ignore long timed events, refer to https://bitbucket.org/jasonsav/checker-plus-for-google-calendar/issues/339/countdown-in-badge-showing-3414m-when
                    if (event.endTime.diffInDays(event.startTime) < 1) {
                        currentEventInProgress = true;
                        eventInProgress = event;
                    }
                }
                
                const nextEventMin = Math.ceil((event.startTime.getTime() - Date.now()) / ONE_MINUTE);

                if (currentEventInProgress || (passedAllTests && (event.startTime.getTime() - Date.now() >= 0 || event.allDay && isToday(event.startTime)) && nextEventMin < 60*24*maxDaysAhead)) {
                    
                    // don't put countdown for cals without a notifiaction by using isCalendarExcludedForNotifsByOptimization ref: https://jasonsavard.com/forum/discussion/comment/32451#Comment_32451
                    const passedOnlyShowBadgeEventsWithNotifs = !onlyShowBadgeEventsWithNotifs || (onlyShowBadgeEventsWithNotifs && !isCalendarExcludedForNotifsByOptimization(calendar, excludedCalendars));

                    if (!nextEvent && passedOnlyShowBadgeEventsWithNotifs) {
                        if (event.allDay) {
                            if (!isToday(event.startTime)) {
                                if (showDaysLeftInBadge) {
                                    badgeText = `${event.startTime.diffInDaysForHumans()}${getMessage(TimePeriodSymbol.DAY)}`;
                                    badgeColor = BadgeColor.GRAY;
                                }
                                
                                unitOfTimeLeftOnBadge = TimePeriodSymbol.DAY;
                                nextEvent = event;
                            }
                        } else {
                            if (currentEventInProgress) {
                                if (timeRemainingForCurrentEvent) {
                                    badgeText = `${Math.ceil(eventInProgress.endTime.diffInMinutes())}${getMessage(TimePeriodSymbol.MINUTE)}`;
                                    badgeColor = BadgeColor.GRAY;
                                    unitOfTimeLeftOnBadge = TimePeriodSymbol.MINUTE;

                                    nextEvent = event;
                                } else {
                                    // do nothing and don't set nextEvent
                                }
                            } else {
                                if (nextEventMin < 60) {
                                    if (showMinutesLeftInBadge) {
                                        badgeText = `${nextEventMin}${getMessage(TimePeriodSymbol.MINUTE)}`;
                                        badgeColor = BadgeColor.RED;
                                    } else {
                                        badgeText = formatTimeForBadge(event.startTime, hideColonInTime);
                                        badgeColor = BadgeColor.BLUE;
                                    }
                                    unitOfTimeLeftOnBadge = TimePeriodSymbol.MINUTE;
                                } else if (nextEventMin < 100) {
                                    if (showHoursLeftInBadge) {
                                        badgeText = `${nextEventMin}${getMessage(TimePeriodSymbol.MINUTE)}`;
                                    } else {
                                        badgeText = formatTimeForBadge(event.startTime, hideColonInTime);
                                    }
                                    badgeColor = BadgeColor.BLUE;
                                    unitOfTimeLeftOnBadge = TimePeriodSymbol.HOUR;
                                } else if (nextEventMin < 60*2) {
                                    if (showHoursLeftInBadge) {
                                        badgeText = `${(nextEventMin/60).toFixed(1).replace(".0", "")}${getMessage(TimePeriodSymbol.HOUR)}`;
                                    } else {
                                        badgeText = formatTimeForBadge(event.startTime, hideColonInTime);
                                    }
                                    badgeColor = BadgeColor.BLUE;
                                    unitOfTimeLeftOnBadge = TimePeriodSymbol.HOUR;
                                } else if (nextEventMin < 60*7) {
                                    if (showHoursLeftInBadge) {
                                        badgeText = `${Math.round(nextEventMin/60)}${getMessage(TimePeriodSymbol.HOUR)}`;
                                    } else {
                                        badgeText = formatTimeForBadge(event.startTime, hideColonInTime);
                                    }			
                                    badgeColor = BadgeColor.GRAY;
                                    unitOfTimeLeftOnBadge = TimePeriodSymbol.HOUR;
                                } else if (nextEventMin < 60*24) { // difference here is I remove unitOfTimeLeftOnBadge so as to not display too many hours ie. 13h on badge
                                    if (showHoursLeftInBadge) {
                                        badgeText = `${Math.round(nextEventMin/60)}${getMessage(TimePeriodSymbol.HOUR)}`;
                                    } else {
                                        badgeText = formatTimeForBadge(event.startTime, hideColonInTime);
                                    }			
                                    badgeColor = BadgeColor.GRAY;
                                } else {
                                    if (showDaysLeftInBadge) {
                                        badgeText = `${event.startTime.diffInDaysForHumans()}${getMessage(TimePeriodSymbol.DAY)}`;
                                        badgeColor = BadgeColor.GRAY;
                                    }
                                    unitOfTimeLeftOnBadge = TimePeriodSymbol.DAY;
                                }

                                nextEvent = event;
                            }
                        }
                    }
                    if (!previousNextEvent || event.startTime.toDateString() != previousNextEvent.startTime.toDateString()) {
                        if (toolTip != "") {
                            toolTip += "\n\n";
                        }
                        
                        if (isToday(event.startTime)) {
                            toolTip += getTodayMessage();
                        } else if (isTomorrow(event.startTime)) {
                            toolTip += getTomorrowMessage();
                        } else {
                            toolTip += event.startTime.toLocaleDateStringJ();
                        }
                        toolTip += ":";
                    }

                    toolTip += "\n";
                    if (event.allDay) {
                        toolTip += getSummary(event);
                    } else {
                        toolTip += `${generateTimeDurationStr({event:event, hideStartDay:true})} ${getSummary(event)}`;
                    }
                    toolTip = toolTip.replace(/&amp;/ig, "&");
                    previousNextEvent = event;
                }
            }
        });
        
        if (eventsIgnoredDueToCalendarReminderChangeByUser) {
            console.log("eventsIgnoredDueToCalendarReminderChangeByUser so serialize")
            serializeEventsShown();
        }
        
        // Check snoozers
        snoozers.forEach(snoozer => {
            if ((!snoozer.email || snoozer.email == email) && snoozer.time?.isEqualOrBefore()) {
                if (!isCurrentlyDisplayed(snoozer.event, notificationsQueue)) {
                    queueNotification({event:snoozer.event, reminderTime:snoozer.reminderTime});
                }
            }
        });
        
        if (await storage.get("showDayOnBadge")) {
            if (!unitOfTimeLeftOnBadge || (unitOfTimeLeftOnBadge == TimePeriodSymbol.MINUTE && !await storage.get("showDayOnBadgeExceptWhenMinutesLeft")) || (unitOfTimeLeftOnBadge == TimePeriodSymbol.HOUR && !await storage.get("showDayOnBadgeExceptWhenHoursLeft")) || (unitOfTimeLeftOnBadge == TimePeriodSymbol.DAY && !await storage.get("showDayOnBadgeExceptWhenDaysLeft"))) {
                badgeText = new Date().toLocaleDateString(locale, {weekday: "short"});
                badgeColor = BadgeColor.LIGHT_GRAY;
            }
        }
        
        if (await storage.get("showEventTimeOnBadge") || await storage.get("showDayOnBadge")) {
            // badgetext stays the same
        } else {
            badgeText = "";
        }

        if (nextEvent && await storage.get("useEventColors") && (!eventInProgress || (eventInProgress && !timeRemainingForCurrentEvent))) {
            const eventColors = getEventColors({
                event: nextEvent,
                cachedFeeds: await storage.get("cachedFeeds"),
                arrayOfCalendars: await getArrayOfCalendars()
            });

            badgeColor = eventColors.bgColor;
        }
        updateBadge({badgeText:badgeText, badgeColor:badgeColor, toolTip:toolTip});

        // must be done before sound and desktop notifications
        await filterNotifications(notificationsQueue, eventsToRemoveFromReminders);

        const soundsPlayedPromise = (async () => {
            for (const notification of notificationsQueue) {
                if (!notification.audioPlayedCount) {
                    const notificationSound = await storage.get("notificationSound");
                    if (notificationSound) {
                        await playNotificationSoundFile(notificationSound, false);
                    }
                    break;
                }
            }

            for (const notification of notificationsQueue) {
                console.log("playnotif", notification);
                
                if (!notification.audioPlayedCount) {
                    if (!await isDND()) {
                        const textToSpeak = notification.event.summary;
		
                        if (notification.audioPlayedCount) {
                            notification.audioPlayedCount++;
                        } else {
                            notification.audioPlayedCount = 1;
                        }
                        
                        await playVoiceNotification(textToSpeak, params);
                    }
                }
            };
        })();
        
        if (desktopNotification && notificationsQueue.length >= 1) {
            try {
                await showNotifications();
            } catch (error) {
                console.error("Problem showing notifications: ", error);
                if (params.source != "startup") {
                    throw error;
                }
            }
        }

        await soundsPlayedPromise; // need to wait for audioPlayedCount to be set above before serializing below, also we want to show desktop before audio is complete
        await storage.set("notificationsQueue", notificationsQueue);
        await storage.set("notificationsOpened", notificationsOpened);

        const previousEventInProgress = await storage.get("_previousEventInProgress")
        console.log("previousEventInProgress", previousEventInProgress, eventInProgress)
        if ((!previousEventInProgress && eventInProgress) || (previousEventInProgress && eventInProgress && previousEventInProgress.id != eventInProgress.id)) {
            sendMessageToGmailExtension({
                action: "setDNDEndTime",
                triggeredByCalendarExtension: true,
                endTime: eventInProgress.endTime.toJSON()
            }).catch(error => {
                // ignore exception
            });
        } else if (previousEventInProgress && !eventInProgress) {
            // do nothing
        }
        if (eventInProgress) {
            await storage.set("_previousEventInProgress", eventInProgress);
        }
    }
}

async function filterNotifications(notifications, eventsToRemoveFromReminders) {
    var removedNotifications = [];
    
    const doNotShowNotificationsForAlldayEvents = await storage.get("doNotShowNotificationsForAlldayEvents");
    const automaticallyDismissRemindersForPastEvents = await storage.get("automaticallyDismissRemindersForPastEvents");
	
	for (let a=0, notification; notification=notifications[a], a<notifications.length; a++) {
		if (!doNotShowNotificationsForAlldayEvents || (doNotShowNotificationsForAlldayEvents && !notification.event.allDay)) {
            // passed all day event check...

            // Remove any deleted events
            if (shouldRemoveNotification(notification, events, eventsToRemoveFromReminders)) {
                console.log("remove event from notifications because it was probably deleted or moved to later", notification);
                removedNotifications.push(notification);
			}

            // Automatically dismiss reminders for past events
            if (automaticallyDismissRemindersForPastEvents) {
                if (notification.event.endTime && notification.event.endTime.isBefore()) {
                    console.log("remove event from notifications because event is past and auto dismiss is on", notification);
                    removedNotifications.push(notification);
                }
            }
		} else {
			// when splicing in a for loop must a-- the index or else it will skip the item after the deleted item
			notifications.splice(a, 1);
			a--;
		}
	}
	
	if (removedNotifications.length) {
		await closeNotifications(removedNotifications, {removeNotificationsFromReminderWindow: true});
	}
}

function serializeEventsShown() {
	// put a timer because this process freezes UI because of the size of eventsShown in localstorage
	clearTimeout(globalThis.serializeEventsTimer);
	globalThis.serializeEventsTimer = setTimeout(() => {
		storage.set("eventsShown", eventsShown).catch(error => {
			// try removing cachedfeeds to make room and then try the eventsShown (becuase its more important)
			logError("error serializing eventsShown: " + error + " eventsShown: " + eventsShown.length + " now trying to remove cachedFeeds to make space...");
			storage.remove("cachedFeeds").then(() => {
				storage.set("eventsShown", eventsShown).catch(error => {
					logError("error serialized eventsShown again: " + error + " so show message to user");
					openUrl(Urls.STORAGE_ISSUE);
				});
			}).catch(error => {
				logError("error removing cachedFeeds: " + error);
				openUrl(Urls.STORAGE_ISSUE);
			});
		});
	}, seconds(2));
}

function openUnstableWarningPage() {
	openUrl("https://jasonsavard.com/wiki/Unstable_browser_channel");
}

async function getManagedStorage() {
    if (chrome.storage.managed) {
        try {
            const items = await chrome.storage.managed.get();
            console.log("managed items", items);
            return items;
        } catch (error) {
            console.error("managed error: " + error);
        }
    }
}

// DO NOT place onInstalled in any async callbacks because the "update" event would not trigger for testing when reloading extension
chrome.runtime.onInstalled.addListener(async details => {
    console.info("onInstalled: " + details.reason);

    if (details.reason == "install" && !await storage.get("installDate")) {
        // Note: Install dates only as old as implementation of this today, April 11th 2011
        await storage.initInstallationVars();

        const managedItems = await getManagedStorage();
        if (!managedItems?.DoNotOpenWebsiteOnInstall) {
            const optionsUrl = chrome.runtime.getURL("options.html"); // i moved the "?action=install" to the redirect in the thankyouforinstalling page because siteground was giving me 403 forbidden whenever it found %3F (which is an encoded "?")
            chrome.tabs.create({
                url: `https://jasonsavard.com/thankYouForInstalling?app=calendar&optionsUrl=${encodeURIComponent(optionsUrl)}`
            });
        }

        sendGA("installed", chrome.runtime.getManifest().version);
    } else if (details.reason == "update") {

        // LEGACY START

        // prepare for v3
        if (!await storage.get("detectedChromeVersion") && globalThis.localStorage?.["detectedChromeVersion"]) {
            storage.set("detectedChromeVersion", true);
        }

        // aug 2024
        // result was several users used lots of storage possibly due to contactsData
        /*
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            if (bytesInUse > 7000000) {
                var quotaText = await fetch(`https://jasonsavard.com/getQuotaText?space=${bytesInUse}`).then(response => response.json());
            }
        } catch (error) {
            // ignore
        }
        */

        // Feb 2023 refactor reminderTimes > reminderTime and remove .time & .shown
        eventsShown = await storage.get("eventsShown");
        if (eventsShown.length && eventsShown[0].version != EVENTS_SHOWN_VERSION) {
            console.info("convert remindertimes");
            eventsShown.forEach(eventShown => {
                if (eventShown.reminderTimes.length) {
                    eventShown.reminderTime = eventShown.reminderTimes.at(-1).time;
                } else {
                    eventShown.reminderTime = new Date(1);
                }
                delete eventShown.reminderTimes;
                eventShown.version = EVENTS_SHOWN_VERSION;
            });
            await storage.set("eventsShown", eventsShown);
        }

        // Feb 2023
        if (await storage.get("autosizePopupWindow")) {
            await storage.set("notificationWindowSize", "auto");
            await storage.remove("autosizePopupWindow");
        }

        // LEGADY END

        // seems that Reloading extension from extension page will trigger an onIntalled with reason "update"
        const realUpdate = details.previousVersion != chrome.runtime.getManifest().version;
        if (realUpdate) {
            console.log("real version changed");
            // extension has been updated to let's resync the data and save the new extension version in the sync data (to make obsolete any old sync data)
            // but let's wait about 60 minutes for (if) any new settings have been altered in this new extension version before saving syncing them
            chrome.alarms.create(Alarms.EXTENSION_UPDATED_SYNC, {delayInMinutes:60});
        }
        
        const previousVersionObj = parseVersionString(details.previousVersion)
        const currentVersionObj = parseVersionString(chrome.runtime.getManifest().version);
        const extensionUpdates = await storage.get("extensionUpdates");
        if ((extensionUpdates == "all" && realUpdate) || (extensionUpdates == "interesting" && (previousVersionObj.major != currentVersionObj.major || previousVersionObj.minor != currentVersionObj.minor))) {
            storage.set("_lastBigUpdate", chrome.runtime.getManifest().version);
            
            const options = {
                type: "basic",
                title: getMessage("extensionUpdated"),
                message: "Checker Plus for Google Calendar " + chrome.runtime.getManifest().version,
                iconUrl: Icons.NotificationLogo,
            }
            
            if (supportsNotificationButtons()) {
                options.buttons = [{title: getMessage("seeUpdates")}];
            } else {
                options.message += `\n${getMessage("seeUpdates")}`;
            }

            if (DetectClient.isFirefox()) {
                options.priority = 2;
            } else {
                if (!DetectClient.isMac()) { // patch for macOS Catalina not working with requireinteraction
                    options.requireInteraction = true;
                }
            }

            isDND().then(dndState => {
                if (!dndState) {
                    chrome.notifications.create("extensionUpdate", options, notificationId => {
                        if (chrome.runtime.lastError) {
                            console.error(chrome.runtime.lastError.message);
                        }
                    });
                }
            }).catch(error => {
                console.error("error in isDND: ", error);
            });
        }
    }

    init();

    sendGA("extensionVersion", chrome.runtime.getManifest().version, details.reason);
});

if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        init();
    })
}

if (chrome.alarms) {
    chrome.alarms.onAlarm.addListener(async alarm => {
        try {
            //console.log("alarm", alarm.name);
            await initMisc();

            if (alarm.name == Alarms.EVERY_MINUTE) {
                await checkEvents({source:"interval"});
                detectSleepMode.ping();

                // update snooze notification times
                if (await storage.get("desktopNotification") == "rich" && await storage.get("showNotificationDuration") == "never") {
                    // bug fix for notifications going directly to notification centre
                    // must add a timeout because I could toast new notifications just above in checkEvents and then execute this updateNotificaiton would put them in notificaiton centre ref: https://jasonsavard.com/forum/discussion/comment/36176#Comment_36176
                    setTimeout(() => {
                        updateNotifications();
                    }, 1000);
                }
            } else if (alarm.name == Alarms.EVERY_DAY) {
                maybeRegisterId();
            } else if (alarm.name == Alarms.WATCH_CALENDAR_SETTINGS) {
                await watchCalendarSettings();
            } else if (alarm.name == Alarms.WATCH_CALENDAR_LIST) {
                await watchCalendarList();
            } else if (alarm.name.startsWith(WATCH_CALENDAR_EVENTS_ALARM_PREFIX)) {
                const calendarId = alarm.name.split(WATCH_CALENDAR_EVENTS_ALARM_PREFIX)[1];
                const calendar = getCalendarById(calendarId);
                console.log("watch event alarm: ", calendarId, calendar, calendarMap);
                const email = await storage.get("email");
                const selectedCalendars = await storage.get("selectedCalendars");
                const excludedCalendars = await storage.get("excludedCalendars");
                const desktopNotification = await storage.get("desktopNotification");

                if (calendar) {
                    // only keep watching if calendar is selected and not excluded
                    if (isCalendarUsedInExtension(calendar, email, selectedCalendars, excludedCalendars, desktopNotification)) {
                        await watchCalendarEvents(calendarId);
                    }
                } else {
                    console.log("don't re-watch: calendar might have been removed");
                }
            } else if (alarm.name == Alarms.EXTENSION_UPDATED_SYNC) {
                syncOptions.save("extensionUpdatedSync").catch(error => {
                    console.warn("extensionUpdatedSync error: " + error);
                });
            } else if (alarm.name == Alarms.SYNC_DATA) {
                syncOptions.save("sync key").catch(error => {
                    console.warn("SYNC_DATA error: " + error);
                });
            } else if (alarm.name == Alarms.UPDATE_CONTACTS) {
                // update contacts
                updateContacts().catch(error => {
                    console.warn("updateContacts() error: " + error);
                });
            } else if (alarm.name == Alarms.UPDATE_UNINSTALL_URL) {
                // do this every day so that the daysellapsed is updated in the uninstall url
                setUninstallUrl(await storage.get("email"));
            } else if (alarm.name == Alarms.UPDATE_CONTEXT_MENU) {
                updateContextMenuItems();
            } else if (alarm.name == Alarms.POLL_SERVER_FROM_FCM_UPDATE) {
                await pollServerFromFCMUpdate();
            } else if (alarm.name == Alarms.POLL_SERVER_AFTER_RIGHT_CLICK_SET_DATE) {
                await pollServer({source:"afterRightClickSetDate..."});
            } else if (alarm.name == Alarms.OPEN_REMINDERS) {
                console.log("notificationsOpened.length", notificationsOpened.length);
                if (notificationsOpened.length) {
                    if (!await storage.get("reminderWindowId") && await storage.get("desktopNotification") == "popupWindow") {
                        console.log("reminders 5min");
                        openReminders({useIdle:true});
                    }
                }
            } else if (alarm.name == Alarms.FORGOTTEN_REMINDER) {
                const forgottenReminderCount = await storage.get("_forgottenReminderCount");
                await storage.set("_forgottenReminderCount", forgottenReminderCount + 1);

                const desktopNotification = await storage.get("desktopNotification");

                if (desktopNotification == "rich") {
                    const notifications = await chrome.notifications.getAll();
                    if (isEmptyObject(notifications)) {
                        // no reminders let's stop interval
                        forgottenReminder.stop();
                    } else {
                        forgottenReminder.execute();
                    }
                } else if (desktopNotification == "popupWindow") {
                    if (await storage.get("reminderWindowId")) {
                        forgottenReminder.execute();
                    } else {
                        forgottenReminder.stop();
                    }
                } else {
                    forgottenReminder.stop();
                }
            } else if (alarm.name == Alarms.UPDATE_SKINS) {
                console.log("updateSkins...");
                
                const skinsSettings = await storage.get("skins");
                const skinsIds = skinsSettings.map(skin => skin.id);
                const nightModeSkin = await storage.get("nightModeSkin");
                
                if (skinsIds.length || nightModeSkin) {
                    const skins = await Controller.getSkins(skinsIds, await storage.get("_lastUpdateSkins"));
                    console.log("skins:", skins);
                    
                    let foundSkins = false;
                    skins.forEach(skin => {
                        skinsSettings.some(skinSetting => {
                            if (skinSetting.id == skin.id) {
                                foundSkins = true;
                                console.log("update skin: " + skin.id);
                                copyObj(skin, skinSetting);
                                return true;
                            }
                        });
                    });
                    
                    if (foundSkins) {
                        storage.set("skins", skinsSettings);
                    }

                    if (nightModeSkin) {
                        const nightSkinFromDB = skins.find(skin => skin.id == nightModeSkin.id);
                        if (nightSkinFromDB) {
                            copyObj(nightSkinFromDB, nightModeSkin);
                            await storage.set("nightModeSkin", nightModeSkin);
                        }
                    }
                    
                    storage.setDate("_lastUpdateSkins");
                }
            } else if (alarm.name == Alarms.COLLECT_STATS) {
                console.log("collecting optionstats")
                        
                let optionStatCounter = 1;
                
                async function sendOptionStat(settingName) {
                    let settingValue = await storage.get(settingName);
                    
                    // Convert booleans to string because google analytics doesn't process them
                    if (settingValue === true) {
                        settingValue = "true";
                    } else if (settingValue === false || settingValue == null) {
                        settingValue = "false";
                    }
                    
                    // issue: seems like the 1st 10 are being logged only in Google Analytics - migth be too many sent at same time
                    // so let's space out the sending to every 2 seconds
                    setTimeout(function() {
                        sendGA("optionStats", settingName, settingValue);
                    }, optionStatCounter++ * seconds(2));
                }
                
                var calendarViewStr = await storage.get("calendarView");
                if (calendarViewStr == CalendarView.AGENDA) {
                    calendarViewStr = "agenda";
                }
                
                storage.setDate("lastOptionStatsSent");
            }
        } catch (error) {
            console.error("error in alarm: ", error);
            if (inLocalExtension) {
                if ([ErrorCause.OFFLINE, ErrorCause.NETWORK_PROBLEM].includes(error.cause)) {
                    // do nothing
                } else {
                    showMessageNotification("Error in alarms", "Dev only", error);
                }
            }
        }
    });
}

if (chrome.system?.display?.onDisplayChanged) {
    chrome.system.display.onDisplayChanged.addListener(async () => {
        console.log("onDisplayChanged", new Date());
        const screens = await chrome.system.display.getInfo();
        const screen = screens.find(screen => screen.isPrimary);
        console.log("screens", screens, "primary screen", screen);
    })
}

// Add listener once only here and it will only activate when browser action for popup = ""
chrome.action.onClicked.addListener(async tab => {
    const browserButtonAction = await storage.get("browserButtonAction");
    if (browserButtonAction == BrowserButtonAction.GOOGLE_CALENDAR) {
        openGoogleCalendarWebsite();
    } else if (browserButtonAction == BrowserButtonAction.POPUP_DETACHED) {
        let width = await storage.get("detachedPopupWidth");
        let height = await storage.get("detachedPopupHeight");
        
        // enlarge if using zoom
        if (globalThis.devicePixelRatio) {
            width *= globalThis.devicePixelRatio;
            height *= globalThis.devicePixelRatio;
        }

        const position = await getCenterWindowPosition(width, height);
        
        createWindow({
            url: getDetachedUrl(),
            width: Math.round(width),
            height: Math.round(height),
            left: position.left,
            top: position.top,
            type: "popup",
            state: "normal"
        });
    } else {
        openUrl(getDetachedUrl(), {urlToFind:chrome.runtime.getURL("popup.html")});
    }
});

// Setup omnibox...
if (chrome.omnibox) {
    chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
        setOmniboxSuggestion(text, suggest);
    });
}

async function getDisplayForWindow(window) {
    const displays = await chrome.system.display.getInfo();
    for (const display of displays) {
        const displayBounds = display.bounds;
        if (window.left >= displayBounds.left &&
            window.top >= displayBounds.top &&
            window.left + window.width <= displayBounds.left + displayBounds.width &&
            window.top + window.height <= displayBounds.top + displayBounds.height) {
            return display;
        }
    }
    return null;
}

chrome.windows.onCreated.addListener(async thisWindow => {
    console.log("onCreated", thisWindow)
    if (thisWindow.type == "popup") {
        storage.get("_openOauthFlowDate").then(async launchWebAuthFlowDate => {
            const MAX_SECONDS_TO_AUTOMATICALLY_RESIZE = 10;
            if (launchWebAuthFlowDate?.diffInSeconds() > -MAX_SECONDS_TO_AUTOMATICALLY_RESIZE) {
                storage.remove("_openOauthFlowDate");
                
                let height = 980;
                try {
                    const displayFound = await getDisplayForWindow(thisWindow);
                    if (displayFound) {
                        console.log("Screen where this window is present: ", displayFound);
                        height = displayFound.workArea.height;
                    }
                } catch (error) {
                    console.warn("Error getting display for window:", error);
                }

                await chrome.windows.update(thisWindow.id, {
                    height: height,
                    width: 599
                });
            }
        }).catch(error => {
            console.warn("error in onCreated: ", error);
        });
    }
});

chrome.windows.onRemoved.addListener(async windowId => {

    await initMisc();
    
    let reminderWindowId = await storage.get("reminderWindowId");
    // detect reminders closed so we snooze it to return in 5 minutes
    if (reminderWindowId == windowId) {
        console.log("reminders closed");
        reminderWindowId = null;
        await storage.remove("reminderWindowId");
        await storage.setDate("_remindersWindowClosedTime");
        
        if (!await storage.get("_remindersWindowClosedByDismissingEvents") && !await storage.get("_remindersWindowCloseWarning")) {
            await storage.enable("_remindersWindowCloseWarning");
            await sleep(seconds(1));
            console.log("open reminders settimeout");
            openReminders({closeWindowGuide:true});
        }
        
        chrome.alarms.create(Alarms.OPEN_REMINDERS, {delayInMinutes: 5});
    }
    
    // patch: if all browser windows closed then let's closereminders because if we leave it doesn't regisere snoozes or dimssiess??
    if (reminderWindowId) {
        const windows = await chrome.windows.getAll();
        let windowsOpened = 0;
        
        windows.forEach(thisWindow => {
            if (reminderWindowId == thisWindow.id) {
                // ignore
            } else {
                windowsOpened++;
            }
        });
        
        if (windowsOpened == 0) {
            closeReminders();
        }
    }
});

if (chrome.commands) {
    chrome.commands.onCommand.addListener(async command => {
        // patch for firefox only becaues they don't have active extension option by default and had to add this code above because required user action and i had async code below
        if (command == "activateExtension") {
            chrome.action.openPopup();
            return;
        }

        await initMisc();
        if (command == "dismissEvent") {
            console.log("oncommand dismiss");
            var desktopNotification = await storage.get("desktopNotification");
            var noEventsToDismiss = false;
            
            if (desktopNotification == "text") {
                if (notificationWindow) {
                    notificationWindow.close();
                } else {
                    noEventsToDismiss = true;
                }
            } else if (desktopNotification == "rich") {
                if (notificationsOpened.length) {
                    await closeNotifications(notificationsOpened);
                } else {
                    noEventsToDismiss = true;
                }
            } else if (desktopNotification == "popupWindow") {
                chrome.runtime.sendMessage({action: "dismissAll"});
            }
            
            if (noEventsToDismiss) {
                shortcutNotApplicableAtThisTime("No events to dismiss");
            }
        } else if (command == "quickAddSelection") {
            console.log("quick add selection");
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0].id;
            chrome.scripting.executeScript({
                target : {tabId : tabId, allFrames : true},
                func: () => {
                    return window.getSelection().toString();
                }
            }, async injectionResults => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    shortcutNotApplicableAtThisTime(chrome.runtime.lastError.message);
                } else {
                    console.log("injectionResults", injectionResults);
                    const selection = injectionResults[0]?.result.toString();
                    //if (selection != "") { // because selection is actually an object
                        console.info("sel", selection);
                        const tab = await getActiveTab();
                        console.log("active tab", tab);
                        quickAddSelectionOrPage({
                            quickAdd: true,
                            allDay: true,
                            selectionText: selection,
                            inputSource: InputSource.SHORTCUT
                        }, tab);
                    //} else {
                        //shortcutNotApplicableAtThisTime("Nothing selected");
                    //}
                }
            });
        }
    });
}

async function onButtonClicked(notificationId, buttonIndex) {
    console.log("notif onbuttonclick:", notificationId, buttonIndex);
    const email = await storage.get("email");
    const groupedNotification = await isGroupedNotificationsEnabled();
        
    if (notificationId == "extensionUpdate") {
        if (buttonIndex == -1 || buttonIndex == 0) {
            openChangelog();
            chrome.notifications.clear(notificationId, function() {});
            storage.remove("_lastBigUpdate");
            sendGA("extensionUpdateNotification", "clicked button - see updates");
        }
    } else if (notificationId == "message") {
        // nothing
    } else if (notificationId == "error") {
        openUrl("https://jasonsavard.com/forum/t/checker-plus-for-google-calendar?ref=errorNotification");
        chrome.notifications.clear(notificationId, function() {});
        sendGA("errorNotification", "clicked button on notification");
    } else {

        stopAllSounds();
        
        if (isNotificationAddedOutside(notificationId)) {
            const notificationObj = getNotificationObj(notificationId);
            const event = findEvent({
                id: notificationObj.eventId
            }, events);
            if (buttonIndex == -1 || buttonIndex == 1) {
                openUrl(getEventUrl(event, email));
                chrome.notifications.clear(notificationId, function() {});
            } else if (buttonIndex == 0) {
                deleteEvent(event).then(() => {
                    chrome.notifications.clear(notificationId, function(wasCleared) {});
                }).catch(error => {
                    showMessageNotification("Checker Plus Error", "Could not delete event", error);
                });
            }
        } else {

            // patch: user might have re-toasted the notification by clicking the bell (before the notification had time to disappear naturally and therefore bypassing the openTemporaryWindowToRemoveFocus logic, so let's force it here
            if (notificationsOpened?.length == 0) {
                console.log("patch: user might have re-toasted the notification by clicking the bell so let's force call the openTemporaryWindow...");
                openTemporaryWindowToRemoveFocus();
                return;
            }

            var notification = getNotification(notificationsOpened, notificationId);
            if (!notification) {
                // only one notification then we aren't grouped 
                if (notificationsOpened.length == 1) {
                    notification = notificationsOpened.first();
                }
            }
            
            var notificationButtonValue;
            
            if (buttonIndex == -1) {
                notificationButtonValue = "snoozeTimes";
            } else {
                var buttons;
                if (groupedNotification) {
                    buttons = notificationsOpened.first().buttons;
                } else {
                    buttons = notification.buttons;
                }
                
                if (buttonIndex == 0) {
                    notificationButtonValue = buttons[0].value;
                } else if (buttonIndex == 1) {
                    notificationButtonValue = buttons[1].value;
                }
            }
            
            console.log("notificationButtonValue", notificationButtonValue);
            
            if (notificationButtonValue == "dismiss") {
                // dismiss
                console.log("dismiss");
                if (groupedNotification) {
                    sendGA('notificationButtonValue', notificationButtonValue, buttonIndex, notificationsOpened.length);
                    closeNotifications(notificationsOpened);
                    closeReminders();
                } else {
                    closeNotifications([notification]);
                    sendGA('notificationButtonValue', notificationButtonValue, buttonIndex, 1);
                }
            } else if (notificationButtonValue == "snoozeTimes") {
                openReminders();
                sendGA('notificationButtonValue', notificationButtonValue, buttonIndex);
            } else if (notificationButtonValue == "location|hangout") {
                const videoMeetingDetails = await getVideoMeetingDetails(notification.event, true);
                const eventSource = getEventSource(notification.event, !videoMeetingDetails);

                let url;

                if (videoMeetingDetails) {
                    url = videoMeetingDetails.videoUrl;
                } else if (eventSource) {
                    url = eventSource.url;
                } else {
                    url = generateLocationUrl(notification.event);
                }

                openUrl(maybeSetAuthUser(notification.event, url, email));

                if (await storage.get("dismissEventAfterClickingJoinVideo")) {
                    closeNotifications([notification]);
                }
                sendGA('notificationButtonValue', notificationButtonValue, buttonIndex);
            } else if (notificationButtonValue == "reducedDonationAd") {
                await storage.enable("reducedDonationAdClicked");
                openUrl("contribute.html?ref=reducedDonationFromNotif");
                updateNotifications();
                sendGA('notificationButtonValue', notificationButtonValue, buttonIndex);
            } else {
                // snooze
                var unit = notificationButtonValue.split("_")[0];
                var delay = notificationButtonValue.split("_")[1];
                
                var snoozeParams = {};
                snoozeParams.source = "notificationButton";
                
                if (unit == "minutes") {
                    snoozeParams.inMinutes = delay;
                } else if (unit == "hours") {
                    snoozeParams.inHours = delay;
                } else if (unit == "days") {
                    snoozeParams.inDays = delay;
                } else {
                    logError("no unit in snooze: " + unit);
                }
                
                if (groupedNotification) {
                    sendGA('notificationButtonValue', "snooze", notificationButtonValue, notificationsOpened.length);
                    await snoozeNotifications(snoozeParams, notificationsOpened);
                    closeReminders();
                } else {
                    await snoozeNotifications(snoozeParams, [notification]);
                    sendGA('notificationButtonValue', "snooze", notificationButtonValue, 1);
                }
            }
        }
    }
}

function openUpdateBrowserLink() {
    if (DetectClient.isChrome()) {
        openUrl("https://support.google.com/chrome/answer/95414");
    } else if (DetectClient.isEdge()) {
        openUrl("https://support.microsoft.com/topic/microsoft-edge-update-settings-af8aaca2-1b69-4870-94fe-18822dbb7ef1");
    } else {
        openUrl("https://browser-update.org/update-browser.html");
    }
}

globalThis.addEventListener("notificationclick", async event => {
    console.log("web notification click: ", event);

    const tag = event.notification.tag;
    if (tag.includes(NotificationTags.CONTAINS_JSON_EVENT)) {
        const thisEvent = findEvent(JSON.parse(tag), events);
        openEventUrl(thisEvent);
    } else if (tag == NotificationTags.SHORTCUT_NOT_APPLICABLE_AT_THIS_TIME) {
        openUrl("https://jasonsavard.com/wiki/Keyboard_shortcuts");
    } else if (tag == NotificationTags.UPDATE_BROWSER) {
        openUpdateBrowserLink();
    } else if (tag == NotificationTags.UNSTABLE_BROWSER_CHANNEL) {
        openUnstableWarningPage();
    }
});

if (chrome.notifications) {
    
    // click anywhere
    chrome.notifications.onClicked.addListener(async notificationId => {
        await initMisc();
        onButtonClicked(notificationId, -1);
    });
    
    // buttons clicked
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
        await initMisc();
        onButtonClicked(notificationId, buttonIndex);
    });
    
    // closed notif
    chrome.notifications.onClosed.addListener(async (notificationId, byUser) => {
        console.log("onClosed", notificationId, byUser);

        // had to comment because this because this listener stopped working chrome.notifications.onClosed refer https://bugs.chromium.org/p/chromium/issues/detail?id=1212142
        // note also hid instructions for clickingXOnNotification
        if (!DetectClient.isFirefox()) {
            await initMisc();
            if (notificationId == "extensionUpdate") {
                if (byUser) {
                    sendGA("extensionUpdateNotification", "closed notification");
                }
            } else if (notificationId == "message") {
                // nothing
            } else if (notificationId == "error") {
                // nothing
            } else {		
                // Chrome <=60 byUser happens ONLY when X is clicked ... NOT by closing browser, NOT by clicking action buttons, ** NOT by calling .clear
                // Chrome 61 update: calling .clear will set byUser = true
                if (byUser) {
                    console.log("notif onclose", notificationId, byUser);
                    stopAllSounds();
                    
                    if (isNotificationAddedOutside(notificationId)) {
                        // do nothing
                    } else {
                        var notification = getNotification(notificationsOpened, notificationId);
                        
                        if (await isGroupedNotificationsEnabled()) {
                            sendGA('notificationButtonValue', "dismissedByClosing", "grouped", notificationsOpened.length);
                            closeNotifications(notificationsOpened, {skipNotificationClear:true});
                            closeReminders();
                        } else {
                            sendGA('notificationButtonValue', "dismissedByClosing", "individual", 1);
                            closeNotifications([notification], {skipNotificationClear:true});
                        }
                    }
                }
            }
        }
    });
}

if (chrome.omnibox) {
    chrome.omnibox.onInputEntered.addListener(async text => {
        await initMisc();
        var eventEntry = new EventEntry();			
        eventEntry.summary = text;
        eventEntry.allDay = true;
        eventEntry.inputSource = InputSource.OMNIBOX;
        
        performActionOutsideOfPopup(eventEntry);
    });
}

if (chrome.storage) {
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
        if (namespace == "local") {
            for (const key in changes) {
                const storageChange = changes[key];
                if (key != "cachedFeeds" && !key.startsWith("_")) {
                    /*
                    console.log('Storage key "%s" in namespace "%s" changed. ' + 'Old: "%s", New "%s".',
                    key,
                    namespace,
                    storageChange.oldValue,
                    storageChange.newValue);
                    */
                }

                // ignore tokenResponse if we are just updating the token, but do sync if it's added or removed
                if (key == "tokenResponses" && storageChange.oldValue && storageChange.newValue) {
                    // do nothing
                } else {
                    syncOptions.storageChanged({key:key});
                }
            }
        } else {
            const label = "Storage key changes";
            console.groupCollapsed(label);
            for (const key in changes) {
                const storageChange = changes[key];
                console.log('Storage key "%s" in namespace "%s" changed.', key, namespace, {
                    oldValue: storageChange.oldValue,
                    newValue: storageChange.newValue
                });
        
                if (key.startsWith(SYNC_OPERATION_PREFIX)) {
                    processSyncOperation(key, storageChange.newValue);
                }
            }
            console.groupEnd(label);
        }
    });
}

if (chrome.idle.setDetectionInterval) {
    chrome.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL);
}

if (chrome.idle.onStateChanged) {
    chrome.idle.onStateChanged.addListener(async newState => {
        if (newState == "active") {
            console.log("idle state change: " + newState);
            // re-toast grouped notifications if different from count when idle
            if (!globalThis.notificationsOpened) {
                notificationsOpened = await storage.get("notificationsOpened");
            }
            console.log("idle test: " + notificationsOpened.length + " " + notificationsOpenedCountWhenIdle);
            if (notificationsOpened.length >= 1 && notificationsOpenedCountWhenIdle >= 1) {
                console.log("new notif since idle re-toast notifs");
                const notificationsQueue = await storage.get("notificationsQueue");
                if (notificationsQueue.length >= 1) {
                    console.log("new notif since idle queue: " + notificationsQueue.length);
                    
                    const desktopNotification = await storage.get("desktopNotification");
                    if ((desktopNotification == "text" || desktopNotification == "rich") && await isGroupedNotificationsEnabled()) {
                        retoastNotifications();
                    } else if (desktopNotification == "popupWindow") {
                        const reminderWindowId = await storage.get("reminderWindowId");
                        if (reminderWindowId) {
                            chrome.windows.update(reminderWindowId, {focused:true}).catch(error => {
                                console.warn("could not focus reminder window: " + error);
                            });
                        }
                    }
                    // reset the count
                    notificationsOpenedCountWhenIdle = 0;
                }
            }
        }
    });
}

chrome.runtime.onMessage.addListener(/* DONT USE ASYNC HERE because of return true */ (message, sender, sendResponse) => {
    console.info("bg onMessage: ", message);
    (async function() {
        await initMisc();
        try {
            if (message.command == "updateSnoozer") {
                const snoozers = await getSnoozers();
                snoozers.some((snoozer, index) => {
                    if (snoozer.event.id == message.eventId) {
                        snoozer.time = parseDate(message.time);
                        return true;
                    }
                });
                await updateSnoozersInStorage(snoozers);
                sendResponse();
            } else if (message.command == "removeSnoozer") {
                const snoozers = await getSnoozers();
                snoozers.some((snoozer, index) => {
                    if (snoozer.event.id == message.eventId) {
                        snoozers.splice(index, 1);
                        return true;
                    }
                });
                await updateSnoozersInStorage(snoozers);
                sendResponse();
            } else if (message.command == "pollServer") {
                const response = await pollServer(message.params);
                sendResponse(response);
            } else if (message.command == "fetchAllCalendarEvents") {
                message.params.startDate = parseDate(message.params.startDate);
                message.params.endDate = parseDate(message.params.endDate);

                const response = await fetchAllCalendarEvents(message.params);
                sendResponse(response);
            } else if (message.command == "generateActionLink") {
                const actionLinkObj = await generateActionLink("TEMPLATE", message.eventEntry);
                sendResponse({url: `${actionLinkObj.url}?${actionLinkObj.data}`});
            } else if (message.command == "snoozeNotifications") {
                console.log("snoozeNotifications", message);
                // call sendResponse before closeNotifications because it's async and we want to close the notifications asap
                sendResponse();

                stopAllSounds();

                if (message.snoozeParams?.snoozeTime) {
                    message.snoozeParams.snoozeTime = parseDate(message.snoozeParams.snoozeTime);
                }
                restoreArrayWithEvents(message.notifications);

                await snoozeNotifications(message.snoozeParams, message.notifications);
            } else if (message.command == "closeNotifications") {
                console.log("closeNotifications", message);
                // call sendResponse before closeNotifications because it's async and we want to close the notifications asap
                sendResponse();

                stopAllSounds();

                restoreArrayWithEvents(message.notifications);

                await closeNotifications(message.notifications);
            } else if (message.command == "closeNotificationsDelayed") {
                console.log("closeNotificationsDelayed", message);
                // call sendResponse before closeNotifications because it's async and we want to close the notifications asap
                sendResponse();

                restoreArrayWithEvents(message.notifications);

                await closeNotificationsDelayed(message.notifications);
            } else if (message.command == "chromeTTS") {
                if (message.stop) {
                    globalThis?.ChromeTTS?.stop?.(); // if you diable and renable extenion seems ChromeTTS is not found
                } else if (message.isSpeaking) {
                    sendResponse(ChromeTTS.isSpeaking());
                } else {
                    await ChromeTTS.queue(message.text);
                    sendResponse();
                }
            } else if (message.command == "forgottenReminder.execute") {
                forgottenReminder.execute(message.params);
                sendResponse(); // add this just to avoid ff error message of "onMessage listener's response handle went out of scope"
            } else if (message.command == "forgottenReminder.start") {
                forgottenReminder.start();
                sendResponse();
            } else if (message.command == "forgottenReminder.stop") {
                forgottenReminder.stop();
                sendResponse();
            } else if (message.command == "resetInitMiscWindowVars") {
                delete globalThis.initMiscPromise;
                sendResponse();
            } else if (message.command == "online-status") {
                console.log("from offscreen online-status", message.status);
                offlineOnlineChanged({
                    type: message.status,
                    source: "offscreen"
                })
                sendResponse();
            } else if (message.command == "firestore-message") {
                onRealtimeMessageReceived(message.data, "firebase");
                sendResponse();
            } else if (typeof globalThis[message.command] == "function") { // map fn string commands directly to calling their fn
                console.log("onMessage: " + message.command);
                const response = await globalThis[message.command](message.params);
                sendResponse(response);
            } else {
                console.warn("No matching command for " + message.command + " might be captured in other pages.");
            }
        } catch (error) {
            console.error(error);
            if (error.message) {
                sendResponse({
                    error: {
                        message: error.message,
                        cause: error.cause
                    }
                });
            } else {
                sendResponse({
                    error: error.message || error
                });
            }
        }
    })();

    return true;
});

async function setUninstallUrl(email) {
	if (chrome.runtime.setUninstallURL) {
		var url = "https://jasonsavard.com/uninstalled?app=calendar";
		url += "&version=" + encodeURIComponent(chrome.runtime.getManifest().version);
		url += "&daysInstalled=" + await daysElapsedSinceFirstInstalled();
		if (email) {
            url += "&e=" + encodeURIComponent(btoa(email));
            storage.set("_uninstallEmail", email);
		}
		chrome.runtime.setUninstallURL(url);
	}
}

if (chrome.runtime.onMessageExternal) {	
	chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
        (async function() {
            await initMisc();
            if (message.action == "turnOffDND") {
                setDND_off(true);
                sendResponse();
            } else if (message.action == "setDNDEndTime") {
                const endTime = new Date(message.endTime);
                setDNDEndTime(endTime, true);
                sendResponse();
            } else if (message.action == "createEvent") {
                if (isGmailExtension(sender.id)) {
                    const createEvent = JSON.parse(message.event);
                    parseEventDates(createEvent);

                    const eventEntry = new EventEntry();
                    console.log("createevent", message);
                    eventEntry.quickAdd = false;
                    eventEntry.allDay = createEvent.allDay;  
                    eventEntry.startTime = new Date(createEvent.startTime);
                    if (createEvent.endTime) {
                        eventEntry.endTime = new Date(createEvent.endTime);
                    }
                    eventEntry.summary = createEvent.summary;
                    eventEntry.location = createEvent.location;
                    eventEntry.source = createEvent.source;
                    //eventEntry.source = {title:title, url:info.linkUrl};
                    eventEntry.description = createEvent.description;

                    performActionOutsideOfPopup(eventEntry, true).then(response => {
                        console.log("createevent response", response);
                        sendResponse({success:true});
                    }).catch(error => {
                        console.log("create event error: " + error);
                        sendResponse({error: error.message ?? error});
                    });
                } else {
                    console.warn("Message not sent from a recognized extension: " + sender.id);
                }
            } else if (message.action == "getEvent") {
                if (isGmailExtension(sender.id)) {
                    const email = await storage.get("email")
                    const event = JSON.parse(message.event);
                    parseEventDates(event);
                    const SEARCH_URL = `/calendars/${encodeURIComponent("primary")}/events`;
                    
                    // try uid 1st
                    try {
                        let response = await oauthDeviceSend({
                            userEmail: email,
                            url: SEARCH_URL,
                            data: {
                                iCalUID: event.uid,
                                singleEvents: true,
                                orderBy: "startTime",
                                maxResults: 1
                            }
                        })
    
                        // fallback to search by title & date
                        if (!response.items.length) {
                            response = await oauthDeviceSend({
                                userEmail: email,
                                url: SEARCH_URL,
                                data: {
                                    q: event.summary,
                                    timeMin: event.startTime.toJSON(),
                                    //timeMax: event.startTime.toJSON(),
                                    singleEvents: true,
                                    orderBy: "startTime",
                                    maxResults: 1
                                }
                            })
                        }
    
                        if (response.items.length) {
                            sendResponse({eventUrl: getEventUrl(response.items[0])});
                        } else {
                            sendResponse({eventFound: false});
                        }
                    } catch (error) {
                        console.warn("could not get event", error);
                        sendResponse({eventFound: false});
                    }
                } else {
                    console.warn("Message not sent from a recognized extension: " + sender.id);
                }
            } else if (message.action == "generateActionLink") {
                if (isGmailExtension(sender.id)) {
                    const eventEntry = JSON.parse(message.eventEntry);
                    const actionLinkObj = await generateActionLink("TEMPLATE", eventEntry);
                    sendResponse({url: `${actionLinkObj.url}?${actionLinkObj.data}`});
                } else {
                    console.warn("Message not sent from a recognized extension: " + sender.id);
                }
            } else if (message.action == "getInfo") {
                sendResponse({installed:true});
            } else if (message.action == "version") {
                sendResponse(chrome.runtime.getManifest().version);
            }
        })();

        return true; // indicate we want to send response asynchronously
	});
}

async function processSyncOperation(key, value) {
    if (await storage.get("syncDismissedAndSnoozedRemindersAcrossExtensions")) {
        try {
            if (value) {
                const syncOperation = JSON.parse(JSON.stringify(value), dateReviver);
                console.log("syncOperation", syncOperation);
    
                if (syncOperation.uniqueId != await getUniqueExtensionId()) {
                    if (syncOperation.version == SYNC_OPERATION_VERSION) {
                        if (syncOperation.action == SyncOperation.CLOSE_NOTIFICATIONS) {
                            const notifications = syncOperation.data.map(strippedEvent => ({
                                event: strippedEvent
                            }));
    
                            restoreArrayWithEvents(notifications);
                            console.log("closeNotifications", notifications);
    
                            globalThis.disableSnoozerStorageAndSync = true;
                            closeNotifications(notifications, {
                                source: "sync",
                                removeNotificationsFromReminderWindow: true
                            }).catch(error => {
                                console.error("syncOperation closeNotifications error: " + error);
                            }).finally(() => {
                                globalThis.disableSnoozerStorageAndSync = false;
                            });
    
                            chrome.storage.sync.remove(key, () => {
                                console.log("removed syncOperation: " + key);
                            }).catch(error => {
                                console.error("syncOperation closeNotifications remove error: " + error);
                            });
                        } else if (syncOperation.action == SyncOperation.UPDATE_SNOOZERS) {
                            const snoozers = syncOperation.data;
    
                            restoreArrayWithEvents(snoozers);
                            console.log("updateSnoozers", snoozers);
                            storage.set("snoozers", snoozers);
    
                            chrome.storage.sync.remove(key, () => {
                                console.log("removed syncOperation: " + key);
                            }).catch(error => {
                                console.error("syncOperation updateSnoozers remove error: " + error);
                            });
                        }
                    } else {
                        console.warn("syncOperation version different: " + syncOperation.version);
                    }
                }
            }
        } catch (error) {
            console.error("syncOperation error: " + error);
        }
    }
}

function restoreArrayWithEvents(ary) {
    // convert stringified to objects
    ary.forEach(item => {
        if (!item.test) {
            // do this to get reference of event
            const event = findEvent(item.event, events);
            if (event) {
                item.event = event;
            } else {
                // it's possible event was deleted to just parse the event dates so it passes other date functions later
                parseEventDates(item.event);
            }
        }
    });
}

async function init() {
    console.info("init");
    try {
        if (!DetectClient.isFirefox() && !chrome.runtime.getContexts) {
            showWebNotification("You must update your browser", {
                body: "To continue using Checker Plus you must update your browser. Click for more info.",
                icon: Icons.NotificationLogo,
                tag: NotificationTags.UNSTABLE_BROWSER_CHANNEL,
                newNotificationOnClick: async () => {
                    openUrl("https://jasonsavard.com/wiki/Unstable_browser_channel?ref=notif");
                }
            });
        } else {
            chrome.storage.local.get(["detectedChromeVersion"]).then(async result => {
                if (!result.detectedChromeVersion) {
                    chrome.storage.local.set({"detectedChromeVersion": true});
                    result = await DetectClient.getChromeChannel();
                    if (result.oldVersion) {
                        showWebNotification("You are using an old browser version", {
                            body: "Click for more info. Bugs might occur, but all issues will be ignored unless you update Chrome.",
                            icon: Icons.NotificationLogo,
                            tag: NotificationTags.UPDATE_BROWSER,
                            newNotificationOnClick: async () => {
                                openUpdateBrowserLink();
                            }
                        });
                    } else if (result?.channel != "stable" && result?.channel != "extended") {
                        showWebNotification("You are not using the stable channel of Chrome", {
                            body: "Click for more info. Bugs might occur, but all issues will be ignored unless you update to stable channel of Chrome.",
                            icon: Icons.NotificationLogo,
                            tag: NotificationTags.UNSTABLE_BROWSER_CHANNEL,
                            newNotificationOnClick: async () => {
                                openUnstableWarningPage();
                            }
                        });
                    }
                }
            }).catch(error => {
                console.warn("error getting detectedChromeVersion: " + error);
            });
        }
    } catch (e) {
        console.warn("error detecting chrome version: " + e);
    }

    storage.get("test_fetch").then(async testFetchResponse => {

        // set this initially in case we never get more details like email etc.
        setUninstallUrl();

        detectSleepMode.init();

        // START LEGACY

        // Sept. 25th 2023
        if (await storage.getRaw("showNotificationDuration") == 7) {
            storage.set("showNotificationDuration", 6);
        }

        // Sep 2024
        const rawSoundFile = await storage.getRaw("notificationSound");
        if (rawSoundFile?.includes(".ogg")) {
            await storage.set("notificationSound", rawSoundFile.replace(".ogg", ".mp3"));
        }

        // END LAGACY

        chrome.action.setBadgeBackgroundColor({color:BadgeColor.EMOJI});
        if (chrome.action.setBadgeTextColor) {
            chrome.action.setBadgeTextColor({color: "black"});
        }
        chrome.action.setBadgeText({text : "⏳"});

        await resetTemporaryData();

        await initMisc();
        updateBadge();
        updateContextMenuItems();
        setOmniboxSuggestion();
        initRealtimeSync();
        
        // Check current time and calculate the delay until next interval
        let delay = PollingIntervals.CHECK_EVENTS - Date.now() % PollingIntervals.CHECK_EVENTS;
        
        // if next minute is too close then wait for next minute
        if (delay < seconds(5)) {
            delay += minutes(1);
        }

        chrome.alarms.create(Alarms.EVERY_MINUTE,           { when: Date.now() + delay, periodInMinutes: 1 });
        chrome.alarms.create(Alarms.EVERY_DAY,              { periodInMinutes: 60 * 24 });
        chrome.alarms.create(Alarms.UPDATE_CONTEXT_MENU,    { periodInMinutes: 30, when: getNearestHalfHour().getTime() }); // = 30 minutes
        chrome.alarms.create(Alarms.UPDATE_CONTACTS,        { periodInMinutes: 60 * 4 }); // = 4 hours (used to be every 24 hours)
        chrome.alarms.create(Alarms.UPDATE_SKINS,           { periodInMinutes: 60 * 24, delayInMinutes: generateRandomAlarmDelay() }); // = 24 hours (used to be every 48 hours)
        chrome.alarms.create(Alarms.UPDATE_UNINSTALL_URL,   { periodInMinutes: 60 * 24, delayInMinutes: generateRandomAlarmDelay() }); // = 24 hours
            
        // collect stats on options
        const lastOptionStatsSent = await storage.get("lastOptionStatsSent");
        if (await daysElapsedSinceFirstInstalled() > 14 && (!lastOptionStatsSent || lastOptionStatsSent.diffInDays() <= -7)) { // start after 2 weeks to give people time to decide and then "every" 7 days after that (to keep up with changes over time)
            console.log("collecting optstats soon...")

            // only send after a timeout make sure ga stats loaded
            chrome.alarms.create(Alarms.COLLECT_STATS, {delayInMinutes: 2});
        }
        
        // must catch error here because it could just be regular timeout error that we don't want user re-installing extension for.
        return pollServer({source:"startup"}).catch(error => {
            console.error(error);
            showMessageNotification("Problem starting extension", "Open popup window to solve it", error);
        });
    }, error => { // Note: this is the 2nd parameter of a promise.then(resolve, reject)
        logError("init settings error: " + error, error);
        showWebNotification("The 'Checker Plus for Google Calendar' extension could not load because your browser profile is corrupt. You can fix and remove this message by clicking Ok and follow the instructions in the tab that will open, or just uninstall this extension.");
        openUrl("https://jasonsavard.com/wiki/Corrupt_browser_profile?source=calendar_corruption_detected");
    }).catch(error => {
        logError("starting extension: " + error, error);
        showMessageNotification("Problem starting extension", "Try re-installing the extension.", error);
    });
}

function offlineOnlineChanged(e) {
    console.log("offline/online detected", e);
    if (e.type == "online") {
        
    }
    updateBadge();
}

globalThis.addEventListener('offline', offlineOnlineChanged);
globalThis.addEventListener('online', offlineOnlineChanged);