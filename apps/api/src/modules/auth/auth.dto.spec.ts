import { PhoneSendCodeDto, PhoneVerifyDto } from './auth.dto';

describe('phone DTOs', () => {
  it('accept a real mobile number in E.164', () => {
    expect(PhoneSendCodeDto.schema.safeParse({ phone: '+66812345678' }).success).toBe(true);
    expect(PhoneVerifyDto.schema.safeParse({ phone: '+66812345678', code: '123456', firstName: 'Somchai', lastName: 'Jaidee' }).success).toBe(
      true,
    );
  });

  it('refuse numbers that are E.164-shaped but not mobiles, since codes go by SMS', () => {
    for (const phone of ['+6621234567', '+6681234567', '+959123456789']) {
      expect(PhoneSendCodeDto.schema.safeParse({ phone }).success).toBe(false);
      expect(PhoneVerifyDto.schema.safeParse({ phone, code: '123456' }).success).toBe(false);
    }
  });

  it('still refuse local formats (the web converts to E.164 first)', () => {
    expect(PhoneSendCodeDto.schema.safeParse({ phone: '0812345678' }).success).toBe(false);
  });
});
