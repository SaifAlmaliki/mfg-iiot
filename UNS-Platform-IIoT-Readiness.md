# UNS Platform – Commercial IIoT Readiness Assessment

This document aligns **UNS Platform** (`uns-platform`) with the industry framework for **Unified Namespace (UNS) maturity** and **Commercial IIoT Readiness**. It maps the platform to the four assessment pillars and the five-level maturity model, and outlines a roadmap to reach **Defined** and **Advanced** readiness.

---

## Assessment framework (four pillars)

| Pillar | What it measures | UNS Platform alignment |
|--------|------------------|------------------------|
| **Strategy alignment** | Executive buy-in, cross-functional ownership of real-time data vision | Product vision and feature set (real-time pipeline, HMI, historian) support a clear IIoT/UNS narrative; document strategy and ownership for commercial use. |
| **Edge to cloud architecture** | Secure, low-latency data flows from devices to enterprise | MQTT (EMQX) at edge/ingest → InfluxDB time-series → Postgres metadata → Socket.IO/WebSocket to frontend. Edge connectors and tag mappings in schema support edge-to-platform flow. |
| **MQTT backbone** | MQTT as the core messaging layer | Tag metadata includes `mqttTopic` (ISA-95 style). Real-time pipeline uses MQTT for ingest (EMQX). Standardized topic usage and governance to be formalized. |
| **Future-safe design** | Open, modular architecture; avoid vendor lock-in | Open-source stack (Next.js, Prisma, EMQX, InfluxDB). Pluggable connectors, clear separation of metadata (Postgres) vs time-series (InfluxDB). No proprietary protocol lock-in. |

---

## Five-level maturity model

| Level | Description | UNS Platform current / target |
|-------|-------------|------------------------------|
| **1. Initial** | No formal UNS; fragmented data; little OT/IT integration | *Past* – schema and design already assume UNS-style tags, topics, and connectors. |
| **2. Developing** | Early UNS steps; basic integration and MQTT; governance and scale in progress | *Current* – schema and real-time pipeline design (openspec) in place; implementation in progress. |
| **3. Defined** | Scalable architecture; standardized topic structures; real-time access across OT/IT; some data governance | *Target* – Complete real-time pipeline (EMQX → InfluxDB → Socket.IO), documented topic scheme, read APIs, and basic governance (tag lifecycle, access). |
| **4. Advanced** | Mature UNS; real-time insights across business units; secure edge-to-cloud flows | *Next* – Multi-site/tenant readiness, historian/analytics, alarms, and security hardening. |
| **5. Optimized** | UNS integrated across systems; advanced analytics/AI/ML; scalable, future-proof infrastructure | *Future* – Analytics, ML, digital twin, ERP integration as in Features.md. |

---

## Gap analysis and roadmap

### Today (Developing → Defined)

- **MQTT backbone**: Implement EMQX integration and real-time pipeline (see `openspec/changes/real-time-data-pipeline`). Publish and adhere to a **topic naming standard** (e.g. ISA-95 or site/area/asset/tag hierarchy).
- **Edge to cloud**: Complete InfluxDB time-series write/read and Socket.IO live updates. Use Postgres only for metadata (Tags, mappings, equipment). Document data flow (edge → broker → platform → UI).
- **Strategy alignment**: Add a short “UNS Platform – IIoT strategy” section (internal or customer-facing) that states real-time data vision, use cases (HMI, trending, alarms), and ownership.
- **Future-safe design**: Keep broker and time-series DB configurable (env); avoid hardcoding proprietary formats. Prefer standard MQTT and open APIs.

### Next (Defined → Advanced)

- **Data governance**: Tag lifecycle (create/retire), topic ownership, and optional access control for time-series and APIs.
- **Security**: TLS for MQTT and InfluxDB; optional auth for Socket.IO; API keys or scoped tokens for external access.
- **Operational visibility**: Health checks for MQTT connector and InfluxDB; basic metrics/logging for pipeline and broker.

### Later (Advanced → Optimized)

- **Analytics and historian**: Trending, aggregation, export (align with Historian/Trending in Features.md).
- **Cross-unit insights**: Dashboards and reports that span sites/areas/assets using the same UNS topic and tag model.
- **AI/ML and integration**: Anomaly detection, predictive maintenance, ERP/B2MML (as in Features.md).

---

## Checklist for “Commercial IIoT Readiness”

Use this to self-assess or prepare for an external assessment (e.g. HiveMQ UNS Maturity Assessment):

- [ ] **MQTT in production**: EMQX (or equivalent) connected; platform subscribes to tag topics and ingests live data.
- [ ] **Unified Namespace**: Single, consistent topic/tag model (e.g. site/area/equipment/tag) and metadata in one place (Postgres).
- [ ] **Real-time pipeline**: MQTT → time-series store → live UI updates (Socket.IO/WebSocket) implemented and operational.
- [ ] **Time-series and metadata split**: Time-series in InfluxDB (or equivalent); metadata (tags, mappings, equipment) in Postgres; no duplicate write path for live data.
- [ ] **APIs**: Read APIs for last value and time range (and optionally aggregates) for integration and UI.
- [ ] **Documentation**: Architecture diagram (edge → broker → platform → UI), topic standard, and deployment/configuration guide.
- [ ] **Strategy**: One-pager or slide set on UNS Platform’s role in IIoT and real-time data (for commercial and assessment use).

---

## References

- [HiveMQ UNS Maturity Assessment](https://www.hivemq.com/resources/uns-maturity-assessment/) – Five-level model and “Pulse Ready” roadmap.
- [Business Value of Unified Namespace for Industry 4.0](https://hivemq.com/blog/business-value-unified-namespace-uns-industry-40) – Strategy and architecture context.
- Internal: `openspec/changes/real-time-data-pipeline` (proposal, design, specs, tasks) for implementation details.
- Internal: `Features.md` for full feature backlog and priorities.

---

*Document purpose: align UNS Platform with Commercial IIoT Readiness and UNS maturity so the product can be assessed and sold as a UNS-capable IIoT platform.*
