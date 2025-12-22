# Clueso Clone – Chrome Recorder Extension

## Build
- Install deps: `npm install`
- Build: `npm run build`

Vite outputs to `extension/dist/`.

## Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/dist` folder

## Use
- Click the extension icon
- Choose:
  - **Record**: shows recording options and starts/stops tab recording
  - **Upload**: opens the web app upload page in a new tab

Notes:
- Recording is tab capture (video + tab audio), with optional microphone mixed in.
- The browser may still show its own "sharing" UI while capturing.
