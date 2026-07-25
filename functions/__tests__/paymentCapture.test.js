const { assessCaptureability, isUnexpectedStateError } = require('../paymentCapture');

const capturablePI = () => ({
  id: 'pi_123',
  status: 'requires_capture',
  amount_capturable: 12000,
  metadata: { jobId: 'job_abc', platform: 'handyman-platform' },
});

describe('assessCaptureability', () => {
  test('captures a requires_capture PI with a jobId and capturable amount', () => {
    expect(assessCaptureability(capturablePI()))
      .toEqual({ shouldCapture: true, reason: 'capture' });
  });

  test('rejects a missing/null intent', () => {
    expect(assessCaptureability(null))
      .toEqual({ shouldCapture: false, reason: 'no_intent' });
  });

  test('rejects statuses other than requires_capture (already captured, canceled, ...)', () => {
    for (const status of ['succeeded', 'canceled', 'processing', 'requires_payment_method']) {
      expect(assessCaptureability({ ...capturablePI(), status }))
        .toEqual({ shouldCapture: false, reason: 'wrong_status' });
    }
  });

  test('rejects a PI without our jobId metadata (unrelated product on the account)', () => {
    expect(assessCaptureability({ ...capturablePI(), metadata: {} }))
      .toEqual({ shouldCapture: false, reason: 'no_job_id' });
    expect(assessCaptureability({ ...capturablePI(), metadata: undefined }))
      .toEqual({ shouldCapture: false, reason: 'no_job_id' });
  });

  test('rejects a PI with nothing capturable', () => {
    expect(assessCaptureability({ ...capturablePI(), amount_capturable: 0 }))
      .toEqual({ shouldCapture: false, reason: 'nothing_capturable' });
  });
});

describe('isUnexpectedStateError', () => {
  test("matches Stripe's real error code (the reliable signal)", () => {
    // Real shape: StripeInvalidRequestError with prose that does NOT
    // contain the word "already" — code is the only dependable field.
    expect(isUnexpectedStateError({
      code: 'payment_intent_unexpected_state',
      message: 'This PaymentIntent could not be captured because it has a status of succeeded. Only a PaymentIntent with one of the following statuses may be captured: requires_capture.',
    })).toBe(true);
  });

  test('falls back to message matching for codeless errors', () => {
    expect(isUnexpectedStateError({ message: 'Charge has already been captured.' })).toBe(true);
  });

  test('does not match unrelated errors or null', () => {
    expect(isUnexpectedStateError({ code: 'card_declined', message: 'Your card was declined.' })).toBe(false);
    expect(isUnexpectedStateError({ message: 'rate limit' })).toBe(false);
    expect(isUnexpectedStateError(null)).toBe(false);
  });
});
