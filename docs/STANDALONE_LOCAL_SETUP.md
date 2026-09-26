# Standalone local setup on Windows

This guide uses PowerShell and Node.js 24. It keeps Firebase and Gemini credentials in a local `.env` file and does not require Replit. Do not commit `.env` or paste its values into source code.

The clean install, typecheck, test suite, production build, and start smoke test were run in an isolated Node.js environment using the public npm registry. A native Windows host was not available in this workspace, so the PowerShell commands themselves were not executed here.

## 1. Clone or download the project

With Git:

```powershell
git clone <repository-url> sejora
Set-Location .\sejora
```

Or download and extract the source ZIP, then open PowerShell in the extracted project directory. It should contain `package.json`, `package-lock.json`, `client\`, `server\`, and `shared\`.

Install Node.js 24 for Windows, then verify Node and npm are available:

```powershell
node --version
npm --version
```

## 2. Install dependencies

From the project root:

```powershell
npm install
```

The lockfile uses the public npm registry; the project contains no `.npmrc` redirect or Replit-only installer.

## 3. Create the local environment file

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in the Firebase values described below. `GEMINI_API_KEY` is needed only for receipt scanning, AI Insights, and AI Finance. Keep the Firebase Admin service-account key and Gemini key private.

### Configure Firebase

In the Firebase Console:

1. Enable Email/Password under Authentication providers.
2. Create or select the Firestore database.
3. Add `localhost` to Authentication Authorized domains if it is not already present.
4. Register a Firebase web app and copy its web configuration into these `.env` entries:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_APP_ID`
5. Create or select a server-side service account authorized to use Firebase Admin and Firestore. Set:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

The five `VITE_` values are public browser configuration. The Firebase Admin service-account values are private and must never use a `VITE_` prefix. For `FIREBASE_PRIVATE_KEY`, keep the key on one `.env` line with newline characters written as `\n`; the server expands those escapes.

### Configure Gemini (optional)

Create a Google Gemini API key and set `GEMINI_API_KEY` in `.env`. Do not put it in a `VITE_` variable. The non-AI application features do not require this key.

## 4. Load `.env` into the PowerShell session

Vite reads frontend values during build, but the Node server does not automatically load `.env`. In the same PowerShell window where you will run the application, execute:

```powershell
Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1]
            if ($value.Length -ge 2 -and $value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') {
                $value = $value.Substring(1, $value.Length - 2)
            } elseif ($value.Length -ge 2 -and $value[0] -eq "'" -and $value[$value.Length - 1] -eq "'") {
                $value = $value.Substring(1, $value.Length - 2)
            }
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}
```

This applies the values to the current PowerShell process and its child processes. Repeat it in any new terminal window.

## 5. Run the development server

The existing `npm run dev` script builds the app and starts production mode; it is not a hot-reload development command. To run the Express server with its Vite middleware in non-production mode:

```powershell
npx tsx server/src/index.ts
```

Open `http://localhost:5000`. Check `http://localhost:5000/api/health` for the liveness response. This endpoint does not verify Firebase or Gemini connectivity. Use a test Firebase account and non-production financial data.

## 6. Build and run the production application

Build from the project root with:

```powershell
npm run build
```

The production files are created under `dist\client\` and `dist\server\`. In the same PowerShell window with `.env` values loaded, start the production server with:

```powershell
$env:NODE_ENV = "production"
node dist/server/src/index.js
```

The server listens on `$env:PORT` or defaults to port `5000`, and serves both the built frontend and `/api` from the same origin. `npm start` is also cross-platform and starts the same production server.

## Quick command sequence

After filling in `.env`, the basic PowerShell sequence is:

```powershell
npm install
# Load .env with the PowerShell block above
npx tsx server/src/index.ts
```

For a production build and run in a new terminal, first load `.env`, then:

```powershell
npm run build
npm start
```

Firebase Auth, Firestore, and Gemini remain external services; this repository does not migrate or provision them.