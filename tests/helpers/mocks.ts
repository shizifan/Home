// Set up mock responses for LLM calls
export function setupMockLLM(callType: string, response: unknown) {
  if (typeof window !== 'undefined') {
    (window as Record<string, unknown>).__testMocks = {
      ...((window as Record<string, unknown>).__testMocks as Record<string, unknown> || {}),
      [`llm_${callType}`]: response,
    };
  }
}

export function setupMockContentAudit(passed: boolean, labels: string[] = []) {
  if (typeof window !== 'undefined') {
    (window as Record<string, unknown>).__testMocks = {
      ...((window as Record<string, unknown>).__testMocks as Record<string, unknown> || {}),
      content_audit_passed: passed,
      content_audit_labels: labels,
    };
  }
}

export function resetMocks() {
  if (typeof window !== 'undefined') {
    delete (window as Record<string, unknown>).__testMocks;
  }
}
