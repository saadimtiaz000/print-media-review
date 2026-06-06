# Print Media Review Android App

This is a native Android archive viewer for the Print Media Review reports. The app now loads archived report JSON directly from bundled assets and no longer depends on a remote web server.

The native splash screen shows `Print Media Review` with a centered animated globe. After the splash, the app loads archived reports from the bundled assets folder:

`app/src/main/assets/archive/`

Build:

```powershell
.\build-apk.ps1
```

Output:

`PrintMediaReview.apk`
