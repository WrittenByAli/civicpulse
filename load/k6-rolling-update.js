/**
 * Zero-downtime rolling update check.
 * Steady read traffic plus a slow trickle of writes; trigger a rollout while it runs.
 * Any failed request fails the test (thresholds require 0% failures).
 */
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://backend:8000";

export const options = {
  scenarios: {
    reads: {
      executor: "constant-arrival-rate",
      rate: 40, timeUnit: "1s", duration: "2m",
      preAllocatedVUs: 40, maxVUs: 100, exec: "reads",
    },
    writes: {
      executor: "constant-arrival-rate",
      rate: 15, timeUnit: "1m", duration: "2m",
      preAllocatedVUs: 5, maxVUs: 10, exec: "writes",
    },
  },
  thresholds: {
    http_req_failed: ["rate==0"],
    checks: ["rate==1"],
  },
};

export function reads() {
  const r = http.get(`${BASE_URL}/api/stats`);
  check(r, { "stats 200": (x) => x.status === 200 });
  const s = http.get(`${BASE_URL}/ready`);
  check(s, { "ready 200": (x) => x.status === 200 });
}

export function writes() {
  const r = http.post(
    `${BASE_URL}/api/complaints`,
    JSON.stringify({ text: "Street light out near the market for two days", location: "Model Town, Lahore" }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(r, { "complaint created": (x) => x.status === 201 });
}
