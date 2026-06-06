# Deploy Backend On Render

This deploys the live scraper API for the mobile APK.

## Steps

1. Push this project to GitHub.
2. Open Render and create a new **Blueprint** from the repo.
3. Render will detect `render.yaml` and create `print-media-review-api`.
4. Wait for deploy to finish.
5. Open:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/archives
```

You should see JSON with archive dates.

## Rebuild APK With Hosted URL

After Render gives you the public URL, rebuild the APK with:

```powershell
cd mobile\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:NODE_ENV="production"
$env:EXPO_PUBLIC_REPORT_API_BASE_URL="https://YOUR-RENDER-SERVICE.onrender.com"
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 --no-daemon --console=plain
cd ..\..
Copy-Item -LiteralPath "mobile\android\app\build\outputs\apk\release\app-release.apk" -Destination "PrintMediaReview-Mobile-Hosted-arm64.apk" -Force
```

## Important

Render free web services can sleep after inactivity. The first live fetch after sleep may take longer.
