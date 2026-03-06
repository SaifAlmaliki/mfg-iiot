# UNS Platform – Feature roadmap

**Goal: Commercial IIoT Readiness** – Align with the [UNS maturity / IIoT readiness assessment](UNS-Platform-IIoT-Readiness.md) (four pillars: strategy alignment, edge-to-cloud architecture, MQTT backbone, future-safe design). Target maturity: **Defined** → **Advanced**.

---

⚠️ CRITICAL FEATURES NEEDED
1. Real-Time Data Pipeline 🔴 Critical
Status: Database schema ready, no implementation

What's Needed:

text

- MQTT broker integration (EMQX/HiveMQ)
- InfluxDB/TimescaleDB for time-series data
- Real-time tag value streaming
- WebSocket data updates to frontend
Files to Create:

/api/mqtt/client.ts - MQTT connection manager
/api/timeseries/route.ts - Time-series data API
/lib/websocket.ts - WebSocket server for real-time updates

2. SCADA HMI/SVG Graphics 🔴 Critical
Status: Basic panel exists, no actual graphics

What's Needed:

SVG-based process graphics editor
Dynamic symbol library (pumps, valves, tanks)
Live data binding to tags
Interactive controls (setpoints, buttons)
3. Process Graphics Runtime 🔴 Critical
What's Needed:

Real-time value rendering
Alarm highlighting on graphics
Animated flows and levels
Touch-friendly controls for operators
🟡 IMPORTANT FEATURES NEEDED
4. Recipe Execution Engine 🟡 Important
Status: Data model ready, no execution logic

What's Needed:

S88 state machine implementation
Step execution with hold/abort/restart
Automatic parameter download to PLCs
Recipe-to-batch binding
5. Batch Record Generation 🟡 Important
Status: Production run tracking exists

What's Needed:

Electronic batch records (EBR)
Automatic report generation
Quality parameter capture
Compliance-ready output
6. Mobile App/PWA 🟡 Important
Status: Responsive UI exists

What's Needed:

Offline capability
Push notifications for alarms
Mobile-optimized operator screens
Barcode/QR scanning for materials
7. Historian/Trending 🟡 Important
Status: Tag values table exists

What's Needed:

Historical trend charts
Data compression/downsampling
CSV export
Comparative trending
8. Reporting Engine 🟡 Important
What's Needed:

Report builder
Scheduled reports
PDF/Excel export
Email distribution
🟢 NICE TO HAVE FEATURES
9. Digital Twin Integration 🟢 Nice
3D plant visualization
Asset model linking
Simulation integration
10. AI/ML Analytics 🟢 Nice
Anomaly detection
Predictive maintenance ML models
Quality prediction
Energy optimization
11. ERP Integration 🟢 Nice
SAP connector
Oracle connector
B2MML message support
12. Advanced Security 🟢 Nice
SSO/SAML integration
2FA/MFA
LDAP/Active Directory
API key management