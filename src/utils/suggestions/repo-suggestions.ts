const KEY_1 = "INCREASE_TEST_COVERAGE";
const VALUE_1 = `I want to scaffold a modern, production-grade application in this workspace.

Please analyze the current project structure and requirements:
1. Architecture: Establish a clean, modular directory structure with TypeScript, type-safe API boundaries, and clear separation of concerns.
2. User Interface: Design a responsive, accessible Dark Void UI with smooth micro-interactions, coherent color hierarchy, and intuitive user flows.
3. Backend & Services: Implement robust, performant services with input validation, graceful error handling, and structured data flow.
4. Testing & Verification: Add unit tests, ensure all dependencies build cleanly, and verify that the dev server launches with zero errors.`;

const KEY_2 = "AUTO_MERGE_PRS";
const VALUE_2 = `Please perform a comprehensive deep-dive code audit across this repository to find and fix bugs:

1. Static & Runtime Analysis: Scan for potential null/undefined exceptions, unhandled promises, memory leaks, and edge-case race conditions.
2. Type Safety: Resolve all TypeScript compiler diagnostics, eliminate unsafe any casts, and tighten return types.
3. Security & Resilience: Validate inputs, sanitize query parameters, and ensure safe fallback states for unexpected payloads.
4. Verification: Run the test suite and verify that all identified bugs are resolved without regressions.`;

const KEY_3 = "FIX_README";
const VALUE_3 = `Please analyze the codebase and refactor the architecture for maximum performance, maintainability, and clean code principles:

1. Modularization: Decompose complex monolithic components into cohesive, single-responsibility modules and reusable hooks.
2. Performance Optimization: Minimize redundant re-renders, optimize heavy computations, and streamline state management.
3. Modernization: Upgrade outdated patterns to modern idioms while strictly preserving existing functionality and API contracts.
4. Documentation & Tests: Update docstrings, refine interface documentation, and confirm that all unit tests pass.`;

const KEY_4 = "CLEAN_DEPENDENCIES";
const VALUE_4 = `Set up an automated CI/CD pipeline and containerization for this project:

1. Containerization: Create an optimized multi-stage Dockerfile and docker-compose setup with health checks, proper non-root users, and caching.
2. CI/CD Workflows: Create GitHub Actions workflows for continuous integration (typecheck, lint, test) and automated release/deployment.
3. Scripts & Optimization: Standardize build and verification scripts in package.json, pruning unused dependencies and optimizing artifact sizes.
4. Verification: Test the container build locally to ensure a seamless zero-downtime deployment pipeline.`;

const KEY_5 = "ADD_DOCS";
const VALUE_5 = `Generate comprehensive documentation and architecture guides for this repository:

1. Architecture Overview: Create an ARCHITECTURE.md outlining system design, data flows, core components, and design decisions.
2. API Documentation: Document all public endpoints, schemas, environment variables, and authentication mechanisms.
3. Contributing Guidelines: Add a detailed CONTRIBUTING.md and CODE_OF_CONDUCT.md with clear setup steps.
4. README Enhancement: Polish the main README.md with badges, quickstart instructions, and architecture links.`;

const KEY_6 = "ADD_DOCKERFILE";
const VALUE_6 = `Investigate the current repository and create a production-ready multi-stage Dockerfile:

1. Use lightweight base images (e.g. alpine/slim) with optimal layer caching.
2. Ensure secure non-root execution and minimal attack surface.
3. Add health check endpoints and proper signal handling for graceful shutdown.
4. Provide a docker-compose.yml file configured for local development and testing.`;

export const REPO_SUGGESTIONS: Record<string, string> = {
  [KEY_1]: VALUE_1,
  [KEY_2]: VALUE_2,
  [KEY_3]: VALUE_3,
  [KEY_4]: VALUE_4,
  [KEY_5]: VALUE_5,
  [KEY_6]: VALUE_6,
};

