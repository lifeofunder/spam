import Stripe from 'stripe';

/**
 * Minimal integration-style check: Stripe's signing helpers round-trip with constructEvent.
 */
describe('Stripe webhook signature (fixture)', () => {
  it('constructEvent accepts generateTestHeaderString payload', () => {
    const secret = 'whsec_test_fixture_12345678901234567890123456789012';
    const payload = JSON.stringify({
      id: 'evt_fixture_1',
      object: 'event',
      type: 'ping',
      data: { object: { id: 'obj_1' } },
    });

    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });

    const stripe = new Stripe('sk_test_fixture_dummy_key_for_webhook_only_0000000000', {
      typescript: true,
    });

    const event = stripe.webhooks.constructEvent(Buffer.from(payload), header, secret);
    expect(event.id).toBe('evt_fixture_1');
    expect(event.type).toBe('ping');
  });
});
