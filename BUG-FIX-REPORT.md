# v1.7 fault report

The previous v1.6 deployment could load correctly but fail when used for four separate reasons:

1. The default OpenAI model was `gpt-5.6-luna`, which was not a valid OpenAI API model identifier for the deployed account.
2. The old “test connections” function only listed models. A provider could appear connected even when generation was blocked by billing, quota or model permission.
3. When an OpenAI model was unavailable, the fallback could choose the first model returned by the account, including an incompatible embedding, audio or image model.
4. The private access-code field appeared below the test control. The protected API endpoints rejected requests without the exact code, but the interface made this easy to miss.

v1.7 corrects all four faults, keeps secrets server-side, and includes a real generation-level diagnostic.
