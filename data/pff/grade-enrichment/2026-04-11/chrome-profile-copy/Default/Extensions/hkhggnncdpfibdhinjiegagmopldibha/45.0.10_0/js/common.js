// Copyright Jason Savard
"use strict";

var commonJSLoaded = true;

function bodyInserted(callback) {
    return new Promise((resolve, reject) => {
        callback ||= resolve;
        if (document.body) {
            callback();
        } else {
            new MutationObserver((mutations, obs) => {
                if (document.body) {
                    obs.disconnect();
                    callback();
                }
            }).observe(document.documentElement, {childList: true});
        }
    });
}

// optional callback
function docReady(fn) {
    return new Promise((resolve, reject) => {
        fn ||= resolve;
        if (document.readyState === "interactive" || document.readyState === "complete") {
            fn();
        } else {
            document.addEventListener("DOMContentLoaded", () => {
                fn();
            });
        }
    });
}

const htmlElement = globalThis.document?.documentElement;
const NNBSP = "\u202F";

/* Had to delcare this in common above jdom.js incase of storage.init corrupt errors */
const ICONS_FOLDER = "/images/icons/";
const Icons = {
    NotificationLogo: `${ICONS_FOLDER}icon-48.png`,
    CalendarWindowNoNumber: `${ICONS_FOLDER}icon-64-no-number.png`,
    AppIconMaskUrl: `${ICONS_FOLDER}notificationMiniIcon.png`,
    BadgeIcon19Prefix: `${ICONS_FOLDER}icon-19_`,
    BadgeIcon38Prefix: `${ICONS_FOLDER}icon-38_`,
    BadgeIconSuffix: ".png",
    Reminder_ExtensionNotification: '/images/bell-48.png',
    Reminder_NativeNotification: '/images/bell-top.png',
    Notification: {
        Undo: `/images/notification-buttons/undo.png`,
        Edit: `/images/notification-buttons/edit.png`,
    }
}

const ErrorCause = {
    NETWORK_PROBLEM: "NETWORK_PROBLEM",
    OFFLINE: "OFFLINE",
    NO_SYNC_ITEMS_FOUND: "NO_SYNC_ITEMS_FOUND",
    ACCESS_DENIED: "ACCESS_DENIED",
}

var inWidget;
var fromToolbar;
var isDetached;
var isRequestingPermission;
var fromGrantedAccess;

// Place this in common.js becaue it loads before popup.js
if (location.href.includes("source=widget")) {
	inWidget = true;
    htmlElement.classList.add("widget");
} else if (location.href.includes("source=toolbar")) {
	fromToolbar = true;
    htmlElement.classList.add("fromToolbar");
} else if (location.href.includes("source=grantedAccess")) {
	fromGrantedAccess = true;
} else if (location.href.includes("source=detached")) {
	isDetached = true;
} else if (location.href.includes("source=requestPermission")) {
    isRequestingPermission = true;
}

function createBR() {
    return document.createElement("br");
}

function emptyNode(target) {
    parseTarget(target, el => {
        while(el.firstChild) el.removeChild(el.firstChild);
    });
}

function lastNode(targets) {
    const nodes = selectorAll(targets);
    if (nodes?.length) {
        return nodes[nodes.length - 1];
    }
}

function emptyAppend(target, ...node) {
    emptyNode(target);
    parseTarget(target, el => {
        el.append(...node);
    });
}

function removeAllNodes(target) {
    parseTarget(target, el => {
        el.remove();
    });
}

function byId(id) {
    return document.getElementById(id);
}

function css(target, styles) {
    parseTarget(target, element => {
        Object.assign(element.style, styles);
    });
}

function selector(selector) {
    return document.querySelector(selector);
}

function selectorAll(targets) {
    if (typeof targets === "string") {
        targets = document.querySelectorAll(targets);
    }

    if (!targets.forEach) {
        targets = [targets];
    }

    return targets;
}

function parseTarget(target, handleElement) {
    if (!target) {
        return [];
    }

    target = selectorAll(target);

    target.forEach(e => {
        handleElement(e);
    });
}

function getDefaultDisplay( elem ) {
    globalThis.defaultDisplayMap ||= {};

	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
        display = globalThis.defaultDisplayMap[ nodeName ];

    if ( display ) {
        return display;
    }

    // hard code some known ones because if polymer code loads only after this then we will always get the default display ie. inline whereas it polymer could set it to inline-display for paper- elements
    if (nodeName == "PAPER-ICON-BUTTON") {
        display = "inline-block";
    } else {    
	    temp = doc.body.appendChild( doc.createElement( nodeName ) );
	    display = getComputedStyle(temp).display;
	    temp.parentNode.removeChild( temp );
    }

	if ( display === "none" ) {
		display = "block";
	}

    globalThis.defaultDisplayMap[ nodeName ] = display;

	return display;
}

function isHiddenWithTree(el) {
    return el.style.display === "none" ||
		el.style.display === "" &&
		getComputedStyle(el).display === "none";
}

function show(target) {
    parseTarget(target, element => {
        if (element.hidden) {
            element.hidden = false;
        }

        if (element.style.display == "none") {
            element.style.display = "";
        }
        if (element.style.display === "" && isHiddenWithTree(element)) {
            element.style.display = getDefaultDisplay(element);
        }
    });
}

function hide(target) {
    parseTarget(target, element => {
        element.hidden = true;

        if (getComputedStyle(element).display !== "none") {
            element.style.display = "none";
        }
    });
}

function showHide(target, display) {
    if (display) {
        show(target);
    } else {
        hide(target);
    }
}

// targets is optional
const getNodeIndex = (el, targets) => {
	if (targets) {
  	    return Array.from(selectorAll(targets)).findIndex(relativeEl => relativeEl === el);
    } else {
  	    return [...el.parentNode.children].indexOf(el);
    }
}

function restoreOriginalSlideProperties(target) {
    target.style.boxSizing = target._originalBoxSizing;
    target.style.overflow = target._originalOverflow;

    target.style.paddingTop = target._originalPaddingTop;
    target.style.paddingBottom = target._originalPaddingBottom;
    target.style.marginTop = target._originalMarginTop;
    target.style.marginBottom = target._originalMarginBottom;
}

/* SLIDE UP */
var slideUp = (targets, duration=500) => {
    if (duration == "fast") {
        duration = 200;
    } else if (duration == "slow") {
        duration = 600;
    }

    return new Promise((resolve, reject) => {
        parseTarget(targets, target => {
            if (target._slideDownInProgress || target._slideUpInProgress) {
                console.log("slideUp already in progress", target);
                return;
            }

            target.style.transitionProperty = 'height, margin, padding, opacity';
            target.style.transitionDuration = duration + 'ms';

            target._slideUpInProgress = true;
            target._originalBoxSizing = target.style.boxSizing;
            target.style.boxSizing = 'border-box';

            target.style.height = target.offsetHeight + 'px';

            target.offsetHeight;

            target._originalOverflow = target.style.overflow;
            target.style.overflow = 'hidden';

            target.style.height = 0;

            target._originalPaddingTop = target.style.paddingTop;
            target.style.paddingTop = 0;

            target._originalPaddingBottom = target.style.paddingBottom;
            target.style.paddingBottom = 0;

            target._originalMarginTop = target.style.marginTop
            target.style.marginTop = 0;

            target._originalMarginBottom = target.style.marginBottom;
            target.style.marginBottom = 0;

            target._slideUpTimeout = setTimeout(() => {
                hide(target);
                target.style.removeProperty('height');

                restoreOriginalSlideProperties(target);

                target.style.removeProperty('transition-duration');
                target.style.removeProperty('transition-property');

                delete target._slideUpTimeout;
                target._slideUpInProgress = false;
            }, duration);
        });

        setTimeout(() => {
            resolve();
        }, duration);
    });
}

/* SLIDE DOWN */
var slideDown = (targets, duration=500) => {
    if (duration == "fast") {
        duration = 200;
    } else if (duration == "slow") {
        duration = 600;
    }

    return new Promise((resolve, reject) => {
        parseTarget(targets, target => {
            const currentHeight = target.clientHeight;
            target.style.removeProperty('display');
            target.hidden = false;
            let display = window.getComputedStyle(target).display;
            if (display === 'none') display = 'block';
            target.style.display = display;

            if (!currentHeight) {
                if (target._slideUpTimeout) {
                    clearTimeout(target._slideUpTimeout);
                    target._slideUpInProgress = false;

                    restoreOriginalSlideProperties(target);
                }

                target._slideDownInProgress = true;

                const prevOverflow = target.style.overflow;
                target.style.overflow = 'hidden';

                //target.style.height = "auto"
                //let height = target.clientHeight + "px";
                target.style.height = 0;

                //target.style.paddingTop = 0;
                //target.style.paddingBottom = 0;
                //target.style.marginTop = 0;
                //target.style.marginBottom = 0;

                target.offsetHeight;

                const prevBoxsizing = target.style.boxSizing;
                target.style.boxSizing = 'border-box';

                target.style.transitionProperty = "height";
                target.style.transitionDuration = duration + 'ms';
            
                /** Do this after the 0px has applied. */
                /** It's like a delay or something. MAGIC! */
                setTimeout(() => {
                    target.style.height = "auto";
                }, 0) 
            
                //target.style.removeProperty('padding-top');
                //target.style.removeProperty('padding-bottom');
                //target.style.removeProperty('margin-top');
                //target.style.removeProperty('margin-bottom');

                target._slideDownTimeout = setTimeout(() => {
                    target.style.removeProperty('height');

                    target.style.overflow = prevOverflow;
                    target.style.boxSizing = prevBoxsizing;

                    target.style.removeProperty('transition-duration');
                    target.style.removeProperty('transition-property');

                    delete target._slideDownTimeout;
                    target._slideDownInProgress = false;
                }, duration);
            }
        });

        setTimeout(() => {
            resolve();
        }, duration);
    });
}

var slideToggle = (targets, duration = 500) => {
    if (duration == "fast") {
        duration = 200;
    } else if (duration == "slow") {
        duration = 600;
    }

    return new Promise((resolve, reject) => {
        parseTarget(targets, target => {
            if (window.getComputedStyle(target).display === 'none') {
                return slideDown(target, duration);
            } else {
                return slideUp(target, duration);
            }
        });
    
        setTimeout(() => {
            resolve();
        }, duration);
    });
}

var fadeIn = (targets, duration=500) => {
    if (duration == "fast") {
        duration = 200;
    } else if (duration == "slow") {
        duration = 600;
    }

    return new Promise((resolve, reject) => {
        parseTarget(targets, target => {
            if (!isVisible(target) || window.getComputedStyle(target).opacity == "0") {
                target.style.opacity = "0";
                show(target);

                target.style.transitionProperty += ",opacity";
                target.style.transitionDuration = duration + 'ms';

                /** Do this after the 0px has applied. */
                /** It's like a delay or something. MAGIC! */
                setTimeout(() => {
                    target.style.opacity = "1";
                }, 0) 
            
                setTimeout(() => {
                    target.style.removeProperty('transition-duration');
                    target.style.removeProperty('transition-property');
                }, duration);
            }
        });

        setTimeout(() => {
            resolve();
        }, duration);
    });
}

var fadeOut = (targets, duration=500) => {
    if (duration == "fast") {
        duration = 200;
    } else if (duration == "slow") {
        duration = 600;
    }

    return new Promise((resolve, reject) => {
        parseTarget(targets, target => {
            if (isVisible(target) || window.getComputedStyle(target).opacity == "1") {
                //target.style.transitionProperty = "opacity";
                target.style.transitionDuration = duration + 'ms';

                /** Do this after the 0px has applied. */
                /** It's like a delay or something. MAGIC! */
                setTimeout(() => {
                    target.style.opacity = "0";
                }, 0);

                setTimeout(() => {
                    hide(target);
                    target.style.removeProperty('transition-duration');
                    target.style.removeProperty('transition-property');
                }, duration);
            }
        });

        setTimeout(() => {
            resolve();
        }, duration);
    });
}

function isVisible(target) {
    if (typeof target === "string") {
        target = document.querySelector(target);
    }

    //return (target.offsetParent !== null) // didn't work for fixed elements like dialog boxes
    return !!( target.offsetWidth || target.offsetHeight || target.getClientRects().length );
}

function importTemplateNode(target, allFlag) {
    let nodes = null;
    parseTarget(target, el => {
        if (nodes) {
            return;
        } else {
            const fragment = document.importNode(el.content, true);
            if (allFlag) {
                nodes = Array.from(fragment.children);
            } else {
                nodes = fragment.firstElementChild;
            }
        }
    })
    return nodes;
}

function addEventListeners(target, type, fn, namespace, listenerOptions) {
    parseTarget(target, el => {
       	let thisListenerOptions = false;
        if (namespace) {
        	const abortControllerFnName = `_myAbortController_${namespace}_${type}`;
        	if (el[abortControllerFnName]) {
          	    console.log("abort")
          	    el[abortControllerFnName].abort();
            }
            el[abortControllerFnName] = new AbortController();
          
            if (listenerOptions === true) {
                thisListenerOptions = {
                	capture: true,
                    signal: el[abortControllerFnName].signal
                }
            } else if (typeof listenerOptions === 'object') {
                thisListenerOptions = Object.assign({}, listenerOptions);
                thisListenerOptions.signal = el[abortControllerFnName].signal;
            } else {
              	thisListenerOptions = {
                	signal: el[abortControllerFnName].signal
                }
            }
        } else if (listenerOptions) {
            thisListenerOptions = listenerOptions;
        }
        el.addEventListener(type, fn, thisListenerOptions);
    });
};

function replaceEventListeners(target, type, fn, namespace = "default", listenerOptions) {
	addEventListeners(target, type, fn, namespace, listenerOptions);
}

function onClick(target, fn, namespace, listenerOptions = false) {
    addEventListeners(target, "click", fn, namespace, listenerOptions);
}

function onClickReplace(target, fn, namespace = "default", listenerOptions = false) {
    onClick(target, fn, namespace, listenerOptions);
}

function onChange(target, fn, namespace, listenerOptions = false) {
    addEventListeners(target, "change", fn, namespace, listenerOptions);
}

function onChangeReplace(target, fn, namespace = "default", listenerOptions = false) {
    onChange(target, fn, namespace, listenerOptions);
}

function onDelegate(node, type, selector, fn, listenerOptions = false) {
    node.addEventListener(type, function(e) {
        for (var target=e.target; target && target!=this; target=target.parentNode) {
            // loop parent nodes from the target to the delegation node
            if (target.matches(selector)) {
                fn.call(target, e);
                break;
            }
        }
    }, listenerOptions);
}

function toggleAttr(target, attr, value) {
    parseTarget(target, el => {
        if (value === false) {
            el.removeAttribute(attr);
        } else {
            if (el.getAttribute(attr) == undefined || value === true) {
                el.setAttribute(attr, "");
            } else {
                el.removeAttribute(attr);
            }
        }
    });
}

class DetectClientClass {

    constructor() {
        this.platform = "Windows"; // patch had to declaire it here instead of above to pass firefox extension compilation warning
    }

    async init() {
        if (navigator.userAgentData) {
            this.platform = (await navigator.userAgentData.getHighEntropyValues(["platform"])).platform;
        }
    }
  
    findBrand(brandString) {
        return navigator.userAgentData?.brands.some(brands => brands.brand == brandString);
    }
    
    isChrome() {
        return this.findBrand("Google Chrome");
    }

    isChromium() {
        return this.findBrand("Chromium")
             && !this.isFirefox()
             && !this.isSafari()
        ;
    }

    isEdge() {
        return this.findBrand("Microsoft Edge");
    }

    isOpera() {
        return this.findBrand("Opera") || this.findBrand("Opera GX");
    }

    isFirefox() {
        return /firefox/i.test(navigator.userAgent);
    }

    isSafari() {
        return /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    }

    isWindows() {
        if (navigator.userAgentData) {
            return this.platform == "Windows";
        } else {
            return /windows/i.test(navigator.userAgent);
        }
    }

    isAndroid() {
        if (navigator.userAgentData) {
            return this.platform == "Android";
        } else {
            return /android/i.test(navigator.userAgent);
        }
    }

    isMac() {
        if (navigator.userAgentData) {
            return this.platform == "macOS";
        } else {
            return /mac/i.test(navigator.userAgent);
        }
    }

    is_iPhone() {
        if (navigator.userAgentData) {
            return this.platform == "iOS";
        } else {
            return /iPhone/i.test(navigator.userAgent);
        }
    }

    isLinux() {
        if (navigator.userAgentData) {
            return this.platform == "Linux";
        } else {
            return /linux/i.test(navigator.userAgent);
        }
    }

    isChromeOS() {
        return this.platform == "Chrome OS" || this.platform == "ChromeOS";
    }

    async getChromeChannel() {
        
        if (this.isChrome() || this.isChromeOS()) {
            let platform;

            if (this.isWindows()) {
                platform = "win";
            } else if (this.isMac()) {
                platform = "mac";
            } else if (this.isLinux()) {
                platform = "linux";
            } else if (this.isChromeOS()) {
                platform = "chromeos";
            } else if (this.isAndroid()) {
                platform = "android";
            } else {
                platform = "all";
            }

            const fullVersionList = (await navigator.userAgentData.getHighEntropyValues(["fullVersionList"])).fullVersionList;
            let matchedBrand = fullVersionList.find(list => list.brand == "Google Chrome");
            if (!matchedBrand) {
                matchedBrand = fullVersionList.find(list => list.brand == "Chromium");
                if (!matchedBrand) {
                    matchedBrand = fullVersionList.find(list => !list.brand.match(/brand/i));
                }
            }

            let browserVersion = matchedBrand?.version;
            if (!browserVersion) {
                throw Error("Could not extract browser version", fullVersionList);
            }
            //browserVersion = "99.0.4844.74";

            const data = await fetchJSON(`https://versionhistory.googleapis.com/v1/chrome/platforms/${platform}/channels/all/versions/all/releases?filter=version=${browserVersion}`);
            const release = data.releases[0];

            if (release) {
                const channel = release.name.split("/")[4];
                const startTime = new Date(release.serving.startTime);
                if (release.serving.endTime) {
                    //console.log("et", new Date(release.serving.endTime));
                }
    
                const OLD_VERSION_THRESHOLD_IN_DAYS = 90;
    
                return {
                    channel: channel,
                    oldVersion: Math.abs(startTime.diffInDays()) > OLD_VERSION_THRESHOLD_IN_DAYS
                };
            } else {
                throw Error("Could not find release for version: " + browserVersion);
            }
        } else {
            throw Error("Not Chrome");
        }
    }

    getFirefoxDetails() {
        return fetchJSON("https://jasonsavard.com/getBrowserDetails");
    }
}

const DetectClient = new DetectClientClass();

function getInternalPageProtocol() {
	var protocol;
	if (DetectClient.isFirefox()) {
		protocol = "moz-extension:";
	} else {
		protocol = "chrome-extension:";
	}
	return protocol;
}

function isInternalPage(url) {
	if (arguments.length == 0) {
		url = location.href;
	}
	return url && url.indexOf(getInternalPageProtocol()) == 0;
}

function customShowError(error) {
    if (globalThis.document) {
        docReady(() => {
            show(document.body);
            document.body.style.opacity = "1";

            const div = document.createElement("div");
            div.style.cssText = "background:red;color:white;padding:5px;z-index:999";
            div.textContent = error;

            document.body.prepend(div);
        });
    } else {
        showCouldNotCompleteActionNotification(error);
    }
}
    
function displayUncaughtError(error) {
    let errorStr = error.stack || error.message || error;
    const lowerCaseErrorStr = errorStr.toLowerCase();

    const googleMapsError = lowerCaseErrorStr.includes("google maps");
    const messageSendingError = lowerCaseErrorStr.includes("could not establish connection") || lowerCaseErrorStr.includes("a listener indicated an asynchronous");

    if (messageSendingError) {
        if (inLocalExtension) {
            errorStr = `[Dev only] ${errorStr}`;
        } else {
            // do nothing in prod
            return;
        }
    }

	if (globalThis.showError) {
        try {
            document.body.style.opacity = "1";
            // must catch errors here to prevent onerror loop

            showError(errorStr, {
                text: "Send feedback",
                onClick: () => {
                    openUrl("https://jasonsavard.com/forum/t/checker-plus-for-google-calendar?ref=send-feedback");
                }
            });
        } catch (e) {
            console.error("showError failed: ", e);
            customShowError(errorStr);
        }
    } else {
        customShowError(errorStr);
    }
}

globalThis.addEventListener('error', event => {
    const msg = event.message;
    const url = event.filename;
    const line = event.lineno;

    var thisUrl = removeOrigin(url).substring(1); // also remove beginning slash '/'
    var thisLine;
    if (line) {
        thisLine = " (" + line + ") ";
    } else {
        thisLine = " ";
    }
    const action = thisUrl + thisLine + msg;

    sendGAError(action);

    const errorStr = msg + " (" + thisUrl + " " + line + ")";
    displayUncaughtError(errorStr);

    // Prevent the default handling (error in console)
    //event.preventDefault();
});

globalThis.addEventListener('unhandledrejection', event => {
    console.error("unhandledrejection", event.reason);
    displayUncaughtError(event.reason);
  
    // Prevent the default handling (error in console)
    //event.preventDefault();
});

// usage: [url] (optional, will use location.href by default)
function removeOrigin(url) {
	var linkObject;
	if (arguments.length && url) {
		try {
			linkObject = document.createElement('a');
			linkObject.href = url;
		} catch (e) {
			console.warn("jerror: could not create link object: " + e);
		}
	} else {
		linkObject = location;
	}
	
	if (linkObject) {
		return linkObject.pathname + linkObject.search + linkObject.hash;
	} else {
		return url;
	}
}

// anonymized email by using only 3 letters instead to comply with policy
async function getUserIdentifier() {
    try {
        if (globalThis.storage) {
            const email = await storage.get("email")
            if (email) {
                return email.split("@")[0].substring(0,3);
            }
        }
    } catch (error) {
        console.warn("Could not getUserIdentifier: " + error);
    }
}

async function sendGAError(action) {
	// google analytics
	var JS_ERRORS_CATEGORY = "JS Errors";
	if (typeof sendGA != "undefined") {
		// only action (no label) so let's use useridentifier
		var userIdentifier = await getUserIdentifier();
		if (arguments.length == 1 && userIdentifier) {
			sendGA(JS_ERRORS_CATEGORY, action, userIdentifier);
		} else {
			// transpose these arguments to sendga (but replace the 1st arg url with category ie. js errors)
			// use slice (instead of sPlice) because i want to clone array
			var argumentsArray = [].slice.call(arguments, 0);
			// transpose these arguments to sendGA
			var sendGAargs = [JS_ERRORS_CATEGORY].concat(argumentsArray);
			sendGA.apply(this, sendGAargs);
		}
	}
	//return false; // false prevents default error handling.
}

function logError(action) {
	// transpose these arguments to console.error
	// use slice (instead of sPlice) because i want to clone array
	var argumentsArray = [].slice.call(arguments, 0);
	// exception: usually 'this' is passed but instead its 'console' because console and log are host objects. Their behavior is implementation dependent, and to a large degree are not required to implement the semantics of ECMAScript.
	console.error.apply(console, argumentsArray);
	
	sendGAError.apply(this, arguments);
}

var ONE_SECOND = 1000;
var ONE_MINUTE = 60000;
var ONE_HOUR = ONE_MINUTE * 60;
var ONE_DAY = ONE_HOUR * 24;

var WEEK_IN_MINUTES = 10080;
var DAY_IN_MINUTES = 1440;
var HOUR_IN_MINUTES = 60;

// copy all the fields (not a clone, we are modifying the target so we don't lose a any previous pointer to it
function copyObj(sourceObj, targetObj) {
    for (const key in sourceObj) {        
    	targetObj[key] = sourceObj[key];
    }
}

function hasVerticalScrollbar(node, buffer = 0) {
    if (node.scrollHeight > node.clientHeight + buffer) {
        return true;
    } else {
        return false;
    }
}

function hasHorizontalScrollbar(node, buffer) {
    if (node.scrollWidth > node.clientWidth + buffer) {
        return true;
    } else {
        return false;
    }
}

function seconds(seconds) {
	return seconds * ONE_SECOND;
}

function minutes(mins) {
	return mins * ONE_MINUTE;
}

function hours(hours) {
	return hours * ONE_HOUR;
}

function days(days) {
	return days * ONE_DAY;
}

function shallowClone(obj) {
    return Object.assign({}, obj);
}

function deepClone(obj) {
    if (obj) {
        return JSON.parse(JSON.stringify(obj), dateReviver);
    }
}

//remove entity codes
async function htmlToText(html) {
    html = html
        .replace(/<br\s?\/?>/ig,"\n")
        .replace(/<(?:.|\n)*?>/gm, '')
    ;

    if (globalThis.DOMParser) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.documentElement.textContent;
    } else {
        return await sendToOffscreenDoc("htmlToText", html)
    }
}

async function readMessagesFile(lang, region) {
    var folderName;
    if (region) {
        folderName = lang + "_" + region.toUpperCase();
    } else {
        folderName = lang;
    }

    return fetchJSON(chrome.runtime.getURL("_locales/" + folderName + "/messages.json"));
}

async function _loadLocaleMessagesFile() {
    const localeFormatted = locale.replace("-", "_");
    const lang = localeFormatted.split("_")[0].toLowerCase();
    const region = localeFormatted.split("_")[1];
        
    try {
        globalThis.localeMessages = await readMessagesFile(lang, region);
    } catch (error) {
        console.warn("readMessagesFile", error);
        // if we had region then try lang only
        if (region) {
            console.log("Couldn't find region: " + region + " so try lang only: " + lang);
            try {
                globalThis.localeMessages = await readMessagesFile(lang);
            } catch (error) {
                // always resolve
                console.warn(error);
            }
        } else {
            console.warn("Lang not found: " + lang);
        }
    }
}

async function loadLocaleMessages() {
    // only load locales from files if they are not using their browser language (because i18n.getMessage uses the browser language) 
    if (chrome.i18n.getUILanguage && (locale == chrome.i18n.getUILanguage() || globalThis.locale == chrome.i18n.getUILanguage().substring(0, 2))) {
        // for english just use native calls to get i18n messages
        globalThis.localeMessages = null;
    } else {
        //console.log("loading locale: " + locale);
        
        // i haven't created a en-US so let's avoid the error in the console and just push the callback
        if (globalThis.locale != "en-US") {
            await _loadLocaleMessagesFile();
        }
    }		
}

function getMessage(messageID, args) {
	if (messageID) {

        if (messageID == "tomorrow") {
            return getTomorrowMessage();
        } else if (messageID == "yesterday") {
            return getYesterdayMessage();
        } else if (messageID == "today") {
            return getTodayMessage();
        }

		if (typeof localeMessages != 'undefined' && localeMessages != null) {
			var messageObj = localeMessages[messageID];	
			if (messageObj) { // found in this language
				var str = messageObj.message;
				
				// patch: replace escaped $$ to just $ (because chrome.i18n.getMessage did it automatically)
				if (str) {
					str = str.replace(/\$\$/g, "$");
				}
				
				if (args != null) {
					if (args instanceof Array) {
						for (var a=0; a<args.length; a++) {
							str = str.replace("$" + (a+1), args[a]);
						}
					} else {
						str = str.replace("$1", args);
					}
				}
				return str;
			} else { // default to default language
				return chromeGetMessage(messageID, args);
			}
		} else {
			return chromeGetMessage(messageID, args);
		}
	}
}

//patch: chrome.i18n.getMessage does pass parameter if it is a numeric - must be converted to str
function chromeGetMessage(messageID, args) {
	if (args != null && !isNaN(args)) {
		args = args + "";
	}
	return chrome.i18n.getMessage(messageID, args);
}

function getUniqueId() {
	return crypto.getRandomValues(new Uint32Array(1))[0];
}

var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	// Regexes and supporting functions are cached through closure
	return function (date, mask, options) { //utc, forceEnglish
		if (!options) {
			options = {};
		}
		
		var dF = dateFormat;
		var i18n = options.forceEnglish ? dF.i18nEnglish : dF.i18n;

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? new Date(date) : new Date;
		if (isNaN(date)) throw SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			options.utc = true;
		}

		var	_ = options.utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = options.utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  i18n.dayNamesShort[D],
				dddd: i18n.dayNames[D],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  i18n.monthNamesShort[m],
				mmmm: i18n.monthNames[m],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    options.utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		var ret = mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});

		if (options.noZeros) {
			ret = ret.replace(":00", "");
		}
		
		return ret;
	};
}();

// Some common format strings
dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
	dayNamesShort: [],
	dayNames: [],
	monthNamesShort: [],
	monthNames: []
};

dateFormat.i18nEnglish = deepClone(dateFormat.i18n);

function initCalendarNames(obj, englishObj) {
    let date = new DateZeroTime();
    date.setDate(date.getDate() - date.getDay()); // set to Sunday

    while (obj.dayNamesShort.length < 7) {
        obj.dayNamesShort.push(date.toLocaleString(locale, {
            weekday: "short"
        }));
        englishObj.dayNamesShort.push(date.toLocaleString("en", {
            weekday: "short"
        }));

        obj.dayNames.push(date.toLocaleString(locale, {
            weekday: "long"
        }));
        englishObj.dayNames.push(date.toLocaleString("en", {
            weekday: "long"
        }));

        date.setDate(date.getDate() + 1);
    }

    date = new DateZeroTime(new Date().getFullYear(), 0, 1);

    // weird bug with feb repeated when using setDate in for loop, so had to use while loop instead
    while (obj.monthNamesShort.length < 12) {
        obj.monthNamesShort.push(date.toLocaleString(locale, {
            month: "short"
        }));
        englishObj.monthNamesShort.push(date.toLocaleString("en", {
            month: "short"
        }));

        obj.monthNames.push(date.toLocaleString(locale, {
            month: "long"
        }));
        englishObj.monthNames.push(date.toLocaleString("en", {
            month: "long"
        }));

        date.setMonth(date.getMonth() + 1);
    }
}

Date.prototype.addSeconds = function(seconds, cloneDate) {
	var date;
	if (cloneDate) {
		date = new Date(this);		
	} else {
		date = this;
	}
	date.setSeconds(date.getSeconds() + seconds, date.getMilliseconds());
	return date;
}

Date.prototype.subtractSeconds = function(seconds, cloneDate) {
	return this.addSeconds(-seconds, cloneDate);
}

Date.prototype.addMinutes = function(mins) {
	return new Date(this.getTime() + minutes(mins));
}

Date.prototype.addHours = function(hrs) {
	return new Date(this.getTime() + hours(hrs));
}

Date.prototype.addDays = function(days) {
	const newDate = new Date(this);
	newDate.setDate(newDate.getDate() + parseInt(days));
	return newDate;
}

Date.prototype.subtractDays = function(days) {
	return this.addDays(days * -1);
}

function getHourCycle() {
    return twentyFourHour ? "h23" : "h12";
}

function getDateFormatOptions(params = {}) {
    return {
        month: 'short',
        day: 'numeric',
        ...(!params.compact && { weekday: 'long' }),
        ...(params.showYear && { year: 'numeric' })
    }
}

function getTimeFormatOptions() {
    return {
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: getHourCycle()
    }
}

function getDateAndTimeFormatOptions(dateParams) {
    return {...getDateFormatOptions(dateParams), ...getTimeFormatOptions()};
}

Object.defineProperty(Date.prototype, "toLocaleDateStringJ", {
    value: function (options = {}) {
        const showYear = this.getFullYear() !== new Date().getFullYear();
        return this.toLocaleDateString(locale, getDateFormatOptions({showYear: showYear, compact: options.compact}));
    }
});

Object.defineProperty(Date.prototype, "toLocaleTimeStringJ", {
    value: function (removeTrailingZeroes) {
        let str = this.toLocaleTimeString(locale, getTimeFormatOptions());

        str = str.replace(/\sAM/, `${NNBSP}am`);
        str = str.replace(/\sPM/, `${NNBSP}pm`);

        str = str.replace(" da manhã", "am");
        str = str.replace(" da tarde", "pm");

        if (removeTrailingZeroes && !twentyFourHour) {
			str = str.replace(":00", "");
		}
        return str;
    }
});

Object.defineProperty(Date.prototype, "toLocaleStringJ", {
    value: function () {
        const showYear = this.getFullYear() !== new Date().getFullYear();
        return this.toLocaleString(locale, getDateAndTimeFormatOptions({showYear: showYear}));
    }
});

// For convenience...
Date.prototype.format = function (mask, options) {
	return dateFormat(this, mask, options);
};

function resetTime(date) {
    date.setHours(0, 0, 0, 0);
    return date;
}

class DateZeroTime extends Date {
    constructor(...dateFields) {
        super(...dateFields);
        resetTime(this);
    }
}

Date.prototype.toRFC3339 = function() {
	//var gmtHours = -d.getTimezoneOffset()/60;
	return this.getUTCFullYear() + "-" + pad(this.getUTCMonth()+1, 2, '0') + "-" + pad(this.getUTCDate(), 2, '0') + "T" + pad(this.getUTCHours(), 2, '0') + ":" + pad(this.getUTCMinutes(), 2, '0') + ":00Z";
}

function convertTimeToTimezone(date, timezone, negativeOffsetFix = false) {
    const localOffset = getGMTOffset(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const targetOffset = getGMTOffset(timezone);
    let offsetDifference = targetOffset - localOffset;

    if (negativeOffsetFix) {
        offsetDifference *= -1;
    }

    return date.addMinutes(offsetDifference);
}

function convertTimeToTimezoneWithOriginalOffset(date, timezone) {
    const newDate = convertTimeToTimezone(date, timezone, true);
    
    const formattedDate = newDate.getFullYear() + "-" +
        String(newDate.getMonth() + 1).padStart(2, '0') + "-" +
        String(newDate.getDate()).padStart(2, '0') + "T" +
        String(newDate.getHours()).padStart(2, '0') + ":" +
        String(newDate.getMinutes()).padStart(2, '0') + ":" +
        String(newDate.getSeconds()).padStart(2, '0');

    const offsetMinutes = getGMTOffset(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60)).toString().padStart(2, '0');
    const offsetMins = Math.abs(offsetMinutes % 60).toString().padStart(2, '0');
    const offsetSign = offsetMinutes < 0 ? "-" : "+";

    const str = `${formattedDate}${offsetSign}${offsetHours}:${offsetMins}`;
    return str;
}

function today() {
	return new DateZeroTime();
}

function yesterday() {
	const yest = new DateZeroTime();
	yest.setDate(yest.getDate()-1);
	return yest;
}

function tomorrow() {
	const tom = new DateZeroTime();
	tom.setDate(tom.getDate()+1);
	return tom;
}

function isToday(date) {
    return date.isSameDay(today());
}

function isTomorrow(date) {
    return date.isSameDay(tomorrow());
}

function isYesterday(date) {
    return date.isSameDay(yesterday());
}

function isLastDayOfMonth(date) {
    if (!(date instanceof Date)) {
        throw new Error("Input must be a Date object");
    }
    const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    return nextDay.getDate() === 1;
}

function getRelativeDayMessage(dayOffset) {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    let relativeDay = formatter.format(dayOffset, 'day');
    if (locale.includes("en")) {
        relativeDay = relativeDay.capitalize();
    }
    return relativeDay;
}

function getTodayMessage() {
    return getRelativeDayMessage(0);
}

function getYesterdayMessage() {
    return getRelativeDayMessage(-1);
}

function getTomorrowMessage() {
    return getRelativeDayMessage(+1);
}

function normalizeDST(date1, date2) {
    if (date1.getTimezoneOffset() != date2.getTimezoneOffset()) {
        date2 = new Date(date2);
        date2 = date2.addMinutes(date1.getTimezoneOffset() - date2.getTimezoneOffset());
    }
    return date2;
}

Date.prototype.isToday = function () {
	return isToday(this);
};

Date.prototype.isTomorrow = function () {
	return isTomorrow(this);
};

Date.prototype.isYesterday = function () {
	return isYesterday(this);
};

Date.prototype.isSameDay = function (otherDay) {
    otherDay = normalizeDST(this, otherDay);
	return this.getFullYear() == otherDay.getFullYear() && this.getMonth() == otherDay.getMonth() && this.getDate() == otherDay.getDate();
};

Date.prototype.isBefore = function(otherDate) {
	let paramDate;
	if (otherDate) {
		paramDate = new Date(otherDate);
	} else {
		paramDate = new Date();
	}	
	const thisDate = new Date(this);
    paramDate = normalizeDST(thisDate, paramDate);

	return thisDate.getTime() < paramDate.getTime();
};

Date.prototype.isBeforeToday = function() {
	return !this.isToday() && this.isBefore();
};

Date.prototype.isEqual = function(otherDate) {
    otherDate = normalizeDST(this, otherDate);
	return this.getTime() == otherDate.getTime();
};

Date.prototype.isEqualOrBefore = function(otherDate) {
    let otherDate2;
    if (otherDate) {
        otherDate2 = normalizeDST(this, otherDate);
    }
	return this.isBefore(otherDate) || (otherDate && this.getTime() == otherDate2.getTime());
};

Date.prototype.isAfter = function(otherDate) {
	return !this.isEqualOrBefore(otherDate);
};

Date.prototype.isEqualOrAfter = function(otherDate) {
	return !this.isBefore(otherDate);
};

Date.prototype.diffInMillis = function(otherDate) {
	let d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}	
	var d2 = new Date(this);
    d1 = normalizeDST(d2, d1);

	return (d2.getTime() - d1.getTime());
};

Date.prototype.diffInSeconds = function(otherDate) {
    return this.diffInMillis(otherDate) / ONE_SECOND;
};

Date.prototype.diffInMinutes = function(otherDate) {
    return this.diffInMillis(otherDate) / ONE_MINUTE;
};

Date.prototype.diffInHours = function(otherDate) {
    return this.diffInMillis(otherDate) / ONE_HOUR;
};

Date.prototype.diffInDays = function(otherDate, forHumans) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}
	var d2 = new Date(this);
	if (forHumans) {
		resetTime(d1);
		resetTime(d2);
	}

    d1 = normalizeDST(d2, d1);
    return (d2.getTime() - d1.getTime()) / ONE_DAY;
};

Date.prototype.diffInDaysForHumans = function(otherDate) {
	return this.diffInDays(otherDate, true);
};

Date.prototype.getDayOfYear = function() {
    const start = new Date(this.getFullYear(), 0, 0);
    const diff = this - start;
    return Math.floor(diff / ONE_DAY);
}

// Note: this is shallow clone if the array contains objects they will remain referenced ie. [{key:value}, ...]
Array.prototype.shallowClone = function() {
	return this.slice(0);
};

Array.prototype.first = function() {
	return this[0];
};
Array.prototype.last = function() {
	return this[this.length-1];
};
Array.prototype.isEmpty = function() {
	return this.length == 0;
};
Array.prototype.swap = function (x,y) {
	var b = this[x];
	this[x] = this[y];
	this[y] = b;
	return this;
}

String.prototype.replaceAll = function(find, replace) {
	var findEscaped = escapeRegExp(find);
	return this.replace(new RegExp(findEscaped, 'g'), replace);
}

String.prototype.chunk = function(size) {
	return this.match(new RegExp('.{1,' + size + '}', 'g'));
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.equalsIgnoreCase = function(str) {
	if (this && str) {
		return this.toLowerCase() == str.toLowerCase();
	}
}

String.prototype.hasWord = function(word) {
	return new RegExp("\\b" + word + "\\b", "i").test(this);
}

String.prototype.startsWith = function (str) {
	return this.indexOf(str) == 0;
};

String.prototype.endsWith = function (str){
	return this.slice(-str.length) == str;
};

String.prototype.summarize = function(maxLength, EOM_Message) {
	if (!maxLength) {
		maxLength = 101;
	}
	var summary = this;
	if (summary.length > maxLength) {
		summary = summary.substring(0, maxLength);
		var lastSpaceIndex = summary.lastIndexOf(" ");
		if (lastSpaceIndex != -1) {
			summary = summary.substring(0, lastSpaceIndex);
			summary = summary.trim();
		}
		summary += "...";
	} else {
		if (EOM_Message) {
			summary += EOM_Message;
		}
	}
	
	// patch: do not why: but it seem that unless i append a str to summary, it returns an array of the letters in summary?
	return summary + "";
}

// match only url and path (NOT query parameters)
String.prototype.urlOrPathContains = function(str) {
	var strIndex = this.indexOf(str);
	if (strIndex != -1) {		
		var queryParamsStart = this.indexOf("?");
		// if query make sure that we don't match the str inside query params
		if (queryParamsStart != -1) {
			if (strIndex < queryParamsStart) {
				return true;
			} else {
				return false;
			}
		} else {
			return true;
		}
	} else {
		return false;
	}
}

String.prototype.parseTime = function(defaultDate) {
	var d;
	if (defaultDate) {
		d = new Date(defaultDate);
	} else {
		d = new DateZeroTime();
	}
	
    let thisDate = this;

    // french canadian language parsing ie. 08 h 30
    thisDate = thisDate.replace(/(\d+) ?h ?(\d+)/i, '$1:$2');

	let pieces;
	if (thisDate.includes(":")) { // "17 September 2015 at 20:56"
		pieces = thisDate.match(/(\d+)([:|\.](\d\d))\s*(a|p)?/i);
	} else { // "2pm"
		pieces = thisDate.match(/(\d+)([:|\.](\d\d))?\s*(a|p)?/i);
	}

	if (pieces?.length >= 5) {
		// patch: had to use parseFloat instead of parseInt (because parseInt would return 0 instead of 9 when parsing "09" ???		
        var hoursStr = pieces[1];
		var hours = parseFloat(hoursStr);
        var sep = pieces[2];
        var minutes = parseFloat(pieces[3]) || 0;
		var ampm = pieces[4];
        //console.log("hours", hours);
        //console.log("sep", sep);
        //console.log("minutes", minutes);

        if (hours >= 100) { // ie. 0900
            if (hoursStr.length <= 3) { // ### ie 3 digits long
                hours = hoursStr.substring(0, 1);
                minutes = hoursStr.substring(1);
            } else { // #### 4 digits long
                hours = hoursStr.substring(0, 2);
                minutes = hoursStr.substring(2);
            }
        }

		// patch for midnight because 12:12am is actually 0 hours not 12 hours for the date object
		if (hours == 12) {
			if (ampm?.toLowerCase().startsWith("a")) {
				hours = 0;
			}
		} else if (ampm?.toLowerCase().startsWith("p")) {
			hours += 12;
		}
		d.setHours(hours);		
		d.setMinutes(minutes);
		d.setSeconds(0, 0);
		return d;
	}
}

String.prototype.htmlEntities = function() {
	return String(this).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseDate(dateStr) {
    if (typeof dateStr != "string") {
        return dateStr;
    }

	/*
	// v1: bug patch: it seems that new Date("2011-09-21") return 20th??? but if you use slashes instead ie. 2011/09/21 then it works :)
    // v2: Append the time ie. Date.parse(`${el.getAttribute("data-date")}T00:00:00.000`)
	if (this.length <= 10) {
		return new Date(Date.parse(this.replace("-", "/")));
	} else {
		return new Date(Date.parse(this));
	}
	*/
	var DATE_TIME_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(\+|-)(\d\d):(\d\d)$/;
	var DATE_TIME_REGEX_Z = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+Z$/;
	var DATE_TIME_REGEX_Z2 = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)+Z$/;
	var DATE_MILLI_REGEX = /^(\d\d\d\d)(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)$/;
	var DATE_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
	var DATE_NOSPACES_REGEX = /^(\d\d\d\d)(\d\d)(\d\d)$/;

	/* Convert the incoming date into a javascript date
	 * 2012-09-26T11:42:00-04:00
	 * 2006-04-28T09:00:00.000-07:00
	 * 2006-04-28T09:00:00.000Z
	 * 2010-05-25T23:00:00Z (new one from jason)
	 * 2006-04-19
	 */

	  var parts = DATE_TIME_REGEX.exec(dateStr);
	  
	  // Try out the Z version
	  if (!parts) {
	    parts = DATE_TIME_REGEX_Z.exec(dateStr);
	  }
	  if (!parts) {
		parts = DATE_TIME_REGEX_Z2.exec(dateStr);
	  }
	  
	  if (exists(parts) && parts.length > 0) {
	    var d = new Date();
	    d.setUTCFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
	    d.setUTCHours(parts[4]);
	    d.setUTCMinutes(parts[5]);
	    d.setUTCSeconds(parts[6]);
		d.setUTCMilliseconds(0);

	    var tzOffsetFeedMin = 0;
	    if (parts.length > 8) {
	      tzOffsetFeedMin = parseInt(parts[9],10) * 60 + parseInt(parts[10],10);
	      if (parts[8] != '-') { // This is supposed to be backwards.
	        tzOffsetFeedMin = -tzOffsetFeedMin;
	      }
	    }
	    return new Date(d.getTime() + tzOffsetFeedMin * ONE_MINUTE);
	  }
	  
	  parts = DATE_MILLI_REGEX.exec(dateStr);
	  if (exists(parts)) {
			var d = new Date();
			d.setFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
		    d.setHours(parts[4]);
		    d.setMinutes(parts[5]);
		    d.setSeconds(parts[6]);
			d.setMilliseconds(0);
			return d;
	  }
	  if (!parts) {
		  parts = DATE_REGEX.exec(dateStr);
	  }
	  if (!parts) {
		  parts = DATE_NOSPACES_REGEX.exec(dateStr);
	  }
	  if (exists(parts) && parts.length > 0) {
	    return new Date(parts[1], parseInt(parts[2],10) - 1, parts[3]);
	  }
	  if (!isNaN(dateStr)) {
		  return new Date(dateStr);
	  }
	  return null;
}

function initAnalytics() {
	if (DetectClient.isChrome()) {
		console.log("initAnalytics");
		// load this immediately if in background
		const ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
		ga.src = '/js/analytics.js';
		const s = document.getElementsByTagName('script')[0];
		if (s) {
			s.parentNode.insertBefore(ga, s);
		}
	}
}

// usage: sendGA('category', 'action', 'label');
// usage: sendGA('category', 'action', 'label', value);  // value is a number.
// usage: sendGA('category', 'action', {'nonInteraction': 1});
function sendGA(category, action, label, etc) {
	console.log("%csendGA: " + category + " " + action + " " + label, "font-size:0.6em");

	// patch: seems arguments isn't really an array so let's create one from it
	var argumentsArray = [].slice.call(arguments, 0);

	var gaArgs = ['send', 'event'];
	// append other arguments
	gaArgs = gaArgs.concat(argumentsArray);
	
	// send to google
	if (globalThis.ga) {
		ga.apply(this, gaArgs);
	}
}

function isAsianLangauge() {
	return /ja|zh|ko/.test(locale);
}

/*
async function initMessagesInTemplates(templates) {
    if (templates) {
        for (const template of templates) {
            const node = template.content.firstElementChild;
            if (node) {
                initMessages(node, true);
                initMessages(node.querySelectorAll("*"), true);
                let innerTemplates = template.content.querySelectorAll("template");
                initMessagesInTemplates(innerTemplates);
            }
        }
    } else {
        templates = document.querySelectorAll("template");
        if (templates.length) {
            initMessagesInTemplates(templates);
        }
    }
}
*/

(async function() {
    // For some reason including scripts for popup window slows down popup window reaction time, so only found that settimeout would work
    if (location.href.includes("popup.") || location.href.includes("options.") || location.href.includes("reminders.")) {
        await sleep(seconds(4));
        //initAnalytics();
    }
})();

async function initUI() {
    await initMisc({UIonly: true});
    initMessages();
    //initMessagesInTemplates();
}

async function initMisc(params = {}) {
    if (!globalThis.initMiscPromise) {
        console.info("initMisc", new Date());
        globalThis.initMiscPromise = new Promise(async (resolve, reject) => {
            
            await DetectClient.init();

            if (!await storage.get("console_messages")) {
                console.log = console.debug = function () {};
            }

            globalThis.locale = await storage.get("language");
            globalThis.twentyFourHour = await storage.get("24hourMode");
            await loadLocaleMessages();
            initCalendarNames(dateFormat.i18n, dateFormat.i18nEnglish);
            await initOauthAPIs();
            Controller();

            initColorsForNonStandardCalendars();

            if (!params.UIonly) {
                console.info("initWindowBGVars");
    
                eventsShown = await storage.get("eventsShown");
                notificationsQueue = await storage.get("notificationsQueue");
                notificationsOpened = await storage.get("notificationsOpened");
                globalThis.cachedFeeds = await storage.get("cachedFeeds");
                globalThis.cachedFeedsDetails = await storage.get("cachedFeedsDetails");
    
                globalThis.forgottenReminder = ForgottenReminder();
                ChromeTTS();
    
                await initPopup();
            
                initEventDates(eventsShown);
    
                calendarMap = await initCalendarMap();
    
                console.time("feeds");
                const arrayOfCalendars = await getArrayOfCalendars();
                const feeds = arrayOfCalendars.map(calendar => cachedFeeds[calendar.id]);
                console.time("mergeevents");
                events = await mergeEvents(feeds);
                console.timeEnd("mergeevents");
                console.timeEnd("feeds");
            }
            resolve();
        });
    }
    return globalThis.initMiscPromise;
}

function openContributeDialog(key, params = {}) {
	if (params.monthly) {
        const content = new DocumentFragment();
        content.append(getMessage("extraFeaturesMonthlyBlurb"));
        if (params.footerText) {
            content.append(createBR(), createBR(), params.footerText);
        }
        openDialog(content, {
            cancel: true,
            buttons: [{
                label: getMessage("moreInfo"),
                onClick: () => {
                    openUrl("https://jasonsavard.com/wiki/Gmail_API_Quota?ref=contributeDialog");
                }
            }, {
                label: getMessage("monthlyContribution"),
                primary: true,
                onClick: () => {
                    openUrl(`contribute.html?action=${key}&contributionType=monthly`);
                }
            }]
        })
    } else if (params.addMultipleAccounts) {
        const content = new DocumentFragment();
        content.append(getMessage("manuallyAddingMultipleAccountsCost"), createBR(), createBR(), getMessage("manuallyAddingMultipleAccountsCost2", params.maxAccountsForFree), createBR(), createBR(), getMessage("extraFeaturesPopup2"));
        openDialog(content, {
            title: getMessage("extraFeatures"),
            cancel: true,
            buttons: [{
                label: getMessage("contribute"),
                primary: true,
                onClick: () => {
                    openUrl(`contribute.html?action=${key}`);
                }
            }]
        });
	} else {
        const content = new DocumentFragment();
        content.append(getMessage("extraFeaturesPopup1"), createBR(), getMessage("extraFeaturesPopup2"))
        openDialog(content, {
            title: getMessage("extraFeatures"),
            cancel: true,
            buttons: [{
                label: getMessage("contribute"),
                primary: true,
                onClick: () => {
                    openUrl(`contribute.html?action=${key}`);
                }
            }]
        });
	}
}

async function setStorage(element, params) {
	var OFF_OR_DEFAULT = DEFAULT_SETTINGS_ALLOWED_OFF.includes(params.key) && (!params.value || STORAGE_DEFAULTS[params.key] == params.value);
	if ((element.closest("[mustDonate]") || params.mustDonate) && !donationClickedFlagForPreventDefaults && !OFF_OR_DEFAULT) {
		params.event.preventDefault();
		openContributeDialog(params.key);
		return Promise.reject(JError.DID_NOT_CONTRIBUTE);
	} else {
		return storage.set(params.key, params.value);
	}
}

function initPaperElement($nodes, params = {}) {
    $nodes = selectorAll($nodes);
	$nodes.forEach(async element => {
		const key = element.getAttribute("storage");
        element.removeAttribute("storage");
		var permissions;
		if (DetectClient.isChromium()) {
			permissions = element.getAttribute("permissions");
            element.removeAttribute("permissions");
		}
		
        let storageValue;
        if (key) {
            storageValue = await storage.get(key);
        }
		if (key && key != "language") { // ignore lang because we use a specific logic inside the options.js
            if (element.nodeName.equalsIgnoreCase("input")) {
                if (element.type == "checkbox") {
                    element.checked = toBool(storageValue);
                } else if (element.type == "radio") {
                    if (element.value == storageValue) {
                        element.checked = true;
                    }
                } else {
                    element.value = storageValue ?? "";
                }
            } else if (element.nodeName.equalsIgnoreCase("j-input")) {
                element.value = storageValue ?? "";
            } else if (element.nodeName.equalsIgnoreCase("select")) {
                element.value = storageValue ?? "";
            }
		} else if (permissions) {
            try {
                element.checked = await chrome.permissions.contains({permissions: [permissions]});
            } catch (error) {
                console.warn("could not get permissions: " + error);
            }
		}

		// need a 1ms pause or else setting the default above would trigger the change below?? - so make sure it is forgotten
        //sleep(500);    
        
        let eventName;
        if (element.nodeName.equalsIgnoreCase("input")) {
            eventName = "change";
        } else if (element.nodeName.equalsIgnoreCase("j-input")) {
            eventName = "change";
        } else if (element.nodeName.equalsIgnoreCase("select")) {
            eventName = "change";

            element.addEventListener("click", function(event) {
                // store previous value in case need to revert
                element.dataset.previousValue = this.value;
            });
        } else {
            throw Error("unsupported element for initPaperElement: " + element.nodeName + " for key: " + key);
        }

        element.addEventListener(eventName, function(event) {
            if (key || params.key) {

                let value;

                if (element.nodeName.equalsIgnoreCase("input")) {
                    if (element.type == "checkbox") {
                        value = element.checked;
                    } else if (element.type == "radio") {
                        if (element.checked) {
                            value = element.value;
                        }
                    } else {
                        value = element.value;
                    }
                } else if (element.nodeName.equalsIgnoreCase("j-input")) {
                    value = element.value;
                } else if (element.nodeName.equalsIgnoreCase("select")) {
                    value = element.value;
                }

                let storagePromise;

                if (key) {
                    storagePromise = setStorage(element, {event:event, key:key, value:value});
                } else if (params.key) {
                    params.event = event;
                    params.value = value;
                    storagePromise = setStorage(element, params);
                }
                
                storagePromise.catch(error => {
                    console.error("could not save setting: " + error);
                    
                    if (element.nodeName.equalsIgnoreCase("input") && element.type == "checkbox") {
                        element.checked = !element.checked;
                    } else if (element.nodeName.equalsIgnoreCase("select")) {
                        element.dataset.attemptedValue = value;
                        if (element.dataset.previousValue) {
                            element.value = element.dataset.previousValue;
                        } else {
                            element.value = storageValue;
                        }
                    }
                    
                    if (error != JError.DID_NOT_CONTRIBUTE) {
                        showError(error);
                    }
                });
            } else if (permissions) {
                if (element.checked) {
                    chrome.permissions.request({permissions: [permissions]}, function(granted) {
                        if (granted) {
                            element.checked = granted;
                        } else {
                            element.checked = false;
                            niceAlert("Might not be supported by this OS");
                        }
                    });
                } else {			
                    chrome.permissions.remove({permissions: [permissions]}, function(removed) {
                        if (removed) {
                            element.checked = false;
                        } else {
                            // The permissions have not been removed (e.g., you tried to remove required permissions).
                            element.checked = true;
                            niceAlert("These permissions could not be removed, they might be required!");
                        }
                    });
                }
            }
        });
	});
}

function initMessages(node) {
	// options page only for now..
    if (location.href.includes("options.html")
        || location.href.includes("popup.html")
        || location.href.includes("reminders.html")
        || location.href.includes("contribute.html")) {
		htmlElement.dir = getMessage("dir");
	}

	let nodes;

	if (node) {
        if (node.querySelectorAll) { // node instanceof DocumentFragment
            nodes = node.querySelectorAll("*");
        } else {
            nodes = selectorAll(node);
        }
	} else {
		nodes = selectorAll("*");
	}

	nodes.forEach(el => {
		let attr = el.getAttribute("msg");
		if (attr) {
            const msgArg1 = el.getAttribute("msgArg1");
			if (msgArg1) {
                el.textContent = getMessage( attr, msgArg1 )
                const msgArg2 = el.getAttribute("msgArg2");
				if (msgArg2) {
                    el.textContent = getMessage(attr, [msgArg1, msgArg2]);
				}
			} else {
				// look for inner msg nodes to replace before...
                const innerMsg = el.querySelectorAll("*[msg]");
				if (innerMsg.length) {
					initMessages(innerMsg);
                    const msgArgs = Array.from(innerMsg).map(msg => msg.outerHTML);
                    el.innerHTML = getMessage(attr, msgArgs);
				} else {
					if (el.nodeName == "PAPER-TOOLTIP") {
						const $innerNode = el.querySelector(".paper-tooltip");
						if ($innerNode) {
                            $innerNode.textContent = getMessage(attr);
						} else {
                            el.textContent = getMessage(attr);
						}
					} else {
                        el.textContent = getMessage(attr);
					}
				}
			}
		}

        function processAttribute(sourceAttr, sourceAttrArg1, destAttr) {
            const attr = el.getAttribute(sourceAttr);
            if (attr) {
                const msgArg1 = sourceAttrArg1 &&= el.getAttribute(sourceAttrArg1);
                if (msgArg1) {
                    el.setAttribute(destAttr, getMessage(attr, msgArg1));
                } else {
                    el.setAttribute(destAttr, getMessage(attr));
                }
            }
        }

        processAttribute("msgTitle", "msgTitleArg1", "title");
        processAttribute("msgLabel", "msgLabelArg1", "label");
        processAttribute("msgText", "msgTextArg1", "text");
        processAttribute("msgValue", "msgValueArg1", "value");
        processAttribute("msgPlaceholder", "msgPlaceholderArg1", "placeholder");

        attr = el.getAttribute("msgSrc");
		if (attr) {
			el.src = getMessage(attr);
		}

        attr = el.getAttribute("msgHTML");
		if (attr) {
			const msgArg1 = el.getAttribute("msgArg1");
			if (msgArg1) {
				const args = [msgArg1];

				const msgArg2 = el.getAttribute("msgArg2");
				if (msgArg2) {
					args.push(msgArg2);
				}

				el.innerHTML = getMessage(el.getAttribute("msgHTML"), args);
			} else {
				// look for inner msg nodes to replace before...
                const innerMsg = el.querySelectorAll("*[msg]");
				if (innerMsg.length) {
					initMessages(innerMsg);
                    const msgArgs = Array.from(innerMsg).map(msg => msg.outerHTML);
                    el.innerHTML = getMessage(attr, msgArgs);
				} else {
                    el.innerHTML = getMessage(attr);
				}
			}
		}
		attr = el.getAttribute("msgPosition");
		if (attr) {
			if (htmlElement.dir == "rtl" && attr == "left") {
				el.setAttribute("position", "right");
			} else if (htmlElement.dir == "rtl" && attr == "right") {
				el.setAttribute("position", "left");
			} else {
				el.setAttribute("position", attr);
			}
		}

		attr = el.getAttribute("msgTime");
		if (attr) {
			el.textContent = attr.parseTime().toLocaleTimeStringJ();
		}
	});

	function addWarning(attrName) {
        const WARNING_MESSAGE = "Not supported by this browser!";
		const $nodes = selectorAll(`[${attrName}]`);

        $nodes.forEach(el => {
            if (!el._warningAdded) {
                el._warningAdded = true;
                el.querySelector("paper-tooltip")?.remove();
    
                el.setAttribute("disabled", "");
                el.style.opacity = "0.5";
                
                const paperTooltip = document.createElement("paper-tooltip");
                paperTooltip.textContent = WARNING_MESSAGE;
                el.append(paperTooltip);
                onClick(el, function (e) {
                    openDialog(WARNING_MESSAGE);
                    e.preventDefault();
                    e.stopPropagation();
                });
		    }
        });
	}

	if (!DetectClient.isChromium()) {
		addWarning("chromium-only");
    }

    if (DetectClient.isFirefox()) {
        addWarning("not-firefox");
        removeAllNodes("[hide-from-firefox]")
    }

    if (DetectClient.isOpera()) {
        addWarning("not-opera");
        removeAllNodes("[hide-from-opera]");
    }
    
    if (DetectClient.isEdge()) {
        addWarning("hide-from-edge");
        removeAllNodes("[hide-from-edge]");
    }
    
    if (!DetectClient.isWindows()) {
        removeAllNodes("[windows-only]");
    }
}

async function donationClicked(action) {
	if (await storage.get("donationClicked")) {
		return true;
	} else {
		openContributeDialog(action);
		return false;
	}
}

async function getChromeWindows() {
    const windows = await chrome.windows.getAll();
    // keep only normal windows and not app windows like debugger etc.
    const normalWindows = windows.filter(thisWindow => {
        return thisWindow.type == "normal";
    });
    return normalWindows;
}

async function findTab(url) {
    try {
        const tabs = await chrome.tabs.query({url:url + "*"});
        if (tabs.length) {
            const tab = tabs.last();
            await chrome.tabs.update(tab.id, {active:true});
            // must do this LAST when called from the popup window because if set focus to a window the popup loses focus and disappears and code execution stops
            await chrome.windows.update(tab.windowId, {focused:true});
            return {found:true, tab:tab};
        }
    } catch (error) {
        console.warn(error);
        // ignore error
    }
}

//usage: openUrl(url, {urlToFind:""})
async function openUrl(url, params = {}) {
    if (globalThis.inWidget) {
        top.location.href = url;
    } else {
        let response;
        const normalWindows = await getChromeWindows();
        if (normalWindows.length == 0) { // Chrome running in background
            const createWindowParams = {url:url};
            if (DetectClient.isChromium()) {
                createWindowParams.focused = true;
            }
            const createdWindow = await chrome.windows.create(createWindowParams);
            response = await findTab(url);
        } else {
            if (params.urlToFind) {
                response = await findTab(params.urlToFind);
            }

            if (!response?.found) {
                response = await createTabAndFocusWindow(url);
            }
                
            if (location.href.includes("source=toolbar") && DetectClient.isFirefox() && params.autoClose !== false) {
                globalThis.close();
            }
        }
        return response;
    }
}

async function createTabAndFocusWindow(url) {
    let windowId;
    // 2026 commented detection and just do it for all because seems vivaldi also behaved this way, but could not detect it
    //if (DetectClient.isFirefox()) { // required for Firefox and (Vivaldi also) because when inside a popup the tabs.create would open a tab/url inside the popup but we want it to open inside main browser window 
        const thisWindow = await chrome.windows.getCurrent();
        if (thisWindow?.type == "popup") {
            const lastFocusedWindow = await chrome.windows.getLastFocused({windowTypes:["normal"]});
            if (lastFocusedWindow) {
                windowId = lastFocusedWindow.id;
            }
        }
    //}

    const createParams = {url: url};
    if (windowId) {
        createParams.windowId = windowId;
    }
    const tab = await chrome.tabs.create(createParams);
    await chrome.windows.update(tab.windowId, {focused:true});
    return tab;
}

function removeNode(id) {
	var o = document.getElementById(id);
	if (o) {
		o.parentNode.removeChild(o);
	}
}

function addCSS(id, css) {
	removeNode(id);
	const s = document.createElement('style');
	s.id = id;
	s.setAttribute('type', 'text/css');
	s.appendChild(document.createTextNode(css));
	(document.getElementsByTagName('head')[0] || document.documentElement).appendChild(s);
	return s;
}

function pad(str, times, character) { 
	var s = str.toString();
	var pd = '';
	var ch = character ? character : ' ';
	if (times > s.length) { 
		for (var i=0; i < (times-s.length); i++) { 
			pd += ch; 
		}
	}
	return pd + str.toString();
}

function toBool(str) {
	if ("false" === str || str == undefined) {
		return false;
	} else if ("true" === str) {
		return true;
	} else {
		return str;
	}
}

// name case sensitive
// url (optional defaults to location.href)
function getUrlValue(name, url) {
    url ||= globalThis.location?.href;

    const urlObj = new URL(url, "https://jasondefault.com");
    return urlObj.searchParams.get(name);
}

function setUrlParam(url, name, value) {
    const DEFAULT_DOMAIN = "https://jasondefault.com";

    let urlObj;
    let origin;

    if (!url.includes("://")) {
        let domain = DEFAULT_DOMAIN;
        if (!url.startsWith("/")) {
            domain += "/";
        }

        urlObj = new URL(domain + url);
        origin = "";
    } else {
        urlObj = new URL(url, DEFAULT_DOMAIN);
        origin = urlObj.origin;
    }

    const searchParams = urlObj.searchParams;
    if (value == null || value == "") {
        searchParams.delete(name);
    } else {
        searchParams.set(name, value);
    }

    url = `${origin}${urlObj.pathname}?${searchParams}`;
    if (urlObj.hash) {
        url += urlObj.hash;
    }

    return url;
}

function exists(o) {
	if (o) {
		return true;
	} else {
		return false;	
	}	
}

function getExtensionIDFromURL(url) {
	//"chrome-extension://dlkpjianaefoochoggnjdmapfddblocd/options.html"
	return url.split("/")[2]; 
}

function findTag(str, name) {
	if (str) {
		var index = str.indexOf("<" + name + " ");
		if (index == -1) {
			index = str.indexOf("<" + name + ">");
		}
		if (index == -1) {
			return null;
		}
		var closingTag = "</" + name + ">";
		var index2 = str.indexOf(closingTag);
		return str.substring(index, index2 + closingTag.length);
	}
}

function trim(str) {
    if (str) {
        str = str.trim();
    }
    return str;
}

function trimLineBreaks(str) {
	if (str) {
		str = str.replace(/^\n*/g, "");
		str = str.replace(/\n*$/g, "");
	}
	return str;
}

function cleanEmailSubject(subject) {
	if (subject) {
		subject = subject.replace(/^re: ?/i, "");
		subject = subject.replace(/^fwd: ?/i, "");
	}
	return subject;	
}

function extractEmails(text) {
	if (text) {
		return text.match(/([a-zA-Z0-9.!#$%^_+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
	}
}

function obscureEmails(str) {
    let matches = extractEmails(str);
    if (matches) {
        matches.forEach (email => {
            console.log(email);
            str = str.replace(email, email.split("@")[0].substring(0,3) + "...@cutoff.com");
        });
    }
    return str;
}

function getHost(url) {
	if (url) {
		var matches = url.match(/:\/\/([^\/?#]*)/);
		if (matches?.length >=2) {
			return matches[1];
		}
	}
}

function ellipsis(str, cutoffLength) {	
	if (str && str.length > cutoffLength) {
		str = str.substring(0, cutoffLength) + " ...";
	}
	return str;
}

function DetectSleepMode() {
	var PING_INTERVAL = 60; // 1 minute
	var PING_INTERVAL_BUFFER = 15;
	
	async function lastPingIntervalToolLong() {
        const lastPingTime = await storage.get("lastPingTime");
		return lastPingTime?.diffInSeconds() < -(PING_INTERVAL+PING_INTERVAL_BUFFER);
	}

    this.init = function() {
        storage.setDate("lastPingTime");
        storage.set("lastWakeupTime", new Date(1)); // make the last wakeup time really old because extension starting up does not equal a wakeup 
    }
	
	this.ping = async function() {
		if (await lastPingIntervalToolLong()) {
			console.log("DetectSleepMode.wakeup time: " + new Date());
            storage.setDate("lastWakeupTime");
		}
        storage.setDate("lastPingTime");
	}

	this.isWakingFromSleepMode = async function() {
        const lastPingTime = await storage.get("lastPingTime");
        const lastWakeupTime = await storage.get("lastWakeupTime");
		console.log("DetectSleepMode.last ping: " + lastPingTime);
		console.log("last wakeuptime: " + lastWakeupTime);
		console.log("current time: " + new Date())
		// if last wakeup time was recently set than we must have awoken recently
		if (await lastPingIntervalToolLong() || lastWakeupTime?.diffInSeconds() >= -(PING_INTERVAL+PING_INTERVAL_BUFFER)) {
			return true;
		} else {
			return false;
		}
	}
}

function Controller() {

	// apps.jasonsavard.com server
	Controller.DOMAIN = "https://apps.jasonsavard.com/";
	
	// internal only for now
	function callAjaxController(params) {
        return fetchJSON(Controller.DOMAIN + "controller.php", params.data, {
            method: params.method ? params.method : "GET",
            headers: {
                misc: location.href,
                "item-id": ITEM_ID
            }
        });
	}

	Controller.verifyPayment = function(itemID, emails) {
		return callAjaxController({
            method: "POST",
            data: {
                action: "verifyPayment",
                name: itemID,
                email: emails
            }
        });
	}

	Controller.getSkins = function(ids, timeMin) {
		const data = {
            action: "getSkins",
            extension: "calendar",
            misc: location.href
        };

        if (ids) {
            data.ids = ids;
        }

		if (timeMin) {
			data.timeMin = Math.round(new Date().diffInSeconds(timeMin)); // seconds elapsed since now
		}
		
		return callAjaxController({data:data});
	}

	Controller.updateSkinInstalls = function(id, offset) {
		const data = {
            action: "updateSkinInstalls",
            id: id,
            offset: offset,
            misc: location.href
        };
		
		// had to pass misc as parameter because it didn't seem to be passed with header above
		return callAjaxController({data:data});
	}
	
	Controller.processFeatures = async () => {
		await storage.enable("donationClicked");
        await initRealtimeSync();
		chrome.runtime.sendMessage({command: "featuresProcessed"}, function(response) {});
	}

    Controller.convertUSDToOtherCurrency = (amount, currency) => {
        currency ||= getMessage("currencyCode");
        if (currency == "JPY") {
            return amount * 100;
        } else if (currency == "TWD") {
            return amount * 30;
        } else {
            return amount;
        }
    }

    Controller.getMinimumPayment = async () => {
        const donationClickedFlag = await storage.get("donationClicked");

        const MIN_PAYMENT_KEY = "_minimumPayment";
        let minPaymentObj = shallowClone(await storage.get(MIN_PAYMENT_KEY) || {
            onetime_payment: 10,
            onetime_payment_reduced: 1,
            onetime_payment_already_contributed: 5,
            monthly_payment: 2,
            yearly_payment: 20
        });
        
        const DAYS_TO_CACHE = 10;
        if (!minPaymentObj.lastFetchDate || minPaymentObj.lastFetchDate.diffInDays() <= -DAYS_TO_CACHE) {
            try {
                minPaymentObj = await callAjaxController({ data: { action: "getMinimumContribution" } });
                minPaymentObj.lastFetchDate = new Date();
                await storage.set(MIN_PAYMENT_KEY, minPaymentObj);
            } catch (error) {
                console.error("getMinimumPayment error: ", error);
            }
        } else {
            console.log("cached min");
        }

        minPaymentObj.getOneTimePayment = function(currency) {
            if (donationClickedFlag) {
                return Controller.convertUSDToOtherCurrency(this.onetime_payment_already_contributed, currency);
            } else {
                return Controller.convertUSDToOtherCurrency(this.onetime_payment, currency);
            }
        }

        minPaymentObj.getOneTimeReducedPayment = function(currency) {
            return Controller.convertUSDToOtherCurrency(this.onetime_payment_reduced, currency);
        }

        minPaymentObj.getMonthlyPayment = function(currency) {
            return Controller.convertUSDToOtherCurrency(this.monthly_payment, currency);
        }

        minPaymentObj.getYearlyPayment = function(currency) {
            return Controller.convertUSDToOtherCurrency(this.yearly_payment, currency);
        }

        return minPaymentObj;
    }
}

async function getActiveTab() {
	const tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    if (tabs?.length >= 1) {
        return tabs[0];
    }
}

function ChromeTTS() {
	
	var chromeTTSMessages = [];
	var speaking = false;
	
	ChromeTTS.queue = async function(msg, params = {}) {
		// this might have fixed the endless loop
		if (msg != null && msg != "") {
			params.utterance = msg;
			chromeTTSMessages.push(params);
			await play();
		}
	};

	ChromeTTS.stop = function() {
		if (chrome.tts) {
			chrome.tts.stop();
		}
		chromeTTSMessages = [];
		speaking = false;
	};

	ChromeTTS.isSpeaking = function() {
		return speaking;
	}

	function setVoiceByLang(chromeTTSMessage, lang, voices) {
		const voiceFound = voices.find(voice => {
			return voice.lang && voice.lang.match(lang);
		});
		
		if (voiceFound) {
			chromeTTSMessage.voiceName = voiceFound.voiceName;
			chromeTTSMessage.extensionId = voiceFound.extensionId;
		}
	}

	function play() {
		return new Promise(async (resolve, reject) => {

            // must declare these here because chrome.tts.* had issues with async callbacks and trying to queue several phrases
            const voiceParams = await storage.get("notificationVoice");
            const volume = await storage.get("voiceSoundVolume") / 100;
            const pitch = parseFloat(await storage.get("pitch"));
            const rate = parseFloat(await storage.get("rate"));

			if (chromeTTSMessages.length) {

                if (chromeTTSMessages[0].utterance) {
                    // decoded etity codes ie. &#39; is ' (apostrohpe)
                    chromeTTSMessages[0].utterance = await htmlToText(chromeTTSMessages[0].utterance);
                } else {
                    chromeTTSMessages[0].utterance = "";
                }

				const speakingParam = await chrome.tts.isSpeaking();
                console.log(speaking + " : " + speakingParam);
                const chromeTTSMessage = chromeTTSMessages[0];
                if (!speaking && !speakingParam && chromeTTSMessage?.utterance) {
                    chromeTTSMessage.voiceName = voiceParams.split("___")[0];
                    chromeTTSMessage.extensionId = voiceParams.split("___")[1];

                    console.log("speak: " + chromeTTSMessage.utterance + " " + new Date());
                    speaking = true;
                    chrome.tts.stop();
                    
                    const detectLanguageResult = await chrome.i18n.detectLanguage(chromeTTSMessage.utterance);
                    const voices = await chrome.tts.getVoices();
                    var voiceUserChose = voices.find(voice => {
                        return voice.voiceName == chromeTTSMessage.voiceName && voice.extensionId == chromeTTSMessage.extensionId;
                    });
                    
                    if (!voiceUserChose || !voiceUserChose.lang) {
                        // user chose voice with a lang (ie. native) don't use auto-detect because it does not have a fallback lang attribute
                    } else if (chromeTTSMessage.forceLang) {
                        if (voiceUserChose && voiceUserChose.lang && voiceUserChose.lang.match(chromeTTSMessage.forceLang)) {
                            // since forced lang is same a user chosen lang then do nothing and use the user default
                        } else {
                            setVoiceByLang(chromeTTSMessage, chromeTTSMessage.forceLang, voices);
                        }
                    } else if (detectLanguageResult.isReliable) {
                        var detectedLang = detectLanguageResult.languages.first().language;
                        console.log("detectedLang: " + detectedLang);
                        if (voiceUserChose && voiceUserChose.lang && voiceUserChose.lang.match(detectedLang)) {
                            // do nothing
                        } else {
                            setVoiceByLang(chromeTTSMessage, detectedLang, voices);
                        }
                    } else if (chromeTTSMessage.defaultLang) {
                        setVoiceByLang(chromeTTSMessage, chromeTTSMessage.defaultLang, voices);
                    }
                    
                    // check the time between when we executed the speak command and the time between the actual "start" event happened (if it doesn't happen then let's break cause we could be stuck)
                    var speakNotStartedTimer = setTimeout(function() {
                        console.log("start event never happened: so stop voice: " + new Date());
                        // stop will invoke the "interuppted" event below and it will process end/next speak events
                        chrome.tts.stop();
                    }, seconds(4));
                    
                    chrome.tts.speak(chromeTTSMessage.utterance, {
                        voiceName: chromeTTSMessage.voiceName,
                        extensionId : chromeTTSMessage.extensionId,
                            //enqueue : true,
                            volume: volume,
                            pitch: pitch,
                            rate: rate,
                            onEvent: function(event) {
                                console.log('event: ' + event.type + " " + new Date());
                                if (event.type == "start") {
                                    clearTimeout(speakNotStartedTimer);
                                } else if (event.type == "interrupted" || event.type == 'error' || event.type == 'end' || event.type == 'cancelled') {
                                    clearTimeout(speakNotStartedTimer);
                                    chromeTTSMessages.shift();
                                    speaking = false;

                                    // delay between plays
                                    setTimeout(function() {
                                        play().then(() => {
                                            resolve();
                                        }).catch(error => {
                                            reject(error);
                                        });
                                    }, chromeTTSMessage.noPause ? 1 : 150);
                                }
                            }
                    }, function() {
                        if (chrome.runtime.lastError) {
                            logError('speech error: ' + chrome.runtime.lastError.message);
                        }
                    });
                } else {
                    //console.log("already speaking, wait before retrying...");
                    setTimeout(() => {
                        play().then(() => {
                            resolve();
                        }).catch(error => {
                            reject(error);
                        });
                    }, seconds(1));
                }
			} else {
				resolve();
			}
		});
	}
}

async function fetchWrapper(url, options) {
    try {
        options ||= {};
        options.headers ||= {};
        options.headers["request-id"] = `req-${crypto.randomUUID()}`;
        return await fetch(url, options);
    } catch (error) {
        if (await isOnline()) {
            console.error("Fetch error: " + error);
            const customError = Error(getMessage("networkProblem"), {cause: ErrorCause.NETWORK_PROBLEM});
            customError.originalError = error;
            customError.jError = JError.NETWORK_ERROR;
            throw customError;
        } else {
            throw Error(getMessage("yourOffline"), {cause: ErrorCause.OFFLINE});
        }
    }
}

async function fetchText(url, searchStreamFunction) {
    const response = await fetchWrapper(url);
    if (response.ok) {
        if (searchStreamFunction) {
            const reader = response.body.getReader();
            const utf8decoder = new TextDecoder();
            let data = "";
            let searchResult;

            console.log("start")
            return reader.read().then(function processText({ done, value }) {
                if (done) {
                    console.log("Stream complete");
                    return;
                } else {
                    console.log("Stream read");
                }
            
                data += utf8decoder.decode(value, {stream: true});

                searchResult = searchStreamFunction(data);
                console.log("search result: ", searchResult);
                if (searchResult) {
                    console.log("found");
                    reader.cancel("searchFound");
                    return;
                } else {
                    return reader.read().then(processText);
                }
            }).then(() => {
                console.log("end: ", searchResult);
                return searchResult;
            });
        } else {
        return response.text();
        }
    } else {
        const error = Error(response.statusText);
        error.status = response.status;
        throw error;
    }
}

async function fetchJSON(url, data, options = {}) {
    if (options.method) {
        options.method = options.method.toUpperCase();
    }

    if (data) {
        // default is get
        if (!options.method || /GET/i.test(options.method)) {
            if (!url.searchParams) {
                url = new URL(url);
            }

            // formdata should not be passed as GET (actually fails) but if we let's convert it to url parameters
            if (data instanceof FormData) {
                for (const pair of data.entries()) {
                    url.searchParams.append(pair[0], pair[1]);
                }
            } else {            
                Object.keys(data).forEach(key => {
                    if (Array.isArray(data[key])) {
                        data[key].forEach(value => {
                            url.searchParams.append(key + "[]", value);
                        });
                    } else {
                        url.searchParams.append(key, data[key]);
                    }
                });
            }
        } else { // must be post, patch, delete etc..
            if (!options.headers) {
                options.headers = {};
            }

            const contentType = options.headers["content-type"] || options.headers["Content-Type"];
            if (contentType && contentType.includes("application/json")) {
                options.body = JSON.stringify(data);
            } else if (contentType && contentType.includes("multipart/mixed")) {
                options.body = data;
            } else if (data instanceof FormData) {
                options.body = data;
            } else {
                var formData = new FormData();
                Object.keys(data).forEach(key => formData.append(key, data[key]));
                options.body = formData;
            }
        }
    }
    
    //console.log("fetchJSON", url, options);
    const response = await fetchWrapper(url, options);
    //console.log("response", response);

    const contentType = response.headers.get("content-type");

    let responseData;
    if (contentType?.includes("application/json")) {

        if (response.headers.get("Content-Length") === "0") {
            if (response.ok) {
                return {};
            } else {
                const error = Error(response.statusText + " " + response.status);
                throw error;
            }
        }

        let cloneResponse;
        if (!response.ok) {
            cloneResponse = response.clone();
        }
        responseData = await response.json().catch(error => {
            console.warn("could not parse json response, trying text", error);
            if (cloneResponse) {
                return cloneResponse.text();
            } else {
                return "Could not fetch json might be a text response";
            }
        });
    } else {
        responseData = await response.text();
    }

    if (response.ok) {
        return responseData;
    } else {
        if (responseData) {
            if (typeof responseData.code === "undefined") { // code property alread exists so let's use fetchReturnCode
                if (typeof responseData !== "string") {
                    responseData.code = response.status;
                }
            } else {
                responseData.fetchReturnCode = response.status;
            }
            throw responseData;
        } else {
            throw Error(response.statusText);
        }
    }
}

function openWindowInCenter(url, title, specs, popupWidth, popupHeight) {
	var left = (screen.width/2)-(popupWidth/2);
	var top = (screen.height/2)-(popupHeight/2);
	return globalThis.open(url, title, specs + ", width=" + popupWidth + ", height=" + popupHeight + ", top=" + top + ", left=" + left)
}

function OAuthForDevices(defaultParams) {

	var that = this;

	const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
	const GOOGLE_WEB_APP_CLIENT_ID = "74919836968-1vv8gkse5mjv8ppr8qnjdms2hd6ot4sv.apps.googleusercontent.com";
	const BASE_URI = "https://www.googleapis.com/calendar/v3";

    this.getDefaultParams = function() {
        return defaultParams;
    }

    this.getTokenResponses = async () => {
        const responses = await storage.getEncryptedObj(defaultParams.storageKey, dateReviver) || [];
        // Mar 2024 convert scopes from space separated to array
        responses.forEach(response => {
            if (response.scopes) {
                if (!Array.isArray(response.scopes)) {
                    response.scopes = response.scopes.split(" ");
                }
            } else { // probably before i started saving scopes to storage, so use old scope
                response.scopes = [Scopes.CALENDARS_READ_WRITE];
            }
        });
        return responses;
    }

    async function setTokenResponses(tokenResponses) {
        await storage.setEncryptedObj(defaultParams.storageKey, tokenResponses);
    }

    async function sequentialFunction(fn) {
        return new Promise(async (resolve, reject) => {
            if (that.sequentialFunctionPromise) {
                await that.sequentialFunctionPromise;
                await fn();
                that.sequentialFunctionPromise = null;
                resolve();
            } else {
                that.sequentialFunctionPromise = new Promise(async (resolve, reject) => {
                    await fn();
                    resolve();
                }).then(() => {
                    that.sequentialFunctionPromise = null;
                    resolve();
                })
            }
        });
    }

    async function updateToken(tokenResponse) {
        await sequentialFunction(async () => {
            const tokenResponses = await that.getTokenResponses();
            const index = await that.findTokenResponseIndex(tokenResponse);
            tokenResponses[index] = tokenResponse;
            await setTokenResponses(tokenResponses);
        });
    }

	this.getUserEmails = async function() {
        return (await that.getTokenResponses()).map(tokenResponse => tokenResponse.userEmail);
	}

	if (defaultParams.getUserEmail) {
		// override default with this method
		this.getUserEmail = defaultParams.getUserEmail;
	} else {
        // default getUserEmail	
        this.getUserEmail = async function() {
            return {};
        }
	}

	function onTokenErrorWrapper(tokenResponse, response) {
		// 400 is returned when refresing token and 401 when .send returns... // means user has problably revoked access: statusText = Unauthorized message = Invalid Credentials
        console.log("tokenonerror response", tokenResponse, response);
		if (response.oauthAction == "refreshToken" && (response.code == 400 || response.code == 401)) {
			console.error("user probably revoked access so removing token:", response);
			that.removeTokenResponse(tokenResponse);			
		}
	}	

    function setExpiryDate(tokenResponse) {
        // expires_in params is in seconds (i think)
        tokenResponse.expiryDate = new Date(Date.now() + (tokenResponse.expires_in * 1000));
    }
	
    async function oauthFetch(url, data, options = {}) {
        try {
            /*
            // test task not working
            if (url.href.includes("MDU2Mzg0MDM3Njk4MzMxOTAzNzE6MDow")) {
                console.log("unab", url)

                const error = Error("servic unab dude");
                error.message = "unaava";
                error.code = "503";
                throw {
                    error: error
                }
            }
            */
            return await fetchJSON(url, data, options);
        } catch (response) {
            let error;
            if (response.error) {
                if (response.error.message) {
                    error = Error(response.error.message, {cause: response.error.details});
                    error.code = response.error.code;
                } else { // token errors look like this {"error": "invalid_grant", "error_description": "Bad Request"}
                    error = Error(response.error);
                    error.code = response.code;
                }
            } else if (response instanceof Response) {
                error = Error(response.statusText);
                error.code = response.status;
                if (response.jError) {
                    error.jError = response.jError;
                }
            } else {
                error = response;
            }

            if (error == "invalid_grant" || error == "invalid_request" || error.code == 401) { // i removed 400 because it happens when entering invalid data like a quick add of "8pm-1am Test 1/1/19"
                error.message = "You need to re-grant access, it was probably revoked";
            }

            console.error("oauthFetch: " + (error?.cause || error?.code || error));
            throw error;
        }
    }    

	this.generateURL = async function (userEmail, url) {
        const tokenResponse = await that.findTokenResponse(userEmail);
        if (tokenResponse) {
            const response = await ensureToken(tokenResponse);
            // before when calling refreshtoken we used to call this method, notice the tokenResponse came from the response and not that one passed in... params.generatedURL = setUrlParam(url, "access_token", params.tokenResponse.access_token);
            response.generatedURL = setUrlParam(url, "access_token", tokenResponse.access_token);
            return response;
        } else {
            throw new Error("No tokenResponse found!");
        }
	}
	
	async function sendOAuthRequest(params) {
        let url;
        if (params.url.indexOf("http") == 0) { // absolute
			url = new URL(params.url);
		} else { // relative
			url = new URL(BASE_URI + params.url); // couldn't use base as 2nd parameter because BASE_URI contains itself a path
		}

		let accessToken;
		if (params.tokenResponse) {
			accessToken = params.tokenResponse.access_token;
            console.log("using tokenResponse", accessToken);
		} else if (params.userEmail) {
			const tokenResponse = await that.findTokenResponse(params.userEmail);
			accessToken = tokenResponse.access_token;
            console.log("using tokenResponse2", accessToken);
        } else {
            throw Error("no tokenResponse or userEmail passed to sendOAuthRequest");
        }
        
		if (params.appendAccessToken) {
			params.data = initUndefinedObject(params.data);
			params.data.access_token = accessToken;
		}
			
		if (/delete/i.test(params.type)) {
			params.data = null;
        }
        
        const options = {
            headers: {
                Authorization: "Bearer " + accessToken,
            },
        }

        if (params.headers) {
            options.headers = {...options.headers, ...params.headers};
        }

        if (params.type) {
            options.method = params.type.toUpperCase(); // was getting CORS and Access-Control-Allow-Origin errors!!
        }

        if (params.noCache) {
            options.cache = "no-cache";
        }

        options.headers["content-type"] = params.contentType || "application/json; charset=utf-8";

        options.mode = "cors";

        try {
            const data = await oauthFetch(url, params.data, options);
            // empty data happens when user does a method like DELETE where this no content returned
            return data || {};
        } catch (error) {
            copyObj(params, error);
            throw error;
        }
	}
	
	async function ensureToken(tokenResponse) {
        if (tokenResponse.chromeProfile) {
            const getAuthTokenParams = {
                interactive: false,
                scopes: (tokenResponse.scopes || [Scopes.CALENDARS_READ_WRITE]) // legacy default to initial full scope (before i reduced them)
            };
            try {
                const authResponse = await getAuthToken(getAuthTokenParams);
                tokenResponse.access_token = authResponse.token;
                await updateToken(tokenResponse);
                return {};
            } catch (errorMessage) {
                const error = Error(errorMessage);
                error.tokenResponse = tokenResponse;
                error.oauthAction = "refreshToken";

                if (error.toString().includes("OAuth2 not granted or revoked")) {
                    error.code = 401;
                }
                throw error;
            }
        } else if (isExpired(tokenResponse)) {
            console.log("token expired: ", tokenResponse);
            return refreshToken(tokenResponse);
        } else {
            return {};
        }
	}
	
	async function refreshToken(tokenResponse) {
		console.log("refresh token: " + tokenResponse.userEmail + " now time: " + Date.now().toString());
		
		let data = {
            refresh_token: tokenResponse.refresh_token,
            extension: ITEM_ID,
        };

		// old OAuth client ID (in new way, I save the client id in tokenresponse)
		if (!tokenResponse.clientId) {
            data.old_client_id = true;
        }
        
        try {
            data = await getAuthTokenFromServer(data);
        } catch (errorMessage) {
            const error = (typeof errorMessage === 'string') ? Error(errorMessage) : errorMessage;
            error.tokenResponse = tokenResponse;
            error.oauthAction = "refreshToken";
            throw error;
        }

        tokenResponse.access_token = data.access_token;
        tokenResponse.token_type = data.token_type;
        tokenResponse.expires_in = data.expires_in;
        setExpiryDate(tokenResponse);

        // patch #1 of 2 for access revoke concurrency issue, because array items were being overwritten : https://jasonsavard.com/forum/discussion/5171/this-access-was-revoked-error-keeps-happening-even-after-reinstalling-etc#latest
        // you can reproduce this by setting expired access tokens to ALL accounts and using old expiry dates and then reload the extension, it's intermittent
        await updateToken(tokenResponse);

        return {tokenResponse:tokenResponse};
	}
	
	// private isExpired
	function isExpired(tokenResponse) {
		var SECONDS_BUFFER = -300; // 5 min. yes negative, let's make the expiry date shorter to be safe
		return !tokenResponse.expiryDate || new Date().isAfter(tokenResponse.expiryDate.addSeconds(SECONDS_BUFFER, true));
    }

    async function getAuthToken(params) {
        //params.enableGranularPermissions = true;
        const response = await chrome.identity.getAuthToken(params);
        return response;
    }
    
    function eStr(raw, offset = 1) {
        let str = "";
        for (let i = 0; i < raw.length; i++) {
            str += String.fromCharCode(raw.charCodeAt(i) + offset);
        }
        return str;
    }

    function dStr(raw, offset = -1) {
        return eStr(raw, offset);
    }

    async function getAuthTokenFromServer(data) {
        data.version = "3";

        if (data.refresh_token) {
            data.ert = eStr(data.refresh_token);
            delete data.refresh_token;
        }

        const rawResponse =  await oauthFetch(Urls.OauthToken, data, {
            method: "post",
            headers: {
                "content-type": "application/json" // required for golang or would come in as ==part form-data ...
            },
        });
        
        const response = dStr(rawResponse);
        return JSON.parse(response);
    }

	// public method, should be called before sending multiple asynchonous requests to .send
	this.ensureTokenForEmail = async function(userEmail) {
        const tokenResponse = await that.findTokenResponse(userEmail);
        if (tokenResponse) {
            try {
                await ensureToken(tokenResponse);
                return tokenResponse;
            } catch (error) {
                onTokenErrorWrapper(tokenResponse, error);
                throw error;
            }
        } else {
            const error = Error("no token for: " + userEmail + ": might have not have been granted access");
            error.jerror = JError.NO_TOKEN;
            console.error(error);
            throw error;
        }
	}		
	
	this.send = async function(params) {
        const tokenResponse = await that.findTokenResponse(params.userEmail);		
        if (tokenResponse) {
            try {
                await ensureToken(tokenResponse);
                const response = await sendOAuthRequest(params);
                response.roundtripArg = params.roundtripArg;
                return response;
            } catch (error) {
                onTokenErrorWrapper(tokenResponse, error);
                error.roundtripArg = params.roundtripArg;
                throw error;
            }
        } else {
            const error = new Error("no token response found for email: " + params.userEmail);
            error.jerror = JError.NO_TOKEN;
            console.warn(error, params);
            throw error;
        }
	}

	this.findTokenResponseIndex = async function(params) {
        const tokenResponses = await that.getTokenResponses();
        return tokenResponses.findIndex(element => element.userEmail == params.userEmail);
	}

	this.findTokenResponse = async function(email) {
		const index = await that.findTokenResponseIndex({userEmail: email});
		if (index != -1) {
            const tokenResponses = await that.getTokenResponses();
			return tokenResponses[index];
		}
	}
	
	this.removeTokenResponse = async function(params) {
        const index = await that.findTokenResponseIndex(params);
        if (index != -1) {
            const tokenResponses = await that.getTokenResponses();
            tokenResponses.splice(index, 1);
            await setTokenResponses(tokenResponses);
        }
	}

	this.removeAllTokenResponses = async function() {
        await setTokenResponses([]);
	}

	this.removeAllCachedTokens = async function() {
        const tokenResponses = await that.getTokenResponses();
        const removeTokenPromises = tokenResponses.map(tokenResponse => removeCachedAuthToken(tokenResponse.access_token));
        return Promise.allSettled(removeTokenPromises);
	}

    this.getAccessToken = async function(params) {
        console.log("get access token");
        let authResponse;
        let tokenResponse;
        let newlyGrantedChromeSignInScopes = [];

        await storage.setDate("_openOauthFlowDate");
        
        if (params.useGoogleAccountsSignIn) {
            const generateCodeVerifier = () => {
                const array = new Uint8Array(56);
                crypto.getRandomValues(array);
                return base64UrlEncode(array);
            };
            
            const base64UrlEncode = (array) => {
                return btoa(String.fromCharCode.apply(null, array))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');
            };
            
            const generateCodeChallenge = async (codeVerifier) => {
                const encoder = new TextEncoder();
                const data = encoder.encode(codeVerifier);
                const digest = await crypto.subtle.digest('SHA-256', data);
                return base64UrlEncode(new Uint8Array(digest));
            };
            
            let redirectURI = `${chrome.identity.getRedirectURL()}provider_cb`;
            if (!redirectURI.includes('chromiumapp.org') && !redirectURI.includes('allizom.org')) {
                niceAlert("Your are using an un-Googled Chromium based browser which might not support a secure sign in.");
                redirectURI = redirectURI.replace('ch40m1umapp.qjz9zk', 'chromiumapp.org');
            }

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = await generateCodeChallenge(codeVerifier);

            const searchParams = {
                client_id: GOOGLE_WEB_APP_CLIENT_ID,
                response_type: 'code',
                redirect_uri: redirectURI,
                access_type: "offline",
                scope: (params.scopes || defaultParams.scopes).join(' '),
                include_granted_scopes: true,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            }

            // seems had to add prompt=consent to get refresh token & I think access_type=offline

			if (params.email) {
				searchParams.login_hint = params.email;
                searchParams.prompt = "consent";
			} else {
				searchParams.prompt = "consent select_account";
			}

            const authParams = new URLSearchParams(searchParams);
            const responseUrl = await chrome.identity.launchWebAuthFlow({ url: `${GOOGLE_AUTH_URL}?${authParams.toString()}`, interactive: true });
            const url = new URL(responseUrl);
            const urlParams = new URLSearchParams(url.search);
            const urLParamsObj = Object.fromEntries(urlParams.entries());

            if (urLParamsObj.error) { // when user clicks cancel to permission screen: error=access_denied
                throw new Error(urLParamsObj.error, {cause: ErrorCause.ACCESS_DENIED});
            }

            const data = await getAuthTokenFromServer({
                code: urLParamsObj.code,
                google_redirect_uri: redirectURI,
                code_verifier: codeVerifier,
                extension: ITEM_ID,
            });

            tokenResponse = data;
            tokenResponse.clientId = GOOGLE_WEB_APP_CLIENT_ID;
            tokenResponse.launchWebAuthFlow = true;
            tokenResponse.scopes = data.scope.split(" ");

            setExpiryDate(tokenResponse);
        } else {
            if (params.refetch) {
                if (params.userEmail) {
                    const tokenResponse = await that.findTokenResponse(params.userEmail);
                    if (tokenResponse) {
                        try {
                            await removeCachedAuthToken(tokenResponse.access_token);
                        } catch (error) {
                            // nothing
                            console.warn(error);
                        }
                    }
                } else {
                    await that.removeAllCachedTokens();
                }
            }

            tokenResponse = {
                chromeProfile: true,
                clientId: chrome.runtime.getManifest().oauth2.client_id
            };

            const getAuthTokenParams = {
                interactive: true,
                scopes: params.scopes || defaultParams.scopes
            };
            
            try {
                authResponse = await getAuthToken(getAuthTokenParams);
            } catch (error) {
                console.log("2nd time:", error)
                // patch seems even on success it would return an error, but calling it 2nd time would get the token
                getAuthTokenParams.interactive = false;
                authResponse = await getAuthToken(getAuthTokenParams);
            }

            console.log("auth response", authResponse);

            tokenResponse.access_token = authResponse.token;
            newlyGrantedChromeSignInScopes = authResponse.grantedScopes;
        }

        console.log("token response", tokenResponse);
        const response = await that.getUserEmail(tokenResponse, sendOAuthRequest);
        response.userEmail ??= params.email;
        if (response.userEmail) {
            // add this to response
            tokenResponse.userEmail = response.userEmail;
            if (response.name) {
                tokenResponse.name = response.name;
            }
            if (response.photoUrl) {
                tokenResponse.photoUrl = response.photoUrl;
            }
            if (tokenResponse.expires_in) {
                setExpiryDate(tokenResponse);
            }
            const tokenResponses = await that.getTokenResponses();
            const index = await that.findTokenResponseIndex(response);
            if (index != -1) {
                // update if exists

                // Chrome sign in only lists newly granted scopes, doesn't include previous ones so must merge with existing
                if (newlyGrantedChromeSignInScopes.length) {
                    tokenResponse.scopes = [...new Set([...tokenResponses[index].scopes, ...newlyGrantedChromeSignInScopes])];
                }

                tokenResponses[index] = tokenResponse;
            } else {
                // add new token response

                if (newlyGrantedChromeSignInScopes.length) {
                    tokenResponse.scopes = newlyGrantedChromeSignInScopes;
                }

                tokenResponses.push(tokenResponse);
            }
            
            await setTokenResponses(tokenResponses);
            return tokenResponse;
        } else {
            throw new Error("Could not fetch email");
        }
	}
}

function serializeForChromeStorage(value) {
    let storageValue;

    // clone any objects/dates etc. or else we could modify the object outside and the cache will also be changed
    if (value instanceof Date) {
        storageValue = value.toJSON(); // must stringify this one because chrome.storage does not serialize
    } else if (value instanceof Uint8Array) {
        storageValue = value.toString();
    } else if (value instanceof ArrayBuffer) {
        const uint8array = new Int8Array(value);
        storageValue = uint8array.toString();
    } else if (isObject(value)) {
        storageValue = JSON.parse(JSON.stringify(value));
    } else {
        storageValue = value;
    }

    return storageValue;
}

function convertToUint8Array(value) {
    if (typeof value !== "undefined") {
        const ary = value.split(',');
        return Uint8Array.from(ary);
    }
}

function convertToArrayBuffer(uint8array) {
    return uint8array?.buffer;
}

function ChromeStorage(params = {}) {
	let that = this;
    let cachedItems;
	
	let storageArea;
	if (params.storageArea == "sync" && chrome.storage.sync) {
		storageArea = chrome.storage.sync;
	} else {
		storageArea = chrome.storage.local;
	}

    this.initInstallationVars = async function(installDate) {
        if (installDate) {
            await storage.set("installDate", installDate);
        } else {
            await storage.setDate("installDate");
        }
        await storage.set("installVersion", chrome.runtime.getManifest().version);
    }

    // Chrome 88 seems it was faster to retrieve all items instead of one by one
    // note, it's important to remove the cache after loading the page, I enforce this with a timeout
    this.initStorageCache = async function () {
        const items = await chrome.storage.local.get(null);
        cachedItems = items;

        // as a fail safe I remove the cache after a 2 seconds
        setTimeout(() => {
            if (cachedItems) {
                console.log("fail safe remove cache")
                cachedItems = null;
            }
        }, seconds(2));
        
        return items;
    }

    this.clearCache = function () {
        console.log("fail safe remove cache")
        cachedItems = null;
    }

    function getItem(items, key, raw) {
        let value;

        if (raw) {
            value = items[key];
        } else {
            if (items[key] === undefined) {
                value = STORAGE_DEFAULTS[key];
            } else {
                value = items[key];
            }
        }

        if (value !== undefined) {
            // decouples reference to any default or cached items
            value = JSON.parse(JSON.stringify(value), dateReviver);
        }

        return value;
    }

	this.get = async function(key, raw = null) {
        if (cachedItems) {
            //console.log("from cache: " + key);
            return getItem(cachedItems, key, raw);
        } else {
            //console.log("NOT cache: " + key);
            const items = await storageArea.get(key);
            return getItem(items, key, raw);
        }
    }

    this.getRaw = function(key) {
        return that.get(key, true);
    }

    this.getEncodedUint8Array = async function(key) {
        const value = await that.getRaw(key);
        return convertToUint8Array(value);
    }

    this.getEncodedArrayBuffer = async function(key) {
        const uint8array = await that.getEncodedUint8Array(key);
        return convertToArrayBuffer(uint8array);
    }
	
	this.set = async function(key, value) {
        if (value === undefined) {
            const error = "value not set for key: " + key;
            console.error(error);
            throw Error(error);
        }
        
        const storageValue = serializeForChromeStorage(value);
        
        const item = {};
        item[key] = storageValue;
        try {
            await storageArea.set(item);
            if (cachedItems) {
                cachedItems[key] = storageValue;
            }
        } catch (error) {
            const myError = "Error with saving key: " + key + " " + error;
            console.error(myError);
            throw myError;
        }
	}
    
    this.setEncryptedObj = async function (key, value, replacer = null) {
        const encryptedObj = await Encryption.encryptObj(value, replacer);
        return that.set(key, encryptedObj);
    };

    this.getEncryptedObj = async function(key, reviver = null) {
        const value = await that.getEncodedArrayBuffer(key);
        try {
            return await Encryption.decryptObj(value, reviver);
        } catch (error) {
            console.log("Use default value probably not enc or first time: ", key);
            return STORAGE_DEFAULTS[key];
        }
    }
    
	this.enable = function(key) {
		return that.set(key, true);
	}

	this.disable = function(key) {
		return that.set(key, false);
	}
	
	this.setDate = function(key) {
		return that.set(key, new Date());
	}
	
	this.toggle = async function(key) {
    	if (await that.get(key)) {
    		return that.remove(key);
    	} else {
    		return that.set(key, true);
    	}
	}
	
	this.remove = async function(key) {
        await storageArea.remove(key);
        if (cachedItems) {
            delete cachedItems[key];
        }
	}
	
	this.clear = async function() {
        const installDate = await storage.get("installDate");

        await storageArea.clear();
        cachedItems = null;

        await storage.initInstallationVars(installDate);
        await storage.setDate("_optionsOpened");
	}
	
	this.firstTime = async function(key) {
		if (await that.get("_" + key)) {
			return false;
		} else {
			await that.setDate("_" + key);
			return true;
		}
	}
}

var storage = new ChromeStorage();

function lightenDarkenColor(col, amt) {
	if (col) {
	    var usePound = false;
	    if ( col[0] == "#" ) {
	        col = col.slice(1);
	        usePound = true;
	    }
	
	    var num = parseInt(col,16);
	
	    var r = (num >> 16) + amt;
	
	    if ( r > 255 ) r = 255;
	    else if  (r < 0) r = 0;
	
	    var b = ((num >> 8) & 0x00FF) + amt;
	
	    if ( b > 255 ) b = 255;
	    else if  (b < 0) b = 0;
	
	    var g = (num & 0x0000FF) + amt;
	
	    if ( g > 255 ) g = 255;
	    else if  ( g < 0 ) g = 0;
	
	    var hex = (g | (b << 8) | (r << 16)).toString(16);
	    
	    // seems if color was already dark then making it darker gave us an short and invalid hex so let's make sure its 6 long
	    if (hex.length == 6) {
	    	return (usePound?"#":"") + hex;
	    } else {
	    	// else return same color
	    	return col;
	    }
	}
}

function hexToRgb(hex) {
	var c;
	if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		c = hex.substring(1).split('');
		if (c.length == 3) {
			c = [c[0], c[0], c[1], c[1], c[2], c[2]];
		}
		c = '0x' + c.join('');
		return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
	}
	//throw new Error('Bad Hex: ' + hex);
}

function rgbToHex(rgb) {
    // rgb can be in format "rgb(r, g, b)" or "rgba(r, g, b, a)"
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return rgb;
    const r = parseInt(result[0]).toString(16).padStart(2, '0');
    const g = parseInt(result[1]).toString(16).padStart(2, '0');
    const b = parseInt(result[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function rgbToHsv(r, g, b) {
	r /= 255, g /= 255, b /= 255;

	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, v = max;

	var d = max - min;
	s = max == 0 ? 0 : d / max;

	if (max == min) {
		h = 0; // achromatic
	} else {
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}

		h /= 6;
	}

	return [h, s, v];
}

function rgbToHsl(r, g, b) {
	r /= 255, g /= 255, b /= 255;
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}

	return [h, s, l];
}

function setRgbOpacity(rgbString, opacity) {
	rgbString = rgbString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	return "rgba(" + rgbString[1] + "," + rgbString[2] + "," + rgbString[3] + "," + opacity + ")";
}

function hsvToRgb(h, s, v) {
	var r, g, b;

	var i = Math.floor(h * 6);
	var f = h * 6 - i;
	var p = v * (1 - s);
	var q = v * (1 - f * s);
	var t = v * (1 - (1 - f) * s);

	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}

	return [parseInt(r * 255), parseInt(g * 255), parseInt(b * 255)];
}

// for 2nd parmeter of JSON.parse(... , dateReviver);
function dateReviver(key, value) {
    if (isStringDate(value)) {
        return new Date(value);
    } else {
    	return value;
    }
}

function dateReplacer(key, value) {
    if (value instanceof Date) {
        return value.toJSON();
    } else {
    	return value;
    }
}

function isStringDate(str) {
	return typeof str == "string" && str.length == 24 && /\d{4}-\d{2}-\d{2}T\d{2}\:\d{2}\:\d{2}\.\d{3}Z/.test(str);
}

//used to reduce load or requests: Will randomy select a date/time between now and maxdaysnfrom now and return true when this date/time has passed 
async function passedRandomTime(name, maxDaysFromNow) {
	var randomTime = await storage.get(name);
	
	// already set a random time let's if we passed it...
	if (randomTime) {
		randomTime = new Date(randomTime);
		// this randomtime is before now, meaning it has passed so return true
		if (randomTime.isBefore()) {
			return true;
		} else {
			return false;
		}
	} else {
		// set a random time
		if (!maxDaysFromNow) {
			maxDaysFromNow = 5; // default 5 days
		}
		var maxDate = new Date();
		maxDate = maxDate.addDays(maxDaysFromNow);
		
		var randomeMilliSecondsFromNow = parseInt(Math.random() * (maxDate.getTime() - Date.now()));
		randomTime = Date.now() + randomeMilliSecondsFromNow;
		randomTime = new Date(randomTime);
		
		console.log("Set randomtime: " + randomTime);
		await storage.set(name, randomTime);
		return false;
	}
}

function IconAnimation(iconUrl) {
    var that = this;
	var iconLoaded;
    var imageBitmap;

    getImageBitmapFromUrl(iconUrl).then(thisImageBitmap => {
        iconLoaded = true;
        imageBitmap = thisImageBitmap;
        if (that.animateCalled) {
            //console.log("this.animate called");
            that.animate(that.animateCallback);
        }
    });

	var canvas;
	const CANVAS_XY = 19;
	if (typeof OffscreenCanvas != "undefined") {
		canvas = new OffscreenCanvas(CANVAS_XY, CANVAS_XY);
	} else if (typeof document != "undefined") {
		canvas = document.createElement("canvas");
		canvas.width = canvas.height = CANVAS_XY;
	}

	const canvasContext = canvas.getContext('2d', {willReadFrequently: true});

	var rotation = 1;
	var factor = 1;
	var animDelay = 35;
    var animActive;
	
	this.stop = function() {
		rotation = 1;
		factor = 1;

        animActive = false;
	}

	this.animate = async function(callback) {
		console.log("in this.animate");
		that.stop();
		that.animateCalled = true;
		that.animateCallback = callback;
		if (iconLoaded) {
			console.log("draw image");
			
			const previousBadgeText = await chrome.action.getBadgeText({});
            chrome.action.setBadgeText({text : ""});
            //canvasContext.drawImage(imageBitmap, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
            
            animActive = true;

            // start animation - used interval in the past but might have created endless animation due to inactive background ref: https://jasonsavard.com/forum/discussion/comment/28390#Comment_28390
            const ANIMATION_DURATION = 2500;
            for (let a = 0; a * animDelay < ANIMATION_DURATION; a++) {
                await sleep(animDelay);

                // in case of race condition stop previous animation
                if (!animActive) {
                    break;
                }

                /*
                console.group();
                console.log("canvas width", canvas.width);
                console.log("canvas height", canvas.height);
                console.log("rotation", rotation);
                console.log("imageBitmap2", imageBitmap);
                console.groupEnd();
                */

                canvasContext.save();
                if (canvasContext.reset) {
                    canvasContext.reset();
                } else {
                    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
                }
                canvasContext.translate(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
                canvasContext.rotate(rotation * 2 * Math.PI);
                canvasContext.drawImage(imageBitmap, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
                
                // inverts images
                /*
                var imageData = canvasContext.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
                var data = imageData.data;

                for(var i = 0; i < data.length; i += 4) {
                    // red
                    data[i] = 255 - data[i];
                    // green
                    data[i + 1] = 255 - data[i + 1];
                    // blue
                    data[i + 2] = 255 - data[i + 2];
                }

                // overwrite original image
                canvasContext.putImageData(imageData, 0, 0);
                */
                
                canvasContext.restore();
                
                rotation += 0.03 * factor;
                
                if (rotation <= 0.8 && factor < 0) {
                    factor = 1;
                }
                else if (rotation >= 1.2 && factor > 0) {
                    factor = -1;
                }
                
                chrome.action.setIcon({
                    imageData: canvasContext.getImageData(0, 0, canvas.width, canvas.height)
                });
            }

            // stop animation
            that.stop();
            callback(previousBadgeText);
		}
	}
}

var syncOptions = (function() {
	var paused;
	
	// ex. syncChunks(deferreds, localStorageChunks, "localStorageChunk", setDetailsSeparateFromChunks);
	function syncChunks(deferreds, chunks, chunkPrefix, details, setDetailsSeparateFromChunks) {
		
		var previousDeferredsCount = deferreds.length;
		
        const groupLabel = "Trying to sync";
        console.groupCollapsed(groupLabel);
		chunks.forEach((chunk, index) => {
			var itemToSave = {};
			
			// let's set details + chunk together
			if (!setDetailsSeparateFromChunks) {
				itemToSave[STORAGE_DETAILS_KEY] = details;
			}
			
			itemToSave[chunkPrefix + "_" + index + "_" + details.chunkId] = chunk;
			
			console.log("trying to sync.set json length: ", chunkPrefix + "_" + index + "_" + details.chunkId, chunk.length + "_" + JSON.stringify(chunk).length);
            
            const promise = new Promise((resolve, reject) => {
				// firefox
                chrome.storage.sync.MAX_WRITE_OPERATIONS_PER_MINUTE ??= 120;
				
				// to avoid problems with MAX_WRITE_OPERATIONS_PER_MINUTE let's spread out the calls
				var delay;
				var SYNC_OPERATIONS_BEFORE = 1; // .clear were done before
				if (SYNC_OPERATIONS_BEFORE + previousDeferredsCount + chunks.length > chrome.storage.sync.MAX_WRITE_OPERATIONS_PER_MINUTE) {
					delay = (previousDeferredsCount+index) * seconds(4); // v2: chnaged 4s becaue of persitent false v1: 10s makes only 6 calls per minute
				} else {
					delay = 0;
				}
				setTimeout(function() {					
					chrome.storage.sync.set(itemToSave, function() {
						if (chrome.runtime.lastError) {
							var error = "sync error: " + chrome.runtime.lastError.message;
							logError(error);
							reject(error);
						} else {											
							//console.log("saved " + chunkPrefix + " " + index);
							resolve("success");
						}
					});
				}, delay);
			});
			deferreds.push(promise);
		});
		console.groupEnd(groupLabel);
	}
	
	// usage: compileChunks(details, items, details.localStorageChunksCount, LOCALSTORAGE_CHUNK_PREFIX) 
	function compileChunks(details, items, chunkCount, prefix) {
		var data = "";
		for (var a=0; a<chunkCount; a++) {
			data += items[prefix + "_" + a + "_" + details.chunkId];
		}
		return JSON.parse(data);
	}
	
	function isSyncable(key) {
		return !key.startsWith("_") && !syncOptions.excludeList.includes(key);
	}
	
	return { // public interface
		init: function(excludeList) {
			if (!excludeList) {
				excludeList = [];
			}
			
			// all private members are accesible here
			syncOptions.excludeList = excludeList;
		},
		storageChanged: async params => {
			if (!paused) {
				if (isSyncable(params.key)) {
					// we don't want new installers overwriting their synced data from previous installations - so only sync after certain amount of clicks by presuming their just going ahead to reset their own settings manually
					let _storageEventsCount = await storage.get("_storageEventsCount");
                    if (!_storageEventsCount) {
						_storageEventsCount = 0;
					}
					_storageEventsCount++;
                    await storage.set("_storageEventsCount", _storageEventsCount);
					
					// if loaded upon new install then we can proceed immediately to save settings or else wait for minimum storage event
					if (await storage.get("lastSyncOptionsLoad") || await storage.get("lastSyncOptionsSave") || _storageEventsCount >= MIN_STORAGE_EVENTS_COUNT_BEFORE_SAVING) {
                        //console.log("storage event: " + params.key + " will sync it soon...");
                        chrome.alarms.create(Alarms.SYNC_DATA, {delayInMinutes: 1});
					} else {
						//console.log("storage event: " + params.key + " waiting for more storage events before syncing");
					}
				} else {
					//console.log("storage event ignored: " + params.key);
				}
			}
		},
		pause: function() {
			paused = true;
		},
		resume: function() {
			paused = false;
		},
		save: async function(reason) {
            if (chrome.storage.sync) {
                // firefox
                if (!chrome.storage.sync.QUOTA_BYTES_PER_ITEM) {
                    chrome.storage.sync.QUOTA_BYTES_PER_ITEM = 8192;
                }
                // split it up because of max size per item allowed in Storage API
                // because QUOTA_BYTES_PER_ITEM is sum of key + value STRINGIFIED! (again)
                // watchout because the stringify adds quotes and slashes refer to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
                // so let's only use 70% (used to be 80%) of the max and leave the rest for stringification when the sync.set is called
                var MAX_CHUNK_SIZE = Math.floor(chrome.storage.sync.QUOTA_BYTES_PER_ITEM * 0.70);
    
                console.log("syncOptions: saving data reason: " + reason + "...");
                
                const chromeStorageItems = await chrome.storage.local.get(null);
                // process chrome.storage.local
                var localStorageItemsToSave = {};
                for (const key in chromeStorageItems) {
                    // don't incude storage options starting with _blah and use exclude list
                    //if (isSyncable(key)) {
                        //console.log(key + ": " + chromeStorageItems[key]);
                        localStorageItemsToSave[key] = chromeStorageItems[key];
                    //}
                }
                //localStorageItemsToSave = JSON.stringify(localStorageItemsToSave);
                
                // remove all items first because we might have less "chunks" of data so must clear the extra unsused ones now
                await syncOptions.clear();
                var deferreds = [];
                var deferred;
                
                var chunkId = getUniqueId();

                const QUOTA_ERROR_STR = "Settings to large. If you need to replicate the settings you can take screenshots of the option pages and set them manually onto the other device.";

                // set firefox defaults
                chrome.storage.sync.QUOTA_BYTES ??= 102400;

                //console.log("size: ", JSON.stringify(localStorageItemsToSave).length);

                if (JSON.stringify(localStorageItemsToSave).length > chrome.storage.sync.QUOTA_BYTES * 0.85) {
                    console.log("remove cachedFeeds to save on space");
                    delete localStorageItemsToSave.cachedFeeds;

                    if (JSON.stringify(localStorageItemsToSave).length > chrome.storage.sync.QUOTA_BYTES * 0.85) {
                        console.log("remove contactsData to save on space");
                        delete localStorageItemsToSave.contactsData;

                        if (JSON.stringify(localStorageItemsToSave).length > chrome.storage.sync.QUOTA_BYTES * 0.85) {
                            console.log("remove eventsShown to save on space");
                            delete localStorageItemsToSave.eventsShown;

                            if (JSON.stringify(localStorageItemsToSave).length > chrome.storage.sync.QUOTA_BYTES * 0.85) {
                                console.log("failed on trying to save space: " + JSON.stringify(localStorageItemsToSave).length);
                            }
                        }
                    }
                }

                var localStorageChunks = chunkObject(localStorageItemsToSave, MAX_CHUNK_SIZE);
                
                var details = {chunkId:chunkId, localStorageChunksCount:localStorageChunks.length, extensionVersion:chrome.runtime.getManifest().version, lastSync:new Date().toJSON(), syncReason:reason};
                
                // can we merge details + first AND only chunk into one .set operation (save some bandwidth)
                var setDetailsSeparateFromChunks;
                
                if (localStorageChunks.length == 1 && JSON.stringify(details).length + localStorageChunks.first().length < MAX_CHUNK_SIZE) {
                    setDetailsSeparateFromChunks = false;
                } else {
                    setDetailsSeparateFromChunks = true;

                    // set sync header/details...
                    deferred = new Promise((resolve, reject) => {
                        chrome.storage.sync.set({ [STORAGE_DETAILS_KEY]: details }, function() {
                            console.log("saved details");
                            resolve("success");
                        });
                    });
                    deferreds.push(deferred);
                }
                
                // in 1st call to syncChunks let's pass the last param setDetailsSeparateFromChunks
                // in 2nd call to syncChunks let's hard code setDetailsSeparateFromChunks to true
                syncChunks(deferreds, localStorageChunks, LOCALSTORAGE_CHUNK_PREFIX, details, setDetailsSeparateFromChunks);
                //syncChunks(deferreds, indexedDBChunks, INDEXEDDB_CHUNK_PREFIX, details, true);
                
                try {
                    await Promise.all(deferreds);
                    await storage.setDate("lastSyncOptionsSave");
                    console.log("sync done");
                } catch (error) {
                    console.error(error);
                    // error occured so let's clear storage because we might have only partially written data
                    try {
                        await syncOptions.clear();
                    } catch (error) {
                        // do nothing
                    } finally {
                        if (error.toString().includes("QUOTA")) {
                            throw Error(QUOTA_ERROR_STR);
                        } else {
                            throw Error("jerror with sync deferreds: " + error);
                        }
                    }
                }
            } else {
                throw Error("Sync is not supported!");
            }
		},
		fetch: async function() {
            if (chrome.storage.sync) {
                console.log("syncOptions: fetch...");
                const items = await chrome.storage.sync.get(null);
                console.log("items", items);
                if (isEmptyObject(items)) {
                    throw Error("Could not find any synced data", {cause: ErrorCause.NO_SYNC_ITEMS_FOUND});
                } else {
                    const details = items[STORAGE_DETAILS_KEY];
                    if (details.extensionVersion != chrome.runtime.getManifest().version) {
                        throw ({items:items, error:"Versions are different: " + details.extensionVersion + " and " + chrome.runtime.getManifest().version});
                    } else {
                        return items;
                    }
                }
            } else {
                throw Error("Sync is not supported!");
            }
		},
		load: async function(items) {
			console.log("syncOptions: load...");
            if (chrome.storage.sync) {
                if (items) {
                    const details = items[STORAGE_DETAILS_KEY]; 
                    if (details) {
                        // process chrome.storage.local					
                        const dataObj = compileChunks(details, items, details.localStorageChunksCount, LOCALSTORAGE_CHUNK_PREFIX);
                        await chrome.storage.local.set(dataObj);
                        // finish stamp
                        await storage.setDate("lastSyncOptionsLoad");
                        console.log("done");
                        return dataObj;
                    }
                } else {
                    throw Error("No items found");
                }
            } else {
                throw Error("Sync is not supported!");
            }
		},
		// only clears syncOptions data ie. chunks_ and details etc.
		clear: async function() {
            if (chrome.storage.sync) {
                const items = await chrome.storage.sync.get(null);
                const itemsToRemove = [];
                for (const key in items) {
                    if (key == STORAGE_DETAILS_KEY || key.startsWith(LOCALSTORAGE_CHUNK_PREFIX) || key.startsWith("chunk_") /* old prefix */) {
                        itemsToRemove.push(key);
                    }
                }
                await chrome.storage.sync.remove(itemsToRemove);
            } else {
                throw Error("Sync is not supported!");
            }
		}
	};
})();

syncOptions.init([
    "version",
    "reminderWindowId",
	"notificationsOpened",
	"notificationsQueue",
	"lastSyncOptionsSave",
	"lastSyncOptionsLoad",
	"detectedChromeVersion",
	"installDate",
	"installVersion",
	"DND_endTime",
	"eventsShown",
	"contactsData",
	"cachedFeeds",
	"cachedFeedsDetails",
	"lastOptionStatsSent",
    "notificationSoundCustom",
    "tokenResponses",
	"tokenResponsesContacts"
]);


function downloadObject(data, filename) {
    if (!data) {
        console.error('No data')
        return;
    }

    if(!filename) filename = 'object.json'

    if(typeof data === "object"){
        data = JSON.stringify(data, undefined, 4)
    }

    var blob = new Blob([data], {type: 'text/json'}),
        e    = document.createEvent('MouseEvents'),
        a    = document.createElement('a')

    a.download = filename
    a.href = globalThis.URL.createObjectURL(blob)
    a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, globalThis, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}

function initUndefinedObject(obj) {
    if (typeof obj == "undefined") {
        return {};
    } else {
        return obj;
    }
}

function initUndefinedCallback(callback) {
    if (callback) {
        return callback;
    } else {
        return function() {};
    }
}

function chunkObject(obj, chunkSize) {
	var str = JSON.stringify(obj);
	return str.chunk(chunkSize);
}

function parseVersionString(str) {
    if (typeof(str) != 'string') { return false; }
    var x = str.split('.');
    // parse from string or default to 0 if can't parse
    var maj = parseInt(x[0]) || 0;
    var min = parseInt(x[1]) || 0;
    var pat = parseInt(x[2]) || 0;
    return {
        major: maj,
        minor: min,
        patch: pat
    }
}

function cmpVersion(a, b) {
    var i, cmp, len, re = /(\.0)+[^\.]*$/;
    a = (a + '').replace(re, '').split('.');
    b = (b + '').replace(re, '').split('.');
    len = Math.min(a.length, b.length);
    for( i = 0; i < len; i++ ) {
        cmp = parseInt(a[i], 10) - parseInt(b[i], 10);
        if( cmp !== 0 ) {
            return cmp;
        }
    }
    return a.length - b.length;
}

function gtVersion(a, b) {
    return cmpVersion(a, b) >= 0;
}

// syntax: ltVersion(details.previousVersion, "7.0.15")
function ltVersion(a, b) {
    return cmpVersion(a, b) < 0;
}

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function openTemporaryWindowToRemoveFocus() {
	// open a window to take focus away from notification and there it will close automatically
    if (!DetectClient.isFirefox()) {
        const win = globalThis.open("about:blank", "emptyWindow", "width=1, height=1, top=-500, left=-500");
        win.close();
    }
}

async function isOnline() {
	// patch because some distributions of linux always returned false for is navigator.online so let's force it to true
	if (DetectClient.isLinux() || await storage.get("disableOnline")) {
		return true;
	} else {
		return navigator.onLine;
	}
}

//cross OS used to determine if ctrl or mac key is pressed
function isCtrlPressed(e) {
	return e.ctrlKey || e.metaKey;
}

async function sleep(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

function isDomainEmail(email) {
	if (email) {
		email = email.toLowerCase();
		var POPULAR_DOMAINS = ["zoho", "aim", "videotron", "icould", "inbox", "yandex", "rambler", "ya", "sbcglobal", "msn", "me", "facebook", "twitter", "linkedin", "email", "comcast", "gmx", "aol", "live", "google", "outlook", "yahoo", "gmail", "mail", "comcast", "googlemail", "hotmail"];
		
		var foundPopularDomainFlag = POPULAR_DOMAINS.some(function(popularDomain) {
			if (email.includes("@" + popularDomain + ".")) {
				return true;
			}
		});
		
		return !foundPopularDomainFlag;
	}
}

function loadImage($image, callback) {
	return new Promise(function(resolve, reject) {
		$image
			.load(function() {
				resolve($image);
			})
			.error(function(e) {
				reject(e);
			})
		;
	});
}

function showMessageNotification(title, message, error) {
    console.error(error);

   const options = {
        type: "basic",
        title: title,
        message: message.toString(),
        iconUrl: Icons.NotificationLogo,
        priority: 1
   }
   
   var notificationId;
   if (error) {
       const errorMsg = error.message || error;
	   notificationId = "error";
	   if (supportsNotificationButtons()) {
           if (DetectClient.isChrome()) {
               options.contextMessage = "Error: " + errorMsg;
           } else { // looks like Edge and maybe other browsers don't show contextMessage
               options.message += " Error: " + errorMsg;
           }
		   options.buttons = [{title:"If this is frequent then click here to report it"}];
	   } else {
		   options.message += " Error: " + errorMsg;
	   }
   } else {
	   notificationId = "message";
   }
   
   chrome.notifications.create(notificationId, options, async function(notificationId) {
	   if (chrome.runtime.lastError) {
		   console.error(chrome.runtime.lastError.message);
	   } else {
           if (!error) {
               await sleep(seconds(4));
               chrome.notifications.clear(notificationId);
           }
	   }
   });
}

function showCouldNotCompleteActionNotification(error) {
	showMessageNotification("Error with Checker Plus", "Restart browser or reinstall the extension", error);
}

class ProgressNotification {
	constructor() {
	    this.PROGRESS_NOTIFICATION_ID = "progress";
	}
	
	show(delay) {
		var that = this;
		this.delayTimeout = setTimeout(() => {
			if (DetectClient.isChromium()) {
				var options = {
					type: "progress",
					title: getMessage("processing"),
					message: "",
					iconUrl: Icons.NotificationLogo,
					requireInteraction: !DetectClient.isMac(),
					progress: 0
				}
				
				chrome.notifications.create(that.PROGRESS_NOTIFICATION_ID, options, function(notificationId) {
					if (chrome.runtime.lastError) {
						console.error(chrome.runtime.lastError.message);
					} else {
						// commented because issue with native notification not disappearing after calling .update
						/*
						that.progressInterval = setInterval(() => {
							options.progress += 20;
							if (options.progress > 100) {
								options.progress = 0;
							}
							chrome.notifications.update(that.PROGRESS_NOTIFICATION_ID, options);
						}, 1000);
						*/
					}
				});
			}
		}, delay);
	}
	
	cancel() {
		clearInterval(this.delayTimeout);
		clearInterval(this.progressInterval);
		chrome.notifications.clear(this.PROGRESS_NOTIFICATION_ID);
	}

	async complete(title) {
		var that = this;
		clearInterval(this.delayTimeout);
        clearInterval(this.progressInterval);
        await sleep(200);
        chrome.notifications.clear(that.PROGRESS_NOTIFICATION_ID, () => {
            showMessageNotification(title ? title : "Complete", getMessage("clickToolbarIconToContinue"));
        });
	}
}

async function getInstallDate() {
	let installDate = await storage.get("installDate");
	if (!installDate) {
		installDate = new Date();
	}
	return installDate;
}

// usage: getAllAPIData({oauthForDevices:oAuthForPeople, userEmail:userEmail, url:"https://people.googleapis.com/v1/people/me/connections?pageSize=100&requestMask.includeField=" + encodeURIComponent("person.emailAddresses,person.names"), itemsRootId:"connections"}) 
async function getAllAPIData(params) {
    if (params.pageToken) {
        params.url = setUrlParam(params.url, "pageToken", params.pageToken);
    }

    const responseObj = await params.oauthForDevices.send(params);
    if (!params.items) {
        params.items = [];
    }

    if (!params.itemsRootId) {
        throw Error("itemsRootId is required");
    }

    const moreItems = responseObj[params.itemsRootId];
    if (moreItems) {
        params.items = params.items.concat(moreItems);
    }
    if (responseObj.nextPageToken) {
        params.pageToken = responseObj.nextPageToken;
        return await getAllAPIData(params);
    } else {
        responseObj.email = params.userEmail;
        responseObj.items = params.items;

        if (responseObj.nextSyncToken) {
            responseObj.syncToken = responseObj.nextSyncToken;
        }

        return responseObj;
    }
}

function convertPlainTextToInnerHtml(str) {
	if (str) {
		return str.htmlEntities().replace(/\n/g, "<br/>");
	}
}

function insertStylesheet(url, id) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        if (id) {
            link.id = id;
        }
        link.rel = 'stylesheet'; 
        link.href = url;
        link.onload = e => {
            resolve(e);
        };
		link.onerror = function (e) {
			reject(`Could not load stylesheet: ${url}`);
		};
        (document.getElementsByTagName('head')[0]||document.getElementsByTagName('body')[0]).appendChild(link);
    });
}

function insertScript(url, id) {
    return new Promise((resolve, reject) => {
        var script = document.createElement('script');
        if (id) {
            script.id = id;
        }
        script.async = true;
        script.src = url;
        script.onload = e => {
            resolve(e);
        };
		script.onerror = function (e) {
			reject(`Coud not load script: ${url}`);
		};
        (document.getElementsByTagName('head')[0]||document.getElementsByTagName('body')[0]).appendChild(script);
    });
}

function findIndexById(ary, id) {
	return ary.findIndex(aryItem => {
		return aryItem.id == id;
	});
}

function removeItemById(ary, id) {
	const index = ary.findIndex(item => {
		return item.id == id;
	});
	
	if (index != -1) {
		ary.splice(index, 1);
		return true;
	}
}

function removeItemByRecurringEventId(ary, recurringEventId) {
	const index = ary.findIndex(item => {
		return item.recurringEventId == recurringEventId;
	});
	
	if (index != -1) {
		ary.splice(index, 1);
		return true;
	}
}

function getUUID() {
	return crypto.randomUUID();
}

async function getUniqueExtensionId() {
    let uniqueId = await storage.get("uniqueExtensionId");
    if (!uniqueId) {
        uniqueId = `ext-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        await storage.set("uniqueExtensionId", uniqueId);
    }
    return uniqueId;
}

function getPreferredLanguage() {
	if (navigator.languages?.length) {
		return navigator.languages[0];
	} else {
		return navigator.language;
	}
}

async function getInstanceToken() {
    if (!chrome.instanceID) {
        console.warn("GCM not supported cause instanceID not available");
        return;
    }

    const MAX_ATTEMPTS = 3;
    const BASE_DELAY = 500; // Base delay in milliseconds

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                chrome.instanceID.getToken({
                    authorizedEntity: GCM_SENDER_ID,
                    scope: "GCM"
                }, async token => {
                    clearTimeout(globalThis.instanceIdTimeout);
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                        if (chrome.runtime.lastError.message.includes("Asynchronous operation is pending")) {
                            reject(chrome.runtime.lastError.message);
                        } else {
                            // Edge: instanceID is not available in Microsoft Edge.
                            // Brave: Instance ID is currently disabled
                            resolve();
                        }
                    } else {
                        resolve(token);
                    }
                });
                
                // seems Brave browser doesn't respond to success or failure
                clearTimeout(globalThis.instanceIdTimeout);
                globalThis.instanceIdTimeout = setTimeout(() => {
                    reject(Error("instanceID not responding"));
                }, seconds(2));
            });
        } catch (error) {
            console.error("Problem getting instance token: ", error);
            if (attempt < MAX_ATTEMPTS) {
                const delay = BASE_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
                console.error(`Retrying in ${delay}ms... (Attempt ${attempt} of ${MAX_ATTEMPTS})`);
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
}

async function ensureGCMRegistration(force) {
    const registrationId = await storage.get("registrationId");
    if (registrationId && !force) {
        console.log("reusing gcm regid");
        return registrationId;
    } else {
        const token = await getInstanceToken();
        if (token) {
            await storage.set("registrationId", token);
            await storage.setDate("registrationIdDate");
            return token;
        }
    }
}

async function removeCachedAuthToken(token) {
    if (chrome.identity) {
        try {
            return await chrome.identity.removeCachedAuthToken({ token: token });
        } catch (error) {
            console.warn("probably not supported", error);
        }
    }
}

// note this same method name exists also in OAuthForDevices but it removes only the tokens for that instance, this ones removes them across all OAuthForDevices
async function removeAllCachedTokens() {
    if (chrome.identity) {
        try {
            return await chrome.identity.clearAllCachedAuthTokens();
        } catch (error) {
            console.warn("probably not supported", error);
        }
    }
}

async function getDataUrl(canvas) {
    if ('toDataURL' in canvas) { // regular canvas element
        return canvas.toDataURL();
    } else { // OffscreenCanvas
        const blob = await canvas.convertToBlob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                resolve(reader.result);
            });
            reader.addEventListener('error', error => {
                reject(error);
            });
            reader.readAsDataURL(blob);
        })
    }
}

function getInstanceId() {
    return new Promise(async (resolve, reject) => {
        const instanceId = await storage.get("instanceId");
        if (instanceId) {
            resolve(instanceId);
        } else {
            if (chrome.instanceID) {
                chrome.instanceID.getID(instanceId => {
                    if (chrome.runtime.lastError) {
                        const error = new Error("Problem getting instanceid: " + chrome.runtime.lastError.message);
                        console.error(error);
                        reject(error)
                    } else {
                        clearTimeout(globalThis.instanceIdTimeout);
                        resolve(instanceId);
                    }
                });
            } else {
                reject("chrome.instanceId not supported");
            }
    
            // seems Brave browser doesn't respond to success or failure
            globalThis.instanceIdTimeout = setTimeout(() => {
                reject("instanceId not responding");
            }, seconds(2));
        }
    }).catch(error => {
        console.warn("Generating instanceId");
        const instanceId = getUUID();
        storage.set("instanceId", instanceId);
        return instanceId;
    });
}

function getNearestHalfHour() {
    const date = new Date();
    date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30);
    return date;
}

function isObject(obj) {
    return typeof obj === 'object' && obj !== null;
}

function isEmptyObject(obj) {
    return Object.entries(obj).length === 0 && obj.constructor === Object;
}

function supportsChromeSignIn() {
    if (DetectClient.isFirefox() || DetectClient.isEdge()) {
        return false;
    } else {
        return true;
    }
}

function supportsNotificationButtons() {
    return DetectClient.isChromium();
}

function browserAutomaticallyClosesPopup() {
    return !DetectClient.isChromium() || DetectClient.isMac() || DetectClient.isChromeOS();
}

class Encryption {

    static async generateAesGcmParams() {
        let iv = await storage.getEncodedUint8Array(this.IV_STORAGE_KEY);
        if (!iv) {
            iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
            storage.set(this.IV_STORAGE_KEY, iv);
        }
        return {
            name: this.ALGORITHM,
            iv: iv
        }
    }

    static async generateAndExportKey() {
        const key = await globalThis.crypto.subtle.generateKey(
            {
                name: this.ALGORITHM,
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        )

        const exportedKey = await globalThis.crypto.subtle.exportKey(
            this.KEY_FORMAT,
            key
        );
        await storage.set(this.EXPORTED_STORAGE_KEY, exportedKey);
        return key;
    }
    
    static async getAesGcmKey() {
        const exportedKey = await storage.getEncodedArrayBuffer(this.EXPORTED_STORAGE_KEY);
        let key;
        if (exportedKey) {
            try {
                key = await globalThis.crypto.subtle.importKey(
                    this.KEY_FORMAT,
                    exportedKey,
                    this.ALGORITHM,
                    true,
                    ["encrypt", "decrypt"]
                );
            } catch (error) {
                console.warn("Problem importing key so recreating it: ", error);
                key = await this.generateAndExportKey();
            }
        } else {
            key = await this.generateAndExportKey();
        }
    
        return key;
    }
    
    static async encrypt(message) {
        const enc = new TextEncoder();
        const encoded = enc.encode(message);

        return globalThis.crypto.subtle.encrypt(
            await this.generateAesGcmParams(),
            await this.getAesGcmKey(),
            encoded
        );
    }

    static async encryptObj(obj, replacer) {
        const message = JSON.stringify(obj, replacer);
        return Encryption.encrypt(message);
    }

    static async decrypt(ciphertext) {
        if (await storage.getEncodedArrayBuffer(this.EXPORTED_STORAGE_KEY)) {
            const decrypted = await globalThis.crypto.subtle.decrypt(
                await this.generateAesGcmParams(),
                await this.getAesGcmKey(),
                ciphertext
            );
        
            const dec = new TextDecoder();
            return dec.decode(decrypted);
        } else {
            throw Error("Encryption keys not present - might be first install or restored options");
        }
    }

    static async decryptObj(ciphertext, reviver) {
        const obj = await Encryption.decrypt(ciphertext);
        return JSON.parse(obj, reviver);
    }
}

Encryption.ALGORITHM = "AES-GCM";
Encryption.KEY_FORMAT = "raw";
Encryption.IV_STORAGE_KEY = "_aesGcmIv"; // must start with _ to be ignored by sync because it's a type "Uint8Array" that can't be sycned properly
Encryption.EXPORTED_STORAGE_KEY = "_aesGcmExportedKey";

async function getImageBitmapFromUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return createImageBitmap(blob);
}

class Picker {
    _selectedDateTime = new DateZeroTime();
    _options

    constructor(inputElement, options = {}) {
        const self = this;
        this.inputElement = inputElement;
        this._options = options;

        if (inputElement._pickerObj) {
            inputElement._pickerObj.reset();
        }
        inputElement._pickerObj = this;

        inputElement.addEventListener("focus", this);
        inputElement.addEventListener("mousedown", this);
        inputElement.addEventListener("blur", this);
        inputElement.addEventListener("keydown", this);
        inputElement.addEventListener("keyup", this);
    }

    get dateTime() {
        return this.toString();
    }

    toString() {
        if (this._selectedDateTime) {
            return new Date(this._selectedDateTime.getTime());
        }
    }

    set dateTime(date) {
        this._setDateTime(new Date(date.getTime()));
    }

    addPickerLayerToDOM() {
        const dialog = getTopmostDialog();
        if (dialog) {
            dialog.append(this.pickerLayer);
        } else {
            document.body.append(this.pickerLayer);
        }
    }

    positionLayer() {
        //this.pickerLayer.style.top = `${this.inputElement.getBoundingClientRect().top + this.inputElement.getBoundingClientRect().height + 4}px`;
        //this.pickerLayer.style.left = `min( calc(100vw - ${this.pickerLayer.getBoundingClientRect().width}px) , ${this.inputElement.getBoundingClientRect().left}px`;

        const dialog = this.inputElement.closest('dialog');

        const inputRect = this.inputElement.getBoundingClientRect();
        const parentRect = (dialog || document.body).getBoundingClientRect();
        
        this.pickerLayer.style.top = `${inputRect.bottom - parentRect.top + 4}px`;
        this.pickerLayer.style.left = `${inputRect.left - parentRect.left}px`;

        if (parentRect.width - (inputRect.left - parentRect.left) < this.pickerLayer.getBoundingClientRect().width) {
            this.pickerLayer.style.left = `max(0px, ${parentRect.width - this.pickerLayer.getBoundingClientRect().width - 5}px)`;
        }
    }

    removeListeners() {
        console.log("removing listeners");
        this.inputElement.removeEventListener("focus", this);
        this.inputElement.removeEventListener("mousedown", this);
        this.inputElement.removeEventListener("blur", this);
        this.inputElement.removeEventListener("keydown", this);
        this.inputElement.removeEventListener("keyup", this);
    }
}

class TimePicker extends Picker {
    constructor(inputElement, options = {}) {
        super(inputElement, options);

        inputElement.classList.add("my-datetime-picker", "my-time-picker");

        if (!options.changeTime) {
            options.changeTime = function () {};
        }
        options.changeTime = options.changeTime.bind(this);
        this.startTimePicker = options.startTimePicker; /* make it accessible so we can cancel it from outside */
    }

    handleEvent(event) {
        console.log("handleevent", event.type, event)
        if (event.type === 'focus' || event.type == "mousedown") {
            if (!this.pickerLayer || this.pickerLayer?.hidden) {
                this.showTimes();
            }
        } else if (event.type == "blur") {
            console.log("blur", this.inputElement.value, this._selectedDateTime);
            if (this.inputElement.value) {
                this._setDateTime(this._selectedDateTime);
                this._options.changeTime();
                //event.target.dispatchEvent(new Event("changeTime"));
            }

            if (this.pickerLayer) {
                this.pickerLayer.hidden = true;
            }
        } else if (event.type == "keydown") {
            const $selected = this.pickerLayer.shadowRoot.querySelector(".selected");
            console.log("selected", $selected);
            if ($selected) {
                if (event.key == "ArrowDown") {
                    this.pickerLayer.hidden = false;
                    if ($selected.nextSibling) {
                        $selected.classList.remove("selected");
                        $selected.nextSibling.classList.add("selected");

                        if (this.pickerLayer.scrollTop + (this.pickerLayer.clientHeight - (2 * $selected.nextSibling.offsetHeight)) < $selected.nextSibling.offsetTop) {
                            this.pickerLayer.scrollTop += $selected.nextSibling.offsetHeight;
                        }
                    }
                    event.preventDefault();
                } else if (event.key == "ArrowUp") {
                    this.pickerLayer.hidden = false;
                    if ($selected.previousSibling) {
                        $selected.classList.remove("selected");
                        $selected.previousSibling.classList.add("selected");

                        if (this.pickerLayer.scrollTop + ($selected.previousSibling.offsetHeight) > $selected.previousSibling.offsetTop) {
                            this.pickerLayer.scrollTop -= $selected.previousSibling.offsetHeight;
                        }
                    }
                    event.preventDefault();
                } else if (event.key == "Enter" || event.key == "Tab") {
                    $selected.dispatchEvent(new Event("mousedown"));
                    this.pickerLayer.hidden = true;
                }
            } else {
                if (event.key == "Enter") {
                    this.inputElement.dispatchEvent(new Event("blur"));
                }
                //this.inputElement.dispatchEvent(new Event("focus"));
            }

            if (event.key == "Escape") {
                this.pickerLayer.hidden = true;
            }
        } else if (event.type == "keyup") {
            console.log("keyup", event);
            if (["Shift", "Control", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Tab"].includes(event.key)) {
                return;
            }
            console.log("parsetime");
            if (locale == "fa" && event.target.value.includes('۰'))  {
                niceAlert("Could not parse time, use international syntax ie. 6:00pm");
            } else {
                const time = event.target.value.parseTime();
                this._selectedDateTime = time;
                this.scrollToTime(time);
            }
        }
    }

    reset() {
        this.removeListeners();
    }

    _setDateTime(date) {
        this._selectedDateTime = date;
        if (date) { // might not be parseable via free input
            this.inputElement.value = date.toLocaleTimeStringJ();
        } else {
            this.pickerLayer.hidden = true;
            niceAlert("Could not parse time, use international syntax ie. 6:00pm");
        }
    }

    showTimes() {
        const self = this;

        document.getElementById("time-dropdown")?.remove();

        this.pickerLayer = document.createElement("div");
        this.pickerLayer.id = "time-dropdown";
        this.pickerLayer.classList.add("time-dropdown");
        this.pickerLayer.style.cssText = `
            position: absolute;
            overflow-y: auto;
            min-width: var(--time-picker-min-width, 60px);
            max-height: 150px;
            z-index: 1000;
            color: var(--text-color);
            background-color: var(--bg-color);
            box-shadow: 0 5px 10px rgb(0 0 0 / 20%);
        `;

        if (DetectClient.isFirefox()) {
            this.pickerLayer.style.cssText += `
                overflow-x: hidden;
                min-width: 80px;
            `;
        }

        this.pickerLayer.attachShadow({mode: 'open'});

        const style = document.createElement('style');
        style.textContent = `
            .time-dropdown-item {
                padding: 5px 5px;
                font-size: var(--input-font-size);
                cursor: pointer;
                white-space: nowrap;
                color: var(--text-color);
            }
        
            .time-dropdown-item.selected {
                background-color: var(--bg-light-color-hover);
            }
        
            .time-dropdown-duration {
                padding-inline-start: 5px;
            }
        `;

        this.pickerLayer.shadowRoot.append(style);

        let time;

        if (this.startTimePicker) {
            time = new Date(this.startTimePicker.dateTime.getTime());
        } else {
            time = new DateZeroTime();
        }
        
        let minutesDuration = 0;

        for (let a=0; a<50; a++) {
            const $time = document.createElement("div");
            $time.classList.add("time-dropdown-item");
            $time.textContent = time.toLocaleTimeStringJ();

            if (this.startTimePicker) {
                const $duration = document.createElement("span");
                $duration.classList.add("time-dropdown-duration");

                if (minutesDuration < 60) {
                    $duration.textContent = `(${getMessage("Xmins", minutesDuration)})`;
                } else if (minutesDuration == 60) {
                    $duration.textContent = `(${getMessage("Xhr", minutesDuration / 60)})`;
                } else {
                    $duration.textContent = `(${getMessage("Xhrs", minutesDuration / 60)})`;
                }
                
                $time.append($duration);
            }

            $time.setAttribute("h", time.getHours());
            $time.setAttribute("m", time.getMinutes());

            $time.addEventListener("mousedown", function(e) {
                self._selectedDateTime = new DateZeroTime();
                self._selectedDateTime.setHours(this.getAttribute("h"));
                self._selectedDateTime.setMinutes(this.getAttribute("m"));
                self.inputElement.value = self._selectedDateTime.toLocaleTimeStringJ();
                self.pickerLayer.hidden = true;
                //self.inputElement.dispatchEvent(new Event("changeTime"));
                self._options.changeTime();
                e.preventDefault();
            });

            $time.addEventListener("mouseenter", function() {
                this.classList.add("selected");
            });

            $time.addEventListener("mouseleave", function() {
                this.classList.remove("selected");
            });

            this.pickerLayer.shadowRoot.append($time);

            let increment;
            if (a < 4) {
                increment = 15;
            } else {
                increment = 30;
            }
            time = time.addMinutes(increment);
            minutesDuration += increment;
        }

        // patch: prevent calling blur on input element when clicking inside picker or actually the scrollbar itself (weird) and happened only when inside a dialog
        this.pickerLayer.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
        })

        this.addPickerLayerToDOM();

        this.positionLayer();

        if (self.inputElement.value) {
            this.scrollToTime(this._selectedDateTime);
        } else {

            if (self._options.defaultHour) {
                const time = new DateZeroTime();
                time.setHours(self._options.defaultHour);
                this.scrollToTime(time);
            } else {
                this.scrollToTime();
            }

        }
    }    

    scrollToTime(date = getNearestHalfHour()) {
        const hourSelector = date.getHours();

        let minSelector;
        if (date.getMinutes() >= 30) {
            minSelector = "30";
        } else {
            minSelector = "0";
        }

        const $selectedTime = this.pickerLayer.shadowRoot.querySelector(`[h='${hourSelector}'][m='${minSelector}']`);

        if ($selectedTime) {
            $selectedTime.scrollIntoView();

            if (globalThis.inReminderWindow) {
                document.body.scrollIntoView();
            } else {
                // patch had to execute a 2nd time below
                document.querySelector("app-header-layout")?.scrollIntoView();
            }
        }

        this.pickerLayer.shadowRoot.querySelector(".selected")?.classList.remove("selected");
        if (date.getMinutes() == 0 || date.getMinutes() == 30) {
            if ($selectedTime) {
                $selectedTime.classList.add("selected");
            }
        }
    }
}

class DatePicker extends Picker {
    constructor(inputElement, options = {}) {
        super(inputElement, options);

        inputElement.classList.add("my-datetime-picker", "my-date-picker");

        if (!options.changeDate) {
            options.changeDate = function () {};
        }
        options.changeDate = options.changeDate.bind(this);
    }
   
    handleEvent(event) {
        console.log("dp handleevent", event)
        if (event.type === 'focus' || event.type == "mousedown") {
            if (!this.pickerLayer || this.pickerLayer?.hidden) {
                this.showCalendar();
            }
        } else if (event.type == "blur") {
            console.log("blur", event, this.inputElement.value, this._selectedDateTime);
            if (this.inputElement.value) {
                this._setDateTime(this._selectedDateTime);
                this._options.changeDate();
                //event.target.dispatchEvent(new Event("changeDate"));
            }

            if (this.pickerLayer) {
                this.pickerLayer.hidden = true;
            }
        } else if (event.type == "keydown") {
            if (event.key == "Escape") {
                this.pickerLayer.hidden = true;
            }
        }
    }

    reset() {
        this.removeListeners();
        this.fullCalendar?.destroy();
    }

    _setDateTime(date) {
        this._selectedDateTime = date;
        if (date) { // might not be parseable via free input
            this.inputElement.value = date.toLocaleDateString(locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } else {
            this.pickerLayer.hidden = true;
            niceAlert("Could not parse time, use international syntax ie. 6:00pm");
        }
    }

    showCalendar() {
        const self = this;

        this.fullCalendar?.destroy();
        document.getElementById("date-dropdown")?.remove();

        this.pickerLayer = document.createElement("div");
        this.pickerLayer.id = "date-dropdown";
        this.pickerLayer.classList.add("date-dropdown", "mini-calendar");
        this.pickerLayer.style.cssText = `
            position: absolute;
            width: 240px;
            border-radius: 5px;
            xxheight: 225px;
            z-index: 1000;
            background-color: var(--bg-color);
            box-shadow: 0 5px 10px rgb(0 0 0 / 20%);
        `;

        if (this._selectedDateTime) {
            this._options.fullCalendarParams.initialDate = this._selectedDateTime;
        }
        
        this._options.fullCalendarParams.selectable = true;
        this._options.fullCalendarParams.select = function (info) {
            self._setDateTime(info.start);
            self.pickerLayer.hidden = true;
            self._options.changeDate();
        }

        this.fullCalendar = new FullCalendar.Calendar(this.pickerLayer, this._options.fullCalendarParams);

        this.addPickerLayerToDOM();

        this.fullCalendar.render();

        console.log("this._selectedDateTime", this._selectedDateTime)
        if (this._selectedDateTime) {
            const $selectedDate = this.pickerLayer.querySelector(`[data-date='${this._selectedDateTime.getFullYear()}-${new String(this._selectedDateTime.getMonth()+1).padStart(2, '0')}-${new String(this._selectedDateTime.getDate()).padStart(2, '0')}']`);
            console.log("$selectedDate", $selectedDate);
            if ($selectedDate) {
                $selectedDate.classList.add("selected");
            }
        }

        this.pickerLayer.addEventListener("mousedown", event => {
            console.log("mousedown", event);
            event.preventDefault();
            event.stopPropagation();
        })

        this.pickerLayer.querySelectorAll(".fc-button-group button").forEach(el => {
            const ripple = document.createElement("j-ripple");
            el.append(ripple);

            el.addEventListener("mousedown", event => {
                //event.preventDefault();
                //event.stopPropagation();
            });
        });

        this.positionLayer();
    }
}

async function generateFullCalendarParams() {
    const calendarSettings = await storage.get("calendarSettings");
    
    const params = {
        locale: locale,
        direction: getMessage("dir"),
        dayHeaderFormat: {
            weekday: 'narrow'
        },
        height: DetectClient.isFirefox() ? "auto" : 241, /* v2 241 (seems mac had scrollbar) v1 240 */
        headerToolbar: {
            end: "prev,next"
        },
    };

    if (isAsianLangauge()) {
        const passedInDatesSet = params.datesSet;

        params.datesSet = info => {
            // workaround to remove chacters from date in asian languages ie. 23日 > 23
            info.view.calendar.el.querySelectorAll(".fc-daygrid-day").forEach(el => {
                const date = new Date(Date.parse(`${el.getAttribute("data-date")}T00:00:00.000`));
                el.querySelector(".fc-daygrid-day-number").textContent = date.getDate();
            });

            // call any user defined functions afterwards
            if (passedInDatesSet) {
                passedInDatesSet();
            }
        }
    }

    if (calendarSettings.weekStart != undefined) { // must check or else got an error with fullcalendar
        params.firstDay = parseInt(calendarSettings.weekStart);
    }

    return params;
}

function formatMiniFullCalendar(node) {
    node.querySelectorAll(".fc-button-group button").forEach(el => {
        const ripple = document.createElement("j-ripple");
        el.append(ripple);
    });
}

async function getCenterWindowPosition(width, height) {
    const position = {
        left: 400,
        top: 300,
        availLeft: 0,
        availTop: 0
    };

    if (chrome.system?.display?.getInfo) {
        const screens = await chrome.system.display.getInfo();
        const screen = screens.find(screen => screen.isPrimary);

        if (screen) {
            position.left = (screen.workArea.width - width) / 2;
            position.top = (screen.workArea.height - height) / 2;

            position.availLeft = screen.workArea.left;
            position.availTop = screen.workArea.top;
        } else {
            console.warn("No primary screen found, using default position: ", screens);
            console.warn("screen info", globalThis.screen);
        }
    } else if (globalThis.screen) {
        position.left = (globalThis.screen.width - width) / 2;
        position.top = (globalThis.screen.height - height) / 2;

        position.availLeft = globalThis.screen.availLeft;
        position.availTop = globalThis.screen.availTop;
    }

    position.left = Math.round(position.left);
    position.top = Math.round(position.top);

    position.availLeft &&= Math.round(position.availLeft);
    position.availTop &&= Math.round(position.availTop);

    return position;
}

// patch for issue on Linux when setting left/top outside of window - solution remove top/left settings, error: Invalid value for bounds. Bounds must be at least 50% within visible screen space.
async function createWindow(params) {

    // feb 2026 add patch: This is a known quirk with the chrome.system.display API on Windows. When you first log in or wake the system, the Windows Display Manager often hasn't "registered" the monitors with the Chrome process yet, especially if the extension’s background script/service worker fires immediately on startup. Since the API returns an empty array [] rather than an error, your code thinks there are zero displays connected.
    const retries = 5;
    const baseDelay = 1; // ms

    for (let i = 1; i <= retries; i++) {
        try {
            try {
                return await chrome.windows.create(params);
            } catch (error) {
                console.warn("create window issue", error)
                const safeParams = shallowClone(params);
                delete safeParams.top;
                delete safeParams.left;
                return await chrome.windows.create(safeParams);
            }
        } catch (error) {
            const waitTime = i * seconds(1);
            console.log("create window failed", new Date(), error);
            console.warn(`Create window failed. Retrying in ${waitTime}ms... (Attempt ${i}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            if (inLocalExtension) {
                showMessageNotification("dev only - error with create window", error);
            }
        }
    }

    console.error(`Failed to create window after ${retries} attempts`);
    throw new Error(`Failed to create window`);
}

function stripUrlPrefix(url) {
    const regex = /^(?:https?:\/\/)?(?:www\.)?/i;
    return url?.replace(regex, '');
}

function generateRandomAlarmDelay() {
    const minHours = 2; // Minimum number of hours
    const maxHours = 8; // Maximum number of hours
  
    // Convert hours to minutes
    const minMinutes = minHours * 60;
    const maxMinutes = maxHours * 60;
  
    // Generate a random number of minutes between minMinutes and maxMinutes
    const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
  
    return randomMinutes;
}

async function isGCMSupported(throwError) {
    try {
        const instanceToken = await getInstanceToken();
        if (chrome.gcm && instanceToken) {
            return instanceToken;
        }
    } catch (error) {
        console.error("isGCMSupported error", error);
        if (throwError) {
            throw error;
        } else {
            // do nothing
        }
    }
}

function formatCurrency(number, currencyCode) {
    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode || getMessage("currencyCode"),
    });
    return formatter.format(number);
}

function getWeekdayInitials() {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const day = formatter.format(getSundayRelativeDate(i));
        weekDays.push(day.toUpperCase());
    }
    return weekDays;
}

function getSundayRelativeDate(index = 0) {
    return new Date(2021, 0, index+3);
}

function getRRule(recurringEvent) {
    return recurringEvent?.recurrence?.find(rule => rule.startsWith("RRULE:"));
}

function getRRuleCondition(rrule, key) {
    const match = rrule?.match(new RegExp(`${key}=([^;]+)`));
    if (match) {
        return match[1];
    }
}

function getRRuleUntilDate(rrule) {
    const untilDate = getRRuleCondition(rrule, "UNTIL");
    if (untilDate) {
        const year = parseInt(untilDate.substring(0, 4), 10);
        const month = parseInt(untilDate.substring(4, 6), 10) - 1; // Month is zero-based
        const day = parseInt(untilDate.substring(6, 8), 10);
        return new Date(year, month, day);
    }
}

function parseRRuleForByDay(byday) {
    const dayPattern = RRULE_DAYS.join('|'); // Create a pattern like 'SU|MO|TU|WE|TH|FR|SA'
    const regex = new RegExp(`\\b(-?[1-9])[-]?(${dayPattern})\\b`, 'g');
    const matches = regex.exec(byday); // ["2MO", "2", "MO"]
    return matches;
}

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

function attachResizeDropdownListener(dropdown) {
    _resizeDropdown(dropdown);

    const paperListbox = dropdown.querySelector("paper-listbox");
    if (!paperListbox.getAttribute("j-listening-for-resize")) {
        paperListbox.addEventListener("iron-activate", () => {
            setTimeout(() => {
                _resizeDropdown(dropdown);
            }, 1);
        });
        paperListbox.setAttribute("j-listening-for-resize", "true");
    }
}

function _resizeDropdown(dropdown) {
    const paperListbox = dropdown.querySelector("paper-listbox");
    const selectedItem = paperListbox.selectedItem;
    if (selectedItem) {
        const text = selectedItem.textContent || "";
        const tempSpan = document.createElement("span");
        tempSpan.style.visibility = "hidden";
        tempSpan.style.position = "absolute";
        tempSpan.style.whiteSpace = "pre";
        tempSpan.style.font = getComputedStyle(selectedItem).font;
        tempSpan.style.fontSize = getComputedStyle(selectedItem).fontSize;
        tempSpan.textContent = text;
        document.body.appendChild(tempSpan);
        const width = Math.min(tempSpan.offsetWidth + 50, 350); // add some padding, set max width
        dropdown.style.width = width + "px";
        tempSpan.remove();
    }
}

async function getZoomFactor() {
    if (chrome.tabs?.getZoomSettings) {
        try {
            const zoomSettings = await chrome.tabs.getZoomSettings();
            return zoomSettings.defaultZoomFactor;
        } catch (error) {
            console.warn(error);
        }
    }
    return globalThis.devicePixelRatio;
}