# Backend Engineering Master Backlog & Action Items
**Target Repository:** `reactjay/AGRIFLOW-MVP`  
**Author:** AgriFlow Engineering Team  
**Status:** Ready for Backend Implementation  

---

## 🚨 Critical Architectural Mandates for Backend Team

### 1. Complete Elimination of LocalStorage
All backend entities must be stored in **PostgreSQL** and served via authenticated **REST/GraphQL API endpoints**. The frontend has completely eradicated `localStorage` storage for business objects. The backend must provide full persistence for:
- **Payments & Escrow Records:** (`src/services/paymentService.ts`) — MUST be persisted in PostgreSQL with Bachs.io session tracking and webhook event logs.
- **Transactions & Event Logs:** (`src/services/transactionService.ts`) — State machine transitions (`PENDING` → `ACCEPTED` → `PAYMENT_CONFIRMED` → `IN_TRANSIT` → `COMPLETED`).
- **Supplies, Videos & Photos:** (`src/services/supplyService.ts`) — Produce catalog, media attachments, and inspection parameters.
- **Buyer Demand Requests & Matching:** (`src/services/demandService.ts`, `src/services/matchingService.ts`).
- **Logistics & Proof of Delivery:** (`src/services/logisticsService.ts`).
- **Disputes & Resolutions:** (`src/services/disputeService.ts`).
- **Notifications & Audit Trails:** (`src/services/notificationService.ts`, `src/services/auditService.ts`).
- **User Accounts & Admin Profiles:** (`src/services/authService.ts`).

### 2. Mandatory Cloud Storage Bucket for Media
Do not use local disk or base64 storage. **You must configure a Cloud Storage Bucket (AWS S3 / Cloudflare R2 / Google Cloud Storage)** with:
- Presigned upload URL generation (`POST /api/media/presigned-url`).
- Dedicated paths for Supplier Produce Images (`/listings/images/`) and Produce 4K/HD Inspection Videos (`/listings/videos/`).
- Direct upload from client to Bucket via signed URL.

### 3. Dedicated Admin Authentication & Logins
- Implement dedicated Admin user accounts in PostgreSQL.
- Seed default platform admin account:
  - **Email:** `admin@agriflow.africa`
  - **Role:** `admin`
  - **Permissions:** Full access to `/api/admin/*` endpoints (user management, dispute arbitrations, transaction overrides, system audit logs).
- Enforce Role-Based Access Control (RBAC) middleware verifying JWT claims (`role === 'admin'`).

---

## 📋 Summary of GitHub Issues Created via `gh` CLI

| Issue # | Title | Priority | Labels |
|---|---|---|---|
| **#30** | **[P0-BLOCKER] Wipe out mock LocalStorage — Implement PostgreSQL Schema & REST API Endpoints** | `P0` | `backend`, `database`, `p0`, `architecture` |
| **#31** | **[P0-BLOCKER] Integrate Bachs.io Naira Payment Gateway API & Webhook Listener** | `P0` | `backend`, `payments`, `bachs.io`, `webhooks`, `p0` |
| **#32** | **[P1-HIGH] Implement Cloud Storage Bucket API for Produce Images & Video Uploads** | `P1` | `backend`, `media`, `storage`, `aws-s3`, `p1` |
| **#33** | **[P1-HIGH] Implement Admin Authentication, Admin Login Endpoints & RBAC Middleware** | `P1` | `backend`, `auth`, `admin`, `security`, `p1` |
| **#34** | **[P1-MEDIUM] Implement Commodity Technical Inspection Metadata & Quality Verification Engine** | `P1` | `backend`, `catalog`, `quality-assurance`, `p1` |
