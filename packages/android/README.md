# LG Agent Mobile Companion

Native Android shell for Sprint 20. The app consumes the versioned `/mobile` read model and does not own task or submission state.

## Variants

- `localDebug`: emulator-friendly local Golden Path fixture and `http://10.0.2.2:3000/` API seam.
- `pilotDebug` / `pilotRelease`: no demo data and no embedded enterprise secret. Until OIDC and the network adapter are configured, the app presents an explicit company sign-in required state.

The local fixture is functional test data only. It is not evidence that enterprise SSO, remote revocation, push delivery, or PC handoff has passed acceptance.

## Build

```powershell
./gradlew.bat --no-daemon :app:testLocalDebugUnitTest :app:lintLocalDebug :app:assembleLocalDebug
```

Instrumentation tests require an API 26+ emulator or device:

```powershell
./gradlew.bat --no-daemon :app:connectedLocalDebugAndroidTest
```

Dependency locking is enabled. After an intentional dependency update, regenerate and review locks with:

```powershell
./gradlew.bat dependencies --write-locks
```
