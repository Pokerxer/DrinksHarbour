# Chatbot provider compatibility

The 10 November 2026 chatbot failure was an Anthropic HTTP 400 rejecting the `temperature` parameter. Both the text retry and photo analysis used that parameter. Keep the Claude Haiku text and vision requests on the provider default. See [reproduction and release verification](../superpowers/specs/RESUME-chatbot-provider-compatibility.md).

The isolated backend hotfix was promoted and the production API answered the original Tomatin question and a taste follow-up. Include the local source patch in the next backend release.
