# GitHub Copilot / AI Agent Entry Point

Welcome to the **Power Pipelines v2.0** repository workspace. 

This project is a complete rewrite of a legacy .NET/RabbitMQ application into a modern TypeScript Monorepo. The system is an event-driven, energy-efficient CI/CD infrastructure manager (GreenOps) that provisions physical hardware (Raspberry Pis) and toggles AC power via IoT smart switches (Shelly Pro).

## 📚 Context Files
Before scaffolding or writing code, please read the following architecture and requirement documents to understand the system context, boundaries, and design decisions:

1. **[Techstack.md](./Techstack.md)**: Defines the strict technologies, libraries, and deployment tools allowed in this project.
2. **[Architecture.md](./Architecture.md)**: Explains the high-level flow, Backend-for-Frontend (BFF) security, CQRS/Event Sourcing with MongoDB, and WebSocket hardware integration.
3. **[Requirements.md](./Requirements.md)**: Details the core business logic (Lease Pattern, Shutdown Sagas, Zero-Touch Provisioning) that the code must satisfy.
4. **[Handover.md](./Handover.md)**: Contains the AI system prompt, schema mental models, and architectural decision records (ADRs).

## 🚀 Initialization Tasks
When asked to begin, please follow this strict scaffolding order:

- **Step 1:** Initialize the Turborepo workspace, including base ESLint, Prettier, and shared TSConfig packages.
- **Step 2:** Scaffold the `apps/core-api` (Node.js) with GraphQL Yoga, MongoDB connection setup, and the base CQRS Event Store structure.
- **Step 3:** Scaffold the `apps/web` (Next.js) BFF with `iron-session` and the base Relay environment.
- **Step 4:** Scaffold the `apps/agent` (Node.js) with the WebSocket client and `dbus-next` systemd integration.