/**
 * Alibaba Cloud Content Safety API Client (ImageModeration)
 *
 * Uses REST API (no SDK dependency) with HMAC-SHA1 Signature V1.
 * Gracefully degrades when credentials are missing.
 */

import 'server-only';
import crypto from 'crypto';

export interface AliyunImageScanResult {
  passed: boolean;
  labels: string[];
  suggestion: 'pass' | 'review' | 'block';
}

const ENDPOINT = 'https://green-cip.cn-hangzhou.aliyuncs.com';
const ACTION = 'ImageModeration';
const API_VERSION = '2022-03-02';
const TIMEOUT_MS = 8_000;

const MOCK_RESULT: AliyunImageScanResult = {
  passed: true,
  labels: [],
  suggestion: 'pass',
};

/**
 * Generate HMAC-SHA1 Signature V1 for Alibaba Cloud API
 */
function sha1Signature(
  secret: string,
  stringToSign: string,
): string {
  return crypto
    .createHmac('sha1', `${secret}&`)
    .update(stringToSign)
    .digest('base64');
}

/**
 * Build query string sorted by key (required for signature)
 */
function buildQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
}

/**
 * Scan an image URL using Alibaba Cloud Content Moderation.
 * Returns a structured result with pass/fail/suggestion.
 */
export async function aliyunImageScan(imageUrl: string): Promise<AliyunImageScanResult> {
  // Mock mode: always pass
  if (process.env.TEST_LLM_MODE === 'mock') {
    return MOCK_RESULT;
  }

  const accessKeyId = process.env.ALIYUN_CONTENT_SAFETY_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_CONTENT_SAFETY_ACCESS_KEY_SECRET;

  // Graceful degradation: if credentials are missing, log warning and pass
  if (!accessKeyId) {
    console.warn(
      '[aliyun_safety] ALIYUN_CONTENT_SAFETY_ACCESS_KEY_ID not set. Skipping Aliyun content scan (graceful degradation).',
    );
    return { passed: true, labels: [], suggestion: 'pass' };
  }

  if (!accessKeySecret) {
    console.warn(
      '[aliyun_safety] ALIYUN_CONTENT_SAFETY_ACCESS_KEY_SECRET not set. Skipping Aliyun content scan (graceful degradation).',
    );
    return { passed: true, labels: [], suggestion: 'pass' };
  }

  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();

  const queryParams: Record<string, string> = {
    Action: ACTION,
    Format: 'JSON',
    Version: API_VERSION,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Timestamp: timestamp,
    AccessKeyId: accessKeyId,
  };

  const sortedQuery = buildQuery(queryParams);

  // Signature V1: HMAC-SHA1(HTTPMethod + "&" + percentEncode("/") + "&" + percentEncode(sortedQuery))
  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(sortedQuery)}`;
  const signature = sha1Signature(accessKeySecret, stringToSign);

  const finalQuery = `${sortedQuery}&Signature=${encodeURIComponent(signature)}`;
  const url = `${ENDPOINT}/?${finalQuery}`;

  const body = JSON.stringify({
    Service: 'baselineCheck',
    ServiceParameters: {
      imageUrl,
    },
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.error(`[aliyun_safety] HTTP ${response.status}: ${await response.text().catch(() => '')}`);
      return { passed: false, labels: ['audit_unavailable'], suggestion: 'block' };
    }

    const json = (await response.json()) as Record<string, unknown>;

    // Parse the Alibaba Cloud response structure
    const data = json.Data as Record<string, unknown> | undefined;
    if (!data) {
      console.warn('[aliyun_safety] Empty Data in response');
      return { passed: false, labels: ['audit_unavailable'], suggestion: 'block' };
    }

    const suggestion = ((data.Suggestion as string) ?? 'review').toLowerCase() as
      | 'pass'
      | 'review'
      | 'block';

    const labels: string[] = [];
    const results = data.Result as Array<Record<string, unknown>> | undefined;
    if (results) {
      for (const r of results) {
        const label = r.Label as string | undefined;
        if (label) labels.push(label);
      }
    }

    const passed = suggestion === 'pass';

    return { passed, labels, suggestion };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout =
      (err as Error)?.name === 'AbortError';
    console.error(
      `[aliyun_safety] ${isTimeout ? 'Timeout' : 'Error'}:`,
      (err as Error)?.message ?? err,
    );
    // Conservative: block on any failure
    return { passed: false, labels: ['audit_unavailable'], suggestion: 'block' };
  }
}
