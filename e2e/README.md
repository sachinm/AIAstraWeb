# Screenshot walkthrough

Walks the app as a person would, on desktop and phone, and saves numbered screenshots for review.

```bash
npm run test:walkthrough
```

- **What runs:** Playwright with the Chrome installed on this machine, against Vite on port 5199, which it starts and stops itself.
- **Data:** `stubApi.ts` answers every API call, so this needs no sign-in, database or model, and touches no real data. It proves the pages and their states, not the server. The pictures show stand-in text.
- **Output:** `docs/screenshots/walkthrough/<desktop|phone>/NN-<step>.png`, replaced on each run, with a `manifest.json` per device: for each step the URL, horizontal overflow, whether the page can scroll, console errors and failed requests. `operationsNotStubbed` lists pages whose real data is not faked, so their empty states come from the stub.
- **Review:** a separate agent, which did not build the change, reads every image and manifest and writes `docs/screenshots/walkthrough/FINDINGS.md`. Findings not fixed on the spot go to `AIAstra_Server/docs/TODOS.md`.
- **Adding a step:** add `await w.shot('name')` to `walkthrough.spec.ts`. To fake a new call, add a case in `stubApi.ts`.
