# system-constraints

Owner đích: `SystemConstraint` and operating-policy configuration. Current compatibility implementation is `src/services/system-constraints.service.ts`, provided by legacy Order and Payment modules.

T2.3 defines a policy-reader contract. A later migration moves the provider once, then removes legacy duplicate registrations in T2.4; this shell intentionally adds no provider today.
