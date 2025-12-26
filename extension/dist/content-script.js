function c(){try{return window.localStorage.getItem("token")}catch{return null}}async function i(){const t=c();if(t)try{await chrome.runtime.sendMessage({type:"AUTH_SYNC",token:t}),window.postMessage({type:"CLUESO_CLONE_TOKEN_SYNCED"},"*")}catch{}}i();setTimeout(()=>{i()},500);setTimeout(()=>{i()},2e3);window.addEventListener("message",t=>{t.source===window&&t.data?.type==="CLUESO_CLONE_REQUEST_TOKEN"&&i()});window.addEventListener("storage",t=>{t.key==="token"&&i()});let o=null,n=null,a=0;function l(){if(o)return;const t=document.createElement("div");t.id="clueso-recorder-host",t.style.position="fixed",t.style.bottom="20px",t.style.left="20px",t.style.zIndex="2147483647";const e=t.attachShadow({mode:"open"}),r=document.createElement("style");r.textContent=`
    .container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: white;
      border-radius: 999px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      color: #111;
    }
    .red-dot {
      width: 8px;
      height: 8px;
      background-color: #ef4444;
      border-radius: 50%;
    }
    .recording-text {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .timer {
      color: #666;
      min-width: 24px;
      font-feature-settings: "tnum";
      font-variant-numeric: tabular-nums;
    }
    .separator {
      width: 1px;
      height: 24px;
      background-color: #e5e7eb;
    }
    button {
      cursor: pointer;
      border: none;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    .btn-stop {
      background-color: #ef4444;
      color: white;
      padding: 6px 16px;
      border-radius: 6px;
    }
    .btn-discard {
      background-color: white;
      color: #111;
      border: 1px solid #e5e7eb;
      padding: 6px 12px;
      border-radius: 6px;
    }
    .btn-open {
      background: none;
      color: #111;
      padding: 6px 8px;
    }
  `;const d=document.createElement("div");d.className="container",d.innerHTML=`
    <div class="recording-text">
      <div class="red-dot"></div>
      <span>Recording</span>
    </div>
    <div class="timer" id="timer">0s</div>
    <div class="separator"></div>
    <button class="btn-stop" id="stopBtn">Stop</button>
    <button class="btn-discard" id="discardBtn">Discard</button>
    <button class="btn-open" id="openBtn">Open</button>
  `,e.appendChild(r),e.appendChild(d),document.body.appendChild(t),o=t,e.getElementById("stopBtn")?.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"STOP_RECORDING"})}),e.getElementById("discardBtn")?.addEventListener("click",()=>{chrome.runtime.sendMessage({type:"STOP_RECORDING",discard:!0})}),e.getElementById("openBtn")?.addEventListener("click",()=>{window.open("http://localhost:3000/dashboard","_blank")})}function p(){o&&(o.remove(),o=null)}function u(){a=Date.now();const t=()=>{if(!o?.shadowRoot)return;const e=o.shadowRoot.getElementById("timer");if(e){const r=Math.floor((Date.now()-a)/1e3);e.textContent=`${r}s`}};n&&clearInterval(n),n=window.setInterval(t,1e3),t()}function s(){n&&(clearInterval(n),n=null)}chrome.runtime.onMessage.addListener(t=>{if(t.type==="SHOW_CLUESO_UI"&&(l(),u()),t.type==="HIDE_CLUESO_UI"&&(s(),p()),t.type==="UPDATE_UI"&&t.status==="uploading"&&(s(),o?.shadowRoot)){const e=o.shadowRoot.querySelector(".container");e&&(e.innerHTML=`
            <div class="recording-text" style="color:#666">
              <div class="red-dot" style="background-color:#fbbf24"></div>
              <span>Uploading to library...</span>
            </div>
          `)}if(t.type==="SHOW_ERROR"&&(s(),o?.shadowRoot)){const e=o.shadowRoot.querySelector(".container");e&&(e.innerHTML=`
            <div class="recording-text" style="color:#ef4444">
              <div class="red-dot"></div>
              <span>${t.error||"Error"}</span>
            </div>
          `)}});
//# sourceMappingURL=content-script.js.map
