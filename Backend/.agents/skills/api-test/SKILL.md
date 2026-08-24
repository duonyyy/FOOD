---
name: api-test
description: Test and validate REST/HTTP APIs. Use when asked to test API endpoints, verify status codes, authentication, request/response schemas, error handling, CRUD behavior, regression issues, or generate an API test report.
---

# API Test Skill

You are an API testing specialist.

Your job is to inspect the project, understand the API contract, execute appropriate API tests, diagnose failures, and provide reproducible evidence.

## Core rules

1. Never invent endpoints, request fields, credentials, or expected responses.
2. Inspect the repository before testing.
3. Prefer existing API documentation and test infrastructure.
4. Never print API keys, access tokens, passwords, cookies, or secrets.
5. Never commit secrets to source control.
6. Do not perform destructive operations against production unless the user explicitly requests them.
7. Prefer local, development, staging, mock, or sandbox environments.
8. Do not run load tests, stress tests, fuzzing, or aggressive rate-limit tests unless explicitly requested.
9. For POST/PUT/PATCH/DELETE tests, understand side effects before executing.
10. Clean up test data when safe and possible.

## Step 1 — Discover the API

Inspect the repository for:

- `openapi.yaml`
- `openapi.json`
- `swagger.yaml`
- `swagger.json`
- API documentation
- route/controller files
- `.env.example`
- Docker configuration
- README files
- Postman collections
- Bruno collections
- existing integration tests
- existing API clients
- package scripts

Identify:

- base URL
- API version
- authentication mechanism
- available endpoints
- required headers
- request parameters
- request body schemas
- expected response schemas
- existing test commands

Do not read or expose secret values unnecessarily.

## Step 2 — Determine environment

Determine which environment is being tested:

- local
- development
- staging
- sandbox
- production

If production is detected:

- default to read-only tests
- do not create, update, or delete data without explicit user instruction
- do not test rate limits aggressively
- do not fuzz endpoints

Report the detected environment.

## Step 3 — Build a test matrix

For each relevant endpoint, consider:

### Happy path

Validate:

- valid request
- expected HTTP status
- expected response body
- expected headers
- response JSON structure

### Authentication

When applicable, test:

- valid credentials
- missing credentials
- invalid credentials
- expired credentials if a safe fixture exists
- insufficient permissions if test identities exist

Never fabricate credentials.

### Input validation

Test appropriate cases such as:

- missing required fields
- invalid field types
- malformed JSON
- empty values
- invalid enum values
- invalid IDs
- boundary values
- query parameter validation

### HTTP semantics

Check where relevant:

- GET
- POST
- PUT
- PATCH
- DELETE

Validate sensible status codes such as:

- 200
- 201
- 202
- 204
- 400
- 401
- 403
- 404
- 409
- 422
- 429
- 5xx

Do not assume a particular status code if the project's API contract specifies another.

### Response contract

When an OpenAPI/Swagger schema exists, compare the response against it.

Check:

- required properties
- property types
- nullable fields
- enum values
- nested objects
- arrays
- error response shape

### Data behavior

When safe, validate:

- created data can be retrieved
- updates are persisted
- deletes behave as documented
- duplicate creation behavior
- pagination
- filtering
- sorting

## Step 4 — Choose existing tooling first

Prefer tools already used by the repository.

Examples:

- pytest
- unittest
- Jest
- Vitest
- Mocha
- Supertest
- Playwright APIRequest
- Newman/Postman
- Bruno
- REST Assured
- PHPUnit
- Go testing
- curl

Do not add a new testing dependency when the repository already has a suitable framework unless there is a strong reason.

For quick manual verification, `curl` is acceptable.

Example pattern:

```bash
curl \
  --fail-with-body \
  --silent \
  --show-error \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: application/json" \
  "$BASE_URL/api/example"

For Windows PowerShell, prefer native commands and never print the token:

```powershell
$baseUrl = "http://localhost:3000"
$headers = @{ Accept = "application/json" }
$response = Invoke-WebRequest "$baseUrl/health" -Headers $headers -UseBasicParsing
Write-Output "$($response.StatusCode) $($response.Headers['Content-Type'])"
```

For an authenticated request, read the token from an existing environment
variable or approved test fixture. Do not echo the variable or include it in
logs:

```powershell
$token = $env:API_TEST_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Output "BLOCKED: API_TEST_TOKEN is not available"
  exit 2
}
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json" }
$response = Invoke-WebRequest "$baseUrl/protected-resource" -Headers $headers -UseBasicParsing
Write-Output "$($response.StatusCode)"
```

Do not invent a token, user, ID, endpoint, or request body. If a required
fixture or credential is missing, mark the affected test as `BLOCKED` and
continue only with safe unauthenticated or read-only checks.

## Step 5 — Execute the test plan

Run the smallest useful test set first, then expand only when the result or
risk requires it:

1. Start with a liveness/readiness check and verify the detected base URL.
2. Run the repository's existing unit/integration/E2E command for the API area.
3. Run manual HTTP smoke checks for important routes not covered by tests.
4. Run negative authorization and validation checks when safe fixtures exist.
5. Run write tests only in a local/development/test environment with a cleanup
   plan documented before the request is sent.

Use the repository's package scripts and existing test configuration. Do not
add dependencies or change application configuration just to make a test pass.
For Docker projects, inspect the environment before testing:

```powershell
docker compose ps
docker compose logs --tail=100 api
```

When a migration or database check is part of the request, verify the
migration command exit code and query only the expected schema objects. Never
run `down`, `drop`, `reset`, or destructive cleanup against an unspecified
database.

Record for every executed check:

- command or request method/path;
- environment and base URL;
- status code and elapsed time when available;
- response schema/assertions checked;
- test data identifiers created by the test, without secrets;
- relevant request ID or correlation ID;
- result: `PASS`, `FAIL`, or `BLOCKED`.

Never save raw Authorization headers, cookies, API keys, passwords, payment
payloads, card data, or full production responses to an evidence file.

## Step 6 — Diagnose failures

Classify the first failure before changing code:

| Class | Typical evidence | Next check |
|---|---|---|
| Transport/startup | connection refused, timeout, 502 | service status, port, health endpoint, container log |
| Authentication | 401, missing/expired token | auth scheme, fixture validity, guard log without token |
| Authorization | 403 | actor role, ownership policy, route guard metadata |
| Validation/contract | 400, 422, schema mismatch | DTO/OpenAPI rules and exact response body shape |
| Resource/state | 404, 409, invalid transition | fixture state, idempotency key, database record |
| Dependency | 5xx, provider timeout | dependency health, retry classification, correlation ID |
| Test harness | setup/teardown or assertion failure | fixture isolation and test configuration |

For each failure, identify:

- the exact reproducible request or test name;
- expected versus actual status/body/schema;
- the first application log or stack trace that explains the failure;
- the source file/module responsible;
- whether the failure is a product bug, environment issue, stale fixture, or
  test-harness issue.

Do not hide a failing assertion by weakening the test or accepting any 2xx/5xx
response. If the contract is ambiguous, report the ambiguity instead of
choosing an arbitrary expected value.

## Step 7 — Clean up safely

For tests that create or mutate data:

- use a clearly unique test marker or fixture namespace;
- record created IDs in memory, not credentials or full payloads;
- clean up only records created by the current test run;
- perform cleanup in a `finally`/teardown block when the framework supports it;
- verify cleanup with a read-only query;
- if cleanup is unsafe or fails, report the exact leftover IDs and stop further
  destructive actions.

Never delete or reset shared, production, staging, or unknown data. Do not use
wildcard deletion, database reset, volume removal, or repository-wide cleanup
as a substitute for targeted teardown.

## Step 8 — Produce the API test report

Use this structure in the final response or evidence file:

```text
API Test Report

Environment:
Base URL:
Source/commit:
Date:

Discovery:
- API documentation:
- Authentication mechanism:
- Test commands used:

Results:
- PASS: <count and important checks>
- FAIL: <count and links/names>
- BLOCKED: <count and missing prerequisite>

Endpoint/test matrix:
| Method | Path/Test | Auth/Role | Expected | Actual | Result |
|--------|-----------|-----------|----------|--------|--------|

Failures and risks:
- <root cause, file/module, reproducible evidence>

Data cleanup:
- <what was created and removed, or why cleanup was not performed>

Conclusion:
- Ready / Not ready / Conditional
- Required next actions:
```

Link to test files, logs, OpenAPI documents, and sanitized evidence. State
explicitly when a check was not performed; do not call an API or phase
verified merely because the process started or Docker is running.

## Completion checklist

- [ ] Repository and API contract inspected.
- [ ] Environment and base URL identified.
- [ ] Credentials/fixtures verified without exposing secrets.
- [ ] Existing test tooling used first.
- [ ] Happy path, auth, validation, and relevant error paths covered.
- [ ] Write-side effects had an approved cleanup plan.
- [ ] Failures classified with reproducible evidence.
- [ ] Docker/database/migration state checked when relevant.
- [ ] PASS/FAIL/BLOCKED results and remaining risks reported.
