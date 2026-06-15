# Shared Model Retry Design

## Context

Guardrail's UI Browser workbench path now reduces generated Gherkin into durable user flows before running `agent-browser`. That flow planning path already retries model outputs when content is available but invalid JSON or invalid schema. It does not retry when the model provider response cannot be converted into assistant content.

The observed failure is:

```text
Flow planning failed: LLM response did not contain assistant content
```

This error is thrown by `ModelClient.extractAssistantContent()` before `AgentModelRunner` receives a `response.content`, so the existing schema-repair retry loop is bypassed. The same problem can affect other workbench model steps because `StructuredModelRunner` has no retry loop.

## Goal

Improve stability for model-driven workbench steps by adding shared retry and error classification around model calls.

The UI Browser flow planner should recover from transient provider responses such as missing assistant content. When recovery fails, Guardrail should report a precise, evidence-friendly failure instead of a generic planning error.

## Non-Goals

- Do not fall back to running raw generated Gherkin when UI Browser flow planning fails.
- Do not hide final model failures or mark skipped planning as passed.
- Do not change the `agent-browser` command execution strategy.
- Do not add product-specific browser assertions.
- Do not retry authentication, configuration, abort, or policy failures.
- Do not change model names or hard-code provider-specific behavior.

## Proposed Design

Add a shared model-call reliability helper under the workbench model layer. The helper should wrap one logical structured model operation, not replace `ModelClient`.

`ModelClient` remains responsible for:

- constructing the provider request;
- making one HTTP call;
- extracting assistant text from supported response shapes;
- returning raw provider payload for diagnostics.

The new helper is responsible for:

- retrying retryable transport and response-content failures;
- preserving schema-aware repair prompts for invalid JSON or invalid schema;
- classifying final failures into stable categories;
- producing concise final error messages with attempt counts.

Both `StructuredModelRunner` and `AgentModelRunner` should use this helper.

## Failure Classification

Retryable model-call failures:

- missing assistant content;
- empty assistant content;
- malformed provider response shape;
- network or fetch failure;
- HTTP 429;
- HTTP 5xx.

Retryable output-repair failures:

- invalid JSON;
- JSON embedded in prose when extraction fails;
- schema validation errors that may be fixed by a stricter retry prompt.

Non-retryable failures:

- `LLM_BASE_URL` or `LLM_API_KEY` is missing;
- HTTP 401 or 403;
- abort or timeout signal;
- unsupported schema name;
- validation failure after the output-repair budget is exhausted.

## Retry Policy

Use two separate budgets:

- Model-call budget: up to 3 attempts for retryable transport/content failures.
- Output-repair budget: up to 2 attempts for invalid JSON or schema validation, preserving the current stricter retry prompt behavior.

Separating the budgets matters because a blank or malformed provider response should not consume the only schema-repair chance.

Backoff should be short and bounded because workbench jobs already have step-level timeouts:

- first retry after about 250 ms;
- second retry after about 750 ms;
- no retry after the final attempt.

The helper must respect the existing `AbortSignal` before and during waits.

## Runner Integration

`StructuredModelRunner.runStep()` should call the shared helper for all structured workbench steps. It should retain its existing schema validation and max token behavior.

`AgentModelRunner.decideNext()`, `planUiBrowserFlows()`, and `planUiBrowserExecution()` should call the same helper. The agent action normalizer and UI Browser plan sanitizers remain unchanged.

For schema repairs, the second prompt should include:

- `schemaName`;
- original context;
- `validationError`;
- a concise retry hint requiring one valid JSON object without prose, markdown, or code fences.

## UI Browser Reporting

If flow planning still fails after retries, the matrix row should remain `Failed`, but the reason should include the classified model failure:

```text
Flow planning failed: model_content_empty after 3 attempts: LLM response did not contain assistant content
```

If execution planning fails for one accepted flow, that flow should remain `Skipped` and other flows should continue.

The final error should be short enough for the matrix and detailed enough for review. Raw provider payloads should not be shown in the user-facing reason. They may be included only in internal traces if already safe and available.

## Observability

Emit progress only when useful:

- do not stream every retry as normal progress;
- include retry count in final failure messages;
- allow tests to inspect attempt counts through fake clients.

Avoid logging prompts, API keys, typed browser values, or full raw model payloads.

## Testing Strategy

Shared helper tests:

- retries missing assistant content and succeeds on a later attempt;
- retries HTTP 429 and 5xx;
- does not retry missing config, 401, 403, or abort;
- stops after the configured model-call budget;
- preserves abort behavior during backoff.

`AgentModelRunner` tests:

- `planUiBrowserFlows()` retries missing assistant content before returning a valid plan;
- `planUiBrowserExecution()` still uses schema repair for invalid JSON;
- `decideNext()` keeps normalizing legacy action shapes after retry.

`StructuredModelRunner` tests:

- structured planning retries transient model content failures;
- invalid JSON gets one repair prompt;
- final failures include a stable category and attempt count.

Adapter-level tests:

- UI Browser flow planning failure does not execute raw Gherkin;
- final matrix reason contains the classified model failure;
- execution planning failure skips only the affected accepted flow.

## Success Criteria

- The observed missing-assistant-content failure is retried before a UI Browser run fails.
- Workbench structured model calls share one retry/error policy.
- Retryable provider instability is handled without masking real configuration, auth, abort, or schema failures.
- UI Browser still fails closed when flow planning cannot produce a valid plan.
- Tests cover retryable, non-retryable, and schema-repair paths.
