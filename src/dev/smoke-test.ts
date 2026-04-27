/**
 * Live smoke test: verify pipeline (prompt build + JSON parse).
 * Run: npm run smoke:test
 */

import { checkPipeline } from '../health/monitor.js';

try {
  const result = checkPipeline();
  if (result.ok) {
    console.log('✅ Pipeline smoke test OK');
    process.exit(0);
  } else {
    console.error('❌ Pipeline smoke test FAIL', result.message, result.details ?? '');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Pipeline smoke test FAIL', e);
  process.exit(1);
}
