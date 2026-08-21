# Providers and models

Kimi Code CLI supports connecting to multiple LLM platforms simultaneously — one-click login via the Kimi Code managed service, connecting Claude with an Anthropic API key, or connecting third-party inference services via the OpenAI-compatible protocol. Each provider corresponds to a specific API protocol; models are declared on top of providers with their own name, context length, and capabilities. This page explains how to configure each type of provider in `config.toml`.

## Supported provider types

The `type` field in the `providers` table determines which protocol implementation to use:

| Type | Protocol | Typical use |
| --- | --- | --- |
| `kimi` | OpenAI-compatible | Kimi Code managed service, Kimi Platform API key |
| `anthropic` | Anthropic Messages | Claude model family |
| `openai` | OpenAI Chat Completions | OpenAI and compatible services, DeepSeek, Qwen, etc. |
| `openai_responses` | OpenAI Responses API | OpenAI's newer Responses interface |
| `google-genai` | Google GenAI | Gemini API |
| `vertexai` | Google GenAI on Vertex | Google Cloud Vertex AI |

All providers communicate with models in streaming mode by default. Capabilities such as thinking, vision, and tool use are matched automatically by model name prefix — you typically do not need to declare them manually.

**Credential priority**: `api_key` direct field > `[providers.<name>.env]` sub-table key > if both are absent, startup fails with an error. The CLI does not fall back to shell environment variables for credentials — see [Config overrides: provider credentials](./overrides.md#provider-credentials).

## `/provider` — interactive provider management

Prefer not to edit TOML by hand? Type `/provider` in the TUI to open the **provider manager**, where you can interactively add or remove providers.

The manager displays providers as a list of entries grouped by source. Navigation:

- ↑/↓ to move the cursor, ←/→ to page
- `d` to delete the current provider (with `[y/N]` confirmation)
- Press Enter on the `[ Add New Platform ]` row to add a new provider

Three paths when adding:

- **Built-in provider**: pick an official Kimi or other locally shipped catalog entry without fetching models.dev. Official Kimi Code (`kimi-for-coding`), Kimi Open Platform China (`moonshotai-cn`) and global (`moonshotai`) come first, then Volcengine Ark Coding Plan and DeepSeek. These entries are stripped snapshots of the public [models.dev](https://models.dev/) catalog plus the local overlays documented below.
- **Known third-party provider**: fetches the model catalog from [models.dev](https://models.dev/), select a provider → enter an API key → select a default model. Vendors whose protocol the catalog does not declare (e.g. xai, openrouter, and other vendor-specific SDKs) are imported as OpenAI-compatible with a "guessed" note; when the catalog provides no usable endpoint, a base URL prompt appears first; proprietary protocols (Amazon Bedrock, Cohere) and unrecognized explicit protocols are refused. Deprecated and alpha-status models are excluded from the import list. If the public catalog is unreachable, the CLI falls back to a built-in snapshot of the catalog, so the import still works offline or in blocked networks. The catalog also merges the same local overlay entries as **Built-in provider**.
- **Custom registry (api.json)**: paste a custom registry URL and Bearer token; the CLI automatically creates the `providers` / `models` entries. On later startup, providers from the same registry URL are refreshed together, so upstream provider additions, removals, and model metadata changes are synced.

::: warning
Kimi Code OAuth managed accounts logged in via `/login` do not appear in `/provider`. Use `/login` and `/logout` to manage them.
:::

The same operations are also available in non-interactive environments via the shell command: [`kimi provider`](../reference/kimi-command.md#kimi-provider).

## `kimi`

For connecting to Moonshot AI's OpenAI-compatible interface, including the Kimi Code managed service and Kimi Platform API keys.

- Default `base_url`: `https://api.moonshot.ai/v1`
- Credential key names: `KIMI_API_KEY`, `KIMI_BASE_URL`
- Additional capability: supports video upload

```toml
[providers.kimi]
type = "kimi"
base_url = "https://api.moonshot.ai/v1"
api_key = "sk-xxxxx"
```

> When using the Kimi Code managed service, running `/login` automatically configures `base_url` and credentials — no manual setup needed.

To use a [Kimi Code console](https://www.kimi.com/code/console) API key instead of OAuth, pick **Built-in provider** → **Kimi For Coding** in `/provider`, or:

```sh
kimi provider catalog add kimi-for-coding --api-key YOUR_API_KEY --default-model k3
```

The import follows the official models.dev entry: `type = "anthropic"` and `base_url = "https://api.kimi.com/coding"` (the catalog's `/v1` suffix is stripped for the Anthropic protocol). Available model ids are `k3`, `k3-256k`, `kimi-for-coding`, and `kimi-for-coding-highspeed`.

Kimi Open Platform keys use **Moonshot AI (China)** (`moonshotai-cn`, `https://api.moonshot.cn/v1`) or **Moonshot AI** (`moonshotai`, `https://api.moonshot.ai/v1`) from the same built-in list. Those stay OpenAI-compatible.

## `anthropic`

For connecting to the Claude API. Standard Claude models automatically enable vision, tool use, and Thinking (where supported); custom or uncovered models need `capabilities` declared explicitly on `[models.<alias>]`.

- Default `base_url`: follows Anthropic SDK default
- Credential key names: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`
- Default `max_tokens`: inferred per model. To override, set `max_output_size` on the model alias

```toml
[providers.anthropic]
type = "anthropic"
api_key = "sk-ant-xxxxx"

[models."claude-opus-4-7"]
provider = "anthropic"
model = "claude-opus-4-7"
max_context_size = 200000
# max_output_size = 32000  # optional; omit to use the model-inferred default
```

## `openai`

For connecting to the OpenAI Chat Completions protocol, as well as any third-party service compatible with that protocol (override `base_url` as needed).

Third-party reasoning models (DeepSeek, Qwen, One API, etc.) work out of the box: the CLI automatically handles the `reasoning_content` field and `reasoning_effort` injection. If your gateway returns reasoning content under a non-standard field name, set `reasoning_key` on the model alias to override.

- Default `base_url`: `https://api.openai.com/v1`
- Credential key names: `OPENAI_API_KEY`, `OPENAI_BASE_URL`

```toml
[providers.openai]
type = "openai"
base_url = "https://api.openai.com/v1"
api_key = "sk-xxxxx"
```

Official DeepSeek is also OpenAI-compatible. Pick **DeepSeek** in `/provider`, or:

```sh
kimi provider catalog add deepseek --api-key YOUR_API_KEY --default-model deepseek-v4-flash
```

The import writes `type = "openai"` and `base_url = "https://api.deepseek.com"`. Current official models are `deepseek-v4-flash`, `deepseek-v4-pro`, and `deepseek-v4-flash-vision-exp`.

On 2026-08-16 DeepSeek switched to peak/off-peak token prices (peak hours 01:00–04:00 and 06:00–10:00 UTC; off-peak is half of peak). The local catalog overlay lists the off-peak USD / 1M token rates (`deepseek-v4-flash` $0.22 / $0.66, `deepseek-v4-pro` $0.66 / $1.98, cache-hit input $0.007 / $0.022). Peak is 2× those numbers.

## `openai_responses`

Corresponds to OpenAI's newer Responses API, always operating in streaming mode. Configuration is the same as `openai`.

- Default `base_url`: `https://api.openai.com/v1`
- Credential key names: `OPENAI_API_KEY`, `OPENAI_BASE_URL`

```toml
[providers.openai-responses]
type = "openai_responses"
base_url = "https://api.openai.com/v1"
api_key = "sk-xxxxx"
```

## `google-genai`

For connecting directly to the Google Gemini API. Thinking, vision, and multimodal capabilities are auto-detected by model name.

- Credential key name: `GOOGLE_API_KEY`

```toml
[providers.gemini]
type = "google-genai"
api_key = "xxxxx"
```

To route through a Gemini-compatible proxy or gateway, set `base_url` (or the `GOOGLE_GEMINI_BASE_URL` env var); when omitted, the SDK default `https://generativelanguage.googleapis.com` is used.

> Give the **host root only**. The Google GenAI SDK appends the API version and path itself (e.g. `/v1beta/models/<model>:generateContent`), so a trailing `/v1beta` would produce a doubled `/v1beta/v1beta/…`.

```toml
[providers.gemini]
type = "google-genai"
api_key = "xxxxx"
base_url = "https://your-gateway.example"
```

## `vertexai`

Shares the same implementation as `google-genai`; setting `type = "vertexai"` switches to the Vertex AI access path.

Authentication follows the standard Google Cloud ADC flow (`gcloud auth application-default login` or a `GOOGLE_APPLICATION_CREDENTIALS` service account JSON) — this part is unrelated to Kimi Code. **The project ID and region must be written in the `[providers.vertexai.env]` sub-table** — simply `export GOOGLE_CLOUD_PROJECT` in the shell will not be read by the CLI.

```toml
[providers.vertexai]
type = "vertexai"

[providers.vertexai.env]
GOOGLE_CLOUD_PROJECT = "my-gcp-project"
GOOGLE_CLOUD_LOCATION = "us-central1"
```

```sh
gcloud auth application-default login   # one-time authentication
kimi
```

To route Vertex requests through a custom (e.g. proxied) endpoint, set `base_url` (or the `GOOGLE_VERTEX_BASE_URL` env var); when omitted, the SDK default regional `*-aiplatform.googleapis.com` host is used. As with `google-genai`, give the host root only — the SDK appends `/v1beta1/publishers/google/models/…` itself.

## Volcengine Ark Coding Plan

[Volcengine Ark Coding Plan](https://www.volcengine.com/article/37482) is a subscription package for individual AI coding. Kimi Code CLI exposes it through a local catalog overlay: pick **Volcengine Ark Coding Plan** in `/provider`, or run:

```sh
kimi provider catalog add volcengine-coding-plan --api-key YOUR_API_KEY --default-model ark-code-latest
```

The import writes `type = "openai"` and the Coding Plan OpenAI-compatible endpoint:

```toml
[providers.volcengine-coding-plan]
type = "openai"
base_url = "https://ark.cn-beijing.volces.com/api/coding/v3"
api_key = "YOUR_API_KEY"

[models."volcengine-coding-plan/ark-code-latest"]
provider = "volcengine-coding-plan"
model = "ark-code-latest"
max_context_size = 262144
```

::: warning
Use the API key and `/api/coding/v3` endpoint issued for Coding Plan. Do not mix Agent Plan (`/api/plan/v3`) or pay-as-you-go Ark API (`/api/v3`) keys or URLs — that can skip plan quota or incur extra charges. Plan quota is valid only inside supported AI coding tools.
:::

Prefer `ark-code-latest` (console Auto routing) first; you can also pick a concrete model such as `doubao-seed-2.0-code`, `deepseek-v4-pro`, `kimi-k2.7-code`, `glm-5.2`, or `minimax-m3`. Treat the Volcengine Coding Plan console as the source of truth for the live model list.

## OAuth and credential injection

The Kimi Code managed service uses OAuth rather than static API keys. After running `/login`, the built-in authentication toolchain automatically writes and refreshes credentials — no manual configuration is needed in `config.toml` for this.

## Next steps

- [Configuration files](./config-files.md) — full field reference for the `providers` and `models` tables
- [Config overrides](./overrides.md) — credential resolution priority rules for providers
- [Environment variables](./env-vars.md) — credential key names per provider type
