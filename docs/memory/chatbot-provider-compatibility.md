# Chatbot provider compatibility

The 10 November 2026 chatbot failure was an Anthropic HTTP 400 rejecting the `temperature` parameter. Both the text retry and photo analysis used that parameter. Omit sampling parameters from Claude Haiku text and vision requests. See [reproduction and release verification](../superpowers/specs/RESUME-chatbot-provider-compatibility.md).

The isolated backend hotfix was promoted and the production API answered the original Tomatin question and a taste follow-up. Include the local source patch in the next backend release.

## Haiku 5.5 upgrade

The platform chatbot now uses the shared `claude-haiku-5-5` model ID.
Shopping replies and image identification use low effort. Occasion-chat
replies and structured drink-list generation use medium effort, with the
existing JSON schema sent alongside effort. The output budgets include
adaptive thinking. Temperature stays omitted.

All 100 focused chatbot and occasion tests passed. The live Anthropic
structured-output probe returned a connection error from the workspace.

The full server suite reported 4,659 passed, 282 failed and 286 skipped.
Failure names matched the run before the chatbot upgrade. The workspace
change has not been deployed.
