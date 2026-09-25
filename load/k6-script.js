/**
 * k6 load test for CivicPulse backend.
 * Usage: k6 run load/k6-script.js --env BASE_URL=http://localhost:8000
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export const options = {
  stages: [
    { duration: "30s", target: 10 },   // ramp up
    { duration: "1m",  target: 10 },   // steady state
    { duration: "30s", target: 50 },   // spike — triggers HPA
    { duration: "1m",  target: 50 },   // hold at spike
    { duration: "30s", target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],     // <1% errors
    http_req_duration: ["p(95)<2000"],  // 95th percentile <2s
  },
};

const COMPLAINTS = [
  { text: "Water pipe burst on Main Boulevard since morning, water flooding the road", location: "Main Boulevard, Lahore" },
  { text: "Street light not working near Gulberg intersection for three days", location: "Gulberg III, Lahore" },
  { text: "Large pothole on Jail Road causing accidents", location: "Jail Road, Lahore" },
  { text: "Garbage not collected for a week in our neighbourhood", location: "DHA Phase 5, Lahore" },
  { text: "Power outage in our area since last night, no update from LESCO", location: "Model Town, Lahore" },
];

export default function () {
  const complaint = COMPLAINTS[Math.floor(Math.random() * COMPLAINTS.length)];

  // POST a complaint
  const postRes = http.post(
    `${BASE_URL}/api/complaints`,
    JSON.stringify(complaint),
    { headers: { "Content-Type": "application/json" } }
  );

  check(postRes, {
    "complaint created": (r) => r.status === 201 || r.status === 429,
  });

  // GET stats (tests cache behaviour)
  const statsRes = http.get(`${BASE_URL}/api/stats`);
  check(statsRes, {
    "stats ok": (r) => r.status === 200,
    "x-cache header present": (r) => r.headers["X-Cache"] !== undefined,
  });

  sleep(1);
}
