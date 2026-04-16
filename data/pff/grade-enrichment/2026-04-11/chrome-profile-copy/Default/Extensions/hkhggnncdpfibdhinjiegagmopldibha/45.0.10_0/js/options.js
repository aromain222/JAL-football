"use strict";

var playing;
var justInstalled = getUrlValue("action") == "install";
var donationClickedFlagForPreventDefaults;
let calendarMap;

function enableFeatures() {
    donationClickedFlagForPreventDefaults = true;
    document.querySelectorAll("[mustDonate]").forEach(el => {
        el.removeAttribute("mustDonate");
    });

    const $realTimeSyncing = byId("realtimeSyncing");
    if ($realTimeSyncing) {
        $realTimeSyncing.checked = true;
    }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.info("message rec", message);
    if (message.command == "featuresProcessed") {
        enableFeatures();
        sendResponse();
    }
});

if (chrome.action.onUserSettingsChanged) {
    chrome.action.onUserSettingsChanged.addListener(userSettings => {
        if (userSettings.isOnToolbar) {
            document.body.classList.add("hide-pin");
        } else {
            document.body.classList.remove("hide-pin");
        }
    });
}

if (chrome.action.getUserSettings) {
    chrome.action.getUserSettings(userSettings => {
        if (userSettings.isOnToolbar) {
            document.body.classList.add("hide-pin");
        } else {
            document.body.classList.remove("hide-pin");
        }
    })
}

async function reloadExtension(onlyCheckEvents) {
    // in prod chrome.runtime.reload() doesn't call chrome.runtime.onInstalled, only with unpacked extensions
    if (inLocalExtension) {
        if (chrome.runtime.reload) {
            chrome.runtime.reload();
        } else {
            niceAlert("You must disable/re-enable the extension in the extensions page or restart the browser");
        }
    } else {
        await sendMessageToBG("resetInitMiscWindowVars");
        if (onlyCheckEvents) {
            await sendMessageToBG("checkEvents");
        } else {
            await sendMessageToBG("init");
            window.close();
        }
    }
}

async function waitForStorageSync() {
    await sleep(200);
}

async function updateCustomIcons() {
    const url = await storage.get("customButtonIcon");
    if (url) {
        const $icon = byId("customButtonIcon");
        $icon.setAttribute("src", url);
        css($icon, {
            width: "19px",
            height: "19px"
        });
    }

    byId("currentBadgeIcon").setAttribute("src", await getBadgeIconUrl("", true));
}

async function initDefaultEventDuration() {
    const $defaultEventDuration = selector("#default-event-duration option");
    if ($defaultEventDuration) {
        const durationInMinutes = await getDefaultEventLength();
        $defaultEventDuration.setAttribute("value", durationInMinutes);
        $defaultEventDuration.textContent = getMessage("Xminutes", durationInMinutes);
        selector("#default-event-duration").value = durationInMinutes;
    }

    onClickReplace("#default-event-duration", function () {
        niceAlert("You must change this in your Google Calendar > General > Event settings > Default duration");
        //selector("#default-event-duration").close();
    });

    onClickReplace("#refresh-google-calendar-settings", async function () {
        sendMessageToBG("fetchCalendarSettings", { bypassCache: true, email: await storage.get("email") }).then(response => {
            initDefaultEventDuration();
            niceAlert(getMessage("done"));
        }).catch(error => {
            niceAlert("problem: " + error)
        });
    });
}

function notificationSoundListener(event) {
    console.log("notificationSoundListener", event, this);

    let soundName = event.target.value;

    if (soundName == "custom") {
        byId("notificationSoundInputButton").click();
    } else {
        if (event.target.dataset.attemptedValue) {
            soundName = event.target.dataset.attemptedValue;
            delete event.target.dataset.attemptedValue;
        }
        playSound(soundName);
    }

    if (soundName) {
        fadeIn("#soundOptions");
    } else {
        hide("#soundOptions");
    }

    // patch required for touchend to open file dialog
    event.preventDefault();
    event.stopPropagation();
}

async function initPage(tabName) {
	console.log("initPage: " + tabName);
	if (!byId(tabName + "Page")) {
		initTemplate(tabName + "PageTemplate", true);

        initPaperElement(selectorAll("#" + tabName + "Page [storage], #" + tabName + "Page [permissions]"));

        onClickReplace(".grantAccessButton, #grantAccessAgain", async () => {
            let tokenResponse;
			if (supportsChromeSignIn()) {
				tokenResponse = await openPermissionsDialog({modal: false});
			} else {
                tokenResponse = await requestPermission({ useGoogleAccountsSignIn: true });
			}

            if (tokenResponse) {
                postGrantedPermissionsToCalendarsAndPolledServer(await storage.get("email"));
            }
		});

		if (tabName == "welcome") {
			const navLang = await storage.get("language");
            const $lang = byId("lang");
            if ($lang.querySelector("[value='" + navLang + "']")) {
				$lang.value = navLang;
			} else if ($lang.querySelector(`[value='${navLang.substring(0, 2)}']`)) {
                $lang.value = navLang.substring(0, 2);
			} else {
				$lang.value = "en";
			}

			byId("lang").addEventListener("change", async function () {
                try {
                    delete window.initMiscPromise;
                    await initUI();
                    await sendMessageToBG("resetInitMiscWindowVars");
                    await sendMessageToBG("checkEvents", {ignoreNotifications: true});
                } catch (error) {
                    showError(error);
                }
			});

			onClick("#openCheckerPlusSidePanelGuide", function() {
				showOptionsSection("button");
                byId("browserButtonAction").classList.add("highlight");
			});

			onClick("#notificationsGuide", function() {
				showOptionsSection("notifications");
				sendGA("guide", "notifications");
			});
		} else if (tabName == "notifications") {

			loadVoices();
			// seems we have to call chrome.tts.getVoices twice at a certain 
			if (DetectClient.isLinux()) {
				setTimeout(function () {
					loadVoices();
				}, seconds(1));
			}
			
			if (await storage.get("notificationVoice")) {
				show("#voiceOptions");
			} else {
				hide("#voiceOptions");
			}

            const $notificationVoice = byId("notificationVoice");
            if ($notificationVoice) {
                byId("notificationVoice").addEventListener("change", function (e) {
                    const voiceName = e.target.value;

                    storage.set("notificationVoice", voiceName);
                    if (voiceName) {
                        if (voiceName == "addVoice") {
                            openUrl("https://jasonsavard.com/wiki/Voice_Notifications");
                        } else {

                            if (voiceName.includes("Multilingual TTS Engine")) {
                                byId("pitch").setAttribute("disabled", "true");
                                byId("rate").setAttribute("disabled", "true");
                            } else {
                                byId("pitch").removeAttribute("disabled");
                                byId("rate").removeAttribute("disabled");
                            }

                            playVoice();
                        }
                        fadeIn("#voiceOptions");
                    } else {
                        hide("#voiceOptions");
                    }
                });
            }

			onClick("#playVoice", async function () {
				const isSpeaking = await chrome.runtime.sendMessage({command: "chromeTTS", isSpeaking:true});
                if (isSpeaking) {
                    chrome.runtime.sendMessage({command: "chromeTTS", stop:true});
                    byId("playVoice").setAttribute("icon", "stop");
                } else {
                    playVoice();
                }
			});

			addEventListeners("#voiceOptions input[type='range']", "change", async function () {
				await waitForStorageSync();
                playVoice();
			});

            addEventListeners("#voiceTestText", "keyup", function (e) {
                if (e.key == "Enter") {
                    playVoice();
                }
            });

			onClick("#runInBackground", function () {
				var that = this;
				// timeout to let permissions logic determine check or uncheck the before
				setTimeout(function () {
					if (that.checked) {
                        if (DetectClient.isMac()) {
                            niceAlert("Unfortunately Chrome no longer supports this on Mac");
                        } else {
                            openDialog("runInBackgroundDialogTemplate");
                        }
					}
				}, 1);
			});

			if (await storage.get("notificationSound")) {
				show("#soundOptions");
			} else {
				hide("#soundOptions");
			}

            selector("#notificationSound").addEventListener("change", notificationSoundListener);

			onClick("#playNotificationSound", function () {
				if (playing) {
                    sendMessageToBG("stopAudio");
                    playing = false;
                    this.setAttribute("icon", "play-arrow");
				} else {
					playSound();
				}
			});

			addEventListeners("#notificationSoundVolume", "change", async function () {
				setTimeout(function () {
					playSound();
				}, 100);
			});

            addEventListeners("#notificationSoundInputButton", "change", function () {
				var file = this.files[0];
				var fileReader = new FileReader();

				fileReader.onloadend = function () {
					storage.set("notificationSoundCustom", this.result).then(() => {
						playSound();
					}).catch(error => {
						openDialog("The file you have chosen is too large, please select a shorter sound alert.");
						storage.remove("notificationSoundCustom");
					});
				}

				fileReader.onabort = fileReader.onerror = function () {
					niceAlert("Problem loading file");
				}

				console.log("file", file)
				fileReader.readAsDataURL(file);
			});

			async function initNotifications(startup) {
				let showMethod;
				let hideMethod;
				if (startup) {
					showMethod = "show";
					hideMethod = "hide";
				} else {
					showMethod = "slideDown";
					hideMethod = "slideUp";
				}

				const desktopNotification = await storage.get("desktopNotification");
				if (desktopNotification == "") {
                    globalThis[hideMethod](byId("desktopNotificationOptions"));
				} else if (desktopNotification == "text") {
					globalThis[showMethod](byId("desktopNotificationOptions"));
					globalThis[hideMethod](byId("richNotificationOptions"));
					globalThis[hideMethod](byId("showCalendarNames"));
					globalThis[hideMethod](byId("popupWindowNotificationOptions"));
				} else if (desktopNotification == "rich") {
					globalThis[showMethod](byId("desktopNotificationOptions"));
					globalThis[showMethod](byId("richNotificationOptions"));
					globalThis[showMethod](byId("showCalendarNames"));
					globalThis[hideMethod](byId("popupWindowNotificationOptions"));
				} else if (desktopNotification == "popupWindow") {
					globalThis[showMethod](byId("desktopNotificationOptions"));
					globalThis[hideMethod](byId("richNotificationOptions"));
					globalThis[showMethod](byId("showCalendarNames"));
					globalThis[showMethod](byId("popupWindowNotificationOptions"));
				}
			}

			initNotifications(true);

			function requestTextNotificationPermission(showTest) {
				Notification.requestPermission(permission => {
					if (permission == "granted") {
						if (showTest) {
                            sendMessageToBG("testNotification", { testType: "text" }).catch(error => {
                                showError("Error: " + error);
                            });
						}
					} else {
						openNotificationPermissionIssueDialog(permission);
					}
				});
			}

			byId("desktopNotification").addEventListener("change", async function(e) {
				initNotifications();
				if (await storage.get("desktopNotification") == "text") {
					requestTextNotificationPermission();
				}
			});

			onClick("#testNotification", async function () {
                const desktopNotification = await storage.get("desktopNotification");
				if (desktopNotification == "text") {
					requestTextNotificationPermission(true);
				} else {
                    sendMessageToBG("testNotification", { testType: desktopNotification }).then(warning => {
                        if (warning && !isEmptyObject(warning)) {
                            console.log("warning: ", warning);
                            throw new Error(warning);
                        }
                    }).catch(error => {
                        console.log("notifresponse: ", error)
                        openNotificationPermissionIssueDialog(error);
                    });
				}
			});

			addEventListeners("#pendingNotificationsInterval", "change", async function () {
				sendMessageToBG("forgottenReminder.stop");
			});

			onClick("#testPendingReminder", async function () {
                await openDialog("Click OK to see the toolbar button animate :)");
                sendMessageToBG("forgottenReminder.execute", {test: true }).catch(error => {
                    alert(error);
                });
			});

			selectorAll(".snoozeOption").forEach(option => {
				option.textContent = getMessage("snooze") + " " + option.textContent.replaceAll("\n", "").trim();
			});

            addEventListeners("#defaultEventNotificationTime", "change", async () => {
                await waitForStorageSync();
                const defaultEventNotificationTime = await getDefaultEventNotificationTime();

                const eventsShown = await storage.get("eventsShown");
                eventsShown.forEach(event => {
                    event.reminderTime = defaultEventNotificationTime;
                });

                await storage.set("eventsShown", eventsShown);
                await niceAlert(getMessage("clickOkToRestartExtension"));
				reloadExtension();
            });

            addEventListeners("#syncDismissedAndSnoozedRemindersAcrossExtensions", "change", async function () {
                if (this.checked && await storage.get("donationClicked")) {
                    niceAlert(document.createRange().createContextualFragment(`
                        <div>
                            <p>You must also enable this option on the other extension (max 2) and make sure you browser extensions sync is enabled.</p>
                            <a href="https://support.google.com/chrome/answer/185277" target="_blank">Learn how to enable Chrome sync</a>
                        </div>
                    `));
                }
            });

			onClick("#refresh", async function () {
                showLoading();
                await sendMessageToBG("pollServer", {
                    source:	"refresh",
                    bypassCache: true,
                });
                location.reload();
			});

        } else if (tabName == "dnd") {

            setTimeout(function() {
				if (location.href.match("highlight=DND_schedule")) {
					byId("dndSchedule").click();
				}
			}, 500);

            onClick("#dndSchedule", async function () {
				//var $dialog = initTemplate("dndScheduleDialogTemplate");

				const $timetable = document.createElement("div");
                $timetable.id = "dndTimetable";

				const DND_timetable = await storage.get("DND_timetable");

                let $header = document.createElement("div");
                $header.classList.add("header", "layout", "horizontal");

                let $time = document.createElement("div");
                $time.classList.add("time");

				$header.append($time);

				for (var a = 1; a < 8; a++) {
                    const $dayHeader = document.createElement("div");
                    $dayHeader.classList.add("day");

                    const $allDay = document.createElement("j-button");
                    $allDay.classList.add("allDay");
                    $allDay.setAttribute("icon", "done-all");
					$allDay.setAttribute("day", a % 7);
                    onClick($allDay, async function () {
						if (await donationClicked("DND_schedule")) {
							let allDayChecked = this.checked;
							let day = this.getAttribute("day");
							selectorAll(`#dndScheduleDialog input[day='${day}']`).forEach(el => {
								el.checked = !allDayChecked;
							});
							this.checked = !this.checked;
						}
					});
					$dayHeader.append($allDay, dateFormat.i18n.dayNamesShort[a % 7]);
					$header.append($dayHeader);
				}

				$timetable.append($header);

				for (var hour = 0; hour < 24; hour++) {
                    let $row = document.createElement("div");
                    $row.classList.add("row");

                    const date = new DateZeroTime();
                    date.setHours(hour);

                    let $time = document.createElement("div");
                    $time.classList.add("time");
					$time.textContent = date.toLocaleTimeStringJ();

					$row.append($time);

					for (var b = 0; b < 7; b++) {
						let day = (b + 1) % 7;
                        let $checkbox = document.createElement("input");
                        $checkbox.type = "checkbox";
						$checkbox.setAttribute("day", day);
						$checkbox.setAttribute("hour", hour);
                        onClick($checkbox, async function () {
							if (!await donationClicked("DND_schedule")) {
								this.checked = false;
							}
						});

						if (DND_timetable && DND_timetable[day][hour]) {
							$checkbox.checked = true;
						}

						$row.append($checkbox);
					}
                    let $allWeek = document.createElement("j-button");
                    $allWeek.classList.add("allWeek");
                    $allWeek.setAttribute("icon", "done-all");
                    onClick($allWeek, async function () {
						if (await donationClicked("DND_schedule")) {
							let allWeekChecked = this.checked;
							this.closest(".row").querySelectorAll("input[type='checkbox']").forEach(el => {
								el.checked = !allWeekChecked;
							});
							this.checked = !this.checked;
						}
					});

					$row.append($allWeek);
					$timetable.append($row);
				}

                openDialog($timetable, {
                    id: "dndScheduleDialog",
                    title: getMessage("muteVoiceWhileSleeping"),
                    buttons: [{
                        label: getMessage("reset"),
                        onClick: function () {
                            selectorAll("#dndScheduleDialog input[type='checkbox']").forEach(el => {
                                el.checked = false;
                            });
                        }
                    }, {
                        label: getMessage("ok"),
                        primary: true,
                        onClick: async function(dialog) {
                            let atleastOneChecked = false;
                            let DND_timetable = {};
                            selectorAll("#dndScheduleDialog input[type='checkbox']").forEach(el => {
                                let day = el.getAttribute("day");
                                let hour = el.getAttribute("hour");
                                DND_timetable[day] ||= {};
                                DND_timetable[day][hour] = el.checked;
                                if (el.checked) {
                                    atleastOneChecked = true;
                                }
                            });
                            // just a flag to indicate schedule is on/off
                            await storage.set("DND_schedule", atleastOneChecked);
                            // store actual hours
                            await storage.set("DND_timetable", DND_timetable);

                            sendMessageToBG("updateBadge");
                            dialog.close();
                        }
                    }]
                });
			});

		} else if (tabName == "button") {
			addEventListeners(`
                #showEventTimeOnBadge,
                #showEventTimeOnBadgeOptions input[type="checkbox"],
                #showDayOnBadge,
                #showDayOnBadgeOptions input[type="checkbox"],
                #excludeRecurringEventsButtonIcon,
                #excludeHiddenCalendarsFromButton,
                #showButtonTooltip,
                #showBusyEvents`,
                
                "change", async function () {
                await waitForStorageSync();
                await sendMessageToBG("checkEvents", { ignoreNotifications: true });
			});

			addEventListeners("#showTimeSpecificEventsBeforeAllDay", "change", async function () {
                await waitForStorageSync();
                await sendMessageToBG("pollServer", { source: "showTimeSpecificEventsBeforeAllDay" });
			});

		    addEventListeners("#browserButtonAction", "change", async function () {
                await waitForStorageSync();
                initPopup();
			});

			if (await storage.get("showEventTimeOnBadge")) {
				show("#showEventTimeOnBadgeOptions");
			} else {
				hide("#showEventTimeOnBadgeOptions");
			}

			addEventListeners("#showEventTimeOnBadge", "change", function () {
				if (this.checked) {
					slideDown("#showEventTimeOnBadgeOptions");
				} else {
					slideUp("#showEventTimeOnBadgeOptions");
				}
			});

			if (await storage.get("showDayOnBadge")) {
				show("#showDayOnBadgeOptions");
			} else {
				hide("#showDayOnBadgeOptions");
			}

			addEventListeners("#showDayOnBadge", "change", function () {
				if (this.checked) {
					slideDown("#showDayOnBadgeOptions");
				} else {
					slideUp("#showDayOnBadgeOptions");
				}
			});

			updateCustomIcons();

            // pointerup to support touch surfaces also
            replaceEventListeners("#badgeIcon option", "click", async function(e) {
                console.log("badge icon")
                updateCustomIcons();
                sendMessageToBG("updateBadge", { forceRefresh: true });

                if (await storage.get("badgeIcon") == "custom") {
                    const customButtonIconInput = document.createElement("input");
                    customButtonIconInput.id = "customButtonIconInput";
                    customButtonIconInput.type = "file";
                    customButtonIconInput.accept = "image/*";
                    customButtonIconInput.addEventListener("change", function (e) {
                        console.log(e.target.files);
                        var buttonId = e.target.id;
                        var file = e.target.files[0];
                        var fileReader = new FileReader();
        
                        fileReader.onload = function () {
                            console.log("result: ", this.result);
        
                            var canvas = document.createElement("canvas");
                            var img = new Image();
                            img.onload = async function () {
                                var widthHeightToSave;
                                if (this.width <= 19) {
                                    widthHeightToSave = 19;
                                } else {
                                    widthHeightToSave = 38;
                                }
                                canvas.width = canvas.height = widthHeightToSave;
        
                                var context2 = canvas.getContext("2d");
                                context2.drawImage(this, 0, 0, widthHeightToSave, widthHeightToSave);
        
                                console.log("dataurl: " + canvas.toDataURL().length);
        
                                await storage.set("customButtonIcon", canvas.toDataURL());

                                updateCustomIcons();
                                sendMessageToBG("updateBadge", { forceRefresh: true });
        
                                niceAlert(getMessage("done"));
                            }
        
                            img.onerror = function (e) {
                                console.error(e);
                                niceAlert("Error loading image, try another image!");
                            }
        
                            img.src = this.result;
                        }
        
                        fileReader.onabort = fileReader.onerror = function (e) {
                            console.error("fileerror: ", e);
                            if (e.currentTarget.error.name == "NotFoundError") {
                                alert("Temporary error, please try again.");
                            } else {
                                alert(e.currentTarget.error.message + " Try again.");
                            }
                        }
        
                        fileReader.readAsDataURL(file);
        
                    });

                    openDialog(customButtonIconInput);
                }
			});
		} else if (tabName == "general") {
            if (location.href.match("highlight=customView")) {
                requestAnimationFrame(() => {
                    byId("customView").scrollIntoView({behavior: "smooth", block: "center"});
                    byId("customView").classList.add("highlight");
                });
            } else if (location.href.match("highlight=eventConflictHandling")) {
                requestAnimationFrame(() => {
                    byId("eventConflictHandling").scrollIntoView({behavior: "smooth", block: "center"});
                    byId("eventConflictHandling").classList.add("highlight");
                });
            }

            async function initTimezoneDropdowns() {
                const displaySecondaryTimezone = await storage.get("displaySecondaryTimezone");

                if (displaySecondaryTimezone) {
                    byId("secondaryTimezone").removeAttribute("disabled");
                    byId("secondaryTimezoneLabel").removeAttribute("disabled");
                } else {
                    byId("secondaryTimezone").setAttribute("disabled", true);
                    byId("secondaryTimezoneLabel").setAttribute("disabled", true);
                }
            }

            initTimezoneDropdowns();

            onClick("#displaySecondaryTimezone", async function () {
                await waitForStorageSync();
                initTimezoneDropdowns();
            });

            requestIdleCallback(() => {
                setTimeout(async () => {
                    generateTimezoneDropdown("primaryTimezone", true);
                    generateTimezoneDropdown("secondaryTimezone");

                    const $primaryTimezone = byId("primaryTimezone");
                    $primaryTimezone.addEventListener("click", function() {
                        niceAlert("The Primary timezone is synced from your Google Calendar. You can change it in your Google Calendar > General > Time zone");
                        //$primaryTimezone.closest("paper-dropdown-menu").close();
                    });
                }, 500)
            });


            initCalendarDropDown("defaultCalendar", {selectedCalendarId: await getDefaultCalendarId(await getArrayOfCalendars())});

			onChange("#maxDaysAhead, #twentyFourHourMode", async function () {
                await waitForStorageSync();
                twentyFourHour = await storage.get("24hourMode");
                await sendMessageToBG("resetInitMiscWindowVars");
                sendMessageToBG("addChangeContextMenuItems");
                sendMessageToBG("checkEvents", { ignoreNotifications: true });
			});

			addEventListeners("#showContextMenuItem", "change", function (e) {
				if (this.checked) {
                    show("#showOnlyQuickWhenTextSelected");
                    sendMessageToBG("addChangeContextMenuItems");
				} else {
                    hide("#showOnlyQuickWhenTextSelected");
					chrome.contextMenus.removeAll();
				}
            });

            if (!await storage.get("showContextMenuItem")) {
                hide("#showOnlyQuickWhenTextSelected");
            }

            addEventListeners("#showOnlyQuickWhenTextSelected", "change", function (e) {
                sendMessageToBG("addChangeContextMenuItems");
            });
            
            async function initFirstDay() {
                const customView = await storage.get("customView");
                showHide("#firstDay", !isCustomViewInDays(customView));
            }

            initFirstDay();

			onChange("#customView", async function () {
                await storage.set("calendarView", CalendarView.CUSTOM);
                initFirstDay();
			});

            const openExistingTabOriginParam = {origins: [Origins.OPEN_EXISTING_TABS]};

			if (await storage.get("openExistingCalendarTab") && await chrome.permissions.contains(openExistingTabOriginParam)) {
				byId("openExistingCalendarTab").checked = true;
			}

			onClick("#openExistingCalendarTab", async function () {
				var that = this;
				if (that.checked) {
					const granted = await chrome.permissions.request(openExistingTabOriginParam);
                    if (granted) {
                        storage.enable("openExistingCalendarTab");
                    } else {
                        that.checked = false;
                    }
				} else {
                    await chrome.permissions.remove(openExistingTabOriginParam);
					storage.disable("openExistingCalendarTab");
				}
            });

            if (await isAllowedRealtimeSync()) {
                byId("realtimeSyncing").checked = true;
                byId("realtimeSyncing").removeAttribute("mustDonate"); // don't need to gray it out if already enabled
            }

            onClick("#realtimeSyncing", async function () {
                if (this.checked && !await storage.get("donationClicked")) {
                    this.checked = false;
                    openContributeDialog("realtimeSyncing");
                } else if (!this.checked) {
                    this.checked = true;
                    niceAlert("Realtime syncing cannot be disabled.");
                }
            });

            byId("appearance").value = await getColorSchemeSetting();

            byId("appearance").addEventListener("click", function(e) {
                e.target.dataset.previousValue = e.target.value;
            });

            byId("appearance").addEventListener("change", async function (e) {
                if (await donationClicked("darkMode")) {
                    await storage.set("darkMode", e.target.value);
                    initColorScheme();
                } else {
                    this.value = e.target.dataset.previousValue;
                    try {
                        var quotaText = await fetch(`https://jasonsavard.com/getQuotaText?space=${"calendar"}`).then(response => response.json());
                    } catch (error) {
                        console.error("Error fetching quota text", error);
                    }
                }
            });

            initDefaultEventDuration();
        } else if (tabName == "skinsAndThemes") {

            const $skinsListing = byId("skinsAndThemesListing");

            showSpinner();

            try {
                const skins = await Controller.getSkins();
                skins.forEach(skin => {
                    const $row = document.createElement("tr");
                    $row.classList.add("skinLine");

                    const $name = document.createElement("td");
                    $name.classList.add("name");
                    $name.textContent = skin.name;

                    const $skinImageWrapper = document.createElement("td");
                    $skinImageWrapper.classList.add("skinImageWrapper");

                    const $skinImageLink = document.createElement("a");
                    $skinImageLink.classList.add("skinImageLink");

                    const $skinImage = document.createElement("img");
                    $skinImage.classList.add("skinImage");

                    $skinImageLink.append($skinImage);
                    $skinImageWrapper.append($skinImageLink);

                    const $author = document.createElement("td");
                    $author.classList.add("author");

                    const $installs = document.createElement("td");
                    $installs.textContent = skin.installs;

                    const $addSkinWrapper = document.createElement("td");

                    const $addSkin = document.createElement("j-button");
                    $addSkin.classList.add("addSkin", "filled");
                    $addSkin.setAttribute("icon", "add");

                    $addSkinWrapper.append($addSkin);

                    $row.append($name, $skinImageWrapper, $author, $installs, $addSkinWrapper);

                    $row._skin = skin;

                    if (skin.image) {
                        $skinImage.src = skin.image;
                        $skinImageLink.href = skin.image;
                        $skinImageLink.target = "_previewWindow";
                    }
    
                    const $authorLink = document.createElement("a");
                    $authorLink.textContent = skin.author;
                    if (skin.author_url) {
                        $authorLink.href = skin.author_url;
                        $authorLink.target = "_preview";
                        $skinImage.style["cursor"] = "pointer";
                    }
                    $author.append( $authorLink );
                    onClick($addSkin, () => {
                        window.open("https://jasonsavard.com/wiki/Skins_and_Themes?ref=skinOptionsTab", "emptyWindow");
                    });
    
                    $skinsListing.append($row);
                });
            } catch (error) {
                $skinsListing.append("Problem loading skins: " + error);
            }

            hideLoading();

		} else if (tabName == "accounts") {
            if (getUrlValue("requestPermission")) {
                const params = JSON.parse(getUrlValue("params")) || {};
                params.modal = false;
                const tokeResponse = await openPermissionsDialog(params);
                hideLoading();
    
                if (tokeResponse) {
                    showToast(getMessage("accessGranted"));
                    chrome.action.openPopup().catch(error => {
                        console.error(error);
                        // for firefox cause it requires a user gesture
                        niceAlert("Click the extension icon to open the popup window").then(() => {
                            chrome.action.openPopup().catch(error => {});
                        });
                    });
                }
            }

            const tokenResponse = await oAuthForDevices.findTokenResponse(await storage.get("email"));
            if (tokenResponse && !canViewEventsAndCalendars(tokenResponse)) {
                byId("grantAccessAgain").classList.add("raised", "colored");
            }

			onClick("#revokeAccess", async function () {
                const email = await storage.get("email");
				storage.remove("snoozers");
                storage.remove("cachedFeeds");
                storage.remove("cachedFeedsDetails");
                
                resetTemporaryData();

                async function revokeAccess(oAuthForMethod, lastRevoke) {
                    const tokenResponse = await oAuthForMethod.findTokenResponse(email)
                    if (tokenResponse) {
                        removeAllCachedTokens();
    
                        await oAuthForMethod.removeAllTokenResponses();
        
                        if (lastRevoke) {
                            emptyNode("#emailsGrantedPermissionToContacts");
                            byId("defaultAccountEmail").textContent = email;
                            show("#oauthNotGranted");
                            hide("#oauthOptions");
                        }

                        return fetchJSON(`https://oauth2.googleapis.com/revoke?token=${tokenResponse.access_token}`, null, {method: "POST"});
                    }
                }

                try {
                    await revokeAccess(oAuthForTasks);
                } catch (error) {
                    console.warn("Ignore task error", error);
                }

                revokeAccess(oAuthForDevices, true).then(() => {
					showLoggedOut();
					showToast(getMessage("done"));
				}).catch(error => {
					console.error(error);
                    const $errorDialog = document.createElement("div");
                    $errorDialog.appendChild(document.createTextNode("Might already be expired or revoked, you can do it manually with this: "));

                    const $link = document.createElement("a");
                    $link.href = "https://support.google.com/accounts/answer/3466521";
                    $link.target = "_blank";
                    $link.textContent = "https://support.google.com/accounts/answer/3466521";

                    $errorDialog.appendChild($link);

                    niceAlert($errorDialog);
				});
			});
		} else if (tabName == "admin") {
			addEventListeners("#showConsoleMessages", "change", async () => {
                await waitForStorageSync();
                await niceAlert(getMessage("clickOkToRestartExtension"));
				reloadExtension();
			});

            addEventListeners("#disableOnline", "change", async () => {
                await waitForStorageSync();
                await niceAlert("Click OK to restart the extension");
                reloadExtension();
            });

			onClick("#fetchCalendarSettings", async () => {
                sendMessageToBG("fetchCalendarSettings", { bypassCache: true, email: await storage.get("email") }).then(response => {
					niceAlert("Done");
				}).catch(error => {
					niceAlert("problem: " + error)
				});
			});

			onClick("#resetSettings", async () => {
				const snoozers = await getFutureSnoozes(await getSnoozers(), {email: await storage.get("email")});
				if (snoozers.length) {
					openDialog("You have some snoozed events which will be fogotten after clearing the data. Do you want to take note of them?", {
                        buttons: [
                            {
                                label: getMessage("snoozedEvents"),
                                onClick: () => {
                                    openReminders({ notifications: snoozers.shallowClone() });
                                }
                            },
                            {
                                label: getMessage("reset"),
                                primary: true,
                                onClick: () => {
                                    clearData();
                                }
                            }
                        ]
					});
				} else {
					clearData();
				}
			});

            onClick("#reload-extension", async () => {
                chrome.runtime.reload();
            });

            onClick("#polling-status", async function() {
                const $pollingStatus = document.createElement("div");

                try {
                    $pollingStatus.innerHTML = "";

                    const cachedFeedsDetails = await storage.get("cachedFeedsDetails") || {};
                    const keys = Object.keys(cachedFeedsDetails);
                    if (!keys.length) {
                        $pollingStatus.textContent = "No cached feeds";
                        return;
                    }

                    const ul = document.createElement("ul");
                    ul.style.margin = "0";
                    ul.style.paddingLeft = "18px";

                    // Sort cachedFeedsDetails keys by CPlastFetched (most recent first).
                    // Supports numeric timestamps and date strings; missing or invalid values go last.
                    keys.sort((k1, k2) => {
                        const getTime = v => {
                            if (v == null) return -Infinity;
                            if (typeof v === "number") return v;
                            const parsed = Date.parse(v);
                            return isNaN(parsed) ? -Infinity : parsed;
                        };

                        const v1 = cachedFeedsDetails[k1]?.CPlastFetched;
                        const v2 = cachedFeedsDetails[k2]?.CPlastFetched;

                        const t1 = getTime(v1);
                        const t2 = getTime(v2);

                        // Descending: newest first
                        return t2 - t1;
                    });

                    for (const key of keys) {
                        const feed = cachedFeedsDetails[key] || {};
                        // Try several possible property names for the timestamp
                        const ts = feed.CPlastFetched ?? null;
                        let display = "never";

                        function formatRelativeTimestamp(tsValue) {
                            if (tsValue == null) return "never";
                            const date = new Date(tsValue);
                            if (isNaN(date.getTime())) return String(tsValue);

                            const now = Date.now();
                            const diffMs = now - date.getTime();
                            const absMs = Math.abs(diffMs);

                            // keep short human-friendly for very recent times
                            if (absMs < 60 * 1000) { // less than 1 minute
                                return diffMs >= 0 ? "just now" : "in a few seconds";
                            }

                            const rtf = new Intl.RelativeTimeFormat(navigator.language || "en", { numeric: "auto" });

                            const minutes = Math.round(diffMs / (60 * 1000));
                            const hours = Math.round(diffMs / (60 * 60 * 1000));
                            const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
                            const weeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

                            // rtf.format expects the value in units relative to now:
                            // negative => "X ago", positive => "in X"
                            if (Math.abs(minutes) < 60) {
                                return rtf.format(-minutes, "minute");
                            } else if (Math.abs(hours) < 24) {
                                return rtf.format(-hours, "hour");
                            } else if (Math.abs(days) < 7) {
                                return rtf.format(-days, "day");
                            } else if (Math.abs(weeks) < 5) {
                                return rtf.format(-weeks, "week");
                            }

                            // fallback to full locale datetime for older timestamps
                            return date.toLocaleString();
                        }

                        if (ts != null) {
                            display = formatRelativeTimestamp(ts);
                        }

                        const calendar = getCalendarById(key);

                        if (calendar) {
                            const title = calendar.summary || key;
                            const li = document.createElement("li");
                            li.textContent = `${title}: ${display}`;
                            ul.appendChild(li);
                        }
                    }

                    $pollingStatus.appendChild(ul);
                } catch (err) {
                    console.error("Error rendering polling status", err);
                    $pollingStatus.textContent = "Error loading polling status";
                }

                niceAlert($pollingStatus);
            });

            onClick("#show-last-dismissed-notifications", async () => {
                if (isVisible("#undo-notifications-list")) {
                    await slideUp("#undo-notifications-list");
                    emptyNode("#undo-notifications-list");
                } else {
                    showLoading();
                    const eventsShown = await storage.get("eventsShown");
                    const events = await getEvents();
    
                    let maxEventsToFetch = 10;
        
                    for (let i = eventsShown.length - 1; i >= Math.max(eventsShown.length - maxEventsToFetch, 0); i--) {
                        let theEvent = findEvent(eventsShown[i], events);

                        const $eventItem = document.createElement("li");
                        let $undoButton;
                        if (!theEvent) {
                            console.warn("event not found", eventsShown[i]);
    
                            const eventId = eventsShown[i].id;
                            try {
                                const response = await oauthDeviceSend({
                                    userEmail: await storage.get("email"),
                                    type: "get",
                                    url: `/calendars/primary/events/${encodeURIComponent(eventId)}`
                                });
                                theEvent = response;
                            } catch (error) {
                                console.error("Error fetching event: ", error);
                                theEvent = {
                                    deleted: true,
                                    summary: `[Deleted event: ${eventsShown[i].id}]`,
                                }
                            }
    
                            /*
                            theEvent = {
                                deleted: true,
                                summary: `[Deleted event: ${eventsShown[i].id}]`,
                            }
                            */
                            //maxEventsToFetch++;
                            //continue;
    
                        }
    
                        $undoButton = document.createElement("j-button");
                        $undoButton.classList.add("filled");
                        $undoButton.style.marginLeft = "10px";
                        $undoButton.textContent = getMessage("undo");
                        $undoButton.addEventListener("click", async () => {
                            const index = eventsShown.findIndex(event => event.id === theEvent.id);
                            if (index !== -1) {
                                eventsShown.splice(index, 1);
                                await storage.set("eventsShown", eventsShown);
                                const $restartButton = document.createElement("j-button");
                                $restartButton.classList.add("colored");
                                $restartButton.style.marginLeft = "10px";
                                //$restartButton.style.backgroundColor = "lightgreen";
                                $restartButton.textContent = "Reload reminders";
                                $restartButton.addEventListener("click", () => {
                                    reloadExtension(true);
                                    slideUp($eventItem);
                                });
    
                                $eventItem.appendChild($restartButton);
                            }
                            $undoButton.disabled = true;
                            //$undoButton.parentNode.remove();
                        });
                        
                        const $link = document.createElement(theEvent.deleted ? "span" : "a");
                        $link.href = theEvent.htmlLink;
                        $link.textContent = theEvent.summary;
                        $link.style.textDecoration = "none";
                        $link.target = "_blank";
                        $eventItem.appendChild($link);
    
                        if (!theEvent.deleted) {
                            $eventItem.appendChild($undoButton);
                        }
    
                        byId("undo-notifications-list").appendChild($eventItem);
                    }
    
                    slideDown("#undo-notifications-list");
                    hideLoading();
                }
            });

            onClick("#reset-dismissed-notifications", async () => {
                await storage.remove("eventsShown");
                await niceAlert(getMessage("clickOkToRestartExtension"));
				reloadExtension(true);
            });

			onClick("#saveSyncOptions", function () {
				syncOptions.save("manually saved").then(function () {
					openDialog("Reminder, make sure you are signed into the browser for the sync to complete", {
						title: "Sync completed",
                        buttons: [
                            {
                                label: getMessage("moreInfo"),
                                onClick: () => {
                                    if (DetectClient.isFirefox()) {
                                        openUrl("https://support.mozilla.org/kb/how-do-i-set-sync-my-computer");
                                    } else {
                                        openUrl("https://support.google.com/chrome/answer/185277");
                                    }
                                }
                            }
                        ]
					});
				}).catch(error => {
                    const errorDiv = document.createElement("div");
                    errorDiv.textContent = "Problem exporting to sync storage, try using the export to local file option.";
                    errorDiv.appendChild(document.createElement("br"));
                    errorDiv.appendChild(document.createElement("br"));
                    const errorSpan = document.createElement("span");
                    errorSpan.style.fontSize = "smaller";
                    errorSpan.style.color = "red";
                    errorSpan.textContent = error;
                    errorDiv.appendChild(errorSpan);
                    niceAlert(errorDiv);
				});
			});

			onClick("#loadSyncOptions", function () {
				syncOptions.fetch(response => {
					// do nothing last fetch will 
					console.log("syncoptions fetch response", response);
				}).catch(response => {
					console.log("catch response", response);
					// probably different versions
					if (response?.items) {
						return new Promise(function (resolve, reject) {
							openDialog(response.error + ". You can force it but it might create issues in the extension and the only solution will be to re-install without loading settings!", {
								title: "Problem",
                                buttons: [
                                    {
                                        label: getMessage("cancel"),
                                        onClick: () => {
                                            reject("cancelledByUser");
                                        }
                                    },
                                    {
                                        label: "Force it",
                                        primary: true,
                                        onClick: () => {
                                            resolve(response.items);
                                        }
                                    }
                                ]
							});
						});
					} else {
						throw response;
					}
				}).then(items => {
					console.log("syncoptions then");
					return syncOptions.load(items);
				}).then(() => {
					openDialog(getMessage("clickOkToRestartExtension")).then(response => {
						if (response == "ok") {
							reloadExtension();
						}
					});
				}).catch(error => {
					console.log("syncoptions error: " + error);
					if (error != "cancelledByUser") {
                        if (error.cause == ErrorCause.NO_SYNC_ITEMS_FOUND) {
                            const container = document.createElement('div');

                            // Create text nodes and elements
                            const text1 = document.createTextNode("Could not find any synced data!");
                            const br1 = document.createElement('br');
                            const br2 = document.createElement('br');
                            const text2 = document.createTextNode("Make sure you sign in to Chrome on your other computer AND this one ");
                            const link = document.createElement('a');
                            link.target = '_blank';
                            link.href = 'https://support.google.com/chrome/answer/185277';
                            link.textContent = getMessage("moreInfo");

                            // Append elements to the container
                            container.appendChild(text1);
                            container.appendChild(br1);
                            container.appendChild(br2);
                            container.appendChild(text2);
                            container.appendChild(link);
                            openDialog(container);
                        } else {
                            openDialog("error loading options: " + error);
                        }
					}
				});
			});

            onClick("#exportToFileOptions", async function () {
                await storage.setDate("_exportDate");

                const items = await chrome.storage.local.get(null);
                DO_NOT_EXPORT.forEach(key => {
                    delete items[key];
                });
                downloadObject(items, "calendar-options.json");
			});

            onClick('#importFromFileOptions', function () {
                document.getElementById('jsonFileInput').click();
            });

            replaceEventListeners("#jsonFileInput", "change", function(event) {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async function(e) {
                        const jsonString = e.target.result;
                        try {
                            const jsonObject = JSON.parse(jsonString);
                            console.log("jsonobject", jsonObject);

                            await storage.clear();
                            
                            await chrome.storage.local.set(jsonObject);

                            DO_NOT_EXPORT.forEach(async key => {
                                await storage.remove(key);
                            });

                            const exportDate = await storage.get("_exportDate");
                            if (exportDate?.diffInDays() < -30) { // 1 month
                                await niceAlert("Importing old configuration files, may cause issues and might require a re-installation of the extension.");
                            }

                            const response = await Controller.verifyPayment(ITEM_ID, await storage.get("email"));
                            if (response.unlocked) {
                                console.log("unlock", response);
                                await Controller.processFeatures();
                            }

                            niceAlert("Click OK to restart the extension", true).then(() => {
                                reloadExtension();
                            });
                        } catch (error) {
                            console.error("Error parsing JSON:", error);
                            niceAlert("Invalid JSON file. Please select a valid JSON file.");
                        }
                    };
                    reader.onerror = function(e) {
                        console.error("Error reading file:", e);
                        niceAlert("Error reading file. Please try again.");
                    };
                    reader.readAsText(file);
                }
            });
		}

		// must be at end (at least after all templates have been exposed like default calendar dropdown)
		if (await storage.get("donationClicked")) {
            document.querySelectorAll("[mustDonate]").forEach(el => {
                el.removeAttribute("mustDonate");
            });
		}
		
	}
}

function showOptionsSection(tabName) {
	console.log("showtabName: " + tabName)

	selectorAll(".secondary-nav > ul > li").forEach(el => el.classList.remove("selected"));
    selector(`.secondary-nav > ul > li[value='${tabName}']`).classList.add("selected");

    selectorAll(".page").forEach(el => el.classList.remove("selected"));

    document.body.scroll({top:0});

	initPage(tabName);

    selector(`.page[value='${tabName}']`).classList.add("selected");
    
    // timeout required because the pushstate created chopiness
    requestIdleCallback(() => {
        history.pushState({}, "blah", "#" + tabName);
    }, {
        timeout: 500
    })
}

async function loadVoices() {
	console.log("loadVoices");

    const ttsVoicesElement = byId("ttsVoices");

	if (chrome.tts && ttsVoicesElement) {
		const voices = await chrome.tts.getVoices();
        console.log("voices", voices);

        for (const voice of voices) {
            const option = document.createElement("option");
            option.value = voice.voiceName;
            option.textContent = voice.voiceName;
            if (voice.extensionId) {
                option.value += "___" + voice.extensionId;
            }
            ttsVoicesElement.append(option);
        }

        byId("notificationVoice").value = (await storage.get("notificationVoice")) || "";
	}
}

async function playSound(soundName) {
	if (!soundName) {
		soundName = await storage.get("notificationSound");
	}
	byId("playNotificationSound")?.setAttribute("icon", "stop");
    playing = true;
    try {
        await sendMessageToBG("playNotificationSoundFile", soundName);
        playing = false;
        byId("playNotificationSound")?.setAttribute("icon", "play-arrow");
    } catch (error) {
        console.warn("might have clicked play multiple times", error);
    }
}

async function playVoice() {
	byId("playVoice").setAttribute("icon", "stop");
    
    try {
        const response = await chrome.runtime.sendMessage({command: "chromeTTS", text: byId("voiceTestText").value});
        byId("playVoice").setAttribute("icon", "play-arrow");
    } catch (error) {
        console.error(error);
        showError(error);
    }
}

function getTabIdToOpen() {
    return location.href.split("#")[1];
}

function initSelectedTab() {
	const tabId = getTabIdToOpen();
	
	if (tabId) {
		showOptionsSection(tabId);
	} else {
		showOptionsSection("notifications");
	}
}

async function initGrantedAccountDisplay(startup) {
    console.log("initGrantedAccountDisplay");
    let showMethod;
    let hideMethod;
    if (startup) {
        showMethod = "show";
        hideMethod = "hide";
    } else {
        showMethod = "slideDown";
        hideMethod = "slideUp";
    }
    
    calendarMap = await initCalendarMap();

	initPage("welcome");
	initPage("notifications");
	initPage("accounts");

    const email = await storage.get("email");
    const loggedOut = await storage.get("loggedOut");
	if (!email || loggedOut || !await oAuthForDevices.findTokenResponse(email)) {
		// only show warning if we did not arrive from popup warning already
		if (getUrlValue("accessNotGranted")) {
			hideToast();
		} else {
			if (!justInstalled && location.hash != "#accounts") {
				showToast(getMessage("accessNotGrantedSeeAccountOptions", ["", getMessage("accessNotGrantedSeeAccountOptions_accounts")]), {
					text: getMessage("accounts"),
					onClick: function() {
						showOptionsSection("accounts");
						hideToast();
					}
				});
			} else {
				hideToast();
			}
		}
		
        if (email) {
            byId("defaultAccountEmail").textContent = email;
            show("#defaultAccount");
        }
		
		globalThis[showMethod](byId("guideGrantAccessButton"));
		globalThis[hideMethod](byId("guides"));
		globalThis[showMethod](byId("oauthNotGranted"));
	} else {
		hideToast();
		globalThis[hideMethod](byId("guideGrantAccessButton"));
		globalThis[showMethod](byId("guides"));
		globalThis[hideMethod](byId("oauthNotGranted"));
	}

    const userEmails = await oAuthForDevices.getUserEmails();
    
    if (userEmails.length && !loggedOut) {
        emptyNode("#emailsGrantedPermissionToContacts");
        userEmails.forEach(userEmail => {
            byId("emailsGrantedPermissionToContacts").append(userEmail, " ");
        });
        globalThis[showMethod](byId("oauthOptions"));
        loadCalendarReminders();
    } else {
        globalThis[hideMethod](byId("oauthOptions"));
    }
}

function getCalendarFromNode(node) {
    //const calendars = selector("calendar-reminders").calendars;
    const calendarId = node.closest("[calendar-id]").getAttribute("calendar-id");
    //return calendars.find(calendar => calendar.id == calendarId);
    return getCalendarById(calendarId);
}

async function sendPatchCommand(calendarReminderModified) {
    console.log("saving: ", calendarReminderModified.defaultReminders)
    
    let calendarId = calendarReminderModified.id;
    if (calendarId == "primary") {
        calendarId = await storage.get("email");
    }

    const sendParams = {
        userEmail: await storage.get("email"),
        type: "patch",
        url: `/users/me/calendarList/${encodeURIComponent(calendarId)}`,
        data: {
            defaultReminders: calendarReminderModified.defaultReminders
        }
    };
    
    oauthDeviceSend(sendParams).then(async response => {
        await storage.remove("cachedFeeds");
        showToast("Synced with Google Calendar");
        return sendMessageToBG("pollServer", {reInitCachedFeeds: true});
    }).catch(error => {
        showError("Error saving: " + error, {
            text: getMessage("refresh"),
            onClick: function() {
                showLoading();
                sendMessageToBG("pollServer", {source: "refresh"}).then(() => {
                    location.reload();
                });
            }
        });
    });        
}

var saveCalendarRemindersTimeout;

async function saveCalendarReminders(node) {
    clearTimeout(saveCalendarRemindersTimeout);

    saveCalendarRemindersTimeout = setTimeout(function() {
        var $reminderMinutes = node.querySelector(".reminderMinutes");
        var $reminderValuePerPeriod = node.querySelector(".reminderValuePerPeriod");
        var $reminderPeriod = node.querySelector(".reminderPeriod");
        var $lastUpdated = node.querySelector(".lastUpdated");
        
        updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod);

        $lastUpdated.value = new Date();
        
        const calendarReminderModified = getCalendarFromNode(node);

        const defaultReminders = [];
        node.closest(".notification-section").querySelectorAll(".calendarReminder").forEach($calendarReminder => {
            const reminder = generateReminderFromValueAndPeriod($calendarReminder);
            if ($calendarReminder.querySelector(".lastUpdated").value) {
                reminder.lastUpdated = $calendarReminder.querySelector(".lastUpdated").value;
            }
            defaultReminders.push(reminder);
        });
        calendarReminderModified.defaultReminders = defaultReminders;

        console.log("calendarReminderModified", calendarReminderModified);

        sendPatchCommand(calendarReminderModified);
    }, seconds(2));
}

async function hasCalendarReadWritePermissions() {
    const tokenResponse = await oAuthForDevices.findTokenResponse(await storage.get("email"));
    const oldUsersWithFullPermissions = tokenResponse && !tokenResponse.scopes;

    if (oldUsersWithFullPermissions || tokenResponse.scopes.includes(Scopes.CALENDARS_READ_WRITE)) {
        return tokenResponse;
    } else {
        await niceAlert(getMessage("permissionIsRequired"));
        try {
            const thisTokenResponse = await requestPermission({
                email: tokenResponse.userEmail,
                useGoogleAccountsSignIn: !tokenResponse.chromeProfile,
                scopes: [Scopes.CALENDARS_READ_WRITE],
                writePermissionForCalendars: true
            });
            return thisTokenResponse;
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }
}

function initCalendarReminders() {
	selector("#calendar-reminders").querySelectorAll(".calendarReminder").forEach($calendarReminder => {
		var $reminderMethod = $calendarReminder.querySelector(".reminderMethod");
		var $reminderMinutes = $calendarReminder.querySelector(".reminderMinutes");
		var $reminderValuePerPeriod = $calendarReminder.querySelector(".reminderValuePerPeriod");
		var $reminderPeriod = $calendarReminder.querySelector(".reminderPeriod");
		var $deleteReminder = $calendarReminder.querySelector(".deleteReminder");

		initReminderPeriod($reminderValuePerPeriod, $reminderPeriod, $reminderMinutes);
		
		// MUST USE .off for all events here

        function attachListener($node, action) {
            // set previous value on click
            replaceEventListeners($node, "click", function() {
                this.dataset.previousValue = this.value;
            });

            replaceEventListeners($node, action, async function(e) {
                if (await hasCalendarReadWritePermissions()) {
                    saveCalendarReminders($calendarReminder);
                } else {
                    this.value = e.target.dataset.previousValue;
                }
            });
        }

        attachListener($reminderMinutes, "change");
        attachListener($reminderValuePerPeriod, "input");
        attachListener($reminderPeriod, "change");

        onClickReplace($deleteReminder, async function() {
            if (await hasCalendarReadWritePermissions()) {
                // must fetch this reminderMinutes because the varaiable above is passed by value and not reference so it might have changes ince
                const reminderMinutes = this.closest(".calendarReminder").querySelector(".reminderMinutes").value;
                
                const calendarReminderModified = getCalendarFromNode($calendarReminder);
                calendarReminderModified.defaultReminders.some(function(defaultReminder, index) {
                    if (defaultReminder.method == $reminderMethod.value && defaultReminder.minutes == reminderMinutes) {
                        calendarReminderModified.defaultReminders.splice(index, 1);
                        return true;
                    }
                });
                
                slideUp($calendarReminder).then(() => {
                    $calendarReminder.remove();
                });
                
                sendPatchCommand(calendarReminderModified);
            }
		});
		
	});

    const tasksLine = selector("#calendar-reminders").querySelector("[calendar-id='tasks']");
    if (tasksLine) {
        oAuthForTasks.getUserEmails().then(async tasksUserEmails => {
            const excludedCalendars = await storage.get("excludedCalendars");
            tasksLine.querySelector(".calendarReminderLineCheckbox").checked = tasksUserEmails?.length && !excludedCalendars[TASKS_CALENDAR_OBJECT.id];
        });
    }

    const birthdaysLine = selector("#calendar-reminders").querySelector("[calendar-id='birthdays']");
    if (birthdaysLine) {
        birthdaysLine.querySelector(".calendarReminderLineCheckbox").checked = true;
    }
	
    replaceEventListeners("#calendar-reminders .calendarReminderLineCheckbox", "change", async function() {
		const calendar = getCalendarFromNode(this);
		const excludedCalendars = await storage.get("excludedCalendars");
		
		if (this.checked) {
            const tasksUserEmails = await oAuthForTasks.getUserEmails();
            if (calendar.id == TASKS_CALENDAR_OBJECT.id && !tasksUserEmails?.length) {
                openUrl("https://jasonsavard.com/wiki/Google_Tasks");
                this.checked = false;
                return;
            }

            excludedCalendars[calendar.id] = false;
			this.closest(".calendarReminderLine").removeAttribute("excluded");

			showToast("Notifications added!" + " " + getMessage("noteToSeeCalendarUseMenuInPopup"), {
                duration: seconds(5)
            });
		} else {
            if (calendar.id == CommonCalendarIds.BIRTHDAYS) {
                openUrl("https://jasonsavard.com/wiki/Birthdays_calendar");
                this.checked = true;
                return;
            }

            excludedCalendars[calendar.id] = true;
			this.closest(".calendarReminderLine").setAttribute("excluded", true);
			
            showToast("Notifications removed! To hide this calendar use the ≡ menu in the popup", {
                duration: seconds(5)
            });
            
            const email = await storage.get("email");
            const selectedCalendars = await storage.get("selectedCalendars");

            if (!isCalendarSelectedInExtension(calendar, email, selectedCalendars)) {
                console.info("optimize and remove from cache: " + calendar.id);
                const cachedFeeds = await storage.get("cachedFeeds");
                delete cachedFeeds[calendar.id];
                await storage.set("cachedFeeds", cachedFeeds);
                await sendMessageToBG("reInitCachedFeeds");
            }
		}

        await storage.set("excludedCalendars", excludedCalendars);

        await sendMessageToBG("checkEvents", {ignoreNotifications: true});
	});
}

async function loadCalendarReminders() {
	console.log("loadCalendarReminders");
	//var t = document.querySelector('#calendarRemindersBind');
	// could only set this .data once and could not use .push on it or it breaks the bind
	
	const calendars = await getArrayOfCalendars({includeTasks: true, includeBirthdays: true});
    console.log("calendars", calendars);
	
	if (calendars.length == 0) {
		console.log("no calendars found");
		return;
	}
	
	calendars.forEach(calendar => {
        if (calendar.defaultReminders) {
            calendar.defaultReminders?.sort((a, b) => {
                if (parseInt(a.minutes) < parseInt(b.minutes)) {
                    return -1;
                } else {
                    return +1;
                }
            });
        } else {
            calendar.defaultReminders = [];
        }
	});

    initCalendarColorsInCSS(await storage.get("cachedFeeds"), calendars);

    window.excludedCalendars = await storage.get("excludedCalendars");

    const calendarReminders = byId("calendar-reminders");
    emptyNode(calendarReminders);

    calendars.forEach(calendar => {
        const calendarReminderLine = document.createElement("div");
        calendarReminderLine.setAttribute("class", "layout horizontal start calendarReminderLine");
        calendarReminderLine.setAttribute("calendar-id", calendar.id);

        if (isCalendarExcludedForNotifs(calendar, excludedCalendars)) {
            calendarReminderLine.setAttribute("excluded", true);
        }

        if (isCalendarExcludedForNotifsByOptimization(calendar, excludedCalendars)) {
            calendarReminderLine.setAttribute("excluded-by-optimization", true);
        }

        const label = document.createElement("label");
        label.setAttribute("class", "calendarReminderLineLabel");
        calendarReminderLine.appendChild(label);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("class", "calendarReminderLineCheckbox jdom-checkbox");
        checkbox.setAttribute("color-id", calendar.colorId);
        if (!isCalendarExcludedForNotifsByOptimization(calendar, excludedCalendars)) {
            checkbox.checked = true;
        }
        label.appendChild(checkbox);

        const calendarTitle = document.createElement("span");
        calendarTitle.textContent = getCalendarName(calendar);
        calendarTitle.title = calendarTitle.textContent;
        calendarTitle.className = "calendarReminderLineTitle";
        label.appendChild(calendarTitle);

        const notificationSection = document.createElement("div");
        notificationSection.setAttribute("class", "notification-section layout vertical start");
        if (calendar.id == TASKS_CALENDAR_OBJECT.id || calendar.id == CommonCalendarIds.BIRTHDAYS) {
            notificationSection.hidden = true;
        }

        const notifSection = generateReminderSection(calendar.defaultReminders);
        notifSection.querySelector(".addReminder").addEventListener("click", async function() {
            if (await hasCalendarReadWritePermissions()) {
                const calendarReminderModified = getCalendarFromNode(this);

                const checkbox = calendarReminderLine.querySelector(".calendarReminderLineCheckbox");
                if (!checkbox.checked) {
                    checkbox.checked = true;
                    checkbox.dispatchEvent(new Event("change"));
                }

                const defaultReminder = {
                    method: "popup",
                    minutes: 10
                }

                calendarReminderModified.defaultReminders.push(defaultReminder);

                const newNotifLine = generateReminderLine(defaultReminder);
                this.parentElement.insertBefore(newNotifLine, this);
                
                initCalendarReminders();
                saveCalendarReminders(newNotifLine);
            }
        });

        notificationSection.append(notifSection);

        calendarReminderLine.appendChild(notificationSection);

        if (calendar.id == TASKS_CALENDAR_OBJECT.id || calendar.id == CommonCalendarIds.BIRTHDAYS) {
            const moreInfoLink = document.createElement("a");
            moreInfoLink.target = "_blank";

            if (calendar.id == TASKS_CALENDAR_OBJECT.id) {
                moreInfoLink.href = "https://jasonsavard.com/wiki/Google_Tasks";
            } else if (calendar.id == CommonCalendarIds.BIRTHDAYS) {
                moreInfoLink.href = "https://jasonsavard.com/wiki/Birthdays_calendar";
            }

            const button = document.createElement("j-button");
            button.classList.add("raised");
            button.textContent = getMessage("moreInfo");
            moreInfoLink.appendChild(button);
            
            calendarReminderLine.appendChild(moreInfoLink);
        }

        calendarReminders.append(calendarReminderLine);
    });

    initCalendarReminders();
}

function openNotificationPermissionIssueDialog(error) {
	openDialog("You might have disabled the notifications. Error: " + error, {
		title: "Permission denied!",
        buttons: [
            {
                label: getMessage("moreInfo"),
                onClick: () => {
                    openUrl("https://support.google.com/chrome/answer/3220216");
                }
            }
        ]
	});
}

async function postGrantedPermissionsToCalendarsAndPolledServer(email) {
    const $div = byId("emailsGrantedPermissionToContacts");
	if (!$div.innerHTML.includes(email)) {
		$div.append(" ", email);
	}

	await initGrantedAccountDisplay();

    if (await storage.get("donationClicked")) {
        enableFeatures();
    }

	hideLoading();
	showToast(getMessage("accessGranted"));
}

async function clearData() {
	localStorage.clear();
	await storage.clear();

	openDialog(`You will have to re-exclude your excluded calendars again! ${getMessage("clickOkToRestartExtension")}`, {
		title: "Data cleared!"
	}).then(response => {
		if (response == "ok") {
			reloadExtension();
		}
	});
}

(async () => {

    await initUI();

    donationClickedFlagForPreventDefaults = await storage.get("donationClicked");

    onDelegate(document.body, "click", ".pin-extension", () => {
        openUrl("https://jasonsavard.com/wiki/Pin_extension_to_menu_bar?ref=welcome");
    });
    
    onClick(".secondary-nav > ul > li", function(e) {
        const tabName = this.getAttribute("value");
        showOptionsSection(tabName);
        e.preventDefault();
    });
    
    window.addEventListener("focus", function(event) {
        console.log("window.focus");
        // reload voices
        loadVoices();
    });

    if (!getTabIdToOpen() && (justInstalled || (!await storage.get("_optionsOpened") && gtVersion(await storage.get("installVersion"), "26.2")))) {
        storage.setDate("_optionsOpened");
        showOptionsSection("welcome");
        
        if (DetectClient.isOpera()) {
            if (!window.Notification) {
                openDialog("Desktop notifications are not yet supported in this browser!");
            }
            if (window.chrome && !window.chrome.tts) {
                openDialog("Voice notifications are not yet supported in this browser!");
            }

            openDialog("Bugs might occur, you can use this extension, however, for obvious reasons, these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome.", {
                title: "You are not using the stable channel of Chrome!",
                buttons: [
                    {
                        label: getMessage("moreInfo"),
                        onClick: () => {
                            openUrl("https://jasonsavard.com/wiki/Unstable_browser_channel");
                        }
                    }
                ]
            });
        }

        // check for sync data
        syncOptions.fetch().then(function(items) {
            console.log("fetch response", items);

            const content = new DocumentFragment();
            content.append("Would you like to use your previous extension options? ");

            const $note = document.createElement("div");
            $note.style.cssText = "margin-top:4px;font-size:12px;color:gray";
            $note.textContent = "(If you had previous issues you should do this later)";
            content.append($note);

            openDialog(content, {
                title: "Restore settings",
                cancel: true
            }).then(response => {
                if (response == "ok") {
                    syncOptions.load(items).then(items => {
                        openDialog("Options restored!", {
                            buttons: [
                                {
                                    label: getMessage("ok"),
                                    primary: true,
                                    onClick: () => {
                                        reloadExtension();
                                    }
                                }
                            ],
                        });
                    }).catch(error => {
                        openDialog(error, {
                            title: "Error loading settings", 
                        });
                    });
                }
            });
        }).catch(error => {
            console.error("error fetching: ", error);
        });
    } else {
        initSelectedTab();
    }
    
    window.onpopstate = function(event) {
        console.log(event);
        initSelectedTab();
    }
    
    initGrantedAccountDisplay(true);
    
    addEventListeners(".logo", "dblclick", async function() {
        await storage.toggle("donationClicked");
        location.reload();
    });
    
    byId("version").textContent = `v.${chrome.runtime.getManifest().version}`;
    onClick("#version", function() {
        showLoading();
        if (chrome.runtime.requestUpdateCheck) {
            chrome.runtime.requestUpdateCheck(function(status, details) {
                hideLoading();
                console.log("updatechec:", details)
                if (status == "no_update") {
                    openDialog("No update!", {
                        buttons: [
                            {
                                label: getMessage("moreInfo"),
                                onClick: () => {
                                    location.href = "https://jasonsavard.com/wiki/Extension_Updates";
                                }
                            }
                        ]
                    })
                } else if (status == "throttled") {
                    openDialog("Throttled, try again later!");
                } else {
                    openDialog("Response: " + status + " new version " + details.version);
                }
            });
        } else {
            location.href = "https://jasonsavard.com/wiki/Extension_Updates";
        }
    });

    onClick("#changelog", function(event) {
        openChangelog("CalendarOptions");
        event.preventDefault();
        event.stopPropagation();
    });

    // detect x
    addEventListeners("#search", "search", function(e) {
        if (!this.value) {
            selectorAll("*").forEach(el => el.classList.remove("search-result"));
        }
    });

    function highlightTab(node) {
        console.log("node", node);
        let page;
        if (node.closest) {
            page = node.closest(".page");
        } else {
            page = node.parentElement.closest(".page");
        }
        
        if (page) {
            const tabName = page.getAttribute("value");
            selector(`.secondary-nav > ul > li[value='${tabName}']`).classList.add("search-result");
        }
    }

    function highlightPriorityNode(highlightNode) {
        return [
            "j-button",
            "label",
            "select"
        ].some(priorityNodeName => {
            const $priorityNode = highlightNode.closest(priorityNodeName);
            if ($priorityNode) {
                $priorityNode.classList.add("search-result");
                return true;
            }
        });
    }

    async function search(search) {
        if (!window.initTabsForSearch) {
            for (const tab of document.querySelectorAll(".secondary-nav > ul > li")) {
                await initPage(tab.getAttribute("value"));
            }
            window.initTabsForSearch = true;
        }

        selectorAll("*").forEach(el => el.classList.remove("search-result"));
        if (search.length >= 2) {
            search = search.toLowerCase();
            var elms = document.getElementsByTagName("*"),
            len = elms.length;
            for(var ii = 0; ii < len; ii++) {

                let label = elms[ii].getAttribute("label");
                if (label && label.toLowerCase().includes(search)) {
                    elms[ii].classList.add("search-result");
                    highlightTab(elms[ii]);
                }

                var myChildred = elms[ii].childNodes;
                const len2 = myChildred.length;
                for (var jj = 0; jj < len2; jj++) {
                    if (myChildred[jj].nodeType === 3) {
                        if (myChildred[jj].nodeValue.toLowerCase().includes(search)) {
                            let highlightNode = myChildred[jj].parentNode;
                            if (highlightNode.nodeName != "STYLE") {
                                let foundPriorityNode = highlightPriorityNode(highlightNode);
                                if (!foundPriorityNode) {
                                    let tooltip = highlightNode.closest("j-tooltip");
                                    if (tooltip) {
                                        const tooltipTarget = tooltip.getAttribute("for");
                                        if (tooltipTarget)  {
                                            const $tooltipTargetNode = byId(tooltipTarget);
                                            if ($tooltipTargetNode) {
                                                $tooltipTargetNode.classList.add("search-result");
                                                foundPriorityNode = true;
                                            }
                                        } else {
                                            tooltip.previousElementSibling.classList.add("search-result");
                                            foundPriorityNode = true;
                                        }
                                        //foundPriorityNode = highlightPriorityNode($priorityNode.target);
                                        //if (!foundPriorityNode) {
                                            //$priorityNode.classList.add("search-result");
                                        //}
                                    } else {
                                        highlightNode.classList.add("search-result");
                                    }
                                }

                                console.log("highlightNode", highlightNode);
                                
                                highlightTab(myChildred[jj]);
                            }
                        }
                    }
                }
            }
        }
    }
    
    addEventListeners("#search", "input", function(e) {
        const searchValue = this.value;
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            search(searchValue);
        }, window.initTabsForSearch ? 0 : 300);

        clearTimeout(window.searchTimeout2);
        window.searchTimeout2 = setTimeout(async () => {
            while (!window.initTabsForSearch) {
                await sleep(200);
            }
            if (searchValue) {
                if (!selector(".search-result")) {
                    openDialog("No results found in options", {
                        cancel: true,
                        buttons: [{
                            label: "Search FAQ & Forum",
                            primary: true,
                            onClick: function(dialog) {
                                window.open("https://jasonsavard.com/search?q=" + encodeURIComponent(searchValue), "emptyWindow");
                                dialog.close();
                            }
                        }]
                    });
                }
            }
        }, 1000);
    });
})();