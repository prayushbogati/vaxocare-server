# Vaxocare Backend - Smart Vaccination Management System

Comprehensive Node.js/Express/MongoDB API for vaccination tracking with AI risk prediction, provider portals, audit/compliance, exports/backups, realtime updates, and advanced admin tools.

## 🚀 Features

### Core Features
- **Multi-Role Authentication** - JWT + RBAC (parent, provider, admin)
- **Child Management** - Profiles, Nepal immunization schedules, catch-up logic
- **Vaccination Tracking** - Booking, completion, overrides, anomaly detection
- **Smart Scheduling** - Greedy slot allocation, realtime Socket.io updates
- **Automated Reminders** - Email/SMS via cron + priority queue

### Provider Portal
- Assigned children management
- Appointment approval/rejection/rescheduling
- Vaccination completion/correction
- Daily summaries, overdue/upcoming lists
- Per-child AI risk predictions

### Advanced AI & Analytics
- **Risk Prediction** - Logistic regression (DB-persisted), auto-training
- **Model Management** - Train/rollback/update weights, version history
- **Anomaly Detection** - Early vacc, interval violations
- **Admin Dashboards** - Stats, trends, heatmaps, high-risk lists

### Admin & Compliance
- **User Management** - CRUD, roles, activation, password reset
- **Provider Approval** - Pending reviews
- **Auditing** - Full logs/stats (USER_LOGIN, VACC_COMPLETED, etc.)
- **Exports/Reports** - Vaccinations/children/audit/high-risk, monthly
- **Configs** - System/email settings
- **Backups** - Automated DB snapshots

## 🛠️ Tech Stack
- **Runtime**: Node.js/Express
- **Database**: MongoDB/Mongoose
- **Real-time**: Socket.io
- **Cache/Sessions**: Redis
- **Email**: Nodemailer
- **Scheduler**: node-cron
- **Docs**: Swagger/OpenAPI
- **Deploy**: Render (prod-ready), self-hosted
- **AI**: Custom logistic regression, auto-train service

## 📁 Project Structure
```
Backend/
├── package.json
├── src/
│   ├── ai/                  # AI subsystem
│   │   ├── riskModel.js
│   │   ├── autoTrain.js
│   │   ├── weightTuner.js
│   │   ├── trainingData.js
│   │   └── modelConfig.json
│   ├── config/
│   │   ├── db.js
│   │   └── swagger.js
│   ├── controllers/         # 15+ controllers
│   │   ├── adminController.js
│   │   ├── aiAdminController.js
│   │   ├── aiModelController.js
│   │   ├── auditController.js
│   │   ├── authController.js
│   │   ├── backupController.js
│   │   ├── childController.js
│   │   ├── emailConfigController.js
│   │   ├── exportController.js
│   │   ├── providerController.js
│   │   ├── reminderController.js
│   │   ├── userManagementController.js
│   │   ├── vaccinationController.js
│   │   ├── vaccinationOverrideController.js
│   │   └── vaccineController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── auditMiddleware.js
│   ├── models/
│   │   ├── AIModelConfig.js
│   │   ├── AuditLog.js
│   │   ├── BackupLog.js
│   │   ├── Center.js
│   │   ├── Child.js
│   │   ├── PasswordReset.js
│   │   ├── Session.js
│   │   ├── SystemConfig.js
│   │   ├── User.js
│   │   ├── Vaccination.js
│   │   └── Vaccine.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── aiAdminRoutes.js
│   │   ├── auditRoutes.js
│   │   ├── authRoutes.js
│   │   ├── backupRoutes.js
│   │   ├── childRoutes.js
│   │   ├── configRoutes.js
│   │   ├── emailConfigRoutes.js
│   │   ├── exportRoutes.js
│   │   ├── providerRoutes.js
│   │   ├── publicRoutes.js
│   │   ├── reminderRoutes.js
│   │   ├── userManagementRoutes.js
│   │   ├── vaccinationOverrideRoutes.js
│   │   ├── vaccinationRoutes.js
│   │   └── vaccineRoutes.js
│   ├── services/
│   │   ├── aiModelService.js
│   │   └── exportService.js
│   ├── utils/
│   │   ├── emailService.js
│   │   ├── reminderPriorityQueue.js
│   │   ├── reminderService.js
│   │   └── vaccineSchedule.js
│   └── server.js
├── .gitignore
└── README.md
```

## 🔌 Key API Endpoints

See full Swagger docs at `/api-docs`.

### Authentication
| Method | Endpoint | Role | Desc |
|--------|----------|------|------|
| POST | `/api/auth/register` | public | Register |
| POST | `/api/auth/login` | public | Login |
| GET | `/api/auth/me` | user | Profile |

### Children & Vaccinations (Parent)
| Method | Endpoint | Desc |
|--------|----------|------|
| POST | `/api/children` | Create child |
| GET | `/api/children/:id` | View child |
| PUT | `/api/vaccinations/book/:id` | Book slot |
| GET | `/api/vaccinations/:childId` | Vacc history |
| GET | `/api/vaccinations/risk/:childId` | AI risk |

### Provider Portal
| Method | Endpoint | Desc |
|--------|----------|------|
| GET | `/api/provider/children` | Assigned kids |
| GET | `/api/provider/appointments/today` | Today's appts |
| PUT | `/api/provider/vaccinations/:id/complete` | Complete vacc |
| GET | `/api/provider/overdue` | Overdue list |
| GET | `/api/provider/children/:id/risk` | Child risk |

### Admin Dashboard
| Method | Endpoint | Desc |
|--------|----------|------|
| GET | `/api/admin/dashboard` | Stats |
| GET | `/api/admin/trends` | Monthly trends |
| GET | `/api/admin/audit-logs` | Audit logs |
| GET | `/api/admin/high-risk` | High-risk kids |

### Exports (Admin)
| Method | Endpoint | Desc |
|--------|----------|------|
| GET | `/api/admin/export/vaccinations` | Vacc data |
| GET | `/api/admin/export/high-risk` | High-risk export |
| GET | `/api/export/report/monthly` | Monthly report |

### AI Model Management (Admin)
| Method | Endpoint | Desc |
|--------|----------|------|
| GET | `/api/admin/ai/model/config` | Current weights |
| POST | `/api/admin/ai/model/train` | Train model |
| PUT | `/api/admin/ai/model/weights` | Update weights |
| POST | `/api/admin/ai/model/rollback/:version` | Rollback |

## 🔐 Roles
- **parent**: Own children only
- **provider**: Assigned children/appointments/vacc completion
- **admin**: Full access + model mgmt/exports/audits/configs

## 🧠 AI Details
- **Risk Model**: Logistic regression `P = 1/(1+e^{-(w1*overdue + w2*missed + w3*days + w4*rate + b)})`
- **Persistence**: AIModelConfig collection (active version), fallback modelConfig.json
- **Auto-Train**: `node src/ai/autoTrain.js` - trains/saves to DB
- **Anomalies**: Early vacc, interval <28d

## 🚀 Setup

```bash
cd Backend
npm install
cp .env.example .env  # Update MONGO_URI, JWT_SECRET, EMAIL_USER/PASS
npm run dev  # nodemon src/server.js
```

**Render Deploy**: Auto-detected, uses RENDER_EXTERNAL_URL.

**API Docs**: http://localhost:5000/api-docs

**Test Flow**: Register parent → Add child → Book vacc → Provider approves/completes → Admin views stats/exports.

## 📊 Scripts
- `npm start` / `npm run dev`
- `node src/ai/autoTrain.js` - Train AI

Updated: Full scan of current codebase (15+ controllers/routes, AI DB mgmt, providers, compliance features).

## 📄 License
ISC

👥 Vaxocare Team
