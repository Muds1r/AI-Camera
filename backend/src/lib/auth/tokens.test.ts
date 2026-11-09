import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { parseSessionToken, signAccessToken } from './tokens';

describe('parseSessionToken', () => {
  it('reads a signed access token', async () => {
    const token = await signAccessToken({
      id: 'user-1',
      email: 'ada@example.com',
      role: Role.hr,
    });

    await expect(parseSessionToken(token)).resolves.toEqual({
      sub: 'user-1',
      email: 'ada@example.com',
      role: Role.hr,
    });
  });

  it('rejects a missing, tampered, or non-access token', async () => {
    const token = await signAccessToken({
      id: 'user-1',
      email: 'ada@example.com',
      role: Role.employee,
    });
    const tampered = `${token.slice(0, -4)}xxxx`;
    const other = jwt.sign(
      { typ: 'refresh', role: Role.employee, email: 'ada@example.com' },
      process.env.JWT_ACCESS_SECRET!,
      {
        subject: 'user-1',
        expiresIn: 60,
        issuer: 'ai-camera',
        audience: 'ai-camera-web',
      },
    );

    expect(await parseSessionToken(undefined)).toBeNull();
    expect(await parseSessionToken(tampered)).toBeNull();
    expect(await parseSessionToken(other)).toBeNull();
  });
});
