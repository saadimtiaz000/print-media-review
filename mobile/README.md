# Print Media Review Mobile

React Native conversion of the Print Media Review app, built with Expo.

## Run

Start the existing report server from the repository root:

```powershell
npm run dev:mobile
```

Then start the mobile app:

```powershell
cd mobile
npm install
npm run android
```

The Android emulator uses `http://10.0.2.2:3000` by default to reach the Next API. For a physical phone, run the Next server with `npm run dev:mobile` and set your PC LAN address before starting Expo:

```powershell
$env:EXPO_PUBLIC_REPORT_API_BASE_URL="http://YOUR-PC-IP:3000"
npm run android
```

If the server is unavailable, the app opens with a bundled sample report so the UI can still be inspected.
