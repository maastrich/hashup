import { greet } from "./greet";

self.postMessage(greet("worker"));
