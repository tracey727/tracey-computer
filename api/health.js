import { getPublicHealth } from "../lib/super-response.js";

export default function handler(request, response) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(getPublicHealth(process.env)));
}
