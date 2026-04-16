"use strict";(()=>{var l=!1,i=new Map,b=null,d=[];chrome.runtime.onMessage.addListener((e,t,n)=>{switch(e.action){case"ADD_CHECKBOXES":l=!0,u(),y();break;case"REMOVE_CHECKBOXES":l=!1,p();break;case"BULK_DELETE":f();break;case"BULK_ARCHIVE":C();break;case"GET_SELECTED_COUNT":n({count:Array.from(i.values()).filter(o=>o.checkbox.checked).length});break}n()});var k=new MutationObserver(()=>{l&&u()});k.observe(document.body,{childList:!0,subtree:!0});function u(){document.querySelectorAll('a[href^="/c/"], a[href^="/g/"][href*="/c/"]').forEach(t=>{if(t.querySelector(".bulk-delete-checkbox"))return;let n=localStorage.getItem("theme")??"light",c=(t.getAttribute("href")||"").match(/\/c\/([^/]+)/),r=c?c[1]:"";if(i.has(r))return;let a=document.createElement("input");a.type="checkbox",a.classList.add("bulk-delete-checkbox"),document.documentElement.style.setProperty("--checkbox-border",n==="dark"?"#888":"#ccc"),document.documentElement.style.setProperty("--checkbox-bg",n==="dark"?"#444":"#fff"),document.documentElement.style.setProperty("--checkbox-checked-bg",n==="dark"?"#76c7c0":"#4CAF50"),document.documentElement.style.setProperty("--checkbox-checked-border",n==="dark"?"#76c7c0":"#4CAF50"),document.documentElement.style.setProperty("--selected-bg",n==="dark"?"rgba(118, 199, 192, 0.3)":"rgba(76, 175, 80, 0.2)"),t.prepend(a),d.push(r),i.set(r,{id:r,checkbox:a}),a.addEventListener("click",s=>{g(s,r)})})}function p(){document.querySelectorAll(".bulk-delete-checkbox").forEach(t=>{t.remove()}),i.clear(),d.length=0,b=null,chrome.runtime.sendMessage({action:"UPDATE_SELECTED_COUNT",count:0}),chrome.runtime.sendMessage({action:"UPDATE_PROGRESS",current:0,total:0})}function g(e,t){e.stopPropagation();let n=Array.from(i.values()).filter(o=>o.checkbox.checked).length;chrome.runtime.sendMessage({action:"UPDATE_SELECTED_COUNT",count:n})}async function h(e){let t=v();if(!t.length){alert("No chats selected!");return}let n=await E();if(!n){console.error("[Error] Unable to find Bearer token!"),alert("Bearer token not found. Make sure you are logged in to ChatGPT.");return}let o=5,c=0;for(let r=0;r<t.length;r+=o){let a=t.slice(r,r+o);await Promise.all(a.map(async s=>{await A(n,s,e),c++,chrome.runtime.sendMessage({action:"UPDATE_PROGRESS",current:c,total:t.length})})),await T(500)}location.reload()}async function f(){return h("delete")}async function C(){return h("archive")}function E(){return new Promise((e,t)=>{chrome.storage.local.get("bearerToken",n=>{if(chrome.runtime.lastError)return t(chrome.runtime.lastError);e(n.bearerToken||null)})})}function m(){return Array.from(i.values()).filter(e=>e.checkbox.checked)}function x(){return m().length}function v(){return m().map(e=>e.id)}function y(){let e=x();chrome.runtime.sendMessage({action:"UPDATE_SELECTED_COUNT",count:e})}async function A(e,t,n){let o=`https://chatgpt.com/backend-api/conversation/${t}`,c=await fetch(o,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`${e}`},body:JSON.stringify({is_visible:n==="delete"?!1:void 0,is_archived:n==="archive"?!0:void 0})});if(!c.ok)throw new Error(`API returned status: ${c.status}`)}function T(e){return new Promise(t=>setTimeout(t,e))}function S(){let e=document.createElement("style");e.innerHTML=`
        /* Ensure flex alignment for conversation links */
        a[href^="/c/"], a[href^="/g/"][href*="/c/"] {
            display: flex !important;
            align-items: center !important;
            padding: 6px !important;
            border-radius: 6px !important;
            transition: background 0.2s ease-in-out !important;
        }

        /* Highlight selected conversation */
        a.selected {
            background: var(--selected-bg, rgba(76, 175, 80, 0.2)) !important;
        }

        /* Custom Checkbox Styling */
        .bulk-delete-checkbox {
            appearance: none !important;
            width: 16px !important;
            height: 16px !important;
            border-radius: 4px !important;
            border: 2px solid var(--checkbox-border, #ccc) !important;
            background: var(--checkbox-bg, transparent) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-right: 8px !important;
            cursor: pointer !important;
            transition: background 0.2s ease-in-out, border 0.2s ease-in-out !important;
        }

        /* Checkbox checked state */
        .bulk-delete-checkbox:checked {
            background: var(--checkbox-checked-bg, #4CAF50) !important;
            border-color: var(--checkbox-checked-border, #4CAF50) !important;
            position: relative !important;
        }

        /* Checkmark inside checkbox */
        .bulk-delete-checkbox:checked::after {
            content: "\u2714" !important; 
            color: white !important;
            font-size: 12px !important;
            font-weight: bold !important;
            display: block !important;
            text-align: center !important;
            line-height: 14px !important;
        }
    `,document.head.appendChild(e)}S();})();
