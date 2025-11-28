import { add, multiply } from "./utils/math.js";
import { formatDate, capitalize } from "./utils/helpers.js";
import type { User, UserWithRole } from "./types/user.js";
import config from "./utils/config.json";
import { API_VERSION, MAX_RETRIES } from "./utils/constants.mjs";
import { defaultLogger } from "./utils/logger.mjs";

export function main() {
  defaultLogger.log("Application starting...");
  defaultLogger.log("Config:", config);
  defaultLogger.log("API Version:", API_VERSION);
  defaultLogger.log("Max Retries:", MAX_RETRIES);

  const result = add(5, multiply(3, 2));
  defaultLogger.log("Calculation result:", result);

  const user: UserWithRole = {
    id: "1",
    name: capitalize("john doe"),
    email: "john@example.com",
    createdAt: new Date(),
    role: "admin",
  };

  defaultLogger.log("User:", user.name);
  defaultLogger.log("Formatted date:", formatDate(user.createdAt));

  return {
    result,
    user,
  };
}
