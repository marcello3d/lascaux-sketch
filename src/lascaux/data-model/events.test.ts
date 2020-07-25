import {
  isLegacyModeEvent,
  isKeyframeEvent,
  getNormalizedModePayload,
} from './events';

describe('isLegacyModeEvent', () => {
  it.each`
    event     | expected
    ${'%foo'} | ${true}
    ${'%'}    | ${true}
    ${'blah'} | ${false}
  `('returns $expected for "$event"', ({ event, expected }) => {
    expect(isLegacyModeEvent(event)).toBe(expected);
  });
});

describe('isKeyframeEvent', () => {
  it.each`
    event      | expected
    ${'start'} | ${true}
    ${'!art'}  | ${true}
    ${'end'}   | ${false}
    ${'%mode'} | ${false}
  `('returns $expected for "$event"', ({ event, expected }) => {
    expect(isKeyframeEvent(event)).toBe(expected);
  });
});

describe('getNormalizedModePayload', () => {
  it.each`
    event       | payload              | expected
    ${'%color'} | ${'red'}             | ${{ color: 'red' }}
    ${'%'}      | ${{ color: 'blue' }} | ${{ color: 'blue' }}
  `(
    'returns $expected for "$event" + $payload',
    ({ event, payload, expected }) => {
      expect(getNormalizedModePayload(event, payload)).toEqual(expected);
    },
  );
});
