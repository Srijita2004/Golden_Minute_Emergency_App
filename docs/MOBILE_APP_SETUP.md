# Mobile Application Setup & PWA Packaging Guide

The User Mobile Application is developed with React 19, TypeScript, Vite, Tailwind CSS, and Leaflet. It is designed mobile-first and can run as a Progressive Web Application (PWA) or be wrapped with Capacitor for native Android APK distribution.

---

## 1. Local Development Run

```bash
cd frontend
npm install
npm run dev
```
Open Chrome or your mobile browser at `http://localhost:3000`.

---

## 2. Testing Mobile Features in Browser

1. Open Chrome DevTools (`F12`) and toggle the **Device Toolbar** (`Ctrl+Shift+M`) to view as iPhone 14 Pro or Samsung Galaxy S20.
2. **Camera**: Grant camera permissions when prompted on the **Phone AI Camera** page.
3. **GPS**: Grant location permissions to test phone geolocation tracking.
4. **Emergency Audio**: Ensure user interaction has occurred so the browser allows Web Audio siren playback.

---

## 3. Native Android Packaging with Capacitor

To build a native Android APK:
```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Golden Minute" "com.emergency.goldenminute"
npm run build
npx cap add android
npx cap copy
npx cap open android
```
In Android Studio, click **Build > Build Bundle(s) / APK(s) > Build APK**.
