"use strict";

var offScreenJSLoaded = true;

async function offlineOnlineChanged(e) {
    console.log("offscreen detected: " + e.type + " " + new Date());
    chrome.runtime.sendMessage({ command: "online-status", status: e.type });
}

globalThis.addEventListener('offline', offlineOnlineChanged);
globalThis.addEventListener('online', offlineOnlineChanged);

let audioPlayer;
let audioMessage;
let audioSendResponse;

// MUST declare all variables inside here as global ie. changedSrc and audioEventTriggered
function audioStopped(event) {
    console.log("audioStopped", event);
    // ignore the abort event when we change the .src
    if (!(audioMessage.data.changedSrc && event.type == "abort") && !globalThis.audioEventTriggered) {
        globalThis.audioEventTriggered = true;
        audioSendResponse();
    }
}

function loadImage(image) {
    return new Promise((resolve, reject) => {
        image.onload = () => {
            resolve();
        }
        image.onerror = event => {
            reject(event);
        }
    });
}

globalThis.myOffscreenListener = (message, sender, sendResponse) => {
    try {
        console.log("message", message);

        if (message.target !== 'offscreen') {
            return false;
        }

        if (message.type == "htmlToText") {
            const html = message.data
                .replace(/<br\s?\/?>/ig,"\n")
                .replace(/<(?:.|\n)*?>/gm, '')
            ;
            const doc = new DOMParser().parseFromString(html, "text/html");
            sendResponse(doc.documentElement.textContent);
        } else if (message.type == "play-sound") {
            audioMessage = message;
            audioSendResponse = sendResponse;

            globalThis.audioEventTriggered = false;

            if (!audioPlayer) {
                audioPlayer = new Audio();
            }

            if (message.data.src) {
                audioPlayer.src = message.data.src;
            }

            if (globalThis.controller) {
                globalThis.controller.abort();
            }
            globalThis.controller = new AbortController();

            audioPlayer.addEventListener("ended", audioStopped, {signal: globalThis.controller.signal });
            audioPlayer.addEventListener("error", audioStopped, {signal: globalThis.controller.signal });
            audioPlayer.addEventListener("abort", audioStopped, {signal: globalThis.controller.signal });
        
            audioPlayer.volume = message.data.volume;
            audioPlayer.play().catch(error => {
                console.warn("might have stopped sign via close notif before play started: " + error, audioPlayer);
                if (/firefox/i.test(navigator.userAgent)) {
                    const prevSrc = audioPlayer.src;
                    audioPlayer.src = "";
                    audioPlayer.pause();
                    audioPlayer.currentTime = 0;
                    setTimeout(() => {
                        console.log("try again", prevSrc)
                        audioPlayer.src = prevSrc
                        audioPlayer.play().catch(error => {
                            console.error("Failed to play sound: " + error);
                            sendResponse();
                        });
                    }, 1000)
                } else {
                    sendResponse();
                }
            });
            return true;
        } else if (message.type == "stop-audio") {
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
            sendResponse();
        } else if (message.type == "init-firebase") {
            (async () => {

                if (globalThis.snapshot) {
                    console.warn("already loaded firebase");
                    sendResponse({
                        firebase: true
                    });
                    return;
                }

                const appMod = await import('/js/firebase-app.js');
                const fsMod = await import('/js/firebase-firestore.js');

                const app = appMod.initializeApp({
                    projectId: "calendar-extension",
                    appId: "1:74919836968:web:fb10c9e8bb511a850e241d"
                });
                const db = fsMod.getFirestore(app);
                console.log("db", db);

                const listen = async () => {
                    const queryRef = fsMod.query(fsMod.collection(db, "messages"), fsMod.where("uid", "==", message.data.instanceId), fsMod.limit(250));

                    fsMod.onSnapshot(queryRef, snapshot => {
                        snapshot.forEach(doc => {
                            const message = doc.data();
                            console.log("firebase message", new Date(), message);
                            if (message.state == "exists") {
                                if (!/firefox/i.test(navigator.userAgent)) {
                                    chrome.runtime.sendMessage({
                                        command: "firestore-message",
                                        data: message
                                    });
                                } else {
                                    onRealtimeMessageReceived(message, "firestore");
                                }
                            }
                        });
                        globalThis.snapshot = snapshot;
                    }, error => {
                        console.error("onsnapshot error: ", error);
                        setTimeout(listen, 5000);
                    });
                }

                listen();

                sendResponse({
                    firebase: true
                });
            })();

            return true;
        } else if (message.type == "test") {
            setTimeout(() => {
                sendResponse(message.data.delay);
            }, message.data.delay);
            return true;
        } else {
            console.warn(`Unexpected message type received: '${message.type}'.`);
            return false;
        }
    } catch (error) {
        console.error(error);
        sendResponse({
            errorInOffscreen: error.message ?? error
        });
    }
}

if (!/firefox/i.test(navigator.userAgent)) {
    chrome.runtime.onMessage.addListener(myOffscreenListener);
}