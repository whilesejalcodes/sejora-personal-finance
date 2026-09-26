# Sejora

### AI-Powered Personal Finance Intelligence Platform

Sejora is a full-stack personal finance application designed to help users track their money, understand spending patterns, plan ahead, and make better financial decisions.

It combines deterministic financial logic with AI-powered features such as receipt scanning and contextual financial insights.

> **Note:** Sejora is a portfolio/educational application. It is not a banking system, payment processor, or financial-advice service. It does not connect to real bank accounts or execute financial transactions.

---

## ✨ Features

### 💳 Transaction Management

- Add, edit, and delete income and expense transactions
- Categorize transactions
- Track payment methods
- View transaction history
- Filter and sort financial records
- Track income, expenses, and net balance

### 📊 Analytics

- Income and expense summaries
- Spending patterns
- Category-based analysis
- Monthly comparisons
- Financial metrics and trends
- Interactive charts and visualizations

### 💰 Budgets

- Create and manage budgets
- Track budget usage
- Monitor remaining budget
- Compare spending against planned limits
- View budget-related financial metrics

### 🎯 Savings Goals

- Create savings goals
- Track progress toward goals
- Monitor contributions
- View goal-related financial metrics

### 🔄 Recurring Payments

- Detect recurring expenses
- Track upcoming recurring payments
- View expected cash-flow items
- Monitor recurring spending patterns

### 🔮 Financial Forecasting

Sejora provides deterministic financial forecasting based on the user's recorded financial history.

Features include:

- Future income projections
- Future expense projections
- Projected balances
- Savings-rate analysis
- Multiple forecast horizons
- What-if simulations

Forecasting does not use an LLM to calculate financial values.

### 🧾 AI Receipt Scanner

Upload a receipt and Sejora uses Google Gemini to extract structured information such as:

- Merchant
- Date
- Total amount
- Currency
- Category
- Payment method
- Visible line items

The extracted information is displayed for review before it can become a transaction.

**Scanning a receipt does not automatically create a transaction.**

### 🤖 AI Financial Insights

Gemini is used selectively for tasks where natural-language reasoning adds value, including:

- Explaining financial trends
- Summarizing financial activity
- Generating contextual financial insights
- Answering supported natural-language finance questions
- Explaining financial scenarios

Core numerical calculations remain deterministic and are not delegated to the LLM.

---

## 🧠 Design Philosophy

Sejora follows a simple product loop:

**Track → Understand → Predict → Act**

The application is designed as a finance product first and an AI-enhanced product second.

Deterministic application logic handles important financial operations such as:

- Balance calculations
- Income and expense calculations
- Budget usage
- Savings calculations
- Financial metrics
- Forecast calculations
- Recurring-payment detection
- Data aggregation
- Input validation

AI is used where it provides additional value:

- Receipt understanding
- Natural-language explanations
- Financial summaries
- Contextual insights
- Natural-language financial questions

This separation keeps important numerical results predictable, testable, and explainable.

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │      React App       │
                         │ TypeScript + Vite    │
                         │ Tailwind CSS         │
                         └──────────┬───────────┘
                                    │
                              Firebase ID Token
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Express API      │
                         │ Node.js + TypeScript │
                         └──────────┬───────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
                   ▼                ▼                ▼
          ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
          │ Firebase Admin│ │   Finance    │ │    Gemini    │
          │      SDK       │ │    Engine    │ │     API      │
          └───────┬────────┘ └──────────────┘ └──────────────┘
                  │
                  ▼
          ┌────────────────┐
          │   Firestore    │
          └────────────────┘
```

### Request Flow

1. The user signs in through Firebase Authentication.
2. Firebase provides an ID token to the client.
3. The client sends the token with authenticated API requests.
4. The Express server verifies the token using Firebase Admin SDK.
5. Requests are validated before reaching application services.
6. Financial services perform deterministic calculations.
7. Firestore stores user-scoped financial data.
8. Gemini is called server-side only for AI-dependent functionality.

The browser never receives Firebase Admin credentials or the Gemini API key.

---

## 🔐 Authentication

Sejora uses Firebase Authentication for user authentication.

The authentication flow is:

```text
User
 │
 ▼
Firebase Authentication
 │
 ▼
Firebase ID Token
 │
 ▼
React Client
 │
 ▼
Authorization: Bearer <token>
 │
 ▼
Express API
 │
 ▼
Firebase Admin verifyIdToken()
 │
 ▼
Authenticated Request
```

Protected API routes verify the Firebase ID token before accessing user-specific financial data.

User data is scoped using the authenticated Firebase UID.

---

## 🗄️ Data Storage

Sejora uses Cloud Firestore for persistent financial data.

The application stores user-owned data such as:

* Transactions
* Budgets
* Goals
* Recurring payments
* Other application-specific financial records

The server verifies the authenticated user before accessing protected data.

Direct client access to private Firestore collections is denied by Firestore Security Rules. Firebase Admin operations on the server bypass those rules, so the Express API verifies Firebase ID tokens and uses UID-scoped repository paths before accessing user data.

---

## 🧾 Receipt Scanning Architecture

Receipt scanning follows this flow:

```text
Receipt Image
      │
      ▼
Authenticated API Request
      │
      ▼
Image Validation
      │
      ▼
Gemini
      │
      ▼
Structured Receipt Data
      │
      ▼
Server Validation
      │
      ▼
Normalization
      │
      ▼
User Review
      │
      ▼
User Confirmation
      │
      ▼
Transaction Created
```

The server validates the uploaded image before sending it to Gemini.

Gemini-generated information is treated as untrusted input.

The server validates and normalizes the response before presenting the data to the user.

The user must review and confirm the extracted information before it is added to the transaction ledger.

---

## 🤖 AI Architecture

Sejora follows a bounded-AI approach.

### Deterministic Layer

The application itself handles:

```text
Transactions
     ↓
Financial Calculations
     ↓
Budgets
     ↓
Analytics
     ↓
Forecasts
     ↓
Financial Metrics
```

### AI Layer

Gemini is used for tasks that benefit from multimodal or natural-language understanding:

```text
Receipt Image ────────► Gemini
                            │
                            ▼
                    Structured Extraction
                            │
                            ▼
                         Validation
                            │
                            ▼
                         User Review
```

For financial explanations:

```text
Financial Context
       │
       ▼
Deterministic Facts
       │
       ▼
Gemini
       │
       ▼
Natural-Language Explanation
```

The AI layer does not replace the application's core financial calculations.

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router
* Recharts
* Lucide React

### Backend

* Node.js
* Express
* TypeScript
* Zod

### Database & Authentication

* Firebase Authentication
* Cloud Firestore
* Firebase Admin SDK

### AI

* Google Gemini API

### Testing

* Vitest

---

## 📁 Project Structure

```text
sejora/
│
├── client/
│   └── src/
│       ├── app/
│       ├── components/
│       │
│       ├── features/
│       │   ├── ai-finance/
│       │   ├── analytics/
│       │   ├── auth/
│       │   ├── budgets/
│       │   ├── cash-flow/
│       │   ├── dashboard/
│       │   ├── forecast/
│       │   ├── goals/
│       │   ├── insights/
│       │   ├── receipts/
│       │   ├── recurring/
│       │   └── transactions/
│       │
│       ├── lib/
│       └── styles/
│
├── server/
│   └── src/
│       ├── ai-finance/
│       ├── ai-insights/
│       ├── analytics/
│       ├── auth/
│       ├── budgets/
│       ├── forecast/
│       ├── goals/
│       ├── intelligence/
│       ├── phase7/
│       ├── receipts/
│       ├── security/
│       └── transactions/
│
├── shared/
│   ├── budgets/
│   ├── finance/
│   ├── forecast/
│   ├── goals/
│   ├── schemas/
│   └── types/
│
├── tests/
│   ├── integration/
│   └── unit/
│
├── docs/
├── public/
│
├── firestore.rules
├── firestore.indexes.json
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔑 Environment Variables

Sejora uses separate client-side and server-side configuration.

### Firebase Client Configuration

These variables are used by the browser application:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_APP_ID=
```

These values identify the Firebase project used by the frontend.

They are not Firebase Admin credentials.

### Server Configuration

These values must remain server-side:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
GEMINI_API_KEY=
```

Optional runtime configuration:

```env
PORT=5000
NODE_ENV=development
```

### Important

Never commit:

```text
.env
Firebase service-account JSON files
Private keys
Gemini API keys
Other credentials
```

The repository includes `.env.example` containing variable names and placeholders.

---

## 🚀 Running Locally

### Requirements

- Node.js 24 and npm.
- A Firebase project configured for Email/Password Authentication and Cloud Firestore.
- A Gemini API key only if you plan to use receipt scanning or Gemini-backed AI features.

### Clone and install

```powershell
git clone https://github.com/whilesejalcodes/sejora-personal-finance.git
Set-Location .\sejora-personal-finance
npm install
Copy-Item .env.example .env
notepad .env
```

Fill in the Firebase web configuration and Firebase Admin service-account values described above. `GEMINI_API_KEY` is optional unless you use the AI features. Do not commit `.env` or a service-account JSON file.

Vite reads the `VITE_FIREBASE_*` values during the build. The Node server does not load `.env` automatically; load the server variables into the PowerShell process before starting the server. The PowerShell loading instructions are in [Standalone Windows setup](docs/STANDALONE_LOCAL_SETUP.md).

### Run the development server

```powershell
npx tsx server/src/index.ts
```

Open `http://localhost:5000`. The server uses its Vite middleware in this mode. The repository's `npm run dev` script instead builds the app and starts it in production mode; it is not a hot-reload command.

### Build and run production

```powershell
npm run build
npm start
```

`npm start` serves the built frontend and API from the same origin. The server listens on `PORT`, defaulting to `5000`. Run `npm test` for the test suite and `npm run typecheck` for client/server type checks.

For exact Windows environment setup and Firebase configuration steps, see [Standalone Windows setup](docs/STANDALONE_LOCAL_SETUP.md).

---

## 🔥 Firebase Setup

Sejora requires a Firebase project with:

* Firebase Authentication enabled
* Email/Password authentication enabled
* Firestore enabled
* Appropriate Firestore security rules
* A Firebase Web App configured for the client
* A Firebase service account configured for server-side Firebase Admin access

The following values must refer to the same Firebase project:

```text
VITE_FIREBASE_PROJECT_ID
FIREBASE_PROJECT_ID
```

For detailed Firebase configuration, see:

```text
FIREBASE_SETUP.md
docs/AUTHENTICATION.md
docs/ENVIRONMENT_VARIABLES.md
docs/STANDALONE_LOCAL_SETUP.md
```

---

## 🧪 Testing

Run the test suite with:

```bash
npm test
```

The project includes unit and integration tests covering areas such as:

* Financial calculations
* Authentication middleware
* API behavior
* Receipt processing
* Forecast calculations
* Budget calculations
* Transaction behavior
* Security-related request handling

---

## 📚 Documentation

Additional technical documentation is available in the `docs/` directory.

Important documents include:

```text
docs/
├── API_REFERENCE.md
├── ARCHITECTURE.md
├── AUTHENTICATION.md
├── DATABASE.md
├── DEPLOYMENT.md
├── ENVIRONMENT_VARIABLES.md
├── FRONTEND_DEPLOYMENT.md
├── LOCAL_DEVELOPMENT.md
├── REPLIT_TO_INDEPENDENT_DEPLOYMENT.md
├── STANDALONE_LOCAL_SETUP.md
├── THIRD_PARTY_SERVICES.md
└── TROUBLESHOOTING.md
```

---

## 🔒 Security Principles

Sejora follows several security principles:

* Server-side verification of Firebase ID tokens
* User-scoped Firestore access
* Server-only Gemini API access
* Server-only Firebase Admin credentials
* Input validation with Zod
* Protected API routes
* Environment-based secret management
* No secrets committed to source control
* Validation of AI-generated structured data

The frontend does not have access to Firebase Admin credentials or the Gemini API key.

---

## ⚠️ Limitations

Sejora currently does not:

* Connect directly to bank accounts
* Execute real financial transactions
* Process payments
* Act as a bank
* Provide regulated financial advice
* Guarantee financial forecasts
* Replace professional financial advice

Financial forecasts and AI-generated insights are intended for informational and educational purposes.

---

## 🎯 Project Goals

Sejora was built to explore the intersection of:

* Full-stack web development
* Financial data processing
* Data visualization
* Cloud databases
* Authentication and authorization
* Generative AI
* Multimodal AI
* Explainable financial calculations
* Secure API design

The project focuses on using AI where it adds value while keeping important financial computations deterministic and testable.

---

## 👩‍💻 Author

### Sejal Thakur

B.Tech — Electronics & Communication Engineering
Artificial Intelligence Specialization

GitHub: **[@whilesejalcodes](https://github.com/whilesejalcodes)**

---

## 📌 Project Status

Sejora is an actively developed portfolio project focused on building a full-stack personal finance platform with analytics, forecasting, financial intelligence, and responsible AI integration.

---

## 📄 License

This project is currently intended for educational and portfolio purposes.
