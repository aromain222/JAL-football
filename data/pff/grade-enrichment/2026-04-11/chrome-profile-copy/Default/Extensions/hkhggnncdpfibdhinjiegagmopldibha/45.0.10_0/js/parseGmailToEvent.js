// extracts message id from offline url, ex. https://mail.google.com/mail/mu/mp/166/#cv/Inbox/145994dc0db175a4
function extractMessageIdFromUrl(url) {
	var matches = url.match(/\/([^\/]+$)/);
	if (matches && matches.length >= 2) {
		return isHex(matches[1]);
	}
}

function isHex(str) {
	return /^[0-9A-Fa-f]+$/.test(str);
}

var response = {};
// can't use const here because the script can be loaded several times in the same page
var subject = document.querySelector("div[role='main'] .hP");
if (subject) {
	var desc = document.querySelector("div[role='main'] .ii.gt");
	if (desc) {
		desc = desc.innerHTML;
	} else {
		desc = null;
	}

	response = { title: subject.innerText, description: desc };

	let messageId = extractMessageIdFromUrl(location.href);
	if (messageId) {
		response.url = location.href;
	} else {
		// find message id in gmail source
		const message = document.querySelector("div[role='main'] .aXjCH");
		if (message) {
			// parse id from... class='a3s aXjCH m15c1af433f9066b7' and remove 'm'
			let match = message.className.match(/ m(.*)/);
			if (match) {
				messageId = match[1];
				if (!location.href.includes(messageId)) {
					response.url = location.href + "/" + messageId;
				}
			}
		}
	}
	
	// weird yes, but the following line will output object and pass it to the callback of chrome.tabs.executeScript
	response;
} else {
	response;
}