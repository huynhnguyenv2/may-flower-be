import type { ChatMessage } from "./llm/openai-client.js";
import { getOperationsSnapshot } from "./ai-tools/data-queries.js";
import { runStaffCopilot } from "./ai-tools/staff-copilot.js";

export async function staffAssistantReply(
  staff: { name: string; roles: string[] },
  history: ChatMessage[],
): Promise<{ message: string; source: "openai" | "rules"; toolsUsed: string[] }> {
  return runStaffCopilot({ staff }, history);
}

/** KPI strip for admin assistant UI */
export async function staffAssistantStats() {
  const snap = await getOperationsSnapshot();
  return {
    ordersToday: snap.ordersToday,
    pendingPayment: snap.pendingPayment,
    revenueTodayVnd: snap.revenueTodayVnd,
  };
}
