# system-constraints

Owner: `SystemConstraint` and operating-policy configuration. Implementation lives in `services/system-constraints.service.ts` and is consumed through the feature module.

T2.3 defines a policy-reader contract. A later migration moves the provider once, then removes legacy duplicate registrations in T2.4; this shell intentionally adds no provider today.
