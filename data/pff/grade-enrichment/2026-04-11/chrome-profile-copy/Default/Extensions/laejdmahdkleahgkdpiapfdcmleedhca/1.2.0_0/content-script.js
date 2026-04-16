"use strict";(()=>{var ee=Object.create;var q=Object.defineProperty;var te=Object.getOwnPropertyDescriptor;var ne=Object.getOwnPropertyNames;var re=Object.getPrototypeOf,oe=Object.prototype.hasOwnProperty;var ie=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var se=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let i of ne(t))!oe.call(e,i)&&i!==n&&q(e,i,{get:()=>t[i],enumerable:!(r=te(t,i))||r.enumerable});return e};var G=(e,t,n)=>(n=e!=null?ee(re(e)):{},se(t||!e||!e.__esModule?q(n,"default",{value:e,enumerable:!0}):n,e));var _=ie((z,V)=>{(function(e,t){if(typeof define=="function"&&define.amd)define("webextension-polyfill",["module"],t);else if(typeof z<"u")t(V);else{var n={exports:{}};t(n),e.browser=n.exports}})(typeof globalThis<"u"?globalThis:typeof self<"u"?self:z,function(e){"use strict";if(!globalThis.chrome?.runtime?.id)throw new Error("This script should only be loaded in a browser extension.");if(typeof globalThis.browser>"u"||Object.getPrototypeOf(globalThis.browser)!==Object.prototype){let t="The message port closed before a response was received.",n=r=>{let i={alarms:{clear:{minArgs:0,maxArgs:1},clearAll:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getAll:{minArgs:0,maxArgs:0}},bookmarks:{create:{minArgs:1,maxArgs:1},get:{minArgs:1,maxArgs:1},getChildren:{minArgs:1,maxArgs:1},getRecent:{minArgs:1,maxArgs:1},getSubTree:{minArgs:1,maxArgs:1},getTree:{minArgs:0,maxArgs:0},move:{minArgs:2,maxArgs:2},remove:{minArgs:1,maxArgs:1},removeTree:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1},update:{minArgs:2,maxArgs:2}},browserAction:{disable:{minArgs:0,maxArgs:1,fallbackToNoCallback:!0},enable:{minArgs:0,maxArgs:1,fallbackToNoCallback:!0},getBadgeBackgroundColor:{minArgs:1,maxArgs:1},getBadgeText:{minArgs:1,maxArgs:1},getPopup:{minArgs:1,maxArgs:1},getTitle:{minArgs:1,maxArgs:1},openPopup:{minArgs:0,maxArgs:0},setBadgeBackgroundColor:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setBadgeText:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setIcon:{minArgs:1,maxArgs:1},setPopup:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setTitle:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0}},browsingData:{remove:{minArgs:2,maxArgs:2},removeCache:{minArgs:1,maxArgs:1},removeCookies:{minArgs:1,maxArgs:1},removeDownloads:{minArgs:1,maxArgs:1},removeFormData:{minArgs:1,maxArgs:1},removeHistory:{minArgs:1,maxArgs:1},removeLocalStorage:{minArgs:1,maxArgs:1},removePasswords:{minArgs:1,maxArgs:1},removePluginData:{minArgs:1,maxArgs:1},settings:{minArgs:0,maxArgs:0}},commands:{getAll:{minArgs:0,maxArgs:0}},contextMenus:{remove:{minArgs:1,maxArgs:1},removeAll:{minArgs:0,maxArgs:0},update:{minArgs:2,maxArgs:2}},cookies:{get:{minArgs:1,maxArgs:1},getAll:{minArgs:1,maxArgs:1},getAllCookieStores:{minArgs:0,maxArgs:0},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}},devtools:{inspectedWindow:{eval:{minArgs:1,maxArgs:2,singleCallbackArg:!1}},panels:{create:{minArgs:3,maxArgs:3,singleCallbackArg:!0},elements:{createSidebarPane:{minArgs:1,maxArgs:1}}}},downloads:{cancel:{minArgs:1,maxArgs:1},download:{minArgs:1,maxArgs:1},erase:{minArgs:1,maxArgs:1},getFileIcon:{minArgs:1,maxArgs:2},open:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},pause:{minArgs:1,maxArgs:1},removeFile:{minArgs:1,maxArgs:1},resume:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1},show:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0}},extension:{isAllowedFileSchemeAccess:{minArgs:0,maxArgs:0},isAllowedIncognitoAccess:{minArgs:0,maxArgs:0}},history:{addUrl:{minArgs:1,maxArgs:1},deleteAll:{minArgs:0,maxArgs:0},deleteRange:{minArgs:1,maxArgs:1},deleteUrl:{minArgs:1,maxArgs:1},getVisits:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1}},i18n:{detectLanguage:{minArgs:1,maxArgs:1},getAcceptLanguages:{minArgs:0,maxArgs:0}},identity:{launchWebAuthFlow:{minArgs:1,maxArgs:1}},idle:{queryState:{minArgs:1,maxArgs:1}},management:{get:{minArgs:1,maxArgs:1},getAll:{minArgs:0,maxArgs:0},getSelf:{minArgs:0,maxArgs:0},setEnabled:{minArgs:2,maxArgs:2},uninstallSelf:{minArgs:0,maxArgs:1}},notifications:{clear:{minArgs:1,maxArgs:1},create:{minArgs:1,maxArgs:2},getAll:{minArgs:0,maxArgs:0},getPermissionLevel:{minArgs:0,maxArgs:0},update:{minArgs:2,maxArgs:2}},pageAction:{getPopup:{minArgs:1,maxArgs:1},getTitle:{minArgs:1,maxArgs:1},hide:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setIcon:{minArgs:1,maxArgs:1},setPopup:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},setTitle:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0},show:{minArgs:1,maxArgs:1,fallbackToNoCallback:!0}},permissions:{contains:{minArgs:1,maxArgs:1},getAll:{minArgs:0,maxArgs:0},remove:{minArgs:1,maxArgs:1},request:{minArgs:1,maxArgs:1}},runtime:{getBackgroundPage:{minArgs:0,maxArgs:0},getPlatformInfo:{minArgs:0,maxArgs:0},openOptionsPage:{minArgs:0,maxArgs:0},requestUpdateCheck:{minArgs:0,maxArgs:0},sendMessage:{minArgs:1,maxArgs:3},sendNativeMessage:{minArgs:2,maxArgs:2},setUninstallURL:{minArgs:1,maxArgs:1}},sessions:{getDevices:{minArgs:0,maxArgs:1},getRecentlyClosed:{minArgs:0,maxArgs:1},restore:{minArgs:0,maxArgs:1}},storage:{local:{clear:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}},managed:{get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1}},sync:{clear:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}}},tabs:{captureVisibleTab:{minArgs:0,maxArgs:2},create:{minArgs:1,maxArgs:1},detectLanguage:{minArgs:0,maxArgs:1},discard:{minArgs:0,maxArgs:1},duplicate:{minArgs:1,maxArgs:1},executeScript:{minArgs:1,maxArgs:2},get:{minArgs:1,maxArgs:1},getCurrent:{minArgs:0,maxArgs:0},getZoom:{minArgs:0,maxArgs:1},getZoomSettings:{minArgs:0,maxArgs:1},goBack:{minArgs:0,maxArgs:1},goForward:{minArgs:0,maxArgs:1},highlight:{minArgs:1,maxArgs:1},insertCSS:{minArgs:1,maxArgs:2},move:{minArgs:2,maxArgs:2},query:{minArgs:1,maxArgs:1},reload:{minArgs:0,maxArgs:2},remove:{minArgs:1,maxArgs:1},removeCSS:{minArgs:1,maxArgs:2},sendMessage:{minArgs:2,maxArgs:3},setZoom:{minArgs:1,maxArgs:2},setZoomSettings:{minArgs:1,maxArgs:2},update:{minArgs:1,maxArgs:2}},topSites:{get:{minArgs:0,maxArgs:0}},webNavigation:{getAllFrames:{minArgs:1,maxArgs:1},getFrame:{minArgs:1,maxArgs:1}},webRequest:{handlerBehaviorChanged:{minArgs:0,maxArgs:0}},windows:{create:{minArgs:0,maxArgs:1},get:{minArgs:1,maxArgs:2},getAll:{minArgs:0,maxArgs:1},getCurrent:{minArgs:0,maxArgs:1},getLastFocused:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},update:{minArgs:2,maxArgs:2}}};if(Object.keys(i).length===0)throw new Error("api-metadata.json has not been included in browser-polyfill");class c extends WeakMap{constructor(a,d=void 0){super(d),this.createItem=a}get(a){return this.has(a)||this.set(a,this.createItem(a)),super.get(a)}}let p=s=>s&&typeof s=="object"&&typeof s.then=="function",m=(s,a)=>(...d)=>{r.runtime.lastError?s.reject(new Error(r.runtime.lastError.message)):a.singleCallbackArg||d.length<=1&&a.singleCallbackArg!==!1?s.resolve(d[0]):s.resolve(d)},x=s=>s==1?"argument":"arguments",u=(s,a)=>function(g,...h){if(h.length<a.minArgs)throw new Error(`Expected at least ${a.minArgs} ${x(a.minArgs)} for ${s}(), got ${h.length}`);if(h.length>a.maxArgs)throw new Error(`Expected at most ${a.maxArgs} ${x(a.maxArgs)} for ${s}(), got ${h.length}`);return new Promise((v,w)=>{if(a.fallbackToNoCallback)try{g[s](...h,m({resolve:v,reject:w},a))}catch(l){console.warn(`${s} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,l),g[s](...h),a.fallbackToNoCallback=!1,a.noCallback=!0,v()}else a.noCallback?(g[s](...h),v()):g[s](...h,m({resolve:v,reject:w},a))})},f=(s,a,d)=>new Proxy(a,{apply(g,h,v){return d.call(h,s,...v)}}),C=Function.call.bind(Object.prototype.hasOwnProperty),S=(s,a={},d={})=>{let g=Object.create(null),h={has(w,l){return l in s||l in g},get(w,l,E){if(l in g)return g[l];if(!(l in s))return;let b=s[l];if(typeof b=="function")if(typeof a[l]=="function")b=f(s,s[l],a[l]);else if(C(d,l)){let I=u(l,d[l]);b=f(s,s[l],I)}else b=b.bind(s);else if(typeof b=="object"&&b!==null&&(C(a,l)||C(d,l)))b=S(b,a[l],d[l]);else if(C(d,"*"))b=S(b,a[l],d["*"]);else return Object.defineProperty(g,l,{configurable:!0,enumerable:!0,get(){return s[l]},set(I){s[l]=I}}),b;return g[l]=b,b},set(w,l,E,b){return l in g?g[l]=E:s[l]=E,!0},defineProperty(w,l,E){return Reflect.defineProperty(g,l,E)},deleteProperty(w,l){return Reflect.deleteProperty(g,l)}},v=Object.create(s);return new Proxy(v,h)},M=s=>({addListener(a,d,...g){a.addListener(s.get(d),...g)},hasListener(a,d){return a.hasListener(s.get(d))},removeListener(a,d){a.removeListener(s.get(d))}}),D=new c(s=>typeof s!="function"?s:function(d){let g=S(d,{},{getContent:{minArgs:0,maxArgs:0}});s(g)}),y=new c(s=>typeof s!="function"?s:function(d,g,h){let v=!1,w,l=new Promise(P=>{w=function(k){v=!0,P(k)}}),E;try{E=s(d,g,w)}catch(P){E=Promise.reject(P)}let b=E!==!0&&p(E);if(E!==!0&&!b&&!v)return!1;let I=P=>{P.then(k=>{h(k)},k=>{let $;k&&(k instanceof Error||typeof k.message=="string")?$=k.message:$="An unexpected error occurred",h({__mozWebExtensionPolyfillReject__:!0,message:$})}).catch(k=>{console.error("Failed to send onMessage rejected reply",k)})};return I(b?E:l),!0}),Q=({reject:s,resolve:a},d)=>{r.runtime.lastError?r.runtime.lastError.message===t?a():s(new Error(r.runtime.lastError.message)):d&&d.__mozWebExtensionPolyfillReject__?s(new Error(d.message)):a(d)},W=(s,a,d,...g)=>{if(g.length<a.minArgs)throw new Error(`Expected at least ${a.minArgs} ${x(a.minArgs)} for ${s}(), got ${g.length}`);if(g.length>a.maxArgs)throw new Error(`Expected at most ${a.maxArgs} ${x(a.maxArgs)} for ${s}(), got ${g.length}`);return new Promise((h,v)=>{let w=Q.bind(null,{resolve:h,reject:v});g.push(w),d.sendMessage(...g)})},X={devtools:{network:{onRequestFinished:M(D)}},runtime:{onMessage:M(y),onMessageExternal:M(y),sendMessage:W.bind(null,"sendMessage",{minArgs:1,maxArgs:3})},tabs:{sendMessage:W.bind(null,"sendMessage",{minArgs:2,maxArgs:3})}},N={clear:{minArgs:1,maxArgs:1},get:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}};return i.privacy={network:{"*":N},services:{"*":N},websites:{"*":N}},S(r,X,i)};e.exports=n(chrome)}else e.exports=globalThis.browser})});var T=G(_());var O=G(_());var H=class{constructor(){this.maxLogEntries=1e3;this.logStorageKey="extension_logs"}async log(t,n,r,i,c){let p={timestamp:new Date().toISOString(),level:t,component:n,message:r,data:i,error:c?{name:c.name,message:c.message,stack:c.stack}:void 0},m=`[${p.timestamp}] [${t.toUpperCase()}] [${n}] ${r}`;switch(t){case"debug":console.debug(m,i,c);break;case"info":console.info(m,i,c);break;case"warn":console.warn(m,i,c);break;case"error":console.error(m,i,c);break}try{let{[this.logStorageKey]:x=[]}=await O.default.storage.local.get(this.logStorageKey),u=Array.isArray(x)?x:[];u.push(p),u.length>this.maxLogEntries&&u.splice(0,u.length-this.maxLogEntries),await O.default.storage.local.set({[this.logStorageKey]:u})}catch(x){console.error("Failed to store log entry:",x)}}debug(t,n,r){return this.log("debug",t,n,r)}info(t,n,r){return this.log("info",t,n,r)}warn(t,n,r,i){return this.log("warn",t,n,r,i)}error(t,n,r,i){return this.log("error",t,n,r,i)}async getLogs(t){try{let{[this.logStorageKey]:n=[]}=await O.default.storage.local.get(this.logStorageKey),r=Array.isArray(n)?n:[];return t&&t>0?r.slice(-t):r}catch(n){return console.error("Failed to retrieve logs:",n),[]}}async clearLogs(){try{await O.default.storage.local.remove(this.logStorageKey)}catch(t){console.error("Failed to clear logs:",t)}}async exportLogs(){let t=await this.getLogs();return JSON.stringify(t,null,2)}},o=new H,B=class{static async trackError(t,n,r){await o.error(t,`Unhandled error: ${n.message}`,r,n)}static async trackUserAction(t,n,r){await o.info(t,`User action: ${n}`,r)}static async trackPerformance(t,n,r,i){await o.info(t,`Performance: ${n} took ${r}ms`,i)}};function K(e){typeof window!="undefined"&&(window.addEventListener("unhandledrejection",t=>{B.trackError(e,new Error(t.reason),{type:"unhandledrejection",reason:t.reason})}),window.addEventListener("error",t=>{B.trackError(e,t.error||new Error(t.message),{type:"error",filename:t.filename,lineno:t.lineno,colno:t.colno})}))}K("content-script");o.info("content-script",`Content script executing for: ${window.location.href}`);typeof window!="undefined"&&(window.extensionContentScriptLoaded=!0,o.info("content-script","Content script loaded flag set"));var L="extension-confirmation-modal",A="extension-modal-overlay",j="extension-loading-indicator",ae="extension-error-modal",le=2,ce="https://chromewebstore.google.com/detail/chatgpt-for-google-calend/laejdmahdkleahgkdpiapfdcmleedhca?hl=en",F=null;async function de(){try{let t=((await T.default.storage.local.get(["successfulEvents"])).successfulEvents||0)+1;return await T.default.storage.local.set({successfulEvents:t}),o.info("content-script","Incremented successful events count",{count:t}),t}catch(e){return o.error("content-script","Failed to increment successful events",void 0,e),0}}async function me(){try{let e=await T.default.storage.local.get(["successfulEvents","reviewPromptDismissed"]),t=e.successfulEvents||0,n=e.reviewPromptDismissed||!1,r=!n&&t>0&&t%le===0;return o.debug("content-script","Review prompt check",{count:t,dismissed:n,shouldShow:r}),r}catch(e){return o.error("content-script","Failed to check review prompt status",void 0,e),!1}}async function ge(){try{await T.default.storage.local.set({reviewPromptDismissed:!0}),o.info("content-script","Review prompt permanently dismissed")}catch(e){o.error("content-script","Failed to mark review prompt as dismissed",void 0,e)}}async function pe(){let e=document.createElement("div");e.style.cssText=`
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 16px !important;
    margin: 16px 0 !important;
    color: white !important;
    font-family: inherit !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
  `,e.innerHTML=`
    <div style="display: flex; align-items: center; margin-bottom: 12px;">
      <span style="font-size: 20px; margin-right: 8px;">\u2B50</span>
      <span style="font-weight: 600; font-size: 16px;">Enjoying the extension?</span>
    </div>
    <div style="margin-bottom: 16px; font-size: 14px; line-height: 1.4; opacity: 0.95;">
      Help others discover this extension by leaving a review, or contact me on Reddit to share feedback and suggestions!
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button id="review-now-btn" style="
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
      ">\u2B50 Review on Store</button>
      <button id="send-feedback-btn" style="
        background: rgba(255, 255, 255, 0.2) !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
      ">\uFFFD Contact on Reddit</button>
      <button id="maybe-later-btn" style="
        background: transparent !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        color: rgba(255, 255, 255, 0.8) !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
      ">Maybe Later</button>
    </div>
  `;let t=e.querySelector("#review-now-btn"),n=e.querySelector("#send-feedback-btn"),r=e.querySelector("#maybe-later-btn");return t&&(t.addEventListener("mouseenter",()=>{t.style.background="rgba(255, 255, 255, 0.3) !important",t.style.transform="translateY(-1px)"}),t.addEventListener("mouseleave",()=>{t.style.background="rgba(255, 255, 255, 0.2) !important",t.style.transform="translateY(0)"}),t.addEventListener("click",async()=>{o.info("content-script","User clicked Review Now"),await ge(),window.open(ce,"_blank")})),n&&(n.addEventListener("mouseenter",()=>{n.style.background="rgba(255, 255, 255, 0.3) !important",n.style.transform="translateY(-1px)"}),n.addEventListener("mouseleave",()=>{n.style.background="rgba(255, 255, 255, 0.2) !important",n.style.transform="translateY(0)"}),n.addEventListener("click",()=>{o.info("content-script","User clicked Send Feedback"),window.open("https://www.reddit.com/user/Loose_Ad_6677/","_blank")})),r&&(r.addEventListener("mouseenter",()=>{r.style.background="rgba(255, 255, 255, 0.1) !important",r.style.color="white !important"}),r.addEventListener("mouseleave",()=>{r.style.background="transparent !important",r.style.color="rgba(255, 255, 255, 0.8) !important"}),r.addEventListener("click",()=>{o.info("content-script","User clicked Maybe Later")})),e}function ue(e){try{if(o.debug("content-script","Creating error modal for failed AI detection",{errorType:e}),!document.body)return o.error("content-script","Document body not available for error modal creation"),null;let t=document.createElement("div");t.id=A,t.style.cssText=`
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: rgba(0, 0, 0, 0.7) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      transition: opacity 0.3s ease-in-out !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-sizing: border-box !important;
    `;let n=document.createElement("div");n.id=ae,n.style.cssText=`
      background-color: #ffffff !important;
      border-radius: 12px !important;
      padding: 24px !important;
      max-width: 500px !important;
      width: 90% !important;
      max-height: 80vh !important;
      overflow: auto !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      transform: scale(0.95) !important;
      transition: transform 0.3s ease-in-out !important;
      position: relative !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
      color: #000000 !important;
      border-left: 4px solid #ef4444 !important;
    `;let r=document.createElement("div"),i=document.createElement("div");i.style.cssText=`
      display: flex !important;
      align-items: center !important;
      margin-bottom: 16px !important;
    `;let c=document.createElement("span");c.textContent="\u26A0\uFE0F",c.style.cssText=`
      font-size: 24px !important;
      margin-right: 12px !important;
    `;let p=document.createElement("h2");e==="timeout"?(c.textContent="\u23F1\uFE0F",p.textContent="Extraction Timed Out"):(c.textContent="\u26A0\uFE0F",p.textContent="No Event Information Found"),p.style.cssText=`
      margin: 0 !important;
      font-size: 20px !important;
      font-weight: 600 !important;
      color: #dc2626 !important;
      font-family: inherit !important;
    `,i.appendChild(c),i.appendChild(p),r.appendChild(i);let m=document.createElement("div");m.style.cssText=`
      margin-bottom: 20px !important;
      line-height: 1.5 !important;
      color: #374151 !important;
      font-size: 14px !important;
    `,e==="timeout"?m.innerHTML=`
        <p style="margin: 0 0 12px 0;">The AI service took too long to respond (more than 5 seconds).</p>
        <p style="margin: 0 0 16px 0;"><strong>This usually happens when:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>The selected text is very long or complex</li>
          <li>The AI service is experiencing high load</li>
          <li>Network connectivity is slow</li>
        </ul>
        <p style="margin: 0 0 16px 0;"><strong>To improve success, try selecting shorter, more specific text that includes:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>Clear dates and times (e.g., "March 15 at 3 PM")</li>
          <li>Concise event descriptions</li>
          <li>Essential details only</li>
        </ul>
        <p style="margin: 0; font-style: italic; color: #6b7280;">Example: "Team meeting tomorrow at 2 PM in Conference Room A"</p>
      `:m.innerHTML=`
        <p style="margin: 0 0 12px 0;">We couldn't extract any event information from the selected text.</p>
        <p style="margin: 0 0 16px 0;"><strong>To get better results, try selecting text that includes:</strong></p>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>Specific dates (e.g., "March 15" or "next Tuesday")</li>
          <li>Times (e.g., "3:00 PM" or "at 2pm")</li>
          <li>Event descriptions (e.g., "meeting", "appointment", "call")</li>
          <li>Location information when available</li>
        </ul>
        <p style="margin: 0; font-style: italic; color: #6b7280;">Example: "Team meeting tomorrow at 2 PM in Conference Room A"</p>
      `,r.appendChild(m);let x=document.createElement("div");x.style.cssText=`
      display: flex !important;
      justify-content: flex-end !important;
      gap: 12px !important;
      margin-top: 24px !important;
    `;let u=document.createElement("button");u.textContent="Cancel",u.style.cssText=`
      background: #f3f4f6 !important;
      color: #374151 !important;
      border: 1px solid #d1d5db !important;
      padding: 10px 20px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
    `,u.onclick=Y;let f=document.createElement("button");f.textContent="Try Again",f.style.cssText=`
      background: #3b82f6 !important;
      color: white !important;
      border: 1px solid #3b82f6 !important;
      padding: 10px 20px !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      transition: all 0.2s ease !important;
    `,f.onclick=Y,u.addEventListener("mouseenter",()=>{u.style.background="#e5e7eb !important"}),u.addEventListener("mouseleave",()=>{u.style.background="#f3f4f6 !important"}),f.addEventListener("mouseenter",()=>{f.style.background="#2563eb !important"}),f.addEventListener("mouseleave",()=>{f.style.background="#3b82f6 !important"}),x.appendChild(u),x.appendChild(f),r.appendChild(x),n.appendChild(r),t.appendChild(n),t.classList.add("visible");let C=document.createElement("style");return C.textContent=`
      .visible { opacity: 1 !important; }
      .visible > div { transform: scale(1) !important; }
    `,document.head.appendChild(C),t}catch(t){return o.error("content-script","Error creating error modal",void 0,t),null}}function Y(){o.debug("content-script","Hiding error modal");let e=document.getElementById(A);e&&(e.classList.remove("visible"),setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},300));try{document.body.style.overflow=""}catch(t){o.warn("content-script","Could not restore body overflow style",void 0,t)}o.info("content-script","Error modal hidden")}function fe(e){if(o.debug("content-script","showErrorModal function entered",{errorType:e}),!document.body){o.error("content-script","Document body not available for error modal display");return}let t=document.getElementById(A);if(t){o.debug("content-script","Removing existing modal overlay",{existingOverlayId:t.id,existingOverlayClass:t.className}),t.remove();try{document.body.style.overflow=""}catch(r){o.warn("content-script","Could not reset body overflow style",void 0,r)}}o.debug("content-script","Creating new error modal");let n=ue(e);if(!n){o.error("content-script","Failed to create error modal, aborting showErrorModal");return}try{document.body.appendChild(n),o.debug("content-script","Successfully appended error modal to body"),n.offsetWidth,n.offsetHeight}catch(r){o.error("content-script","Error appending error modal",{error:r.message,url:window.location.href},r);return}setTimeout(()=>{n&&(n.classList.add("visible"),o.debug("content-script","Error modal visibility class added",{overlayId:n.id,overlayDisplay:getComputedStyle(n).display,overlayOpacity:getComputedStyle(n).opacity,overlayZIndex:getComputedStyle(n).zIndex}))},10);try{document.body.style.overflow="hidden"}catch(r){o.warn("content-script","Could not set body overflow style",void 0,r)}o.info("content-script","Error modal displayed successfully",{overlayInDOM:!!document.getElementById(A),bodyChildrenCount:document.body.children.length,errorType:e})}function xe(){try{if(o.debug("content-script","Creating confirmation modal"),!document.body)return o.error("content-script","Document body not available for modal creation"),null;let e=document.createElement("div");e.id=A,e.style.cssText=`
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: rgba(0, 0, 0, 0.7) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      transition: opacity 0.3s ease-in-out !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-sizing: border-box !important;
      pointer-events: auto !important;
      visibility: visible !important;
    `;let t=document.createElement("div");t.id=L,t.style.cssText=`
      background-color: #ffffff !important;
      border-radius: 12px !important;
      padding: 24px !important;
      max-width: 500px !important;
      width: 90% !important;
      max-height: 80vh !important;
      overflow: auto !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
      transform: scale(0.95) !important;
      transition: transform 0.3s ease-in-out !important;
      position: relative !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
      color: #000000 !important;
    `;let n=document.createElement("div");n.id=j,n.style.display="flex",n.style.flexDirection="column",n.style.alignItems="center",n.style.padding="20px";let r=document.createElement("div");r.style.border="3px solid #f3f3f3",r.style.borderTop="3px solid #3498db",r.style.borderRadius="50%",r.style.width="30px",r.style.height="30px",r.style.animation="spin 1s linear infinite",r.style.marginBottom="12px";let i=document.createElement("div");if(i.textContent="Extracting event details...",i.style.color="#666",i.style.fontSize="14px",n.appendChild(r),n.appendChild(i),!document.head.querySelector(`style[data-ext-modal-id="${L}"]`)){let p=document.createElement("style");p.setAttribute("data-ext-modal-id",L),p.textContent=`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        #${A}.visible {
          opacity: 1;
        }
        #${A}.visible #${L} {
          transform: scale(1);
        }
        .event-field {
          margin-bottom: 12px;
        }
        .event-field-label {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .event-field-value {
          color: #6b7280;
          font-size: 14px;
          background: #f9fafb;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        .modal-button {
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
        }
        .modal-button-primary {
          background: #3b82f6;
          color: white;
        }
        .modal-button-primary:hover {
          background: #2563eb;
        }
        .modal-button-secondary {
          background: #f3f4f6;
          color: #374151;
          margin-right: 12px;
        }
        .modal-button-secondary:hover {
          background: #e5e7eb;
        }
        .error-message {
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }
      `,document.head.appendChild(p)}return t.appendChild(n),e.appendChild(t),o.debug("content-script","Confirmation modal created successfully"),e}catch(e){return o.error("content-script","Error creating confirmation modal",void 0,e),null}}function U(){var n;if(o.debug("content-script","showConfirmationModal function entered"),!document.body){o.error("content-script","Document body not available for modal display");return}let e=document.getElementById(A);e&&(o.debug("content-script","Removing existing modal overlay"),e.remove());let t=document.getElementById(A);if(!t){if(o.debug("content-script","Creating new confirmation modal"),t=xe(),!t){o.error("content-script","Failed to create modal, aborting showConfirmationModal");return}try{let r=document.createElement("div");r.style.cssText="position: fixed !important; z-index: 999999 !important;",document.body.appendChild(r),document.body.removeChild(r),document.body.appendChild(t),o.debug("content-script","Successfully appended modal to body"),t.offsetWidth,t.offsetHeight,o.info("content-script","Modal creation debug info",{overlayId:t.id,overlayInDOM:!!document.getElementById(A),overlayParent:(n=t.parentElement)==null?void 0:n.tagName,overlayDisplay:getComputedStyle(t).display,overlayVisibility:getComputedStyle(t).visibility,overlayZIndex:getComputedStyle(t).zIndex,bodyChildrenCount:document.body.children.length})}catch(r){o.error("content-script","Error appending modal - possible CSP restriction",{error:r.message,url:window.location.href},r);return}}setTimeout(()=>{t&&(t.classList.add("visible"),t.style.opacity="1",o.debug("content-script","Modal visibility class added and opacity set"),o.info("content-script","Modal visibility debug info",{hasVisibleClass:t.classList.contains("visible"),computedOpacity:getComputedStyle(t).opacity,computedDisplay:getComputedStyle(t).display,boundingRect:t.getBoundingClientRect()}))},10);try{document.body.style.overflow="hidden"}catch(r){o.warn("content-script","Could not set body overflow style",void 0,r)}o.info("content-script","Confirmation modal displayed successfully")}function ye(){o.info("content-script","Creating fallback modal");let e=document.createElement("div");e.id=A,e.innerHTML=`
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999999;
      max-width: 400px;
      font-family: Arial, sans-serif;
    ">
      <h3 style="margin: 0 0 15px 0; color: #333;">Processing Event...</h3>
      <p style="margin: 0 0 15px 0; color: #666;">
        The extension is processing your selected text to extract event information.
      </p>
      <div style="text-align: center;">
        <div style="
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  `,e.style.cssText=`
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background-color: rgba(0, 0, 0, 0.5) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
  `,document.body.appendChild(e),o.info("content-script","Fallback modal created and displayed")}function J(e){o.info("content-script","showEventConfirmation called",{eventData:e}),F=e;let t=document.getElementById(A);if(!t&&(o.warn("content-script","Modal overlay not found, creating it now"),U(),t=document.getElementById(A),!t)){o.error("content-script","Failed to create modal overlay");return}let n=document.getElementById(L);if(!n){o.error("content-script","Modal not found for event confirmation even after creation attempt");return}let r=document.getElementById(j);r&&(r.style.display="none");let i=document.createElement("div"),c=document.createElement("h2");c.textContent="Confirm Event Details",c.style.cssText=`
    margin: 0 0 20px 0 !important;
    fontSize: 20px !important;
    fontWeight: 600 !important;
    color: #111827 !important;
    fontFamily: inherit !important;
  `,i.appendChild(c);let p=Ae(e);i.appendChild(p),me().then(async f=>{if(f){let C=await pe();i.insertBefore(C,i.lastElementChild||null)}}).catch(f=>{o.error("content-script","Error checking review prompt status",void 0,f)});let m=document.createElement("div");m.style.display="flex",m.style.justifyContent="flex-end",m.style.marginTop="24px";let x=document.createElement("button");x.textContent="Cancel",x.className="modal-button modal-button-secondary",x.onclick=R;let u=document.createElement("button");u.textContent="Add to Calendar",u.className="modal-button modal-button-primary",u.onclick=async()=>{let f=he(p);if(!f.title.trim()){alert("Please enter an event title");return}if(!f.startDate){alert("Please enter a start date and time");return}o.info("content-script","User confirmed event with data",{updatedEventData:f}),await de(),ve(f),R()},m.appendChild(x),m.appendChild(u),i.appendChild(m),n.innerHTML="",n.appendChild(i)}function be(e){console.log(`[Content Script] showErrorInModal called with message: "${e}"`);let t=document.getElementById(L);if(!t){console.error("[Content Script] Modal not found for error display.");return}let n=document.getElementById(j);n&&(n.style.display="none");let r=document.createElement("div"),i=document.createElement("h2");i.textContent="Error Processing Event",i.style.margin="0 0 20px 0",i.style.fontSize="20px",i.style.fontWeight="600",i.style.color="#111827",r.appendChild(i);let c=document.createElement("div");c.className="error-message",c.textContent=e||"An unexpected error occurred.",r.appendChild(c);let p=document.createElement("div");p.style.display="flex",p.style.justifyContent="flex-end",p.style.marginTop="16px";let m=document.createElement("button");m.textContent="Close",m.className="modal-button modal-button-secondary",m.onclick=R,p.appendChild(m),r.appendChild(p),t.innerHTML="",t.appendChild(r)}function R(){let e=document.getElementById(A);e&&(console.log("[Content Script] Hiding confirmation modal."),e.classList.remove("visible"),document.body.style.overflow="",setTimeout(()=>{let t=document.getElementById(A);t&&!t.classList.contains("visible")&&(t.remove(),console.log("[Content Script] Modal removed from DOM."))},300)),F=null}function Z(e,t=!0){if(!e)return"";try{let n=new Date(e);if(isNaN(n.getTime()))return"";if(t){let r=n.getFullYear(),i=String(n.getMonth()+1).padStart(2,"0"),c=String(n.getDate()).padStart(2,"0"),p=String(n.getHours()).padStart(2,"0"),m=String(n.getMinutes()).padStart(2,"0");return`${r}-${i}-${c}T${p}:${m}`}else return n.toISOString().split("T")[0]}catch(n){return""}}function Ae(e){let t=document.createElement("div");t.style.cssText=`
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
  `;function n(x,u,f,C="",S=!1){let M=document.createElement("div");M.style.cssText=`
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
    `;let D=document.createElement("label");D.textContent=x+(S?" *":""),D.style.cssText=`
      font-weight: 600 !important;
      color: #374151 !important;
      font-size: 14px !important;
      font-family: inherit !important;
    `;let y;return u==="textarea"?(y=document.createElement("textarea"),y.rows=3):(y=document.createElement("input"),y.type=u),y.value=f,y.placeholder=C,S&&(y.required=!0),y.style.cssText=`
      padding: 8px 12px !important;
      border: 1px solid #d1d5db !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      font-family: inherit !important;
      background: #ffffff !important;
      color: #000000 !important;
      box-sizing: border-box !important;
    `,y.addEventListener("focus",()=>{y.style.borderColor="#3b82f6",y.style.outline="none",y.style.boxShadow="0 0 0 3px rgba(59, 130, 246, 0.1)"}),y.addEventListener("blur",()=>{y.style.borderColor="#d1d5db",y.style.boxShadow="none"}),M.appendChild(D),M.appendChild(y),M}let r=n("Event Title","text",e.title||"","Enter event title",!0),i=n("Start Date & Time","datetime-local",Z(e.startDate),"",!0),c=n("End Date & Time","datetime-local",Z(e.endDate),"Optional"),p=n("Location","text",e.location||"","Optional"),m=n("Description","textarea",e.description||"","Optional");return t.titleInput=r.querySelector("input"),t.startDateInput=i.querySelector("input"),t.endDateInput=c.querySelector("input"),t.locationInput=p.querySelector("input"),t.descriptionInput=m.querySelector("textarea"),t.appendChild(r),t.appendChild(i),t.appendChild(c),t.appendChild(p),t.appendChild(m),t}function he(e){var t,n,r,i,c;return{title:((t=e.titleInput)==null?void 0:t.value)||"",startDate:((n=e.startDateInput)==null?void 0:n.value)||"",endDate:((r=e.endDateInput)==null?void 0:r.value)||"",location:((i=e.locationInput)==null?void 0:i.value)||"",description:((c=e.descriptionInput)==null?void 0:c.value)||"",originalText:(F==null?void 0:F.originalText)||""}}function ve(e){console.log("[Content Script] Opening Google Calendar with event data:",e),T.default.runtime.sendMessage({action:"openCalendar",eventData:e}).catch(t=>{console.error("[Content Script] Error sending calendar message:",t)})}o.info("content-script","Adding message listener");T.default.runtime.onMessage.addListener((e,t,n)=>{try{if(o.debug("content-script","Received message",{action:e.action}),e.action==="showModal")U(),setTimeout(()=>{if(!document.getElementById(A)){o.warn("content-script","Modal not found after creation, creating fallback");try{ye()}catch(i){o.error("content-script","Fallback modal creation failed, using alert",void 0,i),alert("ChatGPT Calendar Extension: Processing your selected text...")}}},100);else if(e.action==="hideModal")R();else if(e.action==="showEventConfirmation")J(e.eventData);else if(e.action==="showExtractionError"){o.info("content-script","Showing extraction error modal",{originalText:e.originalText,errorType:e.errorType});let r=document.getElementById(A);o.debug("content-script","Modal state before error modal",{existingModalExists:!!r,existingModalId:r==null?void 0:r.id,existingModalVisible:r?getComputedStyle(r).display:"none"}),fe(e.errorType)}else if(e.action==="showError")be(e.message);else{if(e.action==="ping")return o.debug("content-script","Responding to ping"),n({success:!0,message:"Content script is working",url:window.location.href}),!0;o.warn("content-script","Unknown message action",{action:e.action})}}catch(r){o.error("content-script","Error handling message",{message:e},r)}});o.info("content-script","Content script loaded and listener attached");window.addEventListener("pagehide",()=>{o.info("content-script","pagehide event detected, attempting to hide modal"),R()});typeof window!="undefined"&&(window.extensionDebug={testModal:()=>{o.info("content-script","Testing modal creation"),U()},testEventConfirmation:()=>{let e={title:"Test Event",startDate:"2025-08-02T15:00:00",endDate:"2025-08-02T16:00:00",location:"Test Location",description:"Test Description",originalText:"Test meeting tomorrow at 3 PM"};o.info("content-script","Testing event confirmation with test data"),J(e)},hideModal:()=>{o.info("content-script","Hiding modal via debug function"),R()},checkModalExists:()=>{let e=document.getElementById(A),t=document.getElementById(L),n={overlayExists:!!e,modalExists:!!t,overlayVisible:e==null?void 0:e.classList.contains("visible"),overlayDisplay:e==null?void 0:e.style.display,overlayZIndex:e==null?void 0:e.style.zIndex,bodyOverflow:document.body.style.overflow};return o.info("content-script","Modal existence check",n),console.log("Modal debug info:",n),n},testBackgroundConnection:async()=>{try{let e=await T.default.runtime.sendMessage({action:"ping"});return console.log("Background script response:",e),e}catch(e){return console.error("Failed to connect to background script:",e),{success:!1,error:e.message}}},checkCurrentProvider:async()=>{try{o.info("content-script","Requesting current AI provider information");let e=await T.default.runtime.sendMessage({action:"getCurrentProvider"});return console.log("\u{1F916} Current AI Provider Configuration:",e),o.info("content-script","Provider info received",e),e}catch(e){return console.error("\u274C Failed to get provider info:",e),o.error("content-script","Failed to get provider info",void 0,e),{success:!1,error:e.message}}},getContentScriptInfo:()=>{let e={url:window.location.href,contentScriptLoaded:!!window.extensionContentScriptLoaded,debugFunctionsAvailable:typeof window.extensionDebug!="undefined",browserExtensionAvailable:typeof T.default!="undefined",documentReady:document.readyState,bodyAvailable:!!document.body,canCreateElements:!1,canAppendToBody:!1,cspRestrictions:!1};try{let t=document.createElement("div");e.canCreateElements=!0,document.body&&(document.body.appendChild(t),e.canAppendToBody=!0,document.body.removeChild(t))}catch(t){e.cspRestrictions=!0,console.warn("DOM manipulation test failed:",t)}return console.log("Content script info:",e),e},testDOMManipulation:()=>{try{let e=document.createElement("div");return e.style.cssText=`
          position: fixed !important;
          top: 10px !important;
          right: 10px !important;
          width: 200px !important;
          height: 50px !important;
          background: #4CAF50 !important;
          color: white !important;
          z-index: 2147483647 !important;
          padding: 10px !important;
          border-radius: 5px !important;
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
        `,e.textContent="Extension DOM Test - Click to Remove",e.onclick=()=>e.remove(),document.body.appendChild(e),setTimeout(()=>{e.parentNode&&e.remove()},5e3),console.log("DOM manipulation test successful"),{success:!0,message:"Test element created and will auto-remove in 5 seconds"}}catch(e){return console.error("DOM manipulation test failed:",e),{success:!1,error:e.message}}}});})();
