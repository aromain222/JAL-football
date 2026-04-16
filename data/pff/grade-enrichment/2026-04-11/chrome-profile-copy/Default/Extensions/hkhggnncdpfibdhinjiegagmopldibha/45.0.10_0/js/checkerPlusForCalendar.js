// Copyright Jason Savard
"use strict";

var ITEM_ID = "calendar";

var TEST_REDUCED_DONATION = false;
var TEST_SHOW_EXTRA_FEATURE = false;

const DEFAULT_USER_EMAIL = "default@nevermatchdomain.com";

const PollingIntervals = {
    CHECK_EVENTS: seconds(60), // minutes - MUST match alarm EVERY_MINUTE

    // Aug 2022, quota avg was 10%, peak was 20%, so decided to x2 the active, passive and readonly calendar polling
    ACTIVE_CALENDARS: 1, // hours v4 1 with firebase apr 2024, v3 Aug 2022: 0.5 v2: 4 hours v1: before 1.5 hours;
    PASSIVE_CALENDARS: 2, // hours v4 2 with firebase apr 2024 v3 Aug 2022: 0.5 v2: 1
    READ_ONLY_CALENDARS: 6, // hours v2: Aug 2022: 6 v1: 24
    CALENDARS_OF_INTEREST: 24 * 30, // ie. 30 days
    COLORS: 24 * 30
}

const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const GROUPED_NOTIFICATION_ID = "GROUPED_NOTIFICATION";
const MENU_ITEM_CONTEXTS = ["page", "frame", "link", "editable", "image", "video", "audio"];

const STORAGE_DETAILS_KEY = "details";
const MIN_STORAGE_EVENTS_COUNT_BEFORE_SAVING = 4;
const LOCALSTORAGE_CHUNK_PREFIX = "localStorageChunk";
const INDEXEDDB_CHUNK_PREFIX = "indexedDBChunk";

const SYNC_OPERATION_PREFIX = "syncOperation_";

const SyncOperation = {
    CLOSE_NOTIFICATIONS: "CLOSE_NOTIFICATIONS",
    UPDATE_SNOOZERS: "UPDATE_SNOOZERS",
}

const CommonCalendarIds = {
    BIRTHDAYS: "birthdays",
    TASKS: "tasks",
    FAMILY: "family12707081061263343568@group.calendar.google.com",
    WEATHER: "#weather@group.v.calendar.google.com",
    WEEKNUM: "#weeknum@group.v.calendar.google.com",
    WEEKNUM_ALTERNATE: "g0k1sv1gsdief8q28kvek83ps4@group.calendar.google.com",
    DAYNUM: "#daynum@group.v.calendar.google.com",
    MOONPHASES: "ht3jlfaac5lfd6263ulfh4tql8@group.calendar.google.com"
};

const NotificationTags = {
    SHORTCUT_NOT_APPLICABLE_AT_THIS_TIME: "SHORTCUT_NOT_APPLICABLE_AT_THIS_TIME",
    UNSTABLE_BROWSER_CHANNEL: "UNSTABLE_BROWSER_CHANNEL",
    UPDATE_BROWSER: "UPDATE_BROWSER",
    CONTAINS_JSON_EVENT: "CONTAINS_JSON_EVENT",
}

const BadgeColor = {
    EMOJI: [100, 100, 100, 255],
    RED: [208, 0, 24, 255],
    BLUE: [0, 111, 255, 255],
    GRAY: [125, 125, 125, 255],
    LIGHT_GRAY: [150, 150, 150, 255]
}

const ContextMenu = {
    OPEN_CALENDAR: "OPEN_CALENDAR",
    REFRESH: "REFRESH",
    OPTIONS: "OPTIONS",
    DND_MENU: "dndMenu",
    DND_OFF: "dndOff",
    DND_30_MIN: "dnd30min",
    DND_1_HOUR: "dnd1hour",
    DND_2_HOURS: "dnd2hours",
    DND_4_HOURS: "dnd4hours",
    DND_8_HOURS: "dnd8hours",
    DND_TODAY: "dndToday",
    DND_INDEFINITELY: "dndIndefinitely",
    DND_OPTIONS: "dndOptions",
    QUICK_ADD: "quickAdd"
}

const InputSource = {
    QUICK_ADD: "QUICK_ADD",
    OMNIBOX: "OMNIBOX",
    CONTEXT_MENU: "CONTEXT_MENU",
    SHORTCUT: "SHORTCUT"
}

const nonUISources = [
    InputSource.OMNIBOX,
    InputSource.CONTEXT_MENU,
    InputSource.SHORTCUT
];

const allQuickAddSources = [
    InputSource.QUICK_ADD,
    ...nonUISources
];

var Origins = {};
Origins.FACEBOOK = "https://www.facebook.com/"; // v2 Only used for Firefox now, v1 MUST MATCH manifest > optional_permissions
Origins.OPEN_EXISTING_TABS = "https://calendar.google.com/"; // MUST MATCH manifest > optional_permissions

const ExtensionId = {
    ChromeStoreGmail: "oeopbcgkkoapgobdbedcemjljbihmemj",
    ChromeStoreCalendar: "hkhggnncdpfibdhinjiegagmopldibha",
    ChromeStoreDrive: "pppfmbnpgflleackdcojndfgpiboghga",
    ChromeStoreScreenshot: "mdddabjhelpilpnpgondfmehhcplpiin",
    EdgeStoreGmail: "dkjkomkbjefdadfgbgdfgnpbmhmppiaa",
    EdgeStoreCalendar: "fbongfbliechkeaegkjfehhimpenoani",
    EdgeStoreDrive: "ndcbbjeihlogjndoheabejedggehfbei",
    EdgeStoreScreenshot: "dnjgbabpedipbaghlhmcacpoehgpfoei",
    FirefoxStoreGmail: "checkerplusforgmail@jasonsavard.com",
    FirefoxStoreCalendar: "checkerplusforgooglecalendar@jasonsavard.com",
    FirefoxStoreDrive: "checkerplusforgoogledrive@jasonsavard.com",
    FirefoxStoreScreenshot: "{2b5916ef-4e9b-433c-b744-37b23c511516}",
    LocalGmail: "nkcdjlofpfodhpjihpbicmledhecfldf",
    LocalCalendar: "encfnanpmgmgnblfjgjfbleegminpphg",
    LocalDrive: "chlojnjhoanbiippnehobiclefodbdic",
    LocalScreenshot: "ajdcpfdbildfaahcgabgjhojmbalcnff",
};

const DEFAULT_HOUR_FOR_TIMED_EVENT = 8;

const inLocalExtension = chrome.runtime.id == ExtensionId.LocalCalendar;

let gmailExtensionId;
let driveExtensionId;
if (inLocalExtension) {
    gmailExtensionId = ExtensionId.LocalGmail;
    driveExtensionId = ExtensionId.LocalDrive;
} else if (chrome.runtime.id == ExtensionId.EdgeStoreCalendar) {
    gmailExtensionId = ExtensionId.EdgeStoreGmail;
    driveExtensionId = ExtensionId.EdgeStoreDrive;
} else if (chrome.runtime.id == ExtensionId.FirefoxStoreCalendar) {
    gmailExtensionId = ExtensionId.FirefoxStoreGmail;
    driveExtensionId = ExtensionId.FirefoxStoreDrive;
} else {
    gmailExtensionId = ExtensionId.ChromeStoreGmail;
    driveExtensionId = ExtensionId.ChromeStoreDrive;
}

const CalendarView = {
    AGENDA: "basicDay",
    LIST_WEEK: "customListWeek",
    DAY: "agendaDay",
    WEEK: "agendaWeek",
    MONTH: "month",
    YEAR: "year",
    CUSTOM: "custom",
};

const EventRecurrence = {
    EVERY_WEEKDAY: "BYDAY=MO,TU,WE,TH,FR",
    EVERY_2_WEEKS: "INTERVAL=2"
}

function getFCViewName(viewName) {
    let fcViewName;
    if (viewName == CalendarView.LIST_WEEK) {
        fcViewName = CalendarView.LIST_WEEK;
    } else if (viewName == CalendarView.DAY) {
        fcViewName = "timeGridDay";
    } else if (viewName == CalendarView.WEEK) {
        fcViewName = "timeGridWeek";
    } else if (viewName == CalendarView.MONTH) {
        fcViewName = "dayGridMonth";
    } else if (viewName == CalendarView.YEAR) {
        fcViewName = "multiMonthYear" // "dayGridYear";
    } else if (viewName == CalendarView.CUSTOM) {
        fcViewName = CalendarView.CUSTOM;
    } else {
        fcViewName = viewName;
    }
    return fcViewName;
}

function getFCYearViewScroller() {
    return byId("betaCalendar").querySelector(".fc-multiMonthYear-view");
}

function getFCYearViewScrollTop() {
    return getFCYearViewScroller()?.scrollTop;
}

const AttendingResponseStatus = {
    ACCEPTED: "accepted",
    TENTATIVE: "tentative",
    DECLINED: "declined",
    NEEDS_ACTION: "needsAction"
}

const Scopes = {
    CALENDARS_READ_WRITE:   "https://www.googleapis.com/auth/calendar",
    CALENDARS_READ:         "https://www.googleapis.com/auth/calendar.readonly",
    EVENTS_READ_WRITE:      "https://www.googleapis.com/auth/calendar.events",
    CONTACTS_READ:          "https://www.googleapis.com/auth/contacts.readonly",
    CONTACTS_OTHER_READ:    "https://www.googleapis.com/auth/contacts.other.readonly",
    USERINFO_PROFILE:       "https://www.googleapis.com/auth/userinfo.profile",
    TASKS_READ_WRITE:       "https://www.googleapis.com/auth/tasks",
}

const PEOPLE_API = {
    ME: "https://people.googleapis.com/v1/people/me",
    CONTACTS: "https://people.googleapis.com/v1/people/me/connections",
    CONTACTS_OTHER: "https://people.googleapis.com/v1/otherContacts",
}

const EventType = {
    DEFAULT: "default",
    BIRTHDAY: "birthday",
}

const LIST_VIEW_WEEKS = 4;

var NotificationType = {};
NotificationType.ADDED_OUTSIDE = "ADDED_OUTSIDE";

var JError = {};
JError.DID_NOT_CONTRIBUTE = "DID_NOT_CONTRIBUTE";
JError.NO_TOKEN = "NO_TOKEN";
JError.NETWORK_ERROR = "NETWORK_ERROR";

var BrowserButtonAction = {};
BrowserButtonAction.POPUP = "popup";
BrowserButtonAction.POPUP_SIDE_PANEL = "popupSidePanel";
BrowserButtonAction.POPUP_DETACHED = "popupDetached";
BrowserButtonAction.CHECKER_PLUS_TAB = "checkerPlusTab";
BrowserButtonAction.GOOGLE_CALENDAR = "googleCalendar";

var GOOGLE_API_DATE_ONLY_FORMAT_STR = "yyyy-mm-dd";

var GCM_SENDER_ID = "74919836968";
var GCM_SOURCE = "gcm source";

var WATCH_CALENDAR_EVENTS_ALARM_PREFIX = "watchCalendarEvents_";
var WATCH_EXPIRATION_IN_DAYS = 14;

var MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH = 7;

var DAYS_TO_REMOVE_OLD_EVENTS = 44;

const MAX_RESULTS_FOR_EVENTS = 2500;

var Alarms = {
    EVERY_MINUTE:                           "everyMinute",
    EVERY_DAY:                              "everyDay",
    WATCH_CALENDAR_SETTINGS:                "watchCalendarSettings",
    WATCH_CALENDAR_LIST:                    "watchCalendarList",
    UPDATE_CONTACTS:                        "updateContacts",
    UPDATE_SKINS:                           "updateSkins",
    EXTENSION_UPDATED_SYNC:                 "extensionUpdatedSync",
    SYNC_DATA:                              "syncData",
    UPDATE_UNINSTALL_URL:                   "updateUninstallUrl",
    UPDATE_CONTEXT_MENU:                    "updateContextMenu",
    FORGOTTEN_REMINDER:                     "forgottenReminder",
    POLL_SERVER:                            "pollServer",
    POLL_SERVER_FROM_FCM_UPDATE:            "pollServerFromFCMUpdate",
    POLL_SERVER_AFTER_RIGHT_CLICK_SET_DATE: "pollServerAfterRightClickSetDate",
    OPEN_REMINDERS:                         "openReminders",
    COLLECT_STATS:                          "collectStats"
};

var SendNotificationsAction = {};
SendNotificationsAction.CREATE = "create";
SendNotificationsAction.EDIT = "edit";
SendNotificationsAction.DELETE = "delete";

var ReminderWindow = {};
ReminderWindow.BOTTOM_BORDER = 1;
ReminderWindow.HEADER = 40 + ReminderWindow.BOTTOM_BORDER; // header for snooze/dismiss all = 40 + 1 bottom border
ReminderWindow.NOTIFICATION_HEIGHT = 100 + ReminderWindow.BOTTOM_BORDER; // 100 + 1 for bottom-border
ReminderWindow.MARGIN = 0;
ReminderWindow.MAX_NOTIFICATIONS = 4;

var UserNoticeSchedule = {};
UserNoticeSchedule.DAYS_BEFORE_SHOWING_EXTRA_FEATURE = 3;
UserNoticeSchedule.DURATION_FOR_SHOWING_EXTRA_FEATURE = 2;
UserNoticeSchedule.DAYS_BEFORE_SHOWING_TRY_MY_OTHER_EXTENSION = 4;
UserNoticeSchedule.DURATION_FOR_SHOWING_TRY_MY_OTHER_EXTENSION = 2;
UserNoticeSchedule.DAYS_BEFORE_ELIGIBLE_FOR_REDUCED_DONATION = 14;
UserNoticeSchedule.DAYS_BEFORE_ELIGIBLE_FOR_REDUCED_DONATION_AGAIN = 60; // 2 months
UserNoticeSchedule.DURATION_FOR_SHOWING_REDUCED_DONATION = 7;
UserNoticeSchedule.DAYS_BEFORE_SHOWING_FOLLOW_ME = 9999;
UserNoticeSchedule.DURATION_FOR_SHOWING_FOLLOW_ME = 3;

const EVENTS_SHOWN_VERSION = "2";
const CONTACTS_STORAGE_VERSION = "3";
const SYNC_OPERATION_VERSION = "1";
const MAX_SYNC_OPERATIONS = 100;

const STORAGE_DEFAULTS = {
	"browserButtonAction": "popup",		
	"cachedFeeds": {},
	"cachedFeedsDetails": {},
    "eventsShown": [],
    "notificationsQueue": [],
    "notificationsOpened": [],
	"tokenResponses": [],
	"selectedCalendars": {},
	"excludedCalendars": {
        "p#weather@group.v.calendar.google.com": true
    },
	"notificationSound": "musicBox.mp3",
	"notificationSoundVolume": 100,
	"voiceNotificationOnlyIfIdleInterval": 15,
	"voiceSoundVolume": 100,
	"desktopNotification": "popupWindow",
	"calendarView": CalendarView.MONTH,
	"language": getPreferredLanguage(),
	"pitch": 1,
	"rate": 1,
	"notificationGrouping": "groupNotifications",
	"showNotificationDuration": "never",
	"pendingNotificationsInterval": 15,
	"notificationButton1": "hours_1",
	"notificationButton2": "dismiss",
	"showCalendarInNotification": "onlyNonPrimary",
	"showContextMenuItem": true,
	"maxDaysAhead": 2,
	"weeksInMonth": "auto",
	"customView": "4",
	"slotDuration": 30,
	"hideMorningHoursBefore": "0",
	"hideNightHoursAfter": "24",
	"badgeIcon": "default",
	"showEventTimeOnBadge": true,
	"showMinutesLeftInBadge": true,
	"showDaysLeftInBadge": true,
	"showDayOnBadgeExceptWhenMinutesLeft": true,
	"showButtonTooltip": true,
	"excludeHiddenCalendarsFromButton": true,
	"showSnoozedEvents": true,
	"weekNumberCalculation": "ISO",
	"detachedPopupWidth": 1000,
	"detachedPopupHeight": 800,
	"snoozers": [],
	"calendarSettings": {},
	"skins": [],
	"skinsEnabled": true,
	"customSkin": {id:"customSkin"},
	"useEventColors": true,
    "defaultDate": 0,
    "firstDay": "",
    "_lastPollTime": new Date(1),
    "_lastCheckEventsTime": new Date(1),
    "_lastNotificationShownDate": new Date(),
    "_lastCalendarModificationByExtension": new Date(1),
    "_lastBadgeDate": new Date(),
    "_watchRetries": {},
    "_firstLoad" : true,
    "defaultSnoozeBeforeTime": -5,
    "defaultSnoozeTime": 5,
    "showEventIcons": true,
    "detectTime" : true,
    "selectAllDay" : true,
    "maximizeVisibleEventsInADay": true,
    "hideDelete": true,
    "birthdays-bg-color": "rgb(246, 191, 38)",
    "tasks-bg-color": "rgb(244, 81, 30)",
    "dayMaxEventRows": true,
    "maxEventsToStack": 10,
    "displayEventTitlesInReminderWindowTitle": true,
    "defaultEventNotificationTime": "0:00",
    "dimPastEvents": true,
    "notificationWindowSize": "auto",
    "extensionUpdates": "interesting",
    "eventConflictHandling": "warnForAnyCalendar",
    "showCompletedTasks": true,
    "showOnlyQuickWhenTextSelected": true,
};

const DO_NOT_EXPORT = [
    "donationClicked",
    "verifyPaymentRequestSent",
    "_minimumPayment"
];

const DEFAULT_SETTINGS_ALLOWED_OFF = ["notificationSound"];

const STORAGE_ITEMS_TO_COMPRESS = {
	"cachedFeeds": true
}

const ConferenceSolutionType = {
    GOOGLE_MEET: "hangoutsMeet"
}

const SkinIds = {
    GRAY_TODAY: 83,
    MATERIAL_DESIGN: 96,
    BLACK_FONT_EVENTS: 104,
    MATCH_FONT_COLOR_WITH_EVENT_COLOR: 105,
    THEME_DARK_INVERTED: 4,
    THEME_DARCULA: 117,
    THEME_MIDNIGHT: 122,
};

const Urls = {
    CALENDAR: "https://calendar.google.com/calendar",
    STORAGE_ISSUE: "https://jasonsavard.com/wiki/Calendar_extension_storage_issue",
    //EVENT_LOCATIONS: "https://debounce---calendar-event-locations-b7tconsduq-uc.a.run.app",
    EVENT_LOCATIONS: "https://calendar-event-locations-74919836968.us-central1.run.app",
    OauthToken: "https://extensions-auth.uc.r.appspot.com/oauthToken",
    FCM: "https://fcm-74919836968.us-central1.run.app/notifications",
    FIRESTORE: "https://firestore-74919836968.us-central1.run.app/notifications",
}

const CalendarAccessRole = {
    OWNER: "owner",
    WRITER: "writer",
    READER: "reader",
    FREE_BUSY: "freeBusyReader",
}

const BIRTHDAYS_CALENDAR_OBJECT = {
    id: CommonCalendarIds.BIRTHDAYS,
    summary: "Birthdays", // will be i18n later
    accessRole: CalendarAccessRole.READER,
    colorId: "birthdays"
}

const TASKS_CALENDAR_OBJECT = {
    id: CommonCalendarIds.TASKS,
    summary: "Tasks", // will be i18n later
    accessRole: CalendarAccessRole.OWNER,
    colorId: "tasks",
    //backgroundColor: "rgb(244, 81, 30)", // will be initated in initmisc
    defaultReminders: [{
        method: "popup",
        minutes: 0
    }]
}

const TASKS_BASE_URL = "https://tasks.googleapis.com/tasks/v1";
const TASKS_LISTS_MAX = 100;
const TASKS_MAX = 100;
const TASKS_KIND = "tasks#task";

const EventTransparency = {
    FREE: "transparent",
    BUSY: "opaque"
}

const EventVisibility = {
    DEFAULT: "default",
    PUBLIC: "public",
    PRIVATE: "private",
}

const TaskStatus = {
    COMPLETED: "completed",
    NEEDS_ACTION: "needsAction"
}

const TimePeriodSymbol = {
    MINUTE: "m",
    HOUR: "h",
    DAY: "d"
}

const timezoneAbbreviations = {
    "ACDT": 630,   // Australian Central Daylight Time (UTC+10:30)
    "ACST": 570,   // Australian Central Standard Time (UTC+09:30)
    "ACT": -300,   // Acre Time (UTC-5)
    "ADT": -180,   // Atlantic Daylight Time (UTC-3)
    "AEDT": 660,   // Australian Eastern Daylight Time (UTC+11)
    "AEST": 600,   // Australian Eastern Standard Time (UTC+10)
    "AFT": 270,    // Afghanistan Time (UTC+4:30)
    "AKDT": -480,  // Alaska Daylight Time (UTC-8)
    "AKST": -540,  // Alaska Standard Time (UTC-9)
    "AMST": -180,  // Amazon Summer Time (UTC-3)
    "AMT": -240,   // Amazon Time (UTC-4)
    "ART": -180,   // Argentina Time (UTC-3)
    "AST": -240,   // Atlantic Standard Time (UTC-4)
    "AWST": 480,   // Australian Western Standard Time (UTC+8)
    "AZOST": 0,    // Azores Summer Time (UTC+0)
    "AZT": 240,    // Azerbaijan Time (UTC+4)
    "BDT": 480,    // Brunei Time (UTC+8)
    "BIOT": 360,   // British Indian Ocean Time (UTC+6)
    "BIT": -720,   // Baker Island Time (UTC-12)
    "BOT": -240,   // Bolivia Time (UTC-4)
    "BRST": -120,  // Brasília Summer Time (UTC-2)
    "BRT": -180,   // Brasília Time (UTC-3)
    "BST": 60,     // British Summer Time (UTC+1)
    "BTT": 360,    // Bhutan Time (UTC+6)
    "CAT": 120,    // Central Africa Time (UTC+2)
    "CCT": 390,    // Cocos Islands Time (UTC+6:30)
    "CDT": -300,   // Central Daylight Time (UTC-5)
    "CEST": 120,   // Central European Summer Time (UTC+2)
    "CET": 60,     // Central European Time (UTC+1)
    "CHADT": 825,  // Chatham Island Daylight Time (UTC+13:45)
    "CHAST": 765,  // Chatham Island Standard Time (UTC+12:45)
    "CHOT": 480,   // Choibalsan Time (UTC+8)
    "CHST": 600,   // Chamorro Standard Time (UTC+10)
    "CHUT": 600,   // Chuuk Time (UTC+10)
    "CIST": -480,  // Clipperton Island Standard Time (UTC-8)
    "CIT": 480,    // Central Indonesia Time (UTC+8)
    "CKT": -600,   // Cook Island Time (UTC-10)
    "CLST": -180,  // Chile Summer Time (UTC-3)
    "CLT": -240,   // Chile Standard Time (UTC-4)
    "COST": -240,  // Colombia Summer Time (UTC-4)
    "COT": -300,   // Colombia Time (UTC-5)
    "CST": -360,   // Central Standard Time (UTC-6)
    "CT": 480,     // China Time (UTC+8)
    "CVT": -60,    // Cape Verde Time (UTC-1)
    "CWST": 525,   // Central Western Standard Time (UTC+8:45)
    "CXT": 420,    // Christmas Island Time (UTC+7)
    "DAVT": 420,   // Davis Time (UTC+7)
    "DDUT": 600,   // Dumont d'Urville Time (UTC+10)
    "DFT": 60,     // AIX-specific equivalent of Central European Time (UTC+1)
    "EASST": -300, // Easter Island Summer Time (UTC-5)
    "EAST": -360,  // Easter Island Standard Time (UTC-6)
    "EAT": 180,    // East Africa Time (UTC+3)
    "ECT": -300,   // Ecuador Time (UTC-5)
    "EDT": -240,   // Eastern Daylight Time (UTC-4)
    "EEST": 180,   // Eastern European Summer Time (UTC+3)
    "EET": 120,    // Eastern European Time (UTC+2)
    "EGST": 0,     // Eastern Greenland Summer Time (UTC+0)
    "EGT": -60,    // Eastern Greenland Time (UTC-1)
    "EST": -300,   // Eastern Standard Time (UTC-5)
    "FET": 180,    // Further-Eastern European Time (UTC+3)
    "FJT": 720,    // Fiji Time (UTC+12)
    "FKST": -180,  // Falkland Islands Summer Time (UTC-3)
    "FKT": -240,   // Falkland Islands Time (UTC-4)
    "FNT": -120,   // Fernando de Noronha Time (UTC-2)
    "GALT": -360,  // Galápagos Time (UTC-6)
    "GAMT": -540,  // Gambier Time (UTC-9)
    "GET": 240,    // Georgia Standard Time (UTC+4)
    "GFT": -180,   // French Guiana Time (UTC-3)
    "GILT": 720,   // Gilbert Island Time (UTC+12)
    "GIT": -540,   // Gambier Island Time (UTC-9)
    "GMT": 0,      // Greenwich Mean Time (UTC+0)
    "GST": 240,    // Gulf Standard Time (UTC+4)
    "GYT": -240,   // Guyana Time (UTC-4)
    "HADT": -540,  // Hawaii-Aleutian Daylight Time (UTC-9)
    "HAST": -600,  // Hawaii-Aleutian Standard Time (UTC-10)
    "HKT": 480,    // Hong Kong Time (UTC+8)
    "HMT": 300,    // Heard and McDonald Islands Time (UTC+5)
    "HOVT": 420,   // Hovd Time (UTC+7)
    "ICT": 420,    // Indochina Time (UTC+7)
    "IDT": 180,    // Israel Daylight Time (UTC+3)
    "IOT": 360,    // Indian Ocean Time (UTC+6)
    "IRDT": 270,   // Iran Daylight Time (UTC+4:30)
    "IRKT": 480,   // Irkutsk Time (UTC+8)
    "IRST": 210,   // Iran Standard Time (UTC+3:30)
    "IST": 330,    // Indian Standard Time (UTC+5:30)
    "JST": 540,    // Japan Standard Time (UTC+9)
    "KGT": 360,    // Kyrgyzstan Time (UTC+6)
    "KOST": 660,   // Kosrae Time (UTC+11)
    "KRAT": 420,   // Krasnoyarsk Time (UTC+7)
    "KST": 540,    // Korea Standard Time (UTC+9)
    "LHST": 630,   // Lord Howe Standard Time (UTC+10:30)
    "LINT": 840,   // Line Islands Time (UTC+14)
    "MAGT": 720,   // Magadan Time (UTC+12)
    "MART": -510,  // Marquesas Time (UTC-8:30)
    "MAWT": 300,   // Mawson Time (UTC+5)
    "MDT": -360,   // Mountain Daylight Time (UTC-6)
    "MET": 60,     // Middle European Time (UTC+1)
    "MEST": 120,   // Middle European Summer Time (UTC+2)
    "MHT": 720,    // Marshall Islands Time (UTC+12)
    "MIST": 660,   // Macquarie Island Station Time (UTC+11)
    "MIT": -510,   // Marquesas Islands Time (UTC-8:30)
    "MMT": 390,    // Myanmar Time (UTC+6:30)
    "MSK": 180,    // Moscow Time (UTC+3)
    "MST": -420,   // Mountain Standard Time (UTC-7)
    "MUT": 240,    // Mauritius Time (UTC+4)
    "MVT": 300,    // Maldives Time (UTC+5)
    "MYT": 480,    // Malaysia Time (UTC+8)
    "NCT": 660,    // New Caledonia Time (UTC+11)
    "NDT": -90,    // Newfoundland Daylight Time (UTC-2:30)
    "NFT": 690,    // Norfolk Island Time (UTC+11:30)
    "NOVT": 420,   // Novosibirsk Time (UTC+7)
    "NPT": 345,    // Nepal Time (UTC+5:45)
    "NST": -150,   // Newfoundland Standard Time (UTC-2:30)
    "NT": -150,    // Newfoundland Time (UTC-3:30)
    "NUT": -660,   // Niue Time (UTC-11)
    "NZDT": 780,   // New Zealand Daylight Time (UTC+13)
    "NZST": 720,   // New Zealand Standard Time (UTC+12)
    "OMST": 420,   // Omsk Time (UTC+7)
    "ORAT": 300,   // Oral Time (UTC+5)
    "PDT": -420,   // Pacific Daylight Time (UTC-7)
    "PET": -300,   // Peru Time (UTC-5)
    "PETT": 720,   // Kamchatka Time (UTC+12)
    "PGT": 600,    // Papua New Guinea Time (UTC+10)
    "PHOT": 780,   // Phoenix Island Time (UTC+13)
    "PHT": 480,    // Philippine Time (UTC+8)
    "PKT": 300,    // Pakistan Standard Time (UTC+5)
    "PMDT": -120,  // Saint Pierre and Miquelon Daylight Time (UTC-2)
    "PMST": -180,  // Saint Pierre and Miquelon Standard Time (UTC-3)
    "PONT": 660,   // Pohnpei Standard Time (UTC+11)
    "PST": -480,   // Pacific Standard Time (UTC-8)
    "PWT": 540,    // Palau Time (UTC+9)
    "PYST": -180,  // Paraguay Summer Time (UTC-3)
    "PYT": -240,   // Paraguay Time (UTC-4)
    "RET": 240,    // Réunion Time (UTC+4)
    "ROTT": -180,  // Rothera Research Station Time (UTC-3)
    "SAKT": 660,   // Sakhalin Island Time (UTC+11)
    "SAMT": 240,   // Samara Time (UTC+4)
    "SAST": 120,   // South African Standard Time (UTC+2)
    "SBT": 660,    // Solomon Islands Time (UTC+11)
    "SCT": 240,    // Seychelles Time (UTC+4)
    "SGT": 480,    // Singapore Time (UTC+8)
    "SLST": 330,   // Sri Lanka Time (UTC+5:30)
    "SRET": 660,   // Srednekolymsk Time (UTC+11)
    "SRT": -180,   // Suriname Time (UTC-3)
    "SST": -660,   // Samoa Standard Time (UTC-11)
    "SYOT": 180,   // Syowa Time (UTC+3)
    "TAHT": -600,  // Tahiti Time (UTC-10)
    "THA": 420,    // Thailand Standard Time (UTC+7)
    "TFT": 300,    // French Southern and Antarctic Time (UTC+5)
    "TJT": 300,    // Tajikistan Time (UTC+5)
    "TKT": 780,    // Tokelau Time (UTC+13)
    "TLT": 540,    // East Timor Time (UTC+9)
    "TMT": 300,    // Turkmenistan Time (UTC+5)
    "TRT": 180,    // Turkey Time (UTC+3)
    "TOT": 780,    // Tonga Time (UTC+13)
    "TVT": 720,    // Tuvalu Time (UTC+12)
    "ULAST": 540,  // Ulaanbaatar Summer Time (UTC+9)
    "ULAT": 480,   // Ulaanbaatar Standard Time (UTC+8)
    "UTC": 0,      // Coordinated Universal Time (UTC+0)
    "UYST": -120,  // Uruguay Summer Time (UTC-2)
    "UYT": -180,   // Uruguay Time (UTC-3)
    "UZT": 300,    // Uzbekistan Time (UTC+5)
    "VET": -210,   // Venezuelan Standard Time (UTC-4:30)
    "VLAT": 600,   // Vladivostok Time (UTC+10)
    "VOLT": 240,   // Volgograd Time (UTC+4)
    "VOST": 360,   // Vostok Station Time (UTC+6)
    "VUT": 660,    // Vanuatu Time (UTC+11)
    "WAKT": 720,   // Wake Island Time (UTC+12)
    "WAST": 120,   // West Africa Summer Time (UTC+2)
    "WAT": 60,     // West Africa Time (UTC+1)
    "WEST": 60,    // Western European Summer Time (UTC+1)
    "WET": 0,      // Western European Time (UTC+0)
    "WIT": 540,    // Western Indonesian Time (UTC+9)
    "WST": 480,    // Western Standard Time (UTC+8)
    "YAKT": 540,   // Yakutsk Time (UTC+9)
    "YEKT": 300    // Yekaterinburg Time (UTC+5)
};

function isNotificationAddedOutside(notificationId) {
	return notificationId?.includes(NotificationType.ADDED_OUTSIDE);
}

function EventEntry(summary, startTime) {
	this.summary = summary;
	this.startTime = startTime;
	this.quickAdd = true;
}

function adjustTimeFromLocalToUTC(date) {
    return date.addMinutes(date.getTimezoneOffset());
}

async function saveEvent(eventEntry) {
    let response;
    let initEventAndCopyObj = false;

    if (eventEntry.taskListId) {

        if (eventEntry.quickAdd) {
            const regex = new RegExp("\\b" + getMessage("tomorrow") + "\\b", "i");
            const matches = regex.exec(eventEntry.summary);
            if (matches) {
                eventEntry.summary = eventEntry.summary.replace(regex, "").trim();
                eventEntry.startTime = tomorrow();
            }
        }

        const data = await generateGoogleTask(eventEntry);

        response = await oauthDeviceSend({
            type: "post",
            url: `${TASKS_BASE_URL}/lists/${eventEntry.taskListId}/tasks`,
            data: data
        }, oAuthForTasks);

        initEventAndCopyObj = true;

    } else {
        // If today then processing quick add entry for min or hours etc..
        if (eventEntry.quickAdd && (!eventEntry.startTime || eventEntry.startTime.isToday())) {
            const processedEventEntry = await getEventEntryFromQuickAddText(eventEntry.summary);
            eventEntry.summary = processedEventEntry.summary;
            eventEntry.startTime = processedEventEntry.startTime;
        }

        if (eventEntry.quickAdd) {
            let title;
            // if no date set and it's all day then we must push the date into the quickadd to force to be an all day event
            if (!eventEntry.startTime && eventEntry.allDay) {
                eventEntry.startTime = new Date();
            }
            
            let nonEnglishWithStartTime = false;
            const originalEventEntry = deepClone(eventEntry);
            
            // if not today than skip this if statement because if a user types "tomorrow" or "tuesday" we can't add also the date to the quick add statement ie. conflicting statement... (tomorrow test 12/12/20012
            if (eventEntry.startTime && !eventEntry.startTime.isToday()) {
                // it seems that if we are not in english than quickAdd can only save the time or the date but not both! so let's quick add the event so quickadd recognizes the time string and then pass a 2nd time to update it to the proper date
                const calendarSettings = await storage.get("calendarSettings");
                if (/en/.test(calendarSettings.calendarLocale)) { // will also match en_GB
                    const format = "m/d/yyyy";
                    // german: format = "yyyy/m/d";
                    title = eventEntry.summary + " " + eventEntry.startTime.format(format);
                } else {
                    nonEnglishWithStartTime = true;
                    title = eventEntry.summary;
                }				
            } else {
                title = eventEntry.summary;
            }
            
            const calendarId = await getCalendarIdForAPIUrl(eventEntry)

            response = await oauthDeviceSend({
                type: "post",
                url: `/calendars/${encodeURIComponent(calendarId)}/events/quickAdd?text=${encodeURIComponent(title)}`
            });

            initEventObj(response, calendarId);
            copyObj(response, eventEntry);

            // Adjust timezone for family calendar
            const familyCalendar = await getCalendarById(calendarId);
            if (calendarId === CommonCalendarIds.FAMILY && familyCalendar.timeZone == "UTC") {
                eventEntry.startTime = adjustTimeFromLocalToUTC(eventEntry.startTime);
                if (eventEntry.endTime) {
                    eventEntry.endTime = adjustTimeFromLocalToUTC(eventEntry.endTime);
                }

                const patchFields = {};
                fillTimesForPatchFields(eventEntry, patchFields);

                response = await updateEvent({
                    eventEntry: eventEntry,
                    event: response,
                    patchFields: patchFields
                });

                initEventAndCopyObj = true;
            }
            
            console.log("start", eventEntry)
            if (nonEnglishWithStartTime) {
                console.log("non english with time")
                // determine if time was matched in the text sent to quickadd: it would be extracted from the summary in the result and thus means time was once present
                if (trim(originalEventEntry.summary) != trim(eventEntry.summary)) {
                    // timed event
                    eventEntry.allDay = false;

                    // v2 using a constructor instead of .setxxx because of issue with changing month
                    // v1 must set month before day because if we set day larger than days in month then month is automatically incremented

                    eventEntry.startTime = new Date(
                        originalEventEntry.startTime.getFullYear(),
                        originalEventEntry.startTime.getMonth(),
                        originalEventEntry.startTime.getDate(),
                        eventEntry.startTime.getHours(),
                        eventEntry.startTime.getMinutes(),
                        eventEntry.startTime.getSeconds()
                    );

                    if (originalEventEntry.endTime) {
                        eventEntry.endTime = new Date(
                            originalEventEntry.endTime.getFullYear(),
                            originalEventEntry.endTime.getMonth(),
                            originalEventEntry.endTime.getDate(),
                            eventEntry.endTime.getHours(),
                            eventEntry.endTime.getMinutes(),
                            eventEntry.endTime.getSeconds()
                        );
                    } else {
                        eventEntry.end = null;
                        eventEntry.endTime = null;
                    }
                } else {
                    // allday event
                    eventEntry.allDay = true;
                    eventEntry.startTime = originalEventEntry.startTime;
                    eventEntry.endTime = originalEventEntry.endTime;
                }
                console.log("re-evententry:", eventEntry)
            }
            
            // if we passed in reminders we must set them again to the eventEntry, or else the current reminders are returned from the newy created object
            if (originalEventEntry.reminders != undefined) {
                eventEntry.reminders = originalEventEntry.reminders;
            }

            response = await ensureQuickAddPatchWhenAddingAllDayEvent({originalEventEntry:originalEventEntry, eventEntry:eventEntry, response:response, event:response});
            response = await ensureEventStartTimeIsNotInThePast(eventEntry, response);
            response = await ensureAllEventDetailsSavedAfterQuickAdd({eventEntry:eventEntry, response:response, event:response, nonEnglishWithStartTime:nonEnglishWithStartTime});
            response = await ensureNoConflict(eventEntry, response);

            if (response.secondPass) {
                initEventAndCopyObj = true;
            }
        } else {
            const data = await generateGoogleCalendarEvent(eventEntry);
            const calendarId = await getCalendarIdForAPIUrl(eventEntry);

            let url = `/calendars/${encodeURIComponent(calendarId)}/events`;

            if (eventEntry.sendNotifications && eventEntry.sendNotifications != "sent") {
                url = setUrlParam(url, "sendUpdates", "all");
                eventEntry.sendNotifications = "sent";
            }

            // test for null because that is used to remove conference
            if (eventEntry.conferenceData === null || eventEntry.conferenceData) {
                url = setUrlParam(url, "conferenceDataVersion", "1");
            }

            response = await oauthDeviceSend({
                type: "post",
                url: url,
                data: data
            });

            if (nonUISources.includes(eventEntry.inputSource)) {
                response = await ensureNoConflict(eventEntry, response);
            }

            initEventAndCopyObj = true;
        }
    }

    if (initEventAndCopyObj) {
        initEventObj(response);
        copyObj(response, eventEntry);
    }

    if (eventEntry.conferenceData?.createRequest) {
        const conferenceStatusCode = response.conferenceData.createRequest.status.statusCode;
        if (conferenceStatusCode == "pending") {
            console.warn("conferenceStatusCode", conferenceStatusCode);
            // createRequest is asynchronous so might need to poll in a few seconds to get conference data
            setTimeout(() => {
                sendMessageToBG("pollServer", {source: "pending-conference-data"});
            }, seconds(3));
        } else if (conferenceStatusCode == "failure") {
            showMessageNotification("Problem creating video conference", "Event was saved");
        } else {
            // do nothing should be success
        }
    }

    return response;
}

// Seems when adding all day event to the CURRENT DAY - Google api would register the event as a timed event (saved to the current time) - so let's update the event to save it as an all day event
async function ensureQuickAddPatchWhenAddingAllDayEvent(params) {
    console.log("ensureQuickAddPatchWhenAddingAllDayEvent");
    if (params.originalEventEntry.allDay && trim(params.originalEventEntry.summary) == trim(params.eventEntry.summary) && params.eventEntry.startTime && Math.abs(params.eventEntry.startTime.diffInMinutes()) <= 2) {
        
        // 1st patch: make sure it's all day
        params.eventEntry.allDay = true;
        params.patchFields = await generateGoogleCalendarEvent(params.eventEntry);
        
        console.log("evententry", params.eventEntry);
        console.log("patchfields", params.patchFields);
        
        const response = await updateEvent(params);
        response.secondPass = true;
        return response;
    } else {
        console.log("2nd part", params.eventEntry);
        return params.response;
    }
}

function changeTimesOfEventEntry(eventEntry, newStartTime) {
	const newEndTime = calculateNewEndTime(eventEntry.startTime, eventEntry.endTime, newStartTime);
	eventEntry.startTime = newStartTime;
	eventEntry.endTime = newEndTime;
}

function fillTimesForPatchFields(eventEntry, patchFields) {
	patchFields.start = {};
	if (eventEntry.allDay) {
		patchFields.start.date = eventEntry.startTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR);
	} else {
		patchFields.start.dateTime = eventEntry.startTime.toRFC3339();
	}
	if (eventEntry.endTime) {
		patchFields.end = {};
		if (eventEntry.allDay) {
			patchFields.end.date = eventEntry.endTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR);
		} else {
			patchFields.end.dateTime = eventEntry.endTime.toRFC3339();
		}
	}
}

async function ensureEventStartTimeIsNotInThePast(eventEntry, response) {
	console.log("ensureEventStartTimeIsNotInThePast");
	
    const inputSource = eventEntry.inputSource;
    let newTime;

    if (allQuickAddSources.includes(inputSource) && ((eventEntry.allDay && eventEntry.startTime.isBeforeToday()) || (!eventEntry.allDay && eventEntry.startTime.getTime() < Date.now()))) {
        delete eventEntry.inputSource;

        if (eventEntry.startTime.isToday() && inputSource == InputSource.QUICK_ADD) {
            const response = await openDialog(getMessage("addedTimedEventInThePast"), {
                cancel: true
            });

            if (response == "ok") {
                newTime = eventEntry.startTime.addDays(1);
            }
        } else {
            // patch when using quick add "test wed" it could add it to the past wed if we are thu, so solution is to add it to next week
            // v1 but only do this if the event is added somewhere in the current week (not way before like when entering "Staff Meeting 8/1/16")
            // v2 only do this if within quickAddOldestDateRange (usually 7 days before)
            // let startOfWeek = moment().startOf('week').toDate();

            // ie. Staff Meeting 12/27/17 ref. https://jasonsavard.com/forum/discussion/comment/16931#Comment_16931
            const userEnteredSpecificDate = /\//.test(eventEntry.userInputSummary);
            const quickAddOldestDateRange = today().subtractDays(7);
            if (eventEntry.startTime.isAfter(quickAddOldestDateRange)) {
                if (!userEnteredSpecificDate) {
                    // move it to next week
                    newTime = eventEntry.startTime.addDays(7);
                }
            } else if (inputSource == InputSource.QUICK_ADD) {
                const response = await openDialog("This date is in the past, do you want to continue saving it?", {
                    cancel: true
                });

                if (response != "ok") {
                    const deleteResponse = await deleteEvent(eventEntry);
                    if (fullCalendar) {
                        if (eventEntry.recurrence) {
                            fullCalendar.getEvents().forEach(event => {
                                if (eventEntry.id == event.extendedProps.jEvent.recurringEventId) {
                                    event.remove();
                                }
                            });
                        } else {
                            fullCalendar.getEventById(getEventID(eventEntry))?.remove();
                        }
                    }
                    showToast(getMessage("eventDeleted"));
                    
                    if (await getCalendarView() == CalendarView.AGENDA) {
                        initAgenda();
                    }

                    throw Error("Operation cancelled")
                }
            }
        }

        if (newTime) {
            changeTimesOfEventEntry(eventEntry, newTime);
            
            const patchFields = {};
            fillTimesForPatchFields(eventEntry, patchFields);
            
            response = await updateEvent({
                eventEntry: eventEntry,
                event: response,
                patchFields: patchFields
            });
    
            response.secondPass = true;
        }
    }
    return response;
}

async function ensureNoConflict(eventEntry, response) {
    const eventConflictHandling = await storage.get("eventConflictHandling");
    const selectedCalendars = await storage.get("selectedCalendars");

    if (eventConflictHandling && !eventEntry.allDay) {
        const events = await getEvents();
        const email = await storage.get("email");
        const conflictingEvent = events.find(e =>
            e.id !== eventEntry.id &&
            !e.allDay && e.transparency !== EventTransparency.FREE &&
            (eventConflictHandling === "warnForAnyCalendar" || (eventConflictHandling === "warnForSameCalendar" && e.calendarId === eventEntry.calendarId) || (eventConflictHandling === "warnForVisibleCalendars" && isCalendarSelectedInExtension({id: e.calendarId}, email, selectedCalendars))) &&
            (
                (eventEntry.startTime < e.endTime && eventEntry.endTime > e.startTime) ||
                (eventEntry.startTime?.getTime() === e.startTime?.getTime())
            )
        );

        console.log("ensurenoconflict", conflictingEvent, eventEntry)
        if (conflictingEvent) {
            if (nonUISources.includes(eventEntry.inputSource)) {
                chrome.action.openPopup().then(() => {
                    chrome.runtime.sendMessage({
                        command: "conflicting-event",
                        newEvent: eventEntry,
                        conflictingEvent: conflictingEvent
                    });
                }).catch(error => {
                    console.error(error);
                    // for firefox cause it requires a user gesture
                    showMessageNotification("Conflicting event detected");
                });
            } else {
                openConflictingEventDialog({
                    newEvent: eventEntry,
                    conflictingEvent: conflictingEvent
                });
                response.conflictingEvent = conflictingEvent;
            }
        }
    }

    return response;
}

// since we couldn't add a description with the quickadd method let's pass a 2nd time to add the description by updating the recently created event
async function ensureAllEventDetailsSavedAfterQuickAdd(params) { //calendarId, eventEntry, response
    console.log("ensurequickadd details allday: " + params.eventEntry.allDay)
    console.log("ensurequickadd details startt: " + params.eventEntry.startTime)
    if (params.eventEntry.allDay || params.eventEntry.location || params.eventEntry.colorId || params.eventEntry.description || (params.eventEntry.reminders && !params.eventEntry.reminders.useDefault) || params.eventEntry.sendNotifications || params.nonEnglishWithStartTime || params.eventEntry.recurrence) {
        console.log("ensureAllEventDetailsSavedAfterQuickAdd", params.eventEntry);
        
        params.patchFields = await generateGoogleCalendarEvent(params.eventEntry);
        
        const response = await updateEvent(params);
        response.secondPass = true;
        return response;
    } else {
        return params.response;
    }
}

// in minutes
async function getDefaultEventLength() {
    const calendarSettings = await storage.get("calendarSettings")
	const defaultEventLength = calendarSettings.defaultEventLength;
	if (defaultEventLength) {
		return parseInt(defaultEventLength);
	} else {
		return 60; // 60 minutes
	}
}

async function googleCalendarParseString(params) {
	if (!params.text) {
		throw Error("JERROR: text parameter missing");
	}
	
    const ary = [params.text];
	if (params.startTime) {
		ary.push(params.startTime.format("yyyymmdd"));
		if (params.endTime) {
			ary.push(params.endTime.format("yyyymmdd"));
		} else {
			ary.push(params.startTime.format("yyyymmdd"));
		}
	}

    const data = {
		"f.req": JSON.stringify(ary)
	};

	let response = await fetchJSON(`${Urls.CALENDAR}/compose`, data, {
        method: "post"
    });
    // allday: ")]}'↵[['qa','test','','','20140618','20140618',[],'','']]
    // timed:  ")]}'↵[['qa','test','','','20140610T150000','20140610T160000',[],'','']]"

    // v2 now returning " instead of '
    // )]}'\n[["qa", "hello", "", "", "20171127T150000", "20171127T160000", [], "", ""]]

    console.log("response", response);
    response = response.split("\"");
    console.log("response2", response);
    
    let summary = response[3];
    summary = summary.replaceAll("\\46", "&");
    summary = await htmlToText(summary);

    const responseObj = {
        summary: summary
    };
    
    let startTimeStr = response[5];
    
    // if NO time in string ie. 20140618 vs 20140610T150000 then this is an all day event
    if (!startTimeStr.includes("T")) {
        responseObj.allDay = true;
    }

    // if times return ????????T?????? then there is not time that was parsed
    if (!startTimeStr.includes("??")) {
        responseObj.startTime = parseDate(startTimeStr);
        // v2 trying response 7 v1 seems that end time does not get set when using this google calendar post technique
        responseObj.endTime = parseDate(response[7]);
        /*
        if (params.endTime) {
            responseObj.endTime = params.endTime;
        }
        */
    }
    return responseObj;
}

async function generateGoogleCalendarEvent(eventEntry) {
	const data = {
        summary: eventEntry.summary,
        description: eventEntry.description, //.replace(/&/ig, "&amp;")
        transparency: eventEntry.transparency,
        visibility: eventEntry.visibility
    };
	
	if (eventEntry.source && eventEntry.source.url && (eventEntry.source.url.indexOf("http") != 0 || isInternalPage(eventEntry.source.url))) {
		console.warn("Google Calendar API does not allow chrome-extension:// in source, so excluding it");
	} else {
		data.source = eventEntry.source;
	}
	
	// if string form is passed then push direction to object (this is used for facebook event add from ics file
	// startTimeStr from ics can equal... DTSTART:20121004 or DTSTART:20121014T003000Z
	if (eventEntry.allDay) {
		data.start = {
			date: eventEntry.startTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR),
			dateTime: null
		}
		if (!eventEntry.endTime) {
			eventEntry.endTime = new Date(eventEntry.startTime);
			eventEntry.endTime.setDate(eventEntry.endTime.getDate()+1);
		}
		
		// patch seems quick add would register enddate same as startdate, for all day event it should end on the next day so let's force that
		if (eventEntry.startTime.isSameDay(eventEntry.endTime)) {
			console.log("end time patch")
			eventEntry.endTime = eventEntry.startTime.addDays(1);
		}
		
		data.end = {
			date: eventEntry.endTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR),
			dateTime: null
		}

		if (eventEntry.transparency == undefined) {
			data.transparency = "transparent"; // override default of busy to available for allday events
		}
	} else {
		data.start = {
			date: null,
			dateTime: eventEntry.startTime.toRFC3339() // 2012-12-17T17:54:00Z
        }
        
		// if none set must put it's duration atleast an 1 long
		if (!eventEntry.endTime) {
			eventEntry.endTime = new Date(eventEntry.startTime);
			eventEntry.endTime.setMinutes(eventEntry.endTime.getMinutes() + await getDefaultEventLength());
		}
		data.end = {
			date: null,
			dateTime: eventEntry.endTime.toRFC3339()
        }
        
        if (eventEntry.recurrence || eventEntry.recurringEventId) { // required for recurring events
            const calendar = getEventCalendar(eventEntry);
            data.start.timeZone = calendar.timeZone;
            data.end.timeZone = calendar.timeZone;
        }
	}

    if (eventEntry.timeZone) {
        data.start.dateTime = convertTimeToTimezoneWithOriginalOffset(eventEntry.startTime, eventEntry.timeZone);
        data.end.dateTime = convertTimeToTimezoneWithOriginalOffset(eventEntry.endTime, eventEntry.timeZone);

        data.start.timeZone = eventEntry.timeZone;
        data.end.timeZone = eventEntry.timeZone;
    }
    
    data.conferenceData = eventEntry.conferenceData;
	data.location = eventEntry.location;
	data.colorId = eventEntry.colorId;
	if (eventEntry.reminders && eventEntry.reminders.useDefault) {
		// nothing
	} else {
		data.reminders = eventEntry.reminders;
	}
	
	if (eventEntry.extendedProperties) {
		data.extendedProperties = eventEntry.extendedProperties;
	}

	if (eventEntry.attendees) {
		data.attendees = eventEntry.attendees;
    }
    
    if (eventEntry.recurrence) {
        data.recurrence = eventEntry.recurrence;
    }
	
	return data;
}

function setTaskDueDate(date) {
    return `${date.format("yyyy-mm-dd")}T00:00:00.000Z`;
}

async function generateGoogleTask(eventEntry) {
	return {
        title: eventEntry.summary,
        notes: eventEntry.description,
        due: setTaskDueDate(eventEntry.startTime)
    };
}

async function oauthDeviceSend(sendParams, oAuthForMethod) {
    if (!sendParams.userEmail) {
        sendParams.userEmail = await storage.get("email");
    }
    
    // note that last time this extension is modifying the calendar
    if (/post|patch|delete/i.test(sendParams.type)) {
        storage.setDate("_lastCalendarModificationByExtension");
    }

    if (!oAuthForMethod) {
        oAuthForMethod = oAuthForDevices;
    }
    
    return oAuthForMethod.send(sendParams);
}

async function ensureSameCalendar(params) {
    console.log("ensureSameCalendar", params);
    if (params.oldCalendarId && params.newCalendarId && params.oldCalendarId != params.newCalendarId) {
        console.log("move calendar");
        
        const response = await oauthDeviceSend({
            userEmail: await storage.get("email"),
            type: "post",
            url: `/calendars/${encodeURIComponent(params.oldCalendarId)}/events/${params.useRecurringEvent ? params.event.recurringEventId : params.event.id}/move?destination=${encodeURIComponent(params.newCalendarId)}`
        });
        initEventObj(response);
        if (params.event) {
            copyObj(response, params.event);
            // add new calendar
            params.event.calendarId = params.newCalendarId;
        }
        return response;
    }
}

async function ensureRecurringEventPrompt(params) {
    return new Promise((resolve, reject) => {
        if (params.event.recurringEventId && !params.skipRecurringEventPrompt) {

            // only update this event: seems with google calendar there is no prompt when updating an a recurring event from an invitation, ref: https://jasonsavard.com/forum/discussion/8704/duplicated-event-when-i-changed-the-name#latest
            const calendar = getEventCalendar(params.event)
            if (!params.event.creator?.self && calendar.primary) {
                resolve({thisEvent: true});
                return;
            }

            const $dialogContent = document.createElement("div");
            $dialogContent.className = "layout vertical";
            $dialogContent.style.gap = "10px";

            const options = [
                { value: "this-event", label: "onlyThisEvent", checked: true },
                { value: "this-and-following-events", label: "thisAndFollowingEvents", id: "this-and-following-events" },
                { value: "all-events", label: "allEvents" }
            ];

            options.forEach(option => {
                const $label = document.createElement("label");
                const $input = document.createElement("input");
                $input.type = "radio";
                $input.name = "recurring-choice";
                $input.value = option.value;
                if (option.id) {
                    $input.id = option.id;
                }
                if (option.checked) {
                    $input.checked = true;
                }

                const $span = document.createElement("span");
                $span.setAttribute("msg", option.label);
                $span.textContent = option.label;

                $label.appendChild($input);
                $label.appendChild(document.createTextNode(" "));
                $label.appendChild($span);

                $dialogContent.appendChild($label);
            });

            initMessages($dialogContent);

            let title;
            if (params.action == "update") {
                title = getMessage("editEventDetails");
            } else {
                title = getMessage("delete");
            }

            openDialog($dialogContent, {
                title: title,
                ok: false,
                buttons: [
                    {
                        label: getMessage("cancel"),
                        onClick: async (dialog) => {
                            dialog.close();
                            resolve({cancel: true});
                        }
                    },
                    {
                        label: getMessage("ok"),
                        primary: true,
                        onClick: async (dialog) => {
                            dialog.close();
                            // use dialog from popup.html
                            const choice = getSelectedRadioValue("recurring-choice");
                            if (choice == "this-event") {
                                resolve({thisEvent: true});
                            } else if (choice == "this-and-following-events") {
                                resolve({thisAndFollowingEvents: true});
                            } else if (choice == "all-events") {
                                resolve({changeAllRecurringEvents: true});
                            }
                        }
                    }
                ]   
            });
        } else {
            resolve({});
        }
    });
}

// old way of using updatevent was just passing an eventEntry
// new way is passing the google calendar event object and passing fields to change
async function updateEvent(params) {
    let response;
    let data;

    console.log("updateEvent", params);

    if (params.event?.kind == TASKS_KIND || params.eventEntry?.kind == TASKS_KIND) {
        let taskList;
        let taskId;

        if (params.patchFields) {
            taskId = params.event.id;
            data = params.patchFields;
            taskList = await getTaskList(params.event);
        } else {
            taskId = params.eventEntry.id;
            data = await generateGoogleTask(params.eventEntry);
            taskList = await getTaskList(params.eventEntry);
        }

        response = await oauthDeviceSend({
            type: "patch",
            url: `${TASKS_BASE_URL}/lists/${taskList.id}/tasks/${taskId}`,
            data: data
        }, oAuthForTasks);
    } else {
        if (params.patchFields) {
            data = params.patchFields;
        } else {
            data = await generateGoogleCalendarEvent(params.eventEntry);
        }    

        var calendarId;
        var oldCalendarId;
        var newCalendarId;
        
        console.log("updateevent", params);
        
        if (params.event && getEventCalendar(params.event)) {
            calendarId = getEventCalendarId(params.event);
            oldCalendarId = calendarId;
        }
        
        if (params.eventEntry && getEventCalendar(params.eventEntry)) {
            calendarId = getEventCalendarId(params.eventEntry);
            newCalendarId = calendarId;
        }
        
        if (!calendarId) {
            console.warn("no calendarId, default to primary");
            calendarId = "primary";
        }
    
        let recurringEventPromptResponse;
        let useRecurringEvent;
        if (params.eventEntry?.recurrence) {
            useRecurringEvent = true;
        } else {
            params.action = "update";
            recurringEventPromptResponse = await ensureRecurringEventPrompt(params);
            if (recurringEventPromptResponse.cancel) {
                return recurringEventPromptResponse;
            } else if (recurringEventPromptResponse.changeAllRecurringEvents) {
                useRecurringEvent = true;
            }
        }
        
        await ensureSameCalendar({
            oldCalendarId: oldCalendarId,
            newCalendarId: newCalendarId,
            event: params.event,
            useRecurringEvent: useRecurringEvent
        });

        if (recurringEventPromptResponse?.thisAndFollowingEvents) {
            const recurringEvent = await oauthDeviceSend({
                userEmail: email,
                url: `/calendars/${encodeURIComponent(await getCalendarIdForAPIUrl(params.event))}/events/${params.event.recurringEventId}`
            });

            const changedStartDate = !params.event.startTime?.isSameDay(params.eventEntry.startTime);
            params.event.startTime = params.eventEntry.startTime;
            response = await modifyRecurringEventUntilStartTime(params.event, recurringEvent.recurrence, false);

            // if user has not changed the recurrence then use the original recurrence
            if (!params.eventEntry.recurrence) {
                // but remove the byday rule
                params.eventEntry.recurrence = recurringEvent.recurrence.map(rule => {
                    if (changedStartDate && rule.startsWith("RRULE:")) {
                        rule = rule.replace(/BYDAY=[^;]+/, "")
                    }
                    return rule;
                });
            }
            response = await saveEvent(params.eventEntry);
        } else {
            let url = `/calendars/${encodeURIComponent(calendarId)}/events/${(useRecurringEvent && params.event.recurringEventId ? params.event.recurringEventId : params.event.id)}`;
            if (params.eventEntry?.sendNotifications && params.eventEntry.sendNotifications != "sent") {
                url = setUrlParam(url, "sendUpdates", "all");
                params.eventEntry.sendNotifications = "sent";
            }
        
            // test for null because that is used to remove conference
            if (params.eventEntry && (params.eventEntry.conferenceData === null || params.eventEntry.conferenceData)) {
                url = setUrlParam(url, "conferenceDataVersion", "1");
            }

            response = await oauthDeviceSend({
                type: "patch",
                url: url,
                data: data
            });
        }
    }
    
    console.log("initEventObj", response);
    initEventObj(response);
    // copy new updated times/dates to event which was passed in the eventEntry
    if (params.event) {
        copyObj(response, params.event);
    }
    if (params.eventEntry?.event) {
        copyObj(response, params.eventEntry.event);
    }

    return response;
}

function calculateNewEndTime(oldStartTime, oldEndTime, newStartTime) {
	if (oldEndTime) {
		const duration = oldEndTime.getTime() - oldStartTime.getTime();
		const newEndTime = new Date(newStartTime.getTime() + duration);
		return newEndTime;
	} else {
		return null;
	}
}

async function getEventEntryFromQuickAddText(text) {
    let time = 0;
    let timeStr = "";
    let newDate;

	// look for 'cook in 10 min' etc...
	const minuteFilter = await timeFilter(text, "min(ute)?s?", 1);
    if (minuteFilter) {
        text = minuteFilter.text;
        time += minuteFilter.time;
    }
    const hourFilter = await timeFilter(text, "hours?", 60);
    if (hourFilter) {
        text = hourFilter.text;
        time += hourFilter.time;
    }

    if (time) {
        newDate = new Date(Date.now() + minutes(1) * time);

        // patch for zh-cn and zh-tw because putting 2:00am or pm do not work, must use the chinese am/pm ie. 上午6:00 or 下午6:30
        if (locale.includes("zh")) {		
            timeStr = newDate.getHours() < 12 ? "上午" : "下午";
            timeStr += dateFormat(newDate, "h:MM")
        } else {
            timeStr = dateFormat(newDate, "h:MMtt");
        }
    } else {
        const regex = new RegExp(`^${getMessage("tom")}:`)
        const matches = regex.exec(text);
        if (matches) {
            // remove the tom: etc.
            text = text.replace(regex, "");
            newDate = tomorrow();
        }
    }

    return new EventEntry(`${timeStr} ${text}`, newDate);
}

async function timeFilter(str, timeRegex, timeMultiplierForMinutes) {
	//var matches = title.match(/\b(in )?(\d*) ?min(ute)?s?\b/)
	const regexStr = `\\b ?(in |for )?(\\d*) ?${timeRegex}\\b`;
	const matches = new RegExp(regexStr).exec(str)
	// look for a match and that not just the word 'min' was found without the number of minutes (##)etc..
	if (matches != null && matches[2]) {
		if (matches[1] == "for ") {
			// skip formatting title because this a quick add with a duration ie. dinner at 7pm for 30min
		} else {
			const extractedTime = matches[2];
            return {
                time: extractedTime * timeMultiplierForMinutes,
                text: str.replace(matches[0], "")
            }
		}
	}
}

function cleanTitle(title) {
	// gmail email title ex. "Gmail - emailSubject - abc@def.com"
	// use this regex to get emailsubject from title				
	const matches = title.match(/^Gmail - (.*) - .*@.*/i);
	if (matches) {
		return matches[1];
	} else {
		return title;
	}
}

// if no "tab" passed then default to this page
async function getEventDetailsFromPage(tab) {

    async function executeScript(file) {
        const responses = await chrome.scripting.executeScript({
            target : {tabId : tab.id},
            files: [file]
        });
        return responses[0]?.result;
    }

	var title, description, url;
	
	if (tab) {
		if (tab.url?.includes("https://mail.google.com/mail/u/")) {
            try {
                const eventDetails = await executeScript("/js/parseGmailToEvent.js");
                console.log("eventDetails", eventDetails);
                if (eventDetails) {
                    title = eventDetails.title;
                    description = eventDetails.description;
                    url = eventDetails.url;
                }
            } catch (error) {
                // ignore
                console.error("probably don't have access to parse this page: " + error);
            }
		} else if (tab.url?.includes("https://mail.google.com/mail/mu/")) {
            try {
                const eventDetails = await executeScript("/js/parseGmailOfflineToEvent.js");
                if (eventDetails) {
                    title = eventDetails.title;
                    description = eventDetails.description;
                }
            } catch (error) {
                // ignore
                console.error("probably don't have access to parse this page: " + error);
            }
		} else if (tab.url?.includes(getInternalPageProtocol() + "//" + ExtensionId.Gmail) || tab.url?.includes(getInternalPageProtocol() + "//" + ExtensionId.LocalGmail)) {
            try {
                const response = await sendMessageToGmailExtension({action:"getEventDetails"});
                if (response) {
					title = response.title;
					description = response.description;
					url = response.url;
				}
            } catch (error) {
                // ignore
                console.error("probably don't have access to parse this page: " + error);
            }
		} else {
            try {
                const eventDetails = await executeScript("/js/parseHtmlToEvent.js");
                if (eventDetails) {
                    title = eventDetails.title;
                    description = eventDetails.description;
                    url = eventDetails.url;
                }
            } catch (error) {
                // ignore
                console.error("probably don't have access to parse this page: " + error);
            }
        }
        
        // if page not responding or no details found then just spit out title and url
    	if (!title) {
	    	console.log("timeout no title");
    		title = cleanEmailSubject(cleanTitle(tab.title));
    		description = tab.url;
        }
	} else {
        const $subjectNode = selectorAll(".hP").some(el => isVisible(el));
        title = $subjectNode?.textContent;
        title = cleanEmailSubject(title);

        const $descNode = selectorAll(".ii.gt").some(el => isVisible(el));
        description = $descNode?.innerHTML;
        url = location.href;
        
        if (description) {
            description = await htmlToText(description);
            description = description.trim();
            // trim line breaks
            description = trimLineBreaks(description);
            description = description.trim();
        }
    
        // Add link to email
        if (/\/\/mail.google.com/.test(url)) {
            var matches = url.match(/([0-9]*[a-z]*)*$/); // this will match the 133c67b2eadf9fff part of the email
            var emailLink;
            if (matches && matches[0].length >= 10) {
                emailLink = url;
            } else {
                emailLink = "https://mail.google.com/mail/#search/subject%3A+" + encodeURIComponent(title);
            }
            description = emailLink + "\n\n" + description;
        }

        url = null;
    }
    
    return {
        title: title,
        description: description,
        url: url
    }
}

function formatDateTo8Digits(date, withTime) {
	var str = date.getFullYear() + "" + pad((date.getMonth()+1),2, "0") + "" + pad(date.getDate(), 2, "0");
	if (withTime) {
		str += "T" + pad(date.getHours(), 2, "0") + "" + pad(date.getMinutes(), 2, "0") + "" + pad(date.getSeconds(), 2, "0");
	}
	return str;
}

async function generateActionLink(action, eventEntry) {
	var description = eventEntry.description;
	// when using GET must shorten the url length so let's shorten the desctiption to not get 414 errors
	var MAX_DESCRIPTION_LENGTH = 600;
	if (description?.length > MAX_DESCRIPTION_LENGTH) {
		description = description.substring(0, MAX_DESCRIPTION_LENGTH) + "...";						
	}
	var datesStr = "";
	
	// if no starttime must have one for this url to work with google or else it returns 404
	if (!eventEntry.startTime) {
		eventEntry.startTime = new Date();
	}
	if (eventEntry.startTime) {
		var startTime = eventEntry.startTime ? new Date(eventEntry.startTime) : new Date();
		var endDate;
		var withTime = !eventEntry.allDay;
		var startTimeStr = formatDateTo8Digits(startTime, withTime);
		if (eventEntry.endTime) {
			endDate = new Date(eventEntry.endTime);
		} else {
			endDate = new Date(startTime);
			if (eventEntry.allDay) {
				endDate.setDate(startTime.getDate()+1);
			} else {
				endDate.setMinutes(endDate.getMinutes() + await getDefaultEventLength());
			}
		}					
		var endDateStr = formatDateTo8Digits(endDate, withTime);
		datesStr = "&dates=" + startTimeStr + "/" + endDateStr;
	}
	
	var cText = eventEntry.summary ? "&ctext=" + encodeURIComponent(eventEntry.summary) : "";
	var textParam = eventEntry.summary ? "&text=" + encodeURIComponent(eventEntry.summary) : "";
	//output=js CRASHES without specifying return type in .ajax
	//https://www.google.com/calendar/event?hl=de&dates=20110124/20110125&ctext=tet&pprop=HowCreated:DRAG&qa-src=month-grid&sf=true&action=CREATE&output=js&secid=AmobCPSNU1fGgh1zQp9oPzEaMhA
	var detailsParam = description ? "&details=" + encodeURIComponent(description) : "";
	var locationParams = eventEntry.location ? "&location=" + encodeURIComponent(eventEntry.location) : "";
	
	var src;
    var srcParam
    
    const eventCalendar = getEventCalendar(eventEntry);
	if (eventCalendar) {
		src = eventCalendar.id;
    } else {
        const arrayOfCalendars = await getArrayOfCalendars();
        src = await getDefaultCalendarId(arrayOfCalendars);
    }
    
	srcParam = src ? "&src=" + src : "";
	
	var url = `${Urls.CALENDAR}/event`;
	var data = "action=" + action + datesStr + cText + textParam + detailsParam + locationParams + srcParam + "&authuser=" + encodeURIComponent(await storage.get("email"));
	return {url:url, data:data};
}

async function daysElapsedSinceFirstInstalled() {
    const installDate = await getInstallDate();
	return Math.abs(Math.round(installDate.diffInDays()));
}

var IGNORE_DATES = false;

async function isEligibleForReducedDonation(mightBeShown) {

	if (TEST_REDUCED_DONATION) {
		return true;
	}
	
	// not eligable if we already d or we haven't verified payment
	if (!await storage.get("donationClicked")) {
		if (IGNORE_DATES || await daysElapsedSinceFirstInstalled() >= UserNoticeSchedule.DAYS_BEFORE_ELIGIBLE_FOR_REDUCED_DONATION) {

			// when called from shouldShowReducedDonationMsg then we can assume we are going to show the ad so let's initialize the daysElapsedSinceEligible
			if (mightBeShown) {
				// stamp this is as first time eligibility shown
				var daysElapsedSinceEligible = await storage.get("daysElapsedSinceEligible");
				if (!daysElapsedSinceEligible) {
					await storage.setDate("daysElapsedSinceEligible");				
				}
			}
			
			return true;
		} else {
			return false;
		}
	}
}

// only display eligible special for 1 week after initially being eligiable (but continue the special)
async function isEligibleForReducedDonationAdExpired(mightBeShown) {

	if (TEST_REDUCED_DONATION) {
		return false;
	}
	
	if (await storage.get("reducedDonationAdClicked")) {
		return true;
	} else {
		var daysElapsedSinceEligible = await storage.get("daysElapsedSinceEligible");
		if (daysElapsedSinceEligible) {
			daysElapsedSinceEligible = new Date(daysElapsedSinceEligible);
			if (IGNORE_DATES || Math.abs(daysElapsedSinceEligible.diffInDays()) <= UserNoticeSchedule.DURATION_FOR_SHOWING_REDUCED_DONATION) {
                return false;
            } else if (Math.abs(daysElapsedSinceEligible.diffInDays()) >= UserNoticeSchedule.DAYS_BEFORE_ELIGIBLE_FOR_REDUCED_DONATION_AGAIN) {
                let daysElapsedSinceReducedDonationAgain = await storage.get("daysElapsedSinceReducedDonationAgain");
                if (daysElapsedSinceReducedDonationAgain) {
                    if (Math.abs(daysElapsedSinceReducedDonationAgain.diffInDays()) <= UserNoticeSchedule.DURATION_FOR_SHOWING_REDUCED_DONATION) {
                        return false;
                    } else {
                        return true;
                    }
                } else {
                    await storage.setDate("daysElapsedSinceReducedDonationAgain");
                    return false;
                }
			} else {
				return true;
			}
		}
		return false;
	}
}

async function shouldShowExtraFeature() {

	if (TEST_SHOW_EXTRA_FEATURE) {
		return true;
	}

	if (!await storage.get("donationClicked")) {
		const skins = await storage.get("skins");
		if (skins?.length) {
			return false;
		} else {
			if (await daysElapsedSinceFirstInstalled() >= UserNoticeSchedule.DAYS_BEFORE_SHOWING_EXTRA_FEATURE) {
				var daysElapsedSinceFirstShownExtraFeature = await storage.get("daysElapsedSinceFirstShownExtraFeature");
				if (daysElapsedSinceFirstShownExtraFeature) {
					if (daysElapsedSinceFirstShownExtraFeature.diffInDays() <= -UserNoticeSchedule.DURATION_FOR_SHOWING_EXTRA_FEATURE) {
						return false;
					} else {
						return true;
					}
				} else {
					await storage.setDate("daysElapsedSinceFirstShownExtraFeature");
					return true;
				}
			} else {
				return false;
			}
		}
	}
}

async function shouldShowReducedDonationMsg(ignoreExpired) {
	if (await isEligibleForReducedDonation(true)) {
		if (ignoreExpired) {
			return true;
		} else {
			return !await isEligibleForReducedDonationAdExpired();
		}
	}
}

function getSummary(event) {
	var summary = event.summary;
	if (!summary) {
		const calendar = getEventCalendar(event);
		if (calendar?.accessRole == CalendarAccessRole.FREE_BUSY) {
			summary = getMessage("busy");
		} else {
			summary = "(" + getMessage("noTitle") + ")";
		}
	}
	return summary;
}

function getEventID(event) {
	if (event.id) {
		return event.id
	} else {
		return event.eid;
	}
}

function isSameEvent(event1, event2) {
	return event1.id == event2.id;
}

function darkenColor(color) {
	if (color == "#9fe1e7") { // when using Android my main cal changed to peacock and it was too light
		return "#2cbecc";
	} else {
		return lightenDarkenColor(color, -40);
	}
}

function initEventObj(event, calendarId) {
    if (calendarId) {
        event.calendarId = calendarId;
    }

    if (event.created) {
        event.created = parseDate(event.created);
    }

    if (event.kind == TASKS_KIND) {
		event.allDay = true;
        let isoString;
        if (event.due.toISOString) {
            isoString = event.due.toISOString();
        } else {
            isoString = event.due;
        }
		event.startTime = new Date(isoString.replace("Z", ""));
        event.summary = event.title;
        event.description = event.notes;
    } else {
        if (event.start.date) {
            event.allDay = true;
            event.startTime = parseDate(event.start.date);
            event.endTime = parseDate(event.end.date);
        } else {
            event.allDay = false;
            event.startTime = parseDate(event.start.dateTime);
            event.endTime = parseDate(event.end.dateTime);
        }
    }
}

function isGadgetCalendar(calendar) {
	if (calendar) {
		var id = calendar.id;
		
		if (id) {
			id = decodeCalendarId(id);
			return isGadgetCalendarId(id)
		}
	}
}

function isGadgetCalendarId(calendarId) {
    if (calendarId && (
            calendarId.includes(CommonCalendarIds.WEATHER) || // weather
            calendarId.includes(CommonCalendarIds.WEEKNUM) || // week numbers
            calendarId.includes(CommonCalendarIds.WEEKNUM_ALTERNATE) || // week numbers also?
            calendarId.includes(CommonCalendarIds.DAYNUM) || // day of the year
            calendarId.includes(CommonCalendarIds.MOONPHASES) // moon phases
            )) {
                return true;
    }
}

function decodeCalendarId(id) {
	// ignore decoding errors produced from gtempaccounts because they % ie.  joao%rotagrafica.com.br@gtempaccount.com in them!! refer to https://support.google.com/youtube/answer/1076429
	if (id && !id.includes("@gtempaccount.com")) {
		// try catch for: URIError: URI malformed
		try {
			id = decodeURIComponent(id);
		} catch (e) {
			logError("could not decode id from url: " + id);
		}
	}
	return id;
}

async function updateNotificationEventsShown(notifications, eventsShown, lastAction) {
    const defaultEventNotificationTime = await getDefaultEventNotificationTime();

	notifications.forEach(notification => {
        if (notification) {
            updateEventShown(notification.event, eventsShown, defaultEventNotificationTime);
        }
	});

	if (lastAction != "snooze") {
        await removeSnoozers(notifications);
    }
    
	serializeEventsShown();
}

function updateEventShown(event, eventsShown, defaultEventNotificationTime) {
	// Update eventsShown with stripped event
	const eventShown = eventsShown.find(eventShown => isSameEvent(eventShown, event));
	
	if (eventShown) {
		markReminderTimeAsShown(event, eventShown, defaultEventNotificationTime);
	} else {
		// prevent localStorage quota issue with massive eventsShown - so minimimze the details we need to only the bare essentials
		const strippedEvent = {
            id: event.id,
            startTime: event.startTime,
            endTime: event.endTime,
            //reminderTime: event.reminderTime,
            version: EVENTS_SHOWN_VERSION
        }

		markReminderTimeAsShown(event, strippedEvent, defaultEventNotificationTime);
		eventsShown.push(strippedEvent);
	}
}

function markReminderTimeAsShown(event, eventShown, defaultEventNotificationTime) {
	eventShown.startTime = event.startTime;
    eventShown.reminderTime ||= new Date(1);

	// dismiss any other reminders to this same event that might have come before
	const reminders = getEventReminders(event);
	if (reminders) {
		reminders.forEach(reminder => {
			if (reminder.method == "popup") {
				const reminderTime = getReminderTime(event, reminder, defaultEventNotificationTime);
				if (reminderTime.isEqualOrBefore() && reminderTime.isAfter(eventShown.reminderTime)) {
					eventShown.reminderTime = reminderTime;
				}
			}
		});
	}
}

async function getCalendarIdForAPIUrl(eventEntry) {
	var calendarId;
	
	if (eventEntry.calendar) { // legacy
		calendarId = eventEntry.calendar.id;
	} else if (eventEntry.calendarId) {
        calendarId = eventEntry.calendarId;
    } else {
        calendarId = await storage.get("defaultCalendarId") || "primary";
    }
	return calendarId;
}

function getCalendarIDFromURL(url) {
	if (url) {
		var str = "/feeds/";
		var idx = url.indexOf(str);
		if (idx != -1) {
			id = url.substring(idx+str.length);
			idx = id.indexOf("/");
			if (idx != -1) {
				return id.substring(0, idx);
			}
		}
	}
	return null;
}

async function getArrayOfCalendars(params = {}) {
    const cachedFeeds = await storage.get("cachedFeeds");
    const calendarList = cachedFeeds["calendarList"];
	if (calendarList?.items) {
        const calendars = calendarList.items.slice();

        if (params.includeTasks || (await oAuthForTasks.findTokenResponse(await storage.get("email")) && !params.excludeTasks)) {
            TASKS_CALENDAR_OBJECT.summary = getMessage("tasks");
            calendars.push(TASKS_CALENDAR_OBJECT);
        }

		calendars.sort((calendar1, calendar2) => {
			if (calendar1.primary) return -1;
			if (calendar2.primary) return +1;

            if (calendar1.id == CommonCalendarIds.FAMILY || calendar2.id == CommonCalendarIds.FAMILY) {
                // family calendar (WRITER) should be in first section of OWNER and sorted by names afterwards
            } else {
                if (calendar1.accessRole == CalendarAccessRole.OWNER && calendar2.accessRole != CalendarAccessRole.OWNER) {
                    return -1;
                } else if (calendar1.accessRole != CalendarAccessRole.OWNER && calendar2.accessRole == CalendarAccessRole.OWNER) {
                    return +1;
                }
            }
			
			const summary1 = getCalendarName(calendar1);
			const summary2 = getCalendarName(calendar2);
			
			if (summary1.toLowerCase() < summary2.toLowerCase()) return -1;
		    if (summary1.toLowerCase() > summary2.toLowerCase()) return +1;

		    return 0;
		});

        if (params.includeBirthdays && calendars.length) {
            BIRTHDAYS_CALENDAR_OBJECT.summary = getMessage("birthdays");
            // add it as 2nd item after primary calendar
            calendars.splice(1, 0, BIRTHDAYS_CALENDAR_OBJECT);
        }

        return calendars;
	} else {
        const tokenResponses = await oAuthForDevices.getTokenResponses();
        const tokenResponse = tokenResponses?.[0];

        if (tokenResponse && !canViewEventsAndCalendars(tokenResponse)) {
            return [{
                id: "primary",
                summary: tokenResponse.userEmail == DEFAULT_USER_EMAIL ? "Main Calendar" : tokenResponse.userEmail,
                owner: true,
                primary: true,
                selected: true,
                accessRole: CalendarAccessRole.OWNER
            }]
        } else {
            return [];
        }
	}
}

async function initCalendarMap() {
    const calendarMap = new Map();
    const arrayOfCalendars = await getArrayOfCalendars({
        includeBirthdays: true,
        includeTasks: true
    });
    arrayOfCalendars.forEach(calendar => {
        calendarMap.set(calendar.id, calendar);
    });
    return calendarMap;
}

function getCalendarById(id) {
	return calendarMap.get(id);
}

function getEventCalendar(event) {
    // sometimes happening don't know why
    if (!calendarMap) {
        console.warn("calendarmap not initiated");
        return {};
    }
	
    const calendarId = getEventCalendarId(event);

    const calendar = getCalendarById(calendarId);
    if (!calendar) {
        console.warn("could not get calendar for event: ", event);
    }

    return calendar;
}

function getEventCalendarId(event) {
	let calendarId;
	
	// legacy
	if (event.calendar) {
		calendarId = event.calendar.id;
	} else {
		calendarId = event.calendarId;
	}

    if (event.eventType == EventType.BIRTHDAY) {
        calendarId = BIRTHDAYS_CALENDAR_OBJECT.id;
    }

	return calendarId;
}

function getEventReminders(event) {
	let reminders;
	if (event.reminders) {
		if (event.reminders.useDefault) {
			reminders = getEventCalendar(event).defaultReminders;
		} else {
			reminders = event.reminders.overrides;
		}
	} else if (event.kind == TASKS_KIND) {
        reminders = getEventCalendar(event).defaultReminders;
    }
	return reminders;
}

function getReminderTime(event, reminder, defaultEventNotificationTime) {
	const reminderTime = new Date(event.startTime.getTime());

    // patch for all day events that erroneously return no reminders from the api (my code translates it to minutes = 0) ref: https://issuetracker.google.com/issues/36755676
    // refer to Business Activity Log for more info about new google calendar default behaviour
    // I instead use the checker plus option defaultEventNotificationTime to set a default before time
    if (event.allDay && reminder.minutes == 0) {
        reminderTime.setHours(defaultEventNotificationTime.getHours());
        reminderTime.setMinutes(defaultEventNotificationTime.getMinutes());
        return reminderTime;
    } else {
        return new Date(reminderTime.getTime() - (reminder.minutes * ONE_MINUTE));
    }
}

async function removeSnoozers(notifications) {
    var snoozers = await getSnoozers();
    
    notifications.forEach(notification => {
        // Remove IF from Snoozers
        for (var a=0; a<snoozers.length; a++) {
            var snoozer = snoozers[a];
            //console.log("snooze found")
            if (isSameEvent(notification.event, snoozer.event)) {
                //console.log("remove snooze")
                snoozers.splice(a, 1);
                a--;
                break;
            }
        }
    });

    await updateSnoozersInStorage(snoozers);
    return snoozers;
}

globalThis.debouncedSaveSync = debounce(saveSyncOperation, 1000);

async function updateSnoozersInStorage(snoozers) {
    console.trace("updateSnoozersInStorage", snoozers, globalThis.disableSnoozerStorageAndSync);

    if (!globalThis.disableSnoozerStorageAndSync) {
        await storage.set("snoozers", snoozers);

        if (await storage.get("syncDismissedAndSnoozedRemindersAcrossExtensions")) {
            try {
                const strippedSnoozers = snoozers.map(snoozer => {
                    const strippedSnoozer = serializeForChromeStorage({ ...snoozer });
                    if (strippedSnoozer.event) {
                        strippedSnoozer.event = stripEvent(snoozer.event);
                    }
                    return strippedSnoozer;
                });
                
                globalThis.debouncedSaveSync(SyncOperation.UPDATE_SNOOZERS, strippedSnoozers, {overrideTag: "snoozers"}).catch(error => {
                    console.error("error with saveSyncOperation2", error);
                });
            } catch (error) {
                console.error("error with sync in updateSnoozersInStorage", error);
            }
        }
    }
}

async function saveSyncOperation(action, data, params = {}) {
    // clean up old sync operations
    if (!params.overrideTag) {
        const allSyncKeys = Object.keys(await chrome.storage.sync.get(null));
        const syncOperationKeys = allSyncKeys.filter(key => key.startsWith(SYNC_OPERATION_PREFIX));

        if (syncOperationKeys.length > MAX_SYNC_OPERATIONS) {
            console.log("Cleaning up old sync operations...");
            const keysToRemove = {};
            syncOperationKeys.forEach(key => keysToRemove[key] = null);
            await chrome.storage.sync.remove(syncOperationKeys);
        }

        // clean up other sync data to make room for sync operations (priority)
        const syncQuota = await chrome.storage.sync.getBytesInUse();
        const syncQuotaLimit = chrome.storage.sync.QUOTA_BYTES;
        const syncUsagePercentage = (syncQuota / syncQuotaLimit) * 100;

        const maxSyncUsagePercentage = 70;
        if (syncUsagePercentage >= maxSyncUsagePercentage) {
            console.log("Sync storage usage is high, cleaning up old data...");
            const keysToRemove = [STORAGE_DETAILS_KEY];
            allSyncKeys.forEach(key => {
                if (key.startsWith(LOCALSTORAGE_CHUNK_PREFIX)) {
                    keysToRemove.push(key);
                }
            });

            if (keysToRemove.length > 0) {
                await chrome.storage.sync.remove(keysToRemove);
            }
        }
    }

    const storageKey = params.overrideTag ? `${SYNC_OPERATION_PREFIX}${params.overrideTag}` : `${SYNC_OPERATION_PREFIX}${Date.now()}`;
    chrome.storage.sync.set({
        [storageKey]: {
            version: SYNC_OPERATION_VERSION,
            uniqueId: await getUniqueExtensionId(),
            date: serializeForChromeStorage(new Date()),
            action: action,
            data: data,
        }
    }, function() {
        if (chrome.runtime.lastError) {
            console.error("Error saving sync operation: " + chrome.runtime.lastError.message);
        }
    });
}

function stripEvent(event) {
    let strippedEvent = { ...event };
    if (strippedEvent) {
        strippedEvent = {
            id: strippedEvent.id,
            calendarId: strippedEvent.calendarId
        };
    }
    return strippedEvent;
}

async function setSnoozeInMinutes(notifications, units) {
	// detect if snoozing minutes before event ie. -15, -10, -5 etc..
	if (units <= 0) {
		await setSnoozeDate({
			notifications: notifications,
			beforeStart: units
		});
	} else {
		const date = new Date(Date.now() + minutes(units));
		date.setSeconds(0, 0);
		await setSnoozeDate({
			notifications: notifications,
			time: date
		});
	}
}

async function setSnoozeInHours(notifications, units) {
	var date = new Date(Date.now() + hours(units));
	date.setSeconds(0, 0);
	await setSnoozeDate({
		notifications: notifications,
		time: date
	});
}

async function pushToSnoozers(newSnoozers, params, notification, event) {
    if (DetectClient.isFirefox() && params.time) {
        params.time = new Date(params.time.getTime());
    }
    newSnoozers.push({
        time: params.time,
        event: event,
        reminderTime: notification.reminderTime, // last # = minutes
        email: await storage.get("email")
    });
}

async function setSnoozeDate(params) {
    const newSnoozers = [];
    const defaultEventNotificationTime = await getDefaultEventNotificationTime();

    const updateEventPromises = [];
    const online = await isOnline();
    for (const notification of params.notifications) {

		// remove first then add again
        await removeSnoozers([notification]); // note array is passed

		const event = notification.event;

		if (params.beforeStart != undefined) {
			params.time = event.startTime.addMinutes(params.beforeStart);
		}

		// we don't want to change allday events to timed events let's keep using snoozers IF snoozing for less than a day
		if (await storage.get("snoozingChangesEventTime")
            && isCalendarWriteable(getEventCalendar(event))
            && online
            && (!event.allDay || params.wholeDays)) {

            let performUpdate;
            let patchFields;

            if (event.kind == TASKS_KIND) {
                patchFields = {
                    due: setTaskDueDate(params.time)
                }

                performUpdate = true;
            } else {
                const reminders = deepClone(getEventReminders(event)); // must clone or else calendar reminders in calendarMap were being modified
                if (reminders) {
                    // remove any passed reminders
                    for (let a=0; a<reminders.length; a++) {
                        const reminder = reminders[a];
                        if (reminder.method == "popup") {
                            const reminderTime = getReminderTime(event, reminder, defaultEventNotificationTime);
                            if (reminderTime.isEqualOrBefore(params.time)) {
                                reminders.splice(a, 1);
                                a--;
                            }
                        }
                    }
    
                    // add new reminder
                    // if after original time then change event time
                    if (params.time.isAfter(event.startTime)) {
                        changeTimesOfEventEntry(event, params.time);
                    }
                    reminders.push({
                        method: "popup",
                        minutes: event.startTime.diffInMinutes(params.time)
                    });
    
                    // update event
                    event.reminders.useDefault = false;
                    event.reminders.overrides = reminders;
    
                    // save event
                    patchFields = {
                        reminders: event.reminders
                    }
                    fillTimesForPatchFields(event, patchFields);

                    performUpdate = true;
                }
            }

            if (performUpdate) {
                const updateEventPromise = updateEvent({
                    event: event,
                    patchFields: patchFields,
                    skipRecurringEventPrompt: true
                }).then(response => {
                    // update event immediately in memory so that checkevents updates
                    return updateCachedFeed(event, {
                        operation: "update",
                        ignoreCheckEvents: true
                    });
                }).catch(async error => {
                    console.error("Could not update event, so using snoozer instead", error);
                    await pushToSnoozers(newSnoozers, params, notification, event);
                    throw error;
                });
                updateEventPromises.push(updateEventPromise);
            }
		} else {
            await pushToSnoozers(newSnoozers, params, notification, event);
		}
	}

	if (updateEventPromises.length) {
		await Promise.all(updateEventPromises).then(async () => {
            checkEvents({
                ignoreNotifications: true
            });
		}).catch(error => {
			showMessageNotification("Problem moving event, so just snoozing it.", "Could be connection issue.", error);
		});
	}

	if (newSnoozers.length) {
        let snoozers = await getSnoozers();
        snoozers = snoozers.concat(newSnoozers);
		await updateSnoozersInStorage(snoozers);
	}
}

async function getDefaultEventNotificationTime() {
    const defaultEventNotificationTime = await storage.get("defaultEventNotificationTime");
    return defaultEventNotificationTime.parseTime();
}

async function snoozeNotifications(snoozeParams, notifications) {
	if (snoozeParams.snoozeTime) {
		await setSnoozeDate({
			notifications: notifications,
			time: snoozeParams.snoozeTime
		});
	} else if (snoozeParams.inMinutes) {
		if (snoozeParams.inMinutes == 5 && await storage.get("testMode")) {
			snoozeParams.inMinutes = 1;
		}
		await setSnoozeInMinutes(notifications, snoozeParams.inMinutes);
	} else if (snoozeParams.inHours) {
		await setSnoozeInHours(notifications, snoozeParams.inHours);
	} else { // in days
		const daysToSnooze = snoozeParams.inDays;
		let snoozeToThisDay = new DateZeroTime();

        let wholeDays;
        if (daysToSnooze == 1.5) {
            wholeDays = false;
            snoozeToThisDay.setDate(snoozeToThisDay.getDate() + 1);
            snoozeToThisDay.setHours(12);
        } else {
            wholeDays = true;
            
            // v3 trying to set hours from options
            // v2 I haven't seen any issus with the 1.5 snooze using setHours so this issue might be fixed,
            // v1 commented because it was causing issues in isEventShownOrSnoozed with this line event.startTime.isBefore(eventShown.startTime)

            snoozeToThisDay = await getDefaultEventNotificationTime();
            snoozeToThisDay.setDate(snoozeToThisDay.getDate() + parseInt(daysToSnooze));
        }

		await setSnoozeDate({
			notifications: notifications,
			time: snoozeToThisDay,
			wholeDays: wholeDays
		});
	}

	const closeNotificationsParams = {
        lastAction: "snooze"
    };
	if (snoozeParams.source == "notificationButton") {
		closeNotificationsParams.source = "notificationButton";
	}
	
	closeNotifications(notifications, closeNotificationsParams);
}

async function getTimeElapsed(event) {
    const formatter = new Intl.RelativeTimeFormat(locale, {
        numeric: 'auto',
        style: "short"
    });

	let timeElapsedMsg = "";

    if (event.startTime) {
        const diffInDays = event.startTime.diffInDaysForHumans();
        if (event.allDay) {
            if (isYesterday(event.startTime)) {
                timeElapsedMsg = getYesterdayMessage();
            } else if (isTomorrow(event.startTime)) {
                timeElapsedMsg = getTomorrowMessage();
            } else if (!isToday(event.startTime)) {
                if (diffInDays % 7 == 0) {
                    timeElapsedMsg = formatter.format(diffInDays / 7, 'weeks');
                } else {
                    timeElapsedMsg = formatter.format(diffInDays, 'days');
                }
            }
        } else {
            const diffInMinutes = event.startTime.diffInMinutes();
            
            let diffInHours = diffInMinutes / 60;
            if (Math.abs(diffInHours) <= 2) {
                diffInHours = diffInHours.toFixed(1).replace(".0", "");
            } else {
                diffInHours = diffInHours.toFixed(0);
            }
            
            const startTimePrefix = `${new Date(event.startTime).toLocaleTimeStringJ(true)} • `;

            if (diffInDays >= 1) {
                if (isTomorrow(event.startTime)) {
                    timeElapsedMsg = `${startTimePrefix}${formatter.format(diffInDays, 'days')}`;
                } else {
                    timeElapsedMsg = formatter.format(diffInDays, 'days');
                }
            } else if (diffInHours >= 1) {
                timeElapsedMsg = `${startTimePrefix}${formatter.format(diffInHours, 'hours')}`;
            } else if (diffInMinutes >= 1) {
                timeElapsedMsg = `${startTimePrefix}${formatter.format(Math.ceil(diffInMinutes), 'minutes')}`;
            } else if (diffInMinutes >= -2) {
                // Just happened so do nothing
            } else if (diffInMinutes > -60) {
                timeElapsedMsg = formatter.format(Math.ceil(diffInMinutes), 'minutes');
            } else if (isYesterday(event.startTime)) {
                timeElapsedMsg = getYesterdayMessage();
            } else if (diffInDays > -1) {
                timeElapsedMsg = formatter.format(diffInHours, 'hours');
            } else {
                timeElapsedMsg = formatter.format(diffInDays, 'days');
            }
        }
    }
	
	return timeElapsedMsg;
}

async function getSelectedCalendarsInGoogleCalendar() {
    const arrayOfCalendars = await getArrayOfCalendars();
    return arrayOfCalendars.reduce((filtered, calendar) => {
        if (calendar.selected) {
            filtered.push(calendar);
        }
        return filtered;
    }, []);
}

function isCalendarSelectedInExtension(calendar, email, selectedCalendars) {
	if (calendar) {
		// new added because we were fetching events for weather, week numbers etc. which were never used in the display of new looks (or old looks for that matter because they don't use the feed data- just the embed calendar)
		if (!isGadgetCalendar(calendar)) {
			if (selectedCalendars && selectedCalendars[email]) {
				const selected = selectedCalendars[email][calendar.id];
				// if previously defined than return that setting
				if (typeof selected != "undefined") {
					return selected;
				} else { // never defined so use default selected flag from google calendar settings
                    if (calendar.id == BIRTHDAYS_CALENDAR_OBJECT.id) {
                        return true; // default to true for bday calendar
                    } else {
                        return calendar.selected;
                    }
				}
			} else {
				// never defined so use default selected flag from google calendar settings
				return calendar.selected;
			}			
		}
	}
}

function getCalendarName(calendar) {
	// see if user renamed the original calendar title
	if (calendar.summaryOverride) {
		return calendar.summaryOverride;
	} else {
		return calendar.summary;
	}
}

function getCalendarAttendee(event) {
	return event.attendees?.find(attendee => attendee.self);
}

function hasUserDeclinedEvent(event) {
    return getCalendarAttendee(event)?.responseStatus == AttendingResponseStatus.DECLINED;
}

function hasUserRespondedToEvent(event) {
	const currentUserAttendeeDetails = getCalendarAttendee(event);
	if (!currentUserAttendeeDetails || currentUserAttendeeDetails.responseStatus != AttendingResponseStatus.NEEDS_ACTION) {
		return true;
	}
}

function hasUserRespondedYesOrMaybeToEvent(event) {
	const currentUserAttendeeDetails = getCalendarAttendee(event);
	if (!currentUserAttendeeDetails || (currentUserAttendeeDetails.responseStatus == AttendingResponseStatus.ACCEPTED || currentUserAttendeeDetails.responseStatus == AttendingResponseStatus.TENTATIVE)) {
		return true;
	}
}

function passedRemindOnRespondedEventsOnly(event, calendarSettings) {
	if (!calendarSettings.remindOnRespondedEventsOnly || hasUserRespondedYesOrMaybeToEvent(event)) {
		return true;
	}
}

function passedBirthdayCalendarTest(event, email, selectedCalendars) {
    return event.eventType != EventType.BIRTHDAY || (event.eventType == EventType.BIRTHDAY && isCalendarSelectedInExtension(BIRTHDAYS_CALENDAR_OBJECT, email, selectedCalendars));
}

function passedShowDeclinedEventsTest(event, showDeclinedEvents) {
	return showDeclinedEvents || showDeclinedEvents == undefined || (showDeclinedEvents == false && !hasUserDeclinedEvent(event));
}

function passedHideInvitationsTest(event, hideInvitations) {
	return !hideInvitations || hasUserRespondedToEvent(event);
}

function passedVisibilityTests(event, email, showDeclinedEvents, hideInvitations, selectedCalendars) {
    return passedShowDeclinedEventsTest(event, showDeclinedEvents) && passedHideInvitationsTest(event, hideInvitations) && passedBirthdayCalendarTest(event, email, selectedCalendars);
}

function getEventSource(event, useDescription = true) {
	let source = {};
	
	if (event.source) {
		source = event.source;
	} else {
		// look for link in description and use it as source
		if (useDescription && event.description) {
			const matches = event.description.match(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i);
			if (matches) {
                let link = matches[0].trim();
				if (link) {
                    // patch for this issue: https://github.com/gregjacobs/Autolinker.js/issues/47
                    link = link.split("&nbsp;")[0];
                    
					let title;
					if (link.match("https?://mail.google.com")) {
						title = event.summary;
                    } else if (event.location && link.match("https?://maps.google.com")) {
                        // removing possible duplicate google maps links in location and source, ref: https://calendar.google.com/calendar/u/0/r/eventedit/NDR0cHU4bTQycWpoNjczdjFqcTg3ZjRpbWIgZGtlYTE4N3JibXM5ZjJmMGphOTF1bGhtY29AZw
                        return null;
					} else {
						title = link.replace(/(www.)?/g, "");
					}
					source = {url:link, title:title};
				}
			}
		}
	}
	
	if (source.url) {
		source.title ||= "Open URL";
		if (source.url.match("https?://mail.google.com")) {
			source.isGmail = true;
		}
		return source;
	} else {
		return null;
	}
}

function isMeetingLink(url) {
    if (url) {
        return url.includes(".zoom.us") ||
            url.includes("//zoom.us") ||
            url.includes(".recordzoom.us") ||
            url.includes(".zoomgov.com") ||
            url.includes(".meet.google") ||
            url.includes(".teams.microsoft.com") ||
            url.includes(".gotowebinar.com") ||
            url.includes(".gotomeeting.com") ||
            url.includes(".gotomeet.me") ||
            url.includes(".webex.com")
        ;
    }
}

function getMeetingLink(str) {
    // teams microsoft, seems sometimes there links had 4 slashes https:////
    const matches = str?.match(/https?:\/\/\/?\/?teams\.microsoft\.com[^">]*/i); // removed /g to fetch regex groups
    if (matches && matches[0]) {
        return matches[0].replace("https:////", "https://");
    } else {
        const obj = formatMeetingLinks(str);
        if (obj.firstMeetingUrl) {
            return obj.firstMeetingUrl;
        }
    }
}

function formatMeetingLinks(str) {
    const matches = str?.match(/<https.+?>/g);
    console.log("matches", matches);

    let firstMeetingUrl;

    matches?.forEach(match => {
        let newStr;
        
        if (match.includes("<https: ")) {
            // Search for Microsoft Teams links ie. Click here to join the meeting<https: teams.microsoft.com="" l="" meetup-join="" 19%3ameeting_njdimtfmyjytntfhmy00mdfklwexztutndjlzdgwzdu2m2i3%40thread.v2="" 0?context="%7b%22Tid%22%3a%2259185728-a5f6-4629-bfc4-3c833d60489a%22%2c%22Oid%22%3a%22e842bfbb-ca3b-4f1e-86c8-6646cca6751b%22%7d">
            newStr = match.replace("<https: ", " -> <a href='https://");
            newStr = newStr.replaceAll("=\"\" ", "/");
            newStr = newStr.replaceAll("\"", "");
        } else {
            newStr = match.replace("<https:", " -> <a href='https://");
        }
        newStr = newStr.replace(/\>$/, "\'\>link</a>");

        if (!firstMeetingUrl) {
            const urlMatch = newStr.match(/href='(.*?)'/);
            const url = urlMatch ? urlMatch[1] : null;
            if (isMeetingLink(url)) {
                firstMeetingUrl = url;
            }
        }

        // user complained of this error: RangeError: Invalid string length at String.replace
        // ai says it's possible Memory Limitations or Infinite Loop
        try {
            str = str.replaceAll(match, newStr);
        } catch (error) {
            console.warn("could not replace match", error);
        }
    });

    return {
        str: str,
        firstMeetingUrl: firstMeetingUrl
    }
}

function usefulLocation(event) {
    return event.location && event.location != "Microsoft Teams Meeting" && event.location != "Réunion Microsoft Teams";
}

async function getVideoMeetingDetails(event, anyConferenceLink) {
    if (event.conferenceData?.conferenceSolution) {
        let video = event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "video");
        if (anyConferenceLink) {
            video ||= event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "phone");
            video ||= event.conferenceData.entryPoints.find(entryPoint => entryPoint.entryPointType == "more");
        }

        if (video) {
            let label;

            if (event.conferenceData.conferenceSolution.name) {
                label = getMessage("joinWithX", event.conferenceData.conferenceSolution.name);
            } else {
                label = getMessage("joinVideoCall");
            }

            return {
                conferenceVideo: video,
                videoUrl: maybeSetAuthUser(event, video.uri, await storage.get("email")),
                label: label
            }
        }
    }

    let otherVideoUrl;
    
    if (usefulLocation(event) && isMeetingLink(event.location)) {
        otherVideoUrl = event.location;
    }

    otherVideoUrl ||= getMeetingLink(event.description);

    const hangoutLink = event.hangoutLink;
    const zoomMeetingId = event.extendedProperties?.shared?.zmMeetingNum;

    if (hangoutLink) {
        return {
            hangoutLink: true,
            videoUrl: hangoutLink,
            label: getMessage("joinVideoCall")
        }
    } else if (zoomMeetingId) {
        return {
            zoomMeetingId: zoomMeetingId,
            videoUrl: `https://zoom.us/j/${zoomMeetingId}`,
            label: getMessage("joinWithX", "Zoom")
        }
    } else if (otherVideoUrl) {
        return {
            otherVideo: true,
            videoUrl: otherVideoUrl,
            label: getMessage("joinVideoCall")
        }
    }
}

function getConferenceCodes(str, entryPoint) {
    if (entryPoint.meetingCode) {
        if (str) {
            str += "<br>";
        }
        str += `ID: ${entryPoint.meetingCode}`;
    }
    if (entryPoint.accessCode) {
        if (str) {
            str += "<br>";
        }
        str += `Access code: ${entryPoint.accessCode}`;
    }
    if (entryPoint.passcode) {
        if (str) {
            str += "<br>";
        }
        str += `Passcode: ${entryPoint.passcode}`;
    }
    if (entryPoint.password) {
        if (str) {
            str += "<br>";
        }
        str += `Password: ${entryPoint.password}`;
    }
    if (entryPoint.pin) {
        if (str) {
            str += "<br>";
        }
        str += `${getMessage("PIN")}: ${entryPoint.pin}`;
    }
    return str;
}

function getNotification(notificationsOpened, notificationId) {
    return notificationsOpened.find(notificationOpened => notificationOpened.id == notificationId);
}

async function isGroupedNotificationsEnabled() {
	return await storage.get("notificationGrouping") == "groupNotifications";
}

function isColorTooLight(color, luminosity) {
    if (!color) {
        return false;
    }

    if (color == "black") {
        return false;
    } else if (color == "white") {
        return true;
    }

	let rgb = hexToRgb(color);
    if (!rgb) {
        // convert rgb(r, g, b) or rgba(r, g, b, a) to array
        if (Array.isArray(color)) {
            rgb = color;
        } else {
            rgb = color.match(/\d+/g);
            if (rgb) {
                rgb = rgb.map(Number);
            }
        }
    }

	if (rgb) {
		let l = rgbToHsl(rgb[0], rgb[1], rgb[2])[2];

        if (luminosity) {
            if (l >= luminosity) {
                return true;
            }
        } else {
            let isYellow = rgb[0] == 255 && rgb[1] == 253 && rgb[2] == 33; // refer to https://jasonsavard.com/forum/discussion/comment/19187#Comment_19187
            if (l >= 0.85 || isYellow) {
                return true;
            }
        }
	}
}

function getEventColors(params) { // event, darkenColorFlag, cachedFeeds, arrayOfCalendars
	let bgColor;
    const colors = params.cachedFeeds["colors"];
    const event = params.event;

	if (event) {
		if (event.colorId && colors) {
			bgColor = colors.event[event.colorId].background;
		} else {
            const calendar = getEventCalendar(event);
            if (calendar) {
                if (calendar.backgroundColor) {
                    bgColor = calendar.backgroundColor;
                } else {
                    if (calendar.colorId) {
                        bgColor = colors.calendar[calendar.colorId].background;
                    } else {
                        bgColor = "black";
                    }
                }
            } else {
                console.warn("couldn't get calendar for event", event);
                bgColor = "black";
            }
		}
	} else {
		const primaryCalendar = getPrimaryCalendar(params.arrayOfCalendars);
		bgColor = primaryCalendar.backgroundColor;
	}
	
	if (params.darkenColorFlag) {
		// if anything close to white then change it to black (because we can't see it on a white background remindersWindow and notification window
		if (!bgColor || bgColor == "white" || bgColor == "#fff" || bgColor == "#ffffff") {
			bgColor = "black";
		} else {
			bgColor = darkenColor(bgColor);
		}
		return bgColor;
	} else {
		const response = {};
		if (globalThis.blackFontEvents) {
			response.bgColor = bgColor;
		} else {
			response.bgColor = convertToGoogleCalendarColor(bgColor);
		}

		// if (l)uminosity to bright then use a dark foreground color
		if (isColorTooLight(response.bgColor)) {
			response.fgColor = "black";
		} else {
			response.fgColor = "white";
		}
		return response;
	}
}

async function hasRemindersHeader(notifications) {
	return (notifications.length >= 2 || await shouldShowReducedDonationMsg(true)) && !await storage.get("hideReminderHeader");
}

async function getReminderWindowParams(params) {
    const notifications = params.notifications || globalThis.notificationsOpened || await storage.get("notificationsOpened");
    
    const TOP_TITLE_BAR_HEIGHT_DEFAULT = 31;
    const TOP_TITLE_BAR_HEIGHT_NEWER_WINDOWS = 40;
    const TOP_TITLE_BAR_HEIGHT_MAC = 27; // old Mac OS 22
    const TOP_TITLE_BAR_HEIGHT_LINUX = 22; // guessed
    
    const notificationCount = Math.min(notifications.length, ReminderWindow.MAX_NOTIFICATIONS);
    
    let topTitleSpace;
    if (DetectClient.isWindows()) { // DetectClient.isNewerWindows()
        topTitleSpace = TOP_TITLE_BAR_HEIGHT_NEWER_WINDOWS;
    } else if (DetectClient.isMac()) {
        topTitleSpace = TOP_TITLE_BAR_HEIGHT_MAC;
    } else if (DetectClient.isLinux()) {
        topTitleSpace = TOP_TITLE_BAR_HEIGHT_LINUX;
    } else {
        topTitleSpace = TOP_TITLE_BAR_HEIGHT_DEFAULT;
    }
    let height = (notificationCount * ReminderWindow.NOTIFICATION_HEIGHT) + topTitleSpace + ((notificationCount + 1) * ReminderWindow.MARGIN);
    
    // more than 2 show dismiss all and so make popup higher
    if (await hasRemindersHeader(notifications)) {
        height += ReminderWindow.HEADER;
    }
    
    let windowState;
    let width = 510;

    const notificationWindowSize = await storage.get("notificationWindowSize");

    const zoomFactor = await getZoomFactor();
    
    if (notificationWindowSize == "auto" && zoomFactor) {
        // enlarge if using zoom
        windowState = "normal";
        width *= zoomFactor;
        height *= zoomFactor;
    } else {
        if (notificationWindowSize == "auto") {
            windowState = "normal";
        } else {
            windowState = notificationWindowSize;
        }
    }
    
    // Passing params by backgroud instead of postmessage or chrome message refer below for bug
    await storage.set("_reminderWindowNotifications", notifications);

    let position = await getCenterWindowPosition(width, height);

    const BUFFER = 20; // seems there was always 1px difference from get/setting
    // check if window was moved by verifying the left position and then retoast the window there
    if (params.previousReminderWindow && Math.abs(position.left - params.previousReminderWindow.left) > BUFFER) {
        position.left = params.previousReminderWindow.left;
        position.top = params.previousReminderWindow.top;
    } else {
        // push up a bit because when we open date picker it clips at bottom
        position.top -= 20;
    }

    //var str = Math.floor(Math.random() * 2) == 0 ? "reminders.html" : "test.html";
    
    const newState = await chrome.idle.queryState(15);
    let url = chrome.runtime.getURL("reminders.html");
    if (params.closeWindowGuide) {
        url += "?closeWindowGuide=true";
    }
    
    const windowParams = {
        url:	url,
        type:	"popup",
        state:	windowState
    };

    if (windowState != "minimized" && windowState != "maximized") {
        windowParams.width = Math.round(width);
        windowParams.height = Math.round(height);
        windowParams.left = position.left;
        windowParams.top = position.top;

        if (DetectClient.isChromium()) {
            // if user not doing anything for 15 seconds than let's interupt and put the focus on the popup
            if (params.useIdle) {
                if (await storage.get("onlyInterruptIfIdle")) {
                    windowParams.focused = (newState != "active");
                } else {
                    try {
                        const response = await chrome.runtime.sendMessage({
                            command: "getPopupDetails"
                        });
                        if (!response?.fromToolbar) {
                            // don't interupt if user is interacting in popup window from toolbar
                            windowParams.focused = true;    
                        }
                    } catch (error) {
                        console.warn("error getting popup details", error);
                        windowParams.focused = true;
                    }
                }
            } else {
                windowParams.focused = true;
            }
        }
    }

    console.log("windowParams", windowParams);
    return windowParams;
}

// must be declared in global file because when called from bg.openSnoozePopup (the context of the window/screen might be skewed because it takes debugger settings like mobile resolution etc.)
async function openReminders(params = {}) {
    await storage.disable("_remindersWindowClosedByDismissingEvents");
    
    const reminderWindowId = await storage.get("reminderWindowId");
    if (reminderWindowId) {
        try {
            params.previousReminderWindow = await chrome.windows.get(reminderWindowId);
        } catch (error) {
            console.warn("reminder window might not exist", error);
        }
    }
    
    await closeReminders(reminderWindowId);

    const createWindowParams = await getReminderWindowParams(params);
    const newWindow = await createWindow(createWindowParams);
    await storage.set("reminderWindowId", newWindow.id);
    sendMessageToBG("forgottenReminder.start");

    /*
        * commented out because onload or sometimes postmessage would not be sent when when called from the popup window, note: it would work when called from the notification window
    bg.snoozePopup.onload = function () {
        // seems window object doesn't exist when called from popup etc. so let's use the bg.window 
        bg.snoozePopup.postMessage({notifications:notifications}, bg.window.location.href);
    }
    */
}

async function closeReminders(reminderWindowId) {
    reminderWindowId ||= await storage.get("reminderWindowId");
    if (reminderWindowId) {
        try {
            await chrome.windows.remove(reminderWindowId);
            await storage.remove("reminderWindowId");
        } catch (error) {
            console.warn("close reminders: " + error);
        }
    }
}

function sortNotifications(notifications) {
    notifications.sort((a, b) => {
        if (a.recent && !b.recent) {
            return -1;
        } else if (!a.recent && b.recent) {
            return +1;
        } else {
            if (!a.event.allDay && b.event.allDay) {
                return -1;
            } else if (a.event.allDay && !b.event.allDay) {
                return +1;
            } else {
                if (a.event.startTime.getTime() > b.event.startTime.getTime()) {
                    return -1;
                } else {
                    return +1;
                }
            }
        }
    });
}

function isGmailExtension(id) {
    return [
        ExtensionId.ChromeStoreGmail,
        ExtensionId.EdgeStoreGmail,
        ExtensionId.FirefoxStoreGmail,
        ExtensionId.LocalGmail
    ].includes(id);
}

async function sendMessageToGmailExtension(message) {
    const response = await chrome.runtime.sendMessage(gmailExtensionId, message);
    console.log("response", response);
    return response;
}

async function sendMessageToDriveExtension(message) {
    const response = await chrome.runtime.sendMessage(driveExtensionId, message);
    console.log("response", response);
    return response;
}

async function setDNDEndTime(endTime, fromOtherExtension) {
	await storage.set("DND_endTime", endTime);
	updateBadge();
	
	// !!! Important if this was sent from Gmail or other extension then do not send back or eternal sendMessage loop will occur
	if (!fromOtherExtension && await storage.get("syncDND")) {
		sendMessageToGmailExtension({action:"setDNDEndTime", endTime:endTime.toJSON()}).catch(error => {});
        sendMessageToDriveExtension({action:"setDNDEndTime", endTime:endTime.toJSON()}).catch(error => {});
	}
}

async function setDND_off(fromOtherExtension) {
	if (await storage.get("DND_endTime")) {
		await storage.remove("DND_endTime");
	} else {
		await storage.remove("DND_schedule");
	}
	updateBadge();
	
	if (!fromOtherExtension && await storage.get("syncDND")) {
		sendMessageToGmailExtension({action:"turnOffDND"}).catch(error => {});
        sendMessageToDriveExtension({action:"turnOffDND"}).catch(error => {});
	}
}

function setDND_minutes(minutes) {
	var dateOffset = new Date();
	dateOffset.setMinutes(dateOffset.getMinutes() + parseInt(minutes));
	setDNDEndTime(dateOffset);
}

function setDND_today() {
	setDNDEndTime(tomorrow());
}

function openDNDScheduleOptions() {
	openUrl("options.html?highlight=DND_schedule");
}

function openDNDOptions() {
	openUrl("options.html#dnd");
}

function setDND_indefinitely() {
	var farOffDate = new Date();
	farOffDate.setYear(2999);
	setDNDEndTime(farOffDate);
}

async function isDND() {
	return await isDNDbyDuration() || await isDNDbySchedule();
}

async function isDNDbyDuration() {
	const endTime = await storage.get("DND_endTime");
	return endTime?.isAfter();
}

async function isDNDbySchedule() {
	if (await storage.get("DND_schedule")) {
		var today = new Date();
		let timetable = await storage.get("DND_timetable");
		if (timetable && timetable[today.getDay()][today.getHours()]) {
			return true;
		}
	}
}

function generateLocationUrl(event) {
	var url;
	if (event.location.match("^https?://")) {
		url = event.location;
	} else {
		url = "https://maps.google.com/maps?q=" + encodeURIComponent(event.location) + "&source=calendar";
	}
	return url;
}

async function openGoogleCalendarWebsite() {
    const params = {};
    const email = await storage.get("email");

	if (await storage.get("openExistingCalendarTab")) {
		params.urlToFind = Urls.CALENDAR;
	}
	
	await openUrl(setUrlParam(Urls.CALENDAR, "authuser", email), params);
}

async function openEventUrl(event, email) {
    const url = getEventUrl(event, email);
    if (url) {
        let response = await findTab(`${Urls.CALENDAR}*${event.id}`);
        if (!response) {
            response = await findTab(`${Urls.CALENDAR}`);
            if (response?.tab) {
                chrome.tabs.update(response.tab.id, {
                    active: true,
                    url: url
                });
            } else {
                // if the url didn't open then let's try to open the calendar website
                openUrl(url);
            }
        }
    }
}

function generateTimeDurationStr(params) {
	const event = params.event;
	
	let str = "";
	const startTime = new Date(event.startTime);
	let endTime;
	if (event.endTime) {
		endTime = new Date(event.endTime);
	}

    let dateFormatOptions = getDateFormatOptions({
        showYear: startTime.getFullYear() !== new Date().getFullYear(),
        compact: params.compact || false
    });

    let startDateStr = startTime.toLocaleDateString(locale, dateFormatOptions);

    // Chrome and new Edge supported as of May 12th, NOT Firefox
    const supportsFormatRange = "Intl" in globalThis && Intl.DateTimeFormat.prototype.formatRange;

    if (event.allDay) {
        if (!endTime || Math.round(startTime.diffInDays(endTime)) == -1) {
            if (params.compact && (startTime.isToday() || startTime.isTomorrow())) {
                str = "";
            } else {
                str = startDateStr;
            }
        } else {
            endTime.setDate(endTime.getDate()-1);
            if (supportsFormatRange) {
                const formatter = new Intl.DateTimeFormat(locale, dateFormatOptions);
                try {
                    str = formatter.formatRange(startTime, endTime);
                } catch (error) {
                    console.warn("could not use formatRange", error);
                    str = startDateStr + " - " + endTime.toLocaleDateStringJ();
                }
            } else {
                str = startDateStr + " - " + endTime.toLocaleDateStringJ();
            }
        }
    } else {
        if (params.hideStartDay || (params.compact && startTime.isToday()) || !supportsFormatRange) {
            if (endTime) {
                if (endTime.diffInHours(startTime) < 24) {
                    str += `${startTime.toLocaleTimeStringJ()} - ${endTime.toLocaleTimeStringJ()}`;
                } else {
                    str += `${startTime.toLocaleTimeStringJ()} - ${endTime.toLocaleStringJ()}`;
                }
            } else {
                str = startTime.toLocaleTimeStringJ();
            }
        } else {
            if (endTime) {
                const formatter = new Intl.DateTimeFormat(locale, {...dateFormatOptions, ...getTimeFormatOptions()});
                str = formatter.formatRange(startTime, endTime);
                // patch for fr-FR ex. jeudi 21 mai 'à' 7:00 PM – 8:00 PM
                str = str.replace(" 'à' ", " à ");
            } else {
                str = `${startDateStr} ${startTime.toLocaleTimeStringJ()}`;
            }
        }
    }

    return str;
}

async function modifyRecurringEventUntilStartTime(event, recurrence, sendNotifications) {
    let until = event.startTime.addDays(-1);
    if (event.allDay) {
        until = formatDateTo8Digits(until);
    } else {
        until = until.toISOString().replace(/[-:]/g, "").replace(/\.[0-9]+/, "");
    }
    const newRule = recurrence.map(rule => {
        if (rule.startsWith("RRULE:")) {
            if (rule.includes("UNTIL=")) {
                rule = rule.replace(/UNTIL=[^;]+/, `UNTIL=${until}`);
            } else {
                rule = rule.replace("RRULE:", `RRULE:UNTIL=${until};`);
            }
        }
        return rule;
    });

    let url = `/calendars/${encodeURIComponent(event.calendarId)}/events/${event.recurringEventId}`;
    if (sendNotifications) {
        url = setUrlParam(url, "sendUpdates", "all");
    }

    const response = await oauthDeviceSend({
        type: "patch",
        url: url,
        data: {
            recurrence: newRule
        }
    });

    return response;
}

async function deleteEvent(event, sendNotifications, recurringEvent) {
    let response;
    
    if (event.kind == TASKS_KIND) {
        const taskList = getTaskList(event);
        response = await oauthDeviceSend({
            type: "DELETE",
            url: `${TASKS_BASE_URL}/lists/${taskList.id}/tasks/${event.id}`
        }, oAuthForTasks);
    } else {
        globalThis.hideProgress?.();
        response = await ensureRecurringEventPrompt({event:event});
        
        if (response.cancel) {
            return response;
        }
    
        globalThis.showProgress?.();
        if (response.thisAndFollowingEvents) {
            response = await modifyRecurringEventUntilStartTime(event, recurringEvent.recurrence, sendNotifications);
            response.thisAndFollowingEvents = true;
        } else {
            // save this for inner response below
            const changeAllRecurringEvents = response.changeAllRecurringEvents;
            
            let url = `/calendars/${encodeURIComponent(await getCalendarIdForAPIUrl(event))}/events/${changeAllRecurringEvents ? event.recurringEventId : event.id}`;
            if (sendNotifications) {
                url = setUrlParam(url, "sendUpdates", "all");
            }
            
            try {
                response = await oauthDeviceSend({
                    type: "DELETE",
                    url: url
                });
                response.changeAllRecurringEvents = changeAllRecurringEvents;
            } catch (error) {
                if (error.code == 410) {
                    console.info("already deleted so just removing");
                    response = {};
                } else {
                    throw error;
                }
            }
        }
    }

    await updateCachedFeed(event, {operation: "remove"});

    return response;
}

async function updateCachedFeed(event, params) {
    const calendarId = getEventCalendarId(event);
    
    // remove from cachedfeeds
    let modifiedCachedFeeds;
    const cachedFeeds = params.cachedFeeds || await storage.get("cachedFeeds");
    const calendar = cachedFeeds[calendarId];
    if (calendar) {
        if (params.operation == "add") {
            calendar.items.push(event);
            modifiedCachedFeeds = true;
        } else {
            modifiedCachedFeeds = calendar.items.some((cachedEvent, index) => {
                if (cachedEvent.id == event.id) {
                    if (params.operation ==  "remove") {
                        console.log("removed from cachedfeeds");
                        calendar.items.splice(index, 1);
                    } else if (params.operation == "update") {
                        calendar.items[index] = event;
                    } else {
                        throw Error("Operation not found in updateCachedFeed: " + params.operation);
                    }
                    return true;
                }
            });
        }
    }
    
    if (modifiedCachedFeeds) {
        await storage.set("cachedFeeds", cachedFeeds).then(async () => {

            // do this only for tasks because the other feeds will perform a partial sync
            // add this because when I would delete a task and then create an event and then undo, it would run a delay 1 minute polling and overwrite the cachedFeeds from the background (not from storage)
            if (calendarId == TASKS_CALENDAR_OBJECT.id) {
                await sendMessageToBG("reInitCachedFeeds");
            }
            
            if (!params.ignoreCheckEvents) {
                sendMessageToBG("checkEvents", {ignoreNotifications: true});
            }
        });
    }
}

function parseEventDates(event) { 
	// Patch for Date objects because they are not stringified as an object AND remove old events
    if (event.created) {
        event.created = parseDate(event.created);
    }

    event.startTime = parseDate(event.startTime);
	if (event.endTime) {
		event.endTime = parseDate(event.endTime);
	}
	if (event.reminderTime) {
        event.reminderTime = parseDate(event.reminderTime);
	} else {
		event.reminderTime = new Date(1);
	}
}

function initEventDates(theseEvents) {
	var event;
	for (var a=0; event=theseEvents[a], a<theseEvents.length; a++) {
		if (event.startTime) {
			parseEventDates(event);
			if (event.startTime?.isBefore(today().subtractDays(DAYS_TO_REMOVE_OLD_EVENTS))) { // last # = days
				console.log("removed old event: " + event.id + " " + event.startTime);
				theseEvents.splice(a, 1);
				a--;
			}
		} else {
			//console.log("ignore non reminder event: " + getSummary(event), event);
			//theseEvents.splice(a, 1);
			//a--;
		}
	}
}

function findEvent(event, events) {
    // used because some events have same ids recurring events that are busy and also invited refer to bug: https://jasonsavard.com/forum/discussion/comment/21136/#Comment_21136
    let theEvent = events.find(thisEvent => thisEvent.id == event.id && thisEvent.calendarId == event.calendarId);

    if (!theEvent) {
        console.warn("user might have changed calendar of event after being snoozed, so let's just look for event id");
        theEvent = events.find(thisEvent => thisEvent.id == event.id);
    }

    return theEvent;
}

function isCurrentlyDisplayed(event, notificationsQueue) {
    return notificationsQueue.some(notification => isSameEvent(notification.event, event));
}

async function getSnoozers(theseEvents) {
    const snoozers = await storage.get("snoozers");
    if (snoozers.length) {
        const events = (theseEvents || globalThis.events || await getEvents());
        snoozers.forEach(snoozer => {
            const event = findEvent(snoozer.event, events);
            if (event) {
                snoozer.event = event;
            } else {
                // when an event calendar is changed, gcm removes event from original calendar and another gcm updates event with new calendar
                console.warn("event possibly removed from calendar but not yet added to other more info in comments");
            }
        });
    }
    return snoozers;
}

//get future snoozes, includeAlreadyShown
async function getFutureSnoozes(snoozers, params = {}) {
    const notificationsQueue = await storage.get("notificationsQueue");
	const futureSnoozes = [];
	snoozers.forEach(snoozer => {
		if ((!snoozer.email || snoozer.email == params.email) && snoozer.time.getTime() >= Date.now()) {
			if ((params.includeAlreadyShown || !isCurrentlyDisplayed(snoozer.event, notificationsQueue))) {
				if (!snoozer.time.isToday() || (snoozer.time.isToday() && !params.excludeToday)) {
					snoozer.isSnoozer = true;
					futureSnoozes.push(snoozer);
				}
			}
		}
	});
	return futureSnoozes;
}

function getEventUrl(event, email) {
    const url = event?.htmlLink ?? Urls.CALENDAR;
    return setUrlParam(url, "authuser", email || globalThis.email);
}

async function getBadgeIconUrl(state, keepDate) {
    state ||= "";
	
	let badgeIcon = await storage.get("badgeIcon") || "default";
	
    if (badgeIcon == "custom") {
        return await storage.get("customButtonIcon");
    } else {
        let withDateStr;
        if (keepDate) {
            withDateStr = badgeIcon;
        } else {
            if (badgeIcon == "default3WithDate") {
                badgeIcon = "default";
            }
            withDateStr = badgeIcon.replace("WithDate", "")
        }
        
        let prefix;
        if (badgeIcon == "default") {
            prefix = Icons.BadgeIcon38Prefix;
        } else {
            prefix = Icons.BadgeIcon19Prefix;
        }

        return `${prefix}${withDateStr}${state}${Icons.BadgeIconSuffix}`;
    }
}

function getUserFriendlyReminderTime(minutes, allDay, patchForAllDayBeforeXTime) {
    let obj;

    // if larger than a week AND it's a multiple of 7 days, because we don't want 10 days to equal 1.45 weeks
	if (minutes >= WEEK_IN_MINUTES && minutes % WEEK_IN_MINUTES == 0) {
        obj = {
            value: minutes / WEEK_IN_MINUTES,
            period: "weeks"
        }
	} else if ((minutes >= DAY_IN_MINUTES && minutes % DAY_IN_MINUTES == 0) || (allDay && minutes == 0)) {
        obj = {
            value: minutes / DAY_IN_MINUTES,
            period: "days"
        }
    } else if (minutes >= (WEEK_IN_MINUTES - DAY_IN_MINUTES) && allDay && patchForAllDayBeforeXTime) {
        // ex. 1 week before at 9am
        const weeks = Math.ceil(minutes / WEEK_IN_MINUTES);
        obj = {
            value: weeks,
            period: "weeks",
            beforeTime: WEEK_IN_MINUTES % minutes
        }
    } else if (minutes >= (DAY_IN_MINUTES - HOUR_IN_MINUTES) && allDay && patchForAllDayBeforeXTime) {
        // ex. 2 days before at 9am
        const days = Math.ceil(minutes / DAY_IN_MINUTES);
        obj = {
            value: days,
            period: "days",
            beforeTime: DAY_IN_MINUTES - (minutes % DAY_IN_MINUTES)
        }
	} else if (minutes >= HOUR_IN_MINUTES && minutes % HOUR_IN_MINUTES == 0) {
        if (allDay && patchForAllDayBeforeXTime) {
            // ex. 1 day before at 9am
            obj = {
                value: 1,
                period: "days",
                beforeTime: DAY_IN_MINUTES - minutes // used to be % minutes
            }
        } else {
            obj = {
                value: minutes / HOUR_IN_MINUTES,
                period: "hours"
            }
        }
	} else if (allDay && patchForAllDayBeforeXTime) {
        obj = {
            value: 1,
            period: "days",
            beforeTime: DAY_IN_MINUTES - minutes
        }
    } else {
        obj = {
            value: minutes,
            period: "minutes"
        }
    }
    
    return obj;
}

function initReminderPeriod($reminderValuePerPeriod, $reminderPeriod, $reminderMinutes, allDay) {
	const $minHours = $reminderPeriod.querySelectorAll("[value='minutes'], [value='hours']");
    if (allDay) {
		hide($minHours);
	} else {
		show($minHours);
	}
	
    const reminderMinutes = $reminderMinutes.value;
    
    const obj = getUserFriendlyReminderTime(reminderMinutes, allDay);
    $reminderValuePerPeriod.value = obj.value;
    $reminderPeriod.value = obj.period;
}

function updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod) {
	if ($reminderPeriod.value == "minutes") {
		$reminderMinutes.value = $reminderValuePerPeriod.value;
	} else if ($reminderPeriod.value == "hours") {
		$reminderMinutes.value = $reminderValuePerPeriod.value * HOUR_IN_MINUTES;
	} else if ($reminderPeriod.value == "days") {
		$reminderMinutes.value = $reminderValuePerPeriod.value * DAY_IN_MINUTES;
	} else if ($reminderPeriod.value == "weeks") {
		$reminderMinutes.value = $reminderValuePerPeriod.value * WEEK_IN_MINUTES;
	}
}

async function getDateFormatFromCalendarSettings() {
    const calendarSettings = await storage.get("calendarSettings");

    let dateFormatStr;
	if (calendarSettings.dateFieldOrder == "MDY") {
		dateFormatStr = "M d, yy";
	} else if (calendarSettings.dateFieldOrder == "DMY") {
		dateFormatStr = "d M yy";
	} else if (calendarSettings.dateFieldOrder == "YMD") {
		if (locale == "ja") {
			dateFormatStr = "yy年Md日";
		} else {
			dateFormatStr = "yy M d";
		}
	}
	return dateFormatStr;
}

function isCalendarWriteable(calendar) {
    return calendar.accessRole == CalendarAccessRole.OWNER || calendar.accessRole == CalendarAccessRole.WRITER;
}

function isCalendarExcludedForNotifs(calendar, excludedCalendars) {
    return excludedCalendars[calendar?.id] === true;
}

// Assumes shared calendars with no default reminders are excluded, BUT this fails if user sets reminders per event on a calendar with no default reminders
function isCalendarExcludedForNotifsByOptimization(calendar, excludedCalendars) {
	return isCalendarExcludedForNotifs(calendar, excludedCalendars) || (typeof excludedCalendars[calendar.id] === "undefined" && calendar.accessRole != CalendarAccessRole.OWNER && (!calendar.defaultReminders || calendar.defaultReminders.length == 0));
}

function isCalendarUsedInExtension(calendar, email, selectedCalendars, excludedCalendars, desktopNotification) {
    return isCalendarSelectedInExtension(calendar, email, selectedCalendars) || (desktopNotification && !isCalendarExcludedForNotifsByOptimization(calendar, excludedCalendars) && !isGadgetCalendar(calendar));
}

async function formatEventAddedMessage(title, eventEntry) {
	var message;
	if (eventEntry.startTime) {
		var atStr = "";
		if (!eventEntry.allDay) {
			atStr = "At";
		}
		if (eventEntry.startTime.isToday()) {
			message = getMessage("addedForToday" + atStr, [title, eventEntry.startTime.toLocaleTimeStringJ()]);
		} else if (eventEntry.startTime.isTomorrow()) {
			message = getMessage("addedForTomorrow" + atStr, [title, eventEntry.startTime.toLocaleTimeStringJ()]);
		} else {
            if (eventEntry.allDay) {
                message = getMessage("addedForSomeday", [title, eventEntry.startTime.toLocaleDateStringJ()]);
            } else {
                message = getMessage("addedForSomeday", [title, eventEntry.startTime.toLocaleStringJ()]);
            }
		}
	} else {
		message = getMessage("eventAdded");
	}
	return message;
}

function findIcon(str) {
	var eventIcon;
	
	if (str) {
		if (/test event/i.test(str)) {
			eventIcon = "movie";
		} else if (str.hasWord("compost")) {
			eventIcon = "compost";
		} else if (str.hasWord("soccer") || (getPreferredLanguage() == "en-GB" && str.hasWord("football"))) {
			eventIcon = "soccer";
		} else if (str.hasWord("football") && getPreferredLanguage() != "en-GB") {
			eventIcon = "football";
		} else if (str.hasWord("cat")) {
			eventIcon = "cat";
		} else if (str.hasWord("doctor") || str.hasWord("dr") || str.hasWord("dr.")) {
			eventIcon = "doctor";
		} else if (str.hasWord("bath")) {
			eventIcon = "bath";
		} else if (str.hasWord("dentist")) {
			eventIcon = "dentist";
		} else if (str.hasWord("yoga")) {
			eventIcon = "yoga";
		} else if (str.hasWord("shave")) {
			eventIcon = "shave";
		} else if (str.hasWord("tax") || str.hasWord("taxes") || str.hasWord("cab")) {
			eventIcon = "taxes";
		} else if (str.hasWord("eye") || str.hasWord("eyes") || str.hasWord("optometrist")) {
			eventIcon = "eye";
		} else if (str.hasWord("bike") || str.hasWord("bicycle") || str.hasWord("biking")) {
			eventIcon = "bike";
		} else if (str.hasWord("plants") || /flowers?/i.test(str)) {
			eventIcon = "plants";
		} else if (str.hasWord("garbage")) {
			eventIcon = "garbage";
		} else if (str.hasWord("recycle") || str.hasWord("recycling")) {
			eventIcon = "recycle";
		} else if (str.hasWord("food") || str.hasWord("cook")) {
			eventIcon = "food";
		} else if (str.hasWord("lunch") || str.hasWord("breakfast") || str.hasWord("brunch") || str.hasWord("dinner") || str.hasWord("supper")) {
			eventIcon = "local-dining";
		} else if (str.hasWord("leave") || str.hasWord("run") || str.hasWord("exercise") || str.hasWord("workout") || str.hasWord("race")) {
			eventIcon = "directions-run";
		} else if (str.hasWord("hospital")) {
			eventIcon = "local-hospital";
		} else if (str.hasWord("pills") || str.hasWord("medication")) {
			eventIcon = "local-pharmacy";
		} else if (str.hasWord("groceries")) {
			eventIcon = "local-grocery-store";
		} else if (str.hasWord("laundry")) {
			eventIcon = "local-laundry-service";
		} else if (str.hasWord("cafe") || str.hasWord("coffee") || str.hasWord("tea")) {
			eventIcon = "local-cafe";
		} else if (str.hasWord("flight") || str.hasWord("airplane") || str.hasWord("airport")) {
			eventIcon = "flight";
		} else if (str.hasWord("car")) {
			eventIcon = "directions-car";
		} else if (str.hasWord("rent") || str.hasWord("mortgage")) {
			eventIcon = "rent";
		} else if (str.hasWord("bank") || str.hasWord("cash") || str.hasWord("money") || str.hasWord("funds") || str.hasWord("atm") || str.hasWord("invoice") || str.hasWord("bill")) {
			eventIcon = "dollar";
		} else if (str.hasWord("pizza")) {
			eventIcon = "local-pizza";
		} else if (str.hasWord("bus")) {
			eventIcon = "directions-bus";
		} else if (str.hasWord("call") || str.hasWord("phone")) {
			eventIcon = "local-phone";
		} else if (str.hasWord("drinks") || str.hasWord("party") || str.hasWord("cocktail")) {
			eventIcon = "local-bar";
		} else if (str.hasWord("sleep") || str.hasWord("hotel")) {
			eventIcon = "local-hotel";
		} else if (str.hasWord("meeting") || str.hasWord("workshop")) {
			eventIcon = "group";
		} else if (str.hasWord("cake") || /bday|birthdays?|cumpleaños/i.test(str)) {
			eventIcon = "cake";
		} else if (str.hasWord("school") || str.hasWord("class") || str.hasWord("classes") || str.hasWord("course")) {
			eventIcon = "school";
		} else if (str.hasWord("bank")) {
			eventIcon = "account-balance";
		} else if (str.hasWord("email")) {
			eventIcon = "mail";
		} else if (str.hasWord("updates")) {
			eventIcon = "updates";
		} else if (str.hasWord("movie")) {
			eventIcon = "movie";
		}		
	}
	return eventIcon;
}

function setEventIcon(params) { // event, $eventIcon
    var eventIcon;
    
    const event = params.event;
    let $eventIcon = params.$eventIcon;
    const eventColors = getEventColors({
        event: event,
        darkenColorFlag: true,
        cachedFeeds: params.cachedFeeds,
        arrayOfCalendars: params.arrayOfCalendars
    });

	var summary = getSummary(event);
	const calendar = getEventCalendar(event);
	
	// try event title
	eventIcon = findIcon(summary);
	if (!eventIcon && calendar) {
		if (calendar.summaryOverride) {
			// try calendar "nice" name
			eventIcon = findIcon(calendar.summaryOverride);
		}
		if (!eventIcon) {
			// try calendar name
			eventIcon = findIcon(calendar.summary);
		}
		
		if (!eventIcon) {
			// marie-eve's "Blog" calendar for food :)
			if (calendar.id == "qk6i02icprnhcj6mqt8cijoloc@group.calendar.google.com") {
				eventIcon = "food";
			}
		}
	}
	
	if (eventIcon) {
		$eventIcon.style.fill = eventColors;
        
		if (eventIcon) {
			//const $g = byId(eventIcon).cloneNode(true);
            const $g = document.querySelector(`svg defs g[name="${eventIcon}"]`).cloneNode(true);
			var viewBoxValue = "0 0 ";
			if ($g.getAttribute("width")) {
				viewBoxValue += $g.getAttribute("width") + " " + $g.getAttribute("height");
			} else {
				viewBoxValue += "24 24";
			}
            // must use createElementNS for an svg because .setAttribute would convert "viewBox" tolowercase polymer needs capital B
            const $svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            $svg.setAttribute("height", "24");
			$svg.setAttribute("viewBox", viewBoxValue);

            $g.querySelectorAll("*").forEach(el => {
                $svg.append(el);
            });
			
			$eventIcon.append($svg);
            const $stroke = $eventIcon.querySelector("path[stroke]");
            if ($stroke) {
                $stroke.style.stroke = eventColors;
            }
		}
		$eventIcon.removeAttribute("hidden");
		return $eventIcon;
	} else {
		$eventIcon.setAttribute("hidden", "");
	}
}

function getPrimaryCalendar(calendars) {
	return calendars.find(calendar => {
		return calendar.primary;
	});
}

async function getDefaultCalendarId(calendars) {
    let calendarId = await storage.get("defaultCalendarId");
    if (!calendarId) {
        const primaryCalendar = getPrimaryCalendar(calendars);
        if (primaryCalendar) {
            calendarId = primaryCalendar.id;
        }
    }
    return calendarId;
}

async function getEventNotificationDetails(event, params = {}) {
	let title = getSummary(event);
    if (!params.ignoreDuration) {
        //title = title.summarize(40); // allow space for time to be displayed
        title += ` ${generateTimeDurationStr({event: event, compact: true})}`;
    }
	const calendar = getEventCalendar(event);
	
	// show calendar name if not the main one
	let calendarName;

    if (calendar) {
        const showCalendarInNotification = await storage.get("showCalendarInNotification");
        if ((showCalendarInNotification == "onlyNonPrimary" && !calendar.primary) || showCalendarInNotification == "always") {
            calendarName = getCalendarName(calendar) ?? "";
        }
    }

	const timeElapsed = await getTimeElapsed(event);
	
	return {title:title, calendarName:calendarName, timeElapsed:timeElapsed};
}

async function sortEvents(events) {
    const allDayVStimeSpecific = await storage.get("showTimeSpecificEventsBeforeAllDay") ? -1 : 1;
	events.sort(function(e1, e2) {
		if (e1.allDay && !e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
			return allDayVStimeSpecific * -1;
		} else if (!e1.allDay && e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
			return allDayVStimeSpecific * +1
		} else {
			var retValue = null;
			try {
				retValue = e1.startTime.getTime() - e2.startTime.getTime();
			} catch (e) {
				console.warn("time diff error", e, e1, e2);
			}
			if (e1.allDay && e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
				// make sure no null summaries "Untitled event"
				if (e1.summary && e2.summary) {
					let aCalendar = getEventCalendar(e1);
					let bCalendar = getEventCalendar(e2);
					if (aCalendar?.primary && !bCalendar?.primary) {
						return -1;
					} else if (!aCalendar?.primary && bCalendar?.primary) {
						return +1;
                    } else if (aCalendar?.id == TASKS_CALENDAR_OBJECT.id && bCalendar?.id != TASKS_CALENDAR_OBJECT.id) {
                        return -1;
                    } else if (aCalendar?.id != TASKS_CALENDAR_OBJECT.id && bCalendar?.id == TASKS_CALENDAR_OBJECT.id) {
                        return +1;
					} else {
						return e1.summary.localeCompare(e2.summary);
					}
				} else {
					return -1;
				}
			} else {
				return retValue;
			}
		}
	});
}

function getStartDateBeforeThisMonth() {
	const date = new DateZeroTime();
    date.setDate(1);
	date.setDate(date.getDate()-MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH);
	return date; 
}

async function getEndDateAfterThisMonth() {
    const calendarView = await storage.get("calendarView");
    const customView = await storage.get("customView");
	var date = new DateZeroTime();
    date.setDate(1);
	if (calendarView == CalendarView.CUSTOM && isCustomViewInWeeks(customView)) {
		date = date.addDays(31 + (7 * customView));
	} else if (calendarView == CalendarView.LIST_WEEK) {
		date = date.addDays(31 + (7 * LIST_VIEW_WEEKS));
	} else {
		date = date.addDays(31 + MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH);
	}
	return date;
}

async function getLastFetchedDate(feedId) {
	const feed = cachedFeedsDetails[feedId];
	if (feed?.CPlastFetched) {
		return new Date(feed.CPlastFetched);
	}
}

async function getCachedFeedDetails(feedId) {
    if (feedId) {
        // must initiate feed in object to obtain a reference
        if (!cachedFeedsDetails[feedId]) {
            cachedFeedsDetails[feedId] = {};
        }
        return cachedFeedsDetails[feedId];
    } else {
        return cachedFeedsDetails;
    }
}

async function requestPermission(params = {}) {
    // 2025 patch for Mac because when chrome.identity.launchWebAuthFlow opens the popup window stays open (good), BUT when it closes it closes the popup window before it can process the post permissions actions
    if (DetectClient.isMac() && location.href.includes("popup.html") && globalThis.fromToolbar && !isRequestingPermission) {
        openWindowInCenter(chrome.runtime.getURL("popup.html?source=requestPermission"), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 800, 600);
        closeWindow();

        return;
    }

    showLoading();

    let acceptPartialPermissions = false;

    let oauthMethod;
    if (params.initOAuthContacts) {
        oauthMethod = oAuthForContacts;
    } else if (params.initOAuthTasks) {
        oauthMethod = oAuthForTasks;
    } else {
        oauthMethod = oAuthForDevices;
        if (!params.writePermissionForCalendars) {
            acceptPartialPermissions = true;
        }
    }
    
    try {
        params.refetch = true;
        const tokenResponse = await oauthMethod.getAccessToken(params);
        const email = tokenResponse.userEmail

        const storedTokenResponse = await oauthMethod.findTokenResponse(email);
        const passedScopesTest = (params.scopes || oauthMethod.getDefaultParams().scopes).every(scope => storedTokenResponse.scopes.includes(scope) || tokenResponse.scopes.includes(scope));
        if (!passedScopesTest && !acceptPartialPermissions) {
            hideLoading();
            byId("permissionDialog")?.close();
            await niceAlert("You must check all permissions to continue");
            return requestPermission(params);
        }

        if (params.initOAuthContacts) {
            const contactsData = await storage.get("contactsData") || [];
            const response = await fetchContacts(email);
            const dataIndex = getContactDataItemIndexByEmail(contactsData, response.contactDataItem.userEmail);
            if (dataIndex != -1) {
                console.log('found: updating existing contactsDataItem')
                contactsData[dataIndex] = response.contactDataItem;
            } else {
                console.log("creating new contactsDataItem");
                contactsData.push(response.contactDataItem);
            }
        
            console.log("contactdata: ", contactsData);
            await storage.set("contactsData", contactsData);
        } else if (params.initOAuthTasks) {
            let selectedCalendars = await storage.get("selectedCalendars");
            if (!selectedCalendars[email]) {
                selectedCalendars[email] = {};
            }
            selectedCalendars[email][TASKS_CALENDAR_OBJECT.id] = true;
            await storage.set("selectedCalendars", selectedCalendars);
            await sendMessageToBG("pollServer", { grantingAccess: true, bypassCache: true });
        } else {
            if (acceptPartialPermissions) {
                const response = await verifyPermissions(tokenResponse);
                if (response?.promptAgain) {
                    if (params.secondScopeAttempt) {
                        throw Error("User did not grant permissions");
                    } else {
                        console.log("prompting again");
                        params.secondScopeAttempt = true;
                        return requestPermission(params);
                    }
                } else {
                    if (!await storage.get("verifyPaymentRequestSent")) {
                        try {
                            const response = await Controller.verifyPayment(ITEM_ID, email);
                            if (response.unlocked) {
                                console.log("unlock", response);
                                await Controller.processFeatures();
                            }
                            await storage.enable("verifyPaymentRequestSent");
                        } catch (error) {
                            console.warn("ignore verifyPayment error", error);
                        }
                    }
                    const response = await sendMessageToBG("pollServer", { grantingAccess: true, bypassCache: true });
                }
            }
        }

        hideLoading();
        console.log("return tokenResponse", tokenResponse);
        return tokenResponse;
    } catch (error) {
        console.error(error);

        hideLoading();
        
        if (error.cause == ErrorCause.ACCESS_DENIED) {
            await openUrl("https://jasonsavard.com/wiki/Granting_access?ref=permissionDenied&ext=calendar")
        } else if (error.jError == JError.NETWORK_ERROR) {
            await niceAlert("Network problem, click ok for more info");
            await openUrl("https://jasonsavard.com/wiki/Network_problem?ref=calendar");
        } else {
            throw error;
        }
    }
}

function mightNeedToRequestPermissionFromExtensionPage(params = {}) {
    if (location.href.includes("popup.html") && browserAutomaticallyClosesPopup()) {
        niceAlert(getMessage("permissionIsRequired")).then(() => {
            const urlObj = new URL(chrome.runtime.getURL("options.html#accounts"));
            urlObj.searchParams.set("requestPermission", true);
            urlObj.searchParams.set("params", JSON.stringify(params));
            openUrl(urlObj.href);
        })
        return true;
    }
}

async function requestPermissionFromButton(dialog, params = {}) {
    hideToast();
    dialog.close();
    showLoading();
    params.useGoogleAccountsSignIn = !params.chromeSigninButton;
    try {
        const tokenResponse = await requestPermission(params);
        if (tokenResponse) {
            await sleep(params.chromeSigninButton ? 200 : 0);
            dialog.close();
            return tokenResponse;
        }
    } catch (error) {
        console.error(error);
        params.secondAttempt = true;
        return openPermissionsDialog(params);
    }
}

function openPermissionsDialog(params = {}) {
	return new Promise((resolve, reject) => {

        if (mightNeedToRequestPermissionFromExtensionPage(params)) {
            return;
        }

        let buttons = [];

        if (supportsChromeSignIn() && !params.useGoogleAccountsSignIn) {
            let classList = ["filled"];
            if (!params.secondAttempt) {
                classList.push("colored");
            }

            buttons.push({
                label: getMessage("useChromeSignIn"),
                classList: classList,
                onClick: (dialog) => {
                    params.chromeSigninButton = true;
                    resolve(requestPermissionFromButton(dialog, params));
                }
            });
        }

        buttons.push({
            label: getMessage("googleAccountsSignIn"),
            src: "/images/google.svg",
            classList: ["chrome-sign-in-button"],
            onClick: (dialog) => {
                params.chromeSigninButton = false;
                resolve(requestPermissionFromButton(dialog, params));
            }
        });

        buttons.push({
            icon: "help",
            style: "align-self: center",
            onClick: (dialog) => {
                openUrl("https://jasonsavard.com/wiki/Granting_access?ref=gmailChecker");
            }
        });

        let message = params.secondAttempt ? "Problem with sign in. Try the Sign in with Google instead." : "";

        openDialog(message, {
            id: "permission-dialog",
            modal: params.modal,
            ok: false,
            buttons: buttons
        });
	});
}

async function initOauthAPIs(params = {}) {
    globalThis.oAuthForDevices = new OAuthForDevices({
        scopes: [Scopes.CALENDARS_READ, Scopes.EVENTS_READ_WRITE],
        storageKey: "tokenResponses",
        getUserEmail: async function(tokenResponse, sendOAuthRequest) {
            try {
                const data = await sendOAuthRequest({tokenResponse: tokenResponse, url: "/calendars/primary"});
                return {
                    userEmail: data.id
                }
            } catch (error) {
                console.warn("getUserEmail error", error);
                    
                if (error.cause?.[0].reason == "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
                    try {
                        const data = await sendOAuthRequest({tokenResponse: tokenResponse, url: "/calendars/primary/events", data: {
                            eventTypes: EventType.DEFAULT,
                            maxResults: 5
                        }})

                        const item = data.items?.find(item => item.creator?.email);
                        if (item) {
                            return {
                                userEmail: item.creator.email
                            };
                        } else {
                            throw Error("Couldn't find email in events");
                        }
                    } catch (error) {
                        console.warn("Could not determine email so using default", error);
                        return {
                            userEmail: DEFAULT_USER_EMAIL
                        }
                    }
                } else {
                    // redirectUrl not being triggered? refer to https://jasonsavard.com/forum/discussion/comment/19484#Comment_19484
                    /*
                    if (error.redirectUrl) {
                        error += " A corporate firewall is possibly blocking calls: " + error.redirectUrl;
                    } else {
                        error += " (Could not get userinfo - you might by re-trying to fetch the userEmail for the non default account)";
                    }
                    */
                    error += " Try disabling a conflicting extension or VPN that is blocking requests/urls or ask your admin to allow/trust this extension: https://support.google.com/a/answer/7281227 or you are using the non default account.";
                    throw error;
                }
            }
        }
    });

    globalThis.oAuthForTasks = new OAuthForDevices({
        scopes: [Scopes.TASKS_READ_WRITE],
        storageKey: "tokenResponsesTasks",
        getUserEmail: async function(tokenResponse, sendOAuthRequest) {
            const data = await sendOAuthRequest({
                tokenResponse: tokenResponse,
                url: `${TASKS_BASE_URL}/users/@me/lists`,
            });
            console.log("tasks data", data);

            const response = {};

            return response;
        }
    });

    globalThis.oAuthForContacts = new OAuthForDevices({
        scopes: [Scopes.CONTACTS_READ, Scopes.CONTACTS_OTHER_READ, Scopes.USERINFO_PROFILE],
        storageKey: "tokenResponsesContacts",
        getUserEmail: async function(tokenResponse, sendOAuthRequest) {
            const data = await sendOAuthRequest({
                tokenResponse: tokenResponse,
                url: PEOPLE_API.ME,
                data: {
                    "personFields":	"names,photos"
                }
            });

            const response = {};

            if (data) {
                console.log(data);
                // info pulled here ie. (.name, .photosUrl) must be explicitly also in the getAccessToken method
                if (data.names) {
                    response.name = data.names[0].displayName;
                }

                if (data.photos?.[0].url) {
                    response.photoUrl = data.photos[0].url;
                }
            }
                
            return response;
        }
    });
}

function generateCalendarColors(cachedFeeds, calendars) {
	var calendarColors = cachedFeeds["colors"];
	console.log("colors", calendarColors);
	if (calendarColors) {
		var calendarColorsCSS = "";

        calendarColors.calendar[BIRTHDAYS_CALENDAR_OBJECT.id] = {background: "red", foreground: "blue"}
        calendarColors.calendar[TASKS_CALENDAR_OBJECT.id] = {background: "yellow", foreground: "green"}

		for (const key in calendarColors.calendar) {

			var color;

			for (const calendar of calendars) {
				if (calendar.colorId == key) {
					color = convertToGoogleCalendarColor(calendar.backgroundColor);
					break;
				}
			}

            let checkboxColor = color;

            if (checkboxColor == "#ffffff") {
				checkboxColor == `#fafafa`;
                /*
                    --paper-checkbox-unchecked-color: #fafafa;
                    --paper-checkbox-checkmark-color:black;
                */
			} else {
				if (isColorTooLight(checkboxColor)) {
					checkboxColor = darkenColor(checkboxColor);
                }
			}

			calendarColorsCSS += `

            [color-id="${key}"].jdom-checkbox:not(:checked) {
                appearance: none;
                outline: 1px solid ${checkboxColor};
            }

            [color-id="${key}"].jdom-checkbox:checked {
                appearance: none;
                background-color: ${checkboxColor} !important;
            }`;
			
			calendarColorsCSS += "\n";
		}
		return calendarColorsCSS;
	}
}

function initCalendarColorsInCSS(cachedFeeds, arrayOfCalendars) {
    const calendarColorsCSS = generateCalendarColors(cachedFeeds, arrayOfCalendars);
    docReady().then(() => {
        const ID = "calendarColors";
        removeNode(ID);

        const $style = document.createElement('style');
        $style.id = ID;
        $style.setAttribute('type', 'text/css');
        $style.appendChild(document.createTextNode(calendarColorsCSS));

        (document.getElementsByTagName('head')[0] || document.documentElement).appendChild($style);
    });
}

async function fetchContacts(userEmail, sync) {
    var contactsData = await storage.get("contactsData");
    if (!contactsData) {
        contactsData = [];
    }

    let contactDataItem = findContactDataItemByEmail(contactsData, userEmail);
    if (!contactDataItem) {
        contactDataItem = {
            version:	CONTACTS_STORAGE_VERSION,
            userEmail:	userEmail,
            contacts:	[]
        };
    }
    contactDataItem.lastFetch = new Date().toString();

    async function fetchData(sync, resource) {
        let urlBase;
        const urlParams = new URLSearchParams();
        let itemsRootId;

        if (resource == "otherContacts") {
            urlBase = PEOPLE_API.CONTACTS_OTHER;
            urlParams.set("readMask", "emailAddresses,names,phoneNumbers");
            itemsRootId = "otherContacts";
        } else {
            urlBase = PEOPLE_API.CONTACTS;
            urlParams.set("personFields", "emailAddresses,names,phoneNumbers,photos,metadata");
            itemsRootId = "connections";
        }
        urlParams.set("pageSize", "1000");
    
        if (sync) {
            urlParams.set("syncToken", resource == "otherContacts" ? contactDataItem.otherContactsSyncToken : contactDataItem.syncToken);
        } else {
            urlParams.set("requestSyncToken", true);
        }

        let data;
        try {

            /*
            if (resource != "otherContacts" && sync && localStorage["test"]) {
                throw "test sync error";
            }
            */

            data = await getAllAPIData({
                oauthForDevices: oAuthForContacts,
                userEmail: userEmail,
                url: `${urlBase}?${urlParams.toString()}`,
                itemsRootId: itemsRootId
            });
    
            console.log("sync - data.syncToken", resource, sync, data.syncToken);
    
            if (data.syncToken) {
                if (resource == "otherContacts") {
                    contactDataItem.otherContactsSyncToken = data.syncToken;
                } else {
                    contactDataItem.syncToken = data.syncToken;
                }
            }
        } catch (error) {
            if (sync) {
                if (error.code == 410) { // otherContacts call actually returns 400 for sync expiration
                    console.warn("Contacts sync token expiration after 7 days so do a full sync", error); // https://developers.google.com/people/api/rest/v1/people.connections/list
                } else if (error.code == 400) {
                    console.warn("Maybe othercontacts sync token expiration, doing a full sync", error.code);
                } else if (error.cause == ErrorCause.OFFLINE) {
                    console.warn("Offline so not syncing contacts");
                } else {
                    console.error("Contacts token error, doing a full anyways, sync error is: " + error + " code: " + error.code);
                }
                data = await fetchData(false, resource);

                const resourcePrefix = resource == "otherContacts" ? "otherContacts" : "people";
                // remove all contacts that came from user's contact (not their other contacts)
                contactDataItem.contacts = contactDataItem.contacts.filter(contact => !contact.resourceName.includes(`${resourcePrefix}/`));
            } else {
                if (error.cause == ErrorCause.OFFLINE) {
                    console.error("Offline not fetching contacts");
                } else {
                    console.error("Unknown sync error: " + error);
                }
                throw error;
            }
        }

        return data; 
    }

    let contactsHaveBeenUpdated;

    const responses = await Promise.all([
        fetchData(sync),
        fetchData(sync, "otherContacts")
    ]);
    
    responses.forEach(data => {
        console.log("data", data);

        if (data.items?.length) {
            contactsHaveBeenUpdated = true;
        }

        data.items.forEach(item => {
            const contact = {
                resourceName: item.resourceName
            };
    
            //console.log("item", item);

            if (item.metadata) {
                const source = item.metadata.sources.find(source => source.type == "CONTACT");
                contact.updatedDate = source.updateTime;
            }
        
            if (item.names?.length) {
                contact.name = item.names[0].displayName;
            }
        
            if (item.phoneNumbers?.length) {
                contact.hasPhoneNumber = "true";
            }
        
            if (item.photos?.length) {
                contact.photoUrl = item.photos[0].url;
            }
        
            if (item.emailAddresses?.length) {
                contact.emails = [];
                item.emailAddresses.forEach(itemEmail => {
                    let newEmails = {
                        address: itemEmail.value
                    };
        
                    if (itemEmail.metadata.primary) {
                        newEmails.primary = true;
                    }
                    contact.emails.push(newEmails);
                });
            }
    
            if (sync) {
                const foundContactsIndex = contactDataItem.contacts.findIndex(thisContact => thisContact.resourceName == contact.resourceName);
    
                const deletedContact = item.metadata?.deleted;
                const deletedOtherContact = item.resourceName.includes("otherContacts/") && !item.emailAddresses;

                // contact was deleted so find and remove it from array
                if (deletedContact || deletedOtherContact) {
                    if (foundContactsIndex != -1) {
                        //console.log("remove: " + contact.resourceName);
                        contactDataItem.contacts.splice(foundContactsIndex, 1);
                    }
                } else {
                    if (foundContactsIndex != -1) {
                        // edited
                        //console.log("editing: " + contact.name);
                        contactDataItem.contacts[foundContactsIndex] = contact;
                    } else {
                        // added
                        //console.log("adding: " + contact.name);
                        contactDataItem.contacts.push(contact);
                    }
                }
            } else {
                contactDataItem.contacts.push(contact);
            }
        });
    });

    contactDataItem.lastModified = new Date();

    contactDataItem.contacts.sort(function (a, b) {
        if (a.name && !b.name) {
            return -1;
        } else if (!a.name && b.name) {
            return 1;
        } else {
            if (a.updatedDate > b.updatedDate) {
                return -1;
            } else if (a.updatedDate < b.updatedDate) {
                return 1;
            } else {
                if (a.hasPhoneNumber && !b.hasPhoneNumber) {
                    return -1;
                } else if (!a.hasPhoneNumber && b.hasPhoneNumber) {
                    return 1;
                } else {
                    return 0;
                }
            }
        }
    });

    console.log("contacts fetched for account " + userEmail + ": " + contactDataItem.contacts.length);
    return { contactDataItem: contactDataItem, contactsHaveBeenUpdated: contactsHaveBeenUpdated };
}

function getContactDataItemIndexByEmail(contactsData, email) {
    return contactsData.findIndex(contact => contact.userEmail == email);
}

function findContactDataItemByEmail(contactsData, email) {
    const index = getContactDataItemIndexByEmail(contactsData, email);
    if (index != -1) {
        return contactsData[index];
    }
}

async function getContacts(params) {
    const contactsData = globalThis.contactsData || await storage.get("contactsData");
	if (contactsData) {
		// maybe update
		if (params.account) {
			const contactData = findContactDataItemByEmail(contactsData, params.account.getAddress());
			if (contactData) {
				return contactData.contacts;
			} else {
				console.log("not found")
			}
		} else {
			console.log("not account found")
		}
	} else {
        console.log("no contactsdata; might have not been given permission");
	}
}

async function getContact(params) {
	var emailToFind;
	if (params.email) {
		emailToFind = params.email;
	} else {
		//emailToFind = params.mail.authorMail;
	}

	let contactFound;
	var account;
	if (params.mail) {
		account = params.mail.account
	} else {
		account = params.account;
    }
    
    const contacts = await getContacts({ account: account });
    if (contacts) {
        contacts.some(contact => {
            if (contact && contact.emails) {
                return contact.emails.some(contactEmail => {
                    if (contactEmail.address && emailToFind && contactEmail.address.toLowerCase() == emailToFind.toLowerCase()) {
                        contactFound = contact;
                        return true;
                    }
                });
            }
        });
    }

    return contactFound;
}

//set default icon images for certain emails etc.
function getPresetPhotoUrl(email) {
	let url;
	if (email) {
		if (email.includes("@jasonsavard.com")) { // from forum etc.
			url = "/images/jason.png";
		}
	}
	return url;
}

async function getContactPhoto(params) {
    const contact = await getContact(params);
    try {
        if (contact) {
            var account;
            if (params.mail) {
                account = params.mail.account;
            } else {
                account = params.account;
            }
            const response = await generateContactPhotoURL(contact, account);
            response.realContactPhoto = true;
            return response;
        } else {
            throw Error("No contact found");
        }
    } catch (error) {
        console.warn("getContactPhoto", error);
        // no generated url so let's set a preset photo
        return {
            photoUrl: getPresetPhotoUrl(params.email)
        };
    }
}

async function generateContactPhotoURL(contact, account) {
    if (contact.photoUrl) {
        const response = await oAuthForContacts.generateURL(account.getAddress(), contact.photoUrl);
        response.photoUrl = response.generatedURL;
        return response;
    } else {
        throw Error("photoNotFound");
    }
}

async function updateContacts() {
    const contactsData = await storage.get("contactsData"); // in Gmail extension I have to deepClone because everything I freeze objects
    if (contactsData) {
        const fetchContactPromises = contactsData.map(contactData => {
            if (contactData.version == CONTACTS_STORAGE_VERSION) {
                console.log("updating contacts for account: " + contactData.userEmail);
                return fetchContacts(contactData.userEmail, true);
            } else {
                console.warn("Could not update these contacts because user needs to grant access to new People API permissions: " + contactData.userEmail);
            }
        });

        const responses = await Promise.all(fetchContactPromises);
        var someContactsHaveBeenUpdated = false;

        responses.forEach((response, index) => {
            if (response) {
                contactsData[index] = response.contactDataItem;
                if (response.contactsHaveBeenUpdated) {
                    someContactsHaveBeenUpdated = true;
                }
            }
        });

        if (someContactsHaveBeenUpdated) {
            await storage.set("contactsData", contactsData);
        }
    }
}

let sUpdatedColors = new Map();
sUpdatedColors.set("#9a9cff", "#7986CB"); // My calendar
sUpdatedColors.set("#42d692", "#009688"); // Holiday calendar
sUpdatedColors.set("#cd74e6", "#8e24aa"); // ME calendar
sUpdatedColors.set("#f691b2", "#d81b60"); // full f
sUpdatedColors.set("#9fc6e7", "#4285f4");
sUpdatedColors.set("#9fe1e7", "#039be5");
sUpdatedColors.set("#7bd148", "#7cb342");
sUpdatedColors.set("#c2c2c2", "#616161");
sUpdatedColors.set("#fbe983", "#e4c441");
sUpdatedColors.set("#7ae7bf", "#33B679");

function convertToGoogleCalendarColor(color) {
	let googleCalendarColor = sUpdatedColors.get(color);
	if (googleCalendarColor) {
		return googleCalendarColor
	} else {
		return color;
	}
}

function isCustomViewInDays(customView) {
	return /.*days/.test(customView);
}

function isCustomViewInWeeks(customView) {
	return !isCustomViewInDays(customView);
}

async function getValueFromCustomView() {
	let customView = await storage.get("customView");
	if (customView) {
		return customView.replace("days", "");
	}
}

function getWriteableCalendars(arrayOfCalendars) {
	return arrayOfCalendars.filter(calendar => isCalendarWriteable(calendar) && !calendar.hidden);
}

async function initCalendarDropDown(selectId, params = {}) {
    const arrayOfCalendars = await getArrayOfCalendars({excludeTasks: !params.doNotExcludeTasks});

    let calendarIdToSelect;
    if (params.selectedCalendarId) {
        calendarIdToSelect = params.selectedCalendarId;
    } else {
        calendarIdToSelect = await getDefaultCalendarId(arrayOfCalendars);
    }

    const select = byId(selectId);

    //if (select.querySelectorAll("option").length == 0) {
    if (!select._initCalendarDropDownDone) {
        getWriteableCalendars(arrayOfCalendars).forEach(calendar => {
            var calendarName = getCalendarName(calendar);
            var paperItem = document.createElement("option");

            // color indicator
            let bgColor = calendar.backgroundColor;
            if (!bgColor && window.colors) {
                bgColor = colors.calendar[calendar.colorId].background;
            }
            const colorIndicator = document.createElement("span");
            colorIndicator.setAttribute("class", "colorIndicator");
            colorIndicator.setAttribute("style", "background:" + bgColor);
            paperItem.appendChild(colorIndicator);

            const textNode = document.createTextNode(calendarName);
            paperItem.appendChild(textNode);

            paperItem.setAttribute("value", calendar.id);
            
            select.appendChild(paperItem);
        });

        select._initCalendarDropDownDone = true;
    }

    select.value = calendarIdToSelect;

    /*
    if (listbox) {
        const dropdown = listbox.closest("select[j-resize]");
        if (dropdown) {
            //attachResizeDropdownListener(dropdown);
        }
    }
    */

    return select;
}

async function sendMessageToBG(command, params) {
    console.log("sendmessagetobg", command, params);
    if (globalThis.inBackground) { //if (typeof command === "function") { // if running in same context
        if (command.includes(".")) { // ie. forgottenReminder.start
            const commands = command.split(".");
            return globalThis[commands[0]][commands[1]](params);
        } else {
            return globalThis[command](params);
        }
    } else {
        const response = await chrome.runtime.sendMessage({command: command, params: params});
        if (response?.error) {
            console.log("error2", response);
            const errorOptions = {};
            if (response.error.cause) {
                errorOptions.cause = response.error.cause;
            }

            if (response.error.message) { // recreate errorobj
                const errorObj = Error(response.error.message, errorOptions);
                copyObj(response.error, errorObj);
                console.error("recreate error obj", errorObj)
                throw errorObj;
            } else {
                throw Error(response.error, errorOptions);
            }
        } else {
            return response;
        }
    }
}

async function mergeEvents(feeds) {
    let theseEvents = [];

    feeds.forEach(feed => {
        // keep going to return cached calendars
        if (feed?.items) {
            feed.items.forEach(event => {
                initEventObj(event, feed.roundtripArg);
            });
            theseEvents = theseEvents.concat(feed.items);
        }
    });

    await sortEvents(theseEvents);

    return theseEvents;
}

async function resetTemporaryData() {
    await storage.remove("notificationsQueue");
    await storage.remove("notificationsOpened");
    await storage.remove("_previousEventInProgress");
}

async function getEvents() {
    const arrayOfCalendars = await getArrayOfCalendars();
    const cachedFeeds = await storage.get("cachedFeeds");
    const feeds = arrayOfCalendars.map(calendar => cachedFeeds[calendar.id]);
    return mergeEvents(feeds);
}

async function initPopup() {
    const browserButtonAction = await storage.get("browserButtonAction");
	if (browserButtonAction == BrowserButtonAction.CHECKER_PLUS_TAB || browserButtonAction == BrowserButtonAction.POPUP_DETACHED || browserButtonAction == BrowserButtonAction.GOOGLE_CALENDAR) {
		chrome.action.setPopup({popup:""});
        chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false });
    } else if (browserButtonAction == BrowserButtonAction.POPUP_SIDE_PANEL) {
        chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
	} else {
		chrome.action.setPopup({
            popup: `popup.html?source=toolbar&calendarView=${await storage.get("calendarView")}`
        });
        chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false });
	}
}

async function showLoggedOut() {
    console.info("showloggedout");
	chrome.action.setBadgeBackgroundColor({color:BadgeColor.GRAY});
	chrome.action.setBadgeText({text : "X"});
    chrome.action.setTitle({title : getMessage("notLoggedIn")});
    await storage.enable("loggedOut");
}

function openChangelog(ref) {
    const url = new URL("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog");
    url.searchParams.set("cUrl", chrome.runtime.getURL("contribute.html"));
    if (ref) {
        url.searchParams.set("ref", ref);
    }
    openUrl(url.href);
}

function generateReminderTimes(event, defaultEventNotificationTime) {
    const reminderTimes = [];
    let reminderFound = false;

    const reminders = getEventReminders(event);
    if (reminders) {

        let beforeStr;
        let beforeAtStr;
        let beforeToDisplay;

        if (/en/.test(locale)) {
            beforeStr = "before"
            beforeAtStr = "before at ";
        } else {
            beforeStr = getMessage("beforeStart");
            beforeAtStr = getMessage("beforeStart");
        }

        reminders.sort((a, b) => {
            if (a.minutes < b.minutes) {
                return -1;
            } else {
                return +1;
            }
        });

		reminders.forEach(reminder => {
			if (reminder.method == "popup" || reminder.method == "email") {
                reminderFound = true;
                if (reminder.minutes == 0) {
                    if (event.allDay) {
                        reminderTimes.push(getMessage("onTheSameDayAt", defaultEventNotificationTime.toLocaleTimeStringJ(true)));
                    } else {
                        reminderTimes.push(getMessage("whenEventStarts"));
                    }
                } else {
                    let periodName;
                    const obj = getUserFriendlyReminderTime(reminder.minutes, event.allDay, true);
                    if (obj.value == 1) {
                        periodName = obj.period.replace(/s$/, "");
                    } else {
                        periodName = obj.period;
                    }
                    let atTimeStr = "";
                    console.log("generateReminderTimes", event.summary, reminder.minutes, event.allDay, obj.beforeTime)
                    if (event.allDay && obj.beforeTime) {
                        const date = new DateZeroTime();
                        date.setMinutes(obj.beforeTime);
                        atTimeStr = ` ${date.toLocaleTimeStringJ(true)}`;
                        beforeToDisplay = beforeAtStr;
                    } else {
                        beforeToDisplay = beforeStr;
                    }

                    let str = `${getMessage("X" + periodName, obj.value)} ${beforeToDisplay}${atTimeStr}`;
                    if (reminder.method == "email") {
                        str += ` (${getMessage("email").toLowerCase()})`;
                    }

                    reminderTimes.push(str);
                }
            }
        });
    }

    return {
        reminderTimes: reminderTimes,
        reminderFound: reminderFound
    }
}

async function getHideDeleteFlag() {
    // decided to reverse hideDelete default from false to true on March 17th 2021
    const rawHideDelete = await storage.getRaw("hideDelete");
    if (rawHideDelete) {
        return true;
    } else if (rawHideDelete === false) {
        return false;
    } else {
        const installDate = await getInstallDate();
        if (installDate.isAfter(new Date(2021, 2, 17))) {
            return true;
        } else {
            return false;
        }
    }
}

function getTaskList(event) {
    // https://www.googleapis.com/tasks/v1/lists/MDU2Mzg0MDM3Njk4MzMxOTAzNzE6MDow/tasks/T0IzamRCNFRPTWQwZHh2NQ
    const matches = event.selfLink?.match(/lists\/(.*?)\//); // adding ? for non greedy
    if (matches) {
        const taskListId = matches[1];
        const taskLists = cachedFeeds["taskLists"];
        return taskLists.items.find(taskList => taskList.id == taskListId);
    }
}



async function setTaskStatus(task, status) {
    await updateEvent({
        event: task,
        patchFields: {
            status: status
        },
    });

    // update event immediately in memory so that checkevents updates
    return updateCachedFeed(task, {
        operation: "update",
        ignoreCheckEvents: true
    });
}

async function initColorsForNonStandardCalendars() {
    BIRTHDAYS_CALENDAR_OBJECT.backgroundColor = await storage.get("birthdays-bg-color");
    TASKS_CALENDAR_OBJECT.backgroundColor = await storage.get("tasks-bg-color");
}

class iCalendar {
    /* Pattern for folded lines: start with a whitespace character */
    FOLDED = /^\s(.*)$/;
    /* Pattern for an individual entry: name:value */
    ENTRY = /^([A-Za-z0-9-]+)((?:;[A-Za-z0-9-]+=(?:"[^"]+"|[^";:,]+)(?:,(?:"[^"]+"|[^";:,]+))*)*):(.*)$/;
    /* Pattern for an individual parameter: name=value[,value] */
    PARAM = /;([A-Za-z0-9-]+)=((?:"[^"]+"|[^";:,]+)(?:,(?:"[^"]+"|[^";:,]+))*)/g;
    /* Pattern for an individual parameter value: value | "value" */
    PARAM_VALUE = /,?("[^"]+"|[^";:,]+)/g;
    /* Pattern for a date only field: yyyymmdd */
    DATEONLY = /^(\d{4})(\d\d)(\d\d)$/;
    /* Pattern for a date/time field: yyyymmddThhmmss[Z] */
    DATETIME = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/;
    /* Pattern for a date/time range field: yyyymmddThhmmss[Z]/yyyymmddThhmmss[Z] */
    DATETIME_RANGE = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)\/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/;
    /* Pattern for a timezone offset field: +hhmm */
    TZ_OFFSET = /^([+-])(\d\d)(\d\d)$/;
    /* Pattern for a duration: [+-]PnnW or [+-]PnnDTnnHnnMnnS */
    DURATION = /^([+-])?P(\d+W)?(\d+D)?(T)?(\d+H)?(\d+M)?(\d+S)?$/;
    /* Reserved names not suitable for attrbiute names. */
    RESERVED_NAMES = ['class'];

    cleanICal(str) {
        if (str) {
            return str.replace(/\\/g, "");
        }
    }

    parse(content) {
		var cal = {};
		var timezones = {};
		var lines = this.unfoldLines(content);
		this.parseGroup(lines, 0, cal, timezones);
		if (!cal.vcalendar) {
			throw 'Invalid iCalendar data';
		}

        let startDateOnly;

        try {
            const start = content.indexOf("DTSTART");
            const end = content.indexOf("DTEND");
    
            const dtStart = content.substring(start+8, end-2);
            // date only found ie. DTSTART:20121016
            if (dtStart.length <= 10) {
                startDateOnly = parseDate(dtStart);
                startDateOnly.setDate(startDateOnly.getDate() + 1);
            }
        } catch (e) {
            console.warn("coud not parse for dtstart: ", e);
        }

        if (startDateOnly) {
            cal.vcalendar.vevent.dtstart = startDateOnly;
            cal.vcalendar.vevent.dtend = new Date(startDateOnly);
            cal.vcalendar.vevent.dtend.setDate(cal.vcalendar.vevent.dtend.getDate() + 1);
            cal.vcalendar.vevent.allDay = true;
        } else {
            if (cal.vcalendar.vevent.dtstart?._value) {
                cal.vcalendar.vevent.dtstart = parseDate(cal.vcalendar.vevent.dtstart._value);
            }
            if (cal.vcalendar.vevent.dtend?._value) {
                cal.vcalendar.vevent.dtend = parseDate(cal.vcalendar.vevent.dtend._value);
            }
        }

        console.log("vcalendar", cal.vcalendar);

        cal.vcalendar.vevent.summary = this.cleanICal(cal.vcalendar.vevent.summary);
        cal.vcalendar.vevent.description = this.cleanICal(cal.vcalendar.vevent.description);
        cal.vcalendar.vevent.location = this.cleanICal(cal.vcalendar.vevent.location);

		return cal.vcalendar;
	}

    unfoldLines(content) {
        var lines = content.replace(/\r\n/g, '\n').split('\n');
        for (var i = lines.length - 1; i > 0; i--) {
            var matches = this.FOLDED.exec(lines[i]);
            if (matches) {
                lines[i - 1] += matches[1];
                lines[i] = '';
            }
        }
        return lines.filter(line => line); // Remove blank lines
    }

    parseGroup(lines, index, owner, timezones) {
        if (index >= lines.length || lines[index].indexOf('BEGIN:') != 0) {
            throw 'Missing group start';
        }
        var group = {};
        var name = lines[index].substring(6);
        this.addEntry(owner, name.toLowerCase(), group);
        index++;
        while (index < lines.length && lines[index].indexOf('END:') != 0) {
            if (lines[index].indexOf('BEGIN:') == 0) { // Recurse for embedded group
                index = this.parseGroup(lines, index, group, timezones);
            }
            else {
                // jason: regex couldn't handle the name before the quotes ie. "ORGANIZER;CN=blah \"BallareLoft\":MAILTO:noreply@facebookmail.com"
                // but this would work"ORGANIZER;CN=\"BallareLoft\":MAILTO:noreply@facebookmail.com"
                try {
                    var entry = this.parseEntry(lines[index]);
                    this.addEntry(group, entry._name, (entry._simple ? entry._value : entry));
                } catch (e) {
                    console.warn("ical error " + e);
                }
            }
            index++;
        }
        if (name == 'VTIMEZONE') { // Save timezone offset
            var matches = this.TZ_OFFSET.exec(group.standard.tzoffsetto);
            if (matches) {
                timezones[group.tzid] = (matches[1] == '-' ? -1 : +1) *
                    (parseInt(matches[2], 10) * 60 + parseInt(matches[3], 10));
            }
        }
        else {
            for (var name2 in group) {
                this.resolveTimezones(group[name2], timezones);
            }
        }
        if (lines[index] != 'END:' + name) {
            throw 'Missing group end ' + name;
        }
        return index;
    }
    
    /* Resolve timezone references for dates.
       @param  value  (any) the current value to check - updated if appropriate
       @param  timezones  (object) collection of defined timezones */
    resolveTimezones(value, timezones) {
        if (!value) {
            return;
        }
        if (value.tzid && value._value) {
            var offset = timezones[value.tzid];
            var offsetDate = function(date, tzid) {
                date.setMinutes(date.getMinutes() - offset);
                date._type = tzid;
            };
            if (this.isArray(value._value)) {
                for (var i = 0; i < value._value.length; i++) {
                    offsetDate(value._value[i], value.tzid);
                }
            }
            else if (value._value.start && value._value.end) {
                offsetDate(value._value.start, value.tzid);
                offsetDate(value._value.end, value.tzid);
            }
            else {
                offsetDate(value._value, value.tzid);
            }
        }
        else if (this.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                this.resolveTimezones(value[i], timezones);
            }
        }
    }

    addEntry(owner, name, value) {
        if (typeof value == 'string') {
            value = value.replace(/\\n/g, '\n');
        }
        if (this.RESERVED_NAMES.includes(name)) {
            name += '_';
        }
        if (owner[name]) { // Turn multiple values into an array
            if (!this.isArray(owner[name]) || owner['_' + name + 'IsArray']) {
                owner[name] = [owner[name]];
            }
            owner[name][owner[name].length] = value;
            if (owner['_' + name + 'IsArray']) {
                owner['_' + name + 'IsArray'] = undefined;
            }
        }
        else {
            owner[name] = value;
            if (this.isArray(value)) {
                owner['_' + name + 'IsArray'] = true;
            }
        }
    }

    parseEntry(line) {
        var entry = {};
        var matches = this.ENTRY.exec(line);
        if (!matches) {
            throw 'Missing entry name: ' + line;
        }
        entry._name = matches[1].toLowerCase();
        entry._value = this.checkDate(matches[3]);
        entry._simple = true;
        entry.toString = function() {
            return this._value?.toString()
        }
        this.parseParams(entry, matches[2]);
        return entry;
    }
    
    /* Parse parameters for an individual entry.
       The format is: <param>=<pvalue>[;...]
       @param  owner   (object) the owning object for the parameters,
                       updated with parameters as attributes, and
                       _simple to indicate whether or not other parameters
       @param  params  (string or string[]) the parameters to parse */
    parseParams(owner, params) {
        var param = this.PARAM.exec(params);
        while (param) {
            var values = [];
            var value = this.PARAM_VALUE.exec(param[2]);
            while (value) {
                values.push(this.checkDate(value[1].replace(/^"(.*)"$/, '$1')));
                value = this.PARAM_VALUE.exec(param[2]);
            }
            owner[param[1].toLowerCase()] = (values.length > 1 ? values : values[0]);
            owner._simple = false;
            param = this.PARAM.exec(params);
        }
    }
    
    /* Convert a value into a Date object or array of Date objects if appropriate.
       @param  value  (string) the value to check
       @return  (string or Date) the converted value (if appropriate) */
    checkDate(value) {
        var matches = this.DATETIME.exec(value);
        if (matches) {
            return this.makeDate(matches);
        }
        matches = this.DATETIME_RANGE.exec(value);
        if (matches) {
            return {start: this.makeDate(matches), end: this.makeDate(matches.slice(7))};
        }
        matches = this.DATEONLY.exec(value);
        if (matches) {
            return this.makeDate(matches.concat([0, 0, 0, '']));
        }
        return value;
    }
    
    /* Create a date value from matches on a string.
       @param  matches  (string[]) the component parts of the date
       @return  (Date) the corresponding date */
    makeDate(matches) {
        var date = new Date(matches[1], matches[2] - 1, matches[3],
            matches[4], matches[5], matches[6]);
        date._type = (matches[7] ? 'UTC' : 'float');
        return this.utcDate(date);
    }
    
    /* Standardise a date to UTC.
       @param  date  (Date) the date to standardise
       @return  (Date) the equivalent UTC date */
    utcDate(date) {
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date;
    }

    isArray(a) {
        return (a && a.constructor == Array);
    }
}

function maybeSetAuthUser(event, videoUrl, email) {
    if (event.conferenceData?.conferenceSolution?.key?.type == ConferenceSolutionType.GOOGLE_MEET) {
        videoUrl = setUrlParam(videoUrl, "authuser", email);
    }

    return videoUrl;
}

function initDarkFlags() {
    /* v1 commented
    let bgColor = getComputedStyle(document.querySelector("body")).backgroundColor;
    // Check if background color is fully transparent else use parent color
    if (bgColor === "transparent" || bgColor === "rgba(0, 0, 0, 0)" || bgColor === "rgba(0,0,0,0)") {
        bgColor = getComputedStyle(document.querySelector("#inboxSection")).backgroundColor;
    }
    */

    // v2
    const bgColor = getComputedStyle(document.body).backgroundColor;

    const hexColor = rgbToHex(bgColor);
    document.documentElement.classList.toggle("dark-background", !isColorTooLight(hexColor, 0.60) || getComputedStyle(htmlElement).filter.includes("invert"));
}

function shouldWatermarkImage(skin) {
	//if (skin.name && skin.name.startsWith("[img:") && skin.author != "Jason") {
	if (skin.image && skin.author != "Jason") {
		return true;
	}
}

function addSkinPiece(id, css) {
    docReady().then(() => {
		byId(id).append(css);
	});
}

function shouldApplyDarkTheme(skin) {
    if ((skin.name && skin.name.toLowerCase().includes("dark") && skin.id != SkinIds.THEME_DARK_INVERTED) || skin.id == SkinIds.THEME_DARCULA || skin.id == SkinIds.THEME_MIDNIGHT) {
        return true;
    }
}

function addSkin(skin, id) {
    console.log("addSkin", skin, id);
	if (!id) {
		id = "skin_" + skin.id;
	}
    byId(id)?.remove();

    const $body = document.body;
    
    $body.classList.add(id);
	
	let css = "";
	
	if (skin.image && !location.href.includes("reminders.html")) {
		$body.classList.add("background-skin");
        //$body.querySelector("header").classList.add("apply-dark-theme");

        /*
        let defaultBackgroundColorCSS = "";
        // v1 moved this to css instead under body.background-skin cause i'm using mixed-blend-mode: difference
		// normally default is black BUT if image exists than default is white, unless overwritten with text_color
		if (skin.text_color != "dark") {
            defaultBackgroundColorCSS = "background-color:black;";
            css += `
                #inboxSection app-header-layout app-toolbar paper-icon-button,
                #topLeft,
                #searchInput,
                #skinWatermark,
                .showMoreEmails {
                    color:white;
                    mix-blend-mode: difference;
                }
            `;
        }
        */

		var resizedImageUrl;
		if (/blogspot\./.test(skin.image) || /googleusercontent\./.test(skin.image)) {
			resizedImageUrl = skin.image.replace(/\/s\d+\//, "\/s" + parseInt($body.clientWidth) + "\/");
        } else if (skin.image.includes("unsplash.com")) {
            resizedImageUrl = setUrlParam(skin.image, "w", parseInt($body.clientWidth));
		} else {
			resizedImageUrl = skin.image;
		}
		
		//| += "[main] {background-size:cover;background-image:url('" + resizedImageUrl + "');background-position-x:50%;background-position-y:50%} [main] paper-toolbar {background-color:transparent} .accountHeader {background-color:transparent}";
		// Loading the background image "after" initial load for 2 reasons: 1) make sure it loads after the mails. 2) to trigger opacity transition
        // note that addskinpiece uses domReady() so this gets done after the css style is added below
        addSkinPiece(id, `
            body::before {
                content: '';
                background-size: cover;
                background-image: url('${resizedImageUrl}');
                background-position-x: 50%;
                background-position-y: 50%;
                width: 100%;
                height: 100%;
                position: fixed;
                opacity: 1;
                z-index: -1; /* patch or else agenda view would not show background colors for events, so I don't have to place position: relative to it*/
            }
        `);

		if (shouldWatermarkImage(skin)) {
            const $skinWatermark = byId("skinWatermark");
            if ($skinWatermark) {
                $skinWatermark.classList.add("visible");
                $skinWatermark.textContent = skin.author;
                if (skin.author_url) {
                    $skinWatermark.href = skin.author_url;
                } else {
                    $skinWatermark.removeAttribute("href");
                }
            }
		}
	}

    if (skinsSettings.some(thisSkin => shouldApplyDarkTheme(thisSkin)) || shouldApplyDarkTheme(skin)) {
        htmlElement.classList.add("apply-dark-theme");
    } else {
        htmlElement.classList.remove("apply-dark-theme");
    }

	if (skin.css) {
		css += " " + skin.css;
	}
	
	addCSS(id, css);

    initDarkFlags();
}

async function setupOffscreenDocument(secondAttempt) {
    const path = "off_screen.html";
    // Check all windows controlled by the service worker to see if one 
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(path);

    if (!chrome.runtime.getContexts) {
        throw Error("chrome.runtime.getContexts is not supported - you need to update your browser!");
    }

    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // create offscreen document
    if (globalThis.creating) {
        await globalThis.creating;
    } else {
        globalThis.creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [
                chrome.offscreen.Reason.DOM_PARSER,
                chrome.offscreen.Reason.AUDIO_PLAYBACK,
                chrome.offscreen.Reason.WORKERS
            ],
            justification: 'To parse html and play audio and run background tasks to get push notififcations from server.',
        });
        try {
            await globalThis.creating;
        } catch (error) {
            if (error.message.includes("single")) { // detect error message: Only a single offscreen document may be created.
                if (secondAttempt) {
                    throw Error("Restart the browser");
                } else {
                    console.warn("Got that single error, will close offscreen and reopen...", error);
                    await chrome.offscreen.closeDocument();
                    globalThis.creating = null;
                    await setupOffscreenDocument(true);
                }
            } else {
                throw error;
            }
        }
        globalThis.creating = null;
    }
}

async function sendToOffscreenDoc(type, data) {
    if (!DetectClient.isFirefox()) {
        await setupOffscreenDocument();
    }

    const message = {
        target: "offscreen",
        type: type,
        data: data
    };

    let response;
    if (DetectClient.isFirefox()) {
        response = await new Promise((resolve, reject) => {
            myOffscreenListener(message, "firefox-manual-send", resolve);
        });
    } else {
        try {
            response = await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.error("error sending to offscreen", error);
            throw error;
        }
    }

    if (response?.errorInOffscreen) {
        throw Error(response.errorInOffscreen);
    } else {
        return response;
    }
}

function canViewEventsAndCalendars(tokenResponse) {
    return tokenResponse.scopes.includes(Scopes.EVENTS_READ_WRITE) && (tokenResponse.scopes.includes(Scopes.CALENDARS_READ) || tokenResponse.scopes.includes(Scopes.CALENDARS_READ_WRITE))
}

async function verifyPermissions(tokenResponse) {
    if (canViewEventsAndCalendars(tokenResponse)) {
        await storage.disable("loggedOut");
    } else {
        // missing permissions
        hideLoading();
        const response = await openDialog(getMessage("checkBothPermissions"), {
            //okLabel: getMessage("continue"),
            cancel: true
        });

        if (response == "ok") {
            await oAuthForDevices.removeAllTokenResponses({userEmail: tokenResponse.userEmail});
            return {
                promptAgain: true
            }
        } else {
            await niceAlert("Ok, you can always grant those permissions later in the Options > Accounts tab");
            await storage.disable("loggedOut");
        }
    }
}

async function isAllowedRealtimeSync() {

    if (DetectClient.isFirefox()) {
        return false;
    }

    let grandfathered = false;
    const installDate = await getInstallDate();
    const APRIL = 4 - 1;
    if (installDate.isBefore(new Date(2024, APRIL, 29))) {
        grandfathered = true;
    }

    return await storage.get("donationClicked") || grandfathered;
}

async function initRealtimeSync() {
    if (!await isGCMSupported() && await isAllowedRealtimeSync()) {
        try {
            await sendToOffscreenDoc("init-firebase", {
                instanceId: await getInstanceId()
            })
        } catch (error) {
            console.error("couldn't init firebase: " + error);
        }
    }
}

function getDetachedUrl() {
    let url = chrome.runtime.getURL("popup.html");
    url = setUrlParam(url, "source", "detached");
    return url;
}

function shouldRemoveNotification(notification, events, eventsToRemoveFromReminders = []) {
    if (events.length) { // make sure we have some events because they could be empty if we're offline or there was a temporary connection issue
        const foundEvent = findEvent(notification.event, events);
        if (foundEvent) {
            if (foundEvent.kind == TASKS_KIND && foundEvent.status == TaskStatus.COMPLETED) {
                console.log("Remove completed task", notification);
                return true;
            }

            if (eventsToRemoveFromReminders.some(event => event.id === notification.event.id)) {
                return true;
            }
        } else {
            if (notification.event.startTime?.isBefore(getStartDateBeforeThisMonth())) {
                // possible fix for disappearing reminders, do not remove these reminder as they might just be a notification that the user just kept in his reminders without dismissing and now it's older than the events start date
                // ref: https://bitbucket.org/jasonsav/checker-plus-for-google-calendar/issues/203/old-reminders-being-disappearing-after-x
                console.log("do not remove notification because it's older than the event start date", notification);
            } else {
                return true;
            }
        }
    }
}

async function isSidePanelOpened() {
    if (chrome.runtime.getContexts) {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
        });
    
        return existingContexts.length > 0;
    }
}

async function getPrimaryTimezone() {
    const calendarSettings = await storage.get("calendarSettings");
    const primaryTimezone = calendarSettings?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return primaryTimezone;
}

// Function to get the GMT offset for a given timezone
function getGMTOffset(timezone) {
    const now = new Date();
    const options = { timeZone: timezone, hour12: false, timeZoneName: 'short' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    console.log(timezone, timeZonePart);

    if (timezoneAbbreviations[timeZonePart.value]) {
        return timezoneAbbreviations[timeZonePart.value];
    }
    
    const match = timeZonePart.value.match(/([+-]\d{1,2}):?(\d{2})?/);
    if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2] || '0', 10);
        return hours * 60 + minutes * (hours < 0 ? -1 : 1);
    } else {
        return 0; // Default to 0 if the timezone string is invalid
    }
}

async function generateTimezoneDropdown(id, defaultTimezone) {
    const dropdown = document.getElementById(id);

    // Get the list of all supported timezones
    const timezones = Intl.supportedValuesOf('timeZone');

    // Create an array of timezones with their GMT offsets
    const timezonesWithOffsets = timezones.map(timezone => {
        const offset = getGMTOffset(timezone);
        return { timezone, offset };
    });

    // Sort the timezones by their GMT offset
    timezonesWithOffsets.sort((a, b) => a.offset - b.offset);

    // Prepend the user's current timezone to the list
    const primaryTimezone = await getPrimaryTimezone();
    const userOffset = getGMTOffset(primaryTimezone);
    appendTimezoneOption(userOffset, primaryTimezone);

    const _userChosenTimezone = await storage.get("_userChosenTimezone");
    if (_userChosenTimezone) {
        const userChosenOffset = getGMTOffset(_userChosenTimezone);
        appendTimezoneOption(userChosenOffset, _userChosenTimezone);
    }

    // Add a divider to the dropdown
    const divider = document.createElement('hr');
    dropdown.appendChild(divider);

    // Populate the dropdown with the sorted timezones, including the GMT offset in the label
    timezonesWithOffsets.forEach(({ timezone, offset }) => {
        appendTimezoneOption(offset, timezone);
    });

    // Set the default selected timezone to the user's current timezone
    //const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (defaultTimezone) {
        const calendarSettings = await storage.get("calendarSettings");
        const timezone = calendarSettings?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        dropdown.value = timezone;
    }

    function appendTimezoneOption(offset, timezone) {
        const offsetHours = Math.floor(Math.abs(offset) / 60);
        const offsetMinutes = Math.abs(offset) % 60;
        const offsetSign = offset >= 0 ? '+' : '-';
        const offsetLabel = `GMT${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
        const paperItem = document.createElement('option');
        paperItem.setAttribute('value', timezone);
        paperItem.textContent = `${offsetLabel} ${timezone}`;
        dropdown.appendChild(paperItem);
    }
}

function isMultiDayEvent(event) {
    return event.endTime?.diffInDays(event.startTime) > 1;
}

function generateReminderLine(reminder) {
    const reminderNode = document.createElement("div");
    reminderNode.classList.add("calendarReminder");
    reminderNode.innerHTML = `
        <select class="reminderMethod">
            <option value="email" msg="email">Email</option>
            <option value="popup" msg="notification">nnNotification</option>
        </select>
        <j-input class="reminderMinutes" value="${reminder.minutes}" hidden></j-input>
        <j-input class="reminderValuePerPeriod" type="number" min="0"></j-input>
        <select class="reminderPeriod">
            <option value="minutes" msg="minutes">minutes</option>
            <option value="hours" msg="hours">hours</option>
            <option value="days" msg="days">dddays</option>
            <option value="weeks" msg="weeks">weeks</option>
        </select>
        <j-button class="deleteReminder" icon="close"></j-button>
        <j-input class="lastUpdated" hidden value="${reminder.lastUpdated || ''}"></j-input>
    `;

    initSelects(reminderNode);
    initMessages(reminderNode);

    reminderNode.querySelector(".reminderMethod").value = reminder.method;

    return reminderNode;
}

function generateReminderSection(reminders) {
    const fragment = document.createDocumentFragment();

    const style = document.createElement("style");

    style.innerHTML = `
        .calendarReminder {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .reminderPeriod {
            min-width: 81px;
        }
        .reminderValuePerPeriod {
            width: 62px;
            xxtext-align: end;
        }
        .underline {position:absolute}
    `;

    fragment.append(style);

    reminders.forEach(reminder => {
        fragment.append(generateReminderLine(reminder));
    });

    const $addReminder = document.createElement("j-button");
    $addReminder.className = "addReminder";
    $addReminder.textContent = getMessage("addNotification");
    fragment.append($addReminder);

    return fragment;
}

function generateReminderFromValueAndPeriod(calendarReminder) {
    const method = calendarReminder.querySelector(".reminderMethod").value;
    const reminderMinutes = parseInt(calendarReminder.querySelector(".reminderMinutes").value);
    return {
        method: method,
        minutes: reminderMinutes
    };
}

function generateRemindersForEventEntry() {
    const reminders = [];
    selectorAll("#event-reminders .calendarReminder").forEach(calendarReminder => {
        reminders.push(generateReminderFromValueAndPeriod(calendarReminder));
    });

    return {
        useDefault: false,
        overrides: reminders
    }
}