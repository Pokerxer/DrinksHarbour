'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const uri = process.env.DRINKSHARBOUR_AUTH_TEST_MONGO_URI;
process.env.JWT_SECRET =
  'tenant-customer-test-secret-with-at-least-32-characters';
test(
  'real database customer credentials, sessions and recovery remain within their store',
  { skip: !uri },
  async (t) => {
    assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_auth_test_[\w]+$/);
    await mongoose.connect(uri);
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    await User.init();
    await RefreshToken.init();
    const auth = require('../services/tenantCustomer.service');
    await require('../models/TenantCustomerChallenge').init();
    const a = { _id: new mongoose.Types.ObjectId(), slug: 'test-a' },
      b = { _id: new mongoose.Types.ObjectId(), slug: 'test-b' };
    const mails = [];
    t.mock.method(
      require('../services/email.service'),
      'sendEmailVerificationEmail',
      async (data) => mails.push(data),
    );
    t.mock.method(
      require('../services/email.service'),
      'sendPasswordResetEmail',
      async (data) => mails.push(data),
    );
    const input = {
      firstName: 'Ada',
      lastName: 'Obi',
      email: 'same@example.com',
      password: 'Bottle123!',
    };
    const first = await auth.register(a, input),
      codeA = mails.at(-1).code;
    const second = await auth.register(b, { ...input, password: 'Other123!' }),
      codeB = mails.at(-1).code;
    await t.test(
      'same email has independent passwords and profiles',
      async () => {
        assert.notEqual(first.user._id, second.user._id);
    const platform = await User.create({ email: input.email, firstName: 'Platform', role: 'customer', status: 'active',
      passwordHash: await require('bcryptjs').hash('Platform123!', 12) });
    const generic = require('../services/user.service');
    assert.equal(String((await generic.loginUser(input.email, 'Platform123!')).user._id), String(platform._id));
    await assert.rejects(auth.login(a, { email: input.email, password: 'Platform123!' }));

        assert.equal(
          (
            await auth.login(a, {
              email: input.email,
              password: input.password,
            })
          ).user._id,
          first.user._id,
        );
        await assert.rejects(
          auth.login(b, { email: input.email, password: input.password }),
        );
        await assert.rejects(
          require('../services/user.service').loginUser(
            input.email,
            input.password,
          ),
        );
        await assert.rejects(
          auth.register(a, { ...input, tenant: b._id, role: 'admin' }),
        );
      },
    );
    await t.test(
      'foreign access and refresh tokens are rejected; refresh rotates once',
      async () => {
        assert.equal((await auth.me(a, first.token)).tenantId, String(a._id));
        await assert.rejects(auth.me(b, first.token));
        await assert.rejects(auth.refresh(b, first.refreshToken));
        const attempts = await Promise.allSettled([
          auth.refresh(a, first.refreshToken),
          auth.refresh(a, first.refreshToken),
        ]);
        assert.equal(
          attempts.filter((x) => x.status === 'fulfilled').length,
          1,
        );
        const rotated = attempts.find((x) => x.status === 'fulfilled').value;
        assert.equal((await auth.me(a, rotated.token)).email, input.email);
        await auth.logout(a, rotated.refreshToken);
        await assert.rejects(auth.me(a, rotated.token));
      },
    );
    await t.test(
      'verification code is bound to tenant and is single use',
      async () => {
        await assert.rejects(
          auth.verifyEmail(b, { email: input.email, code: codeA }),
        );
        await auth.verifyEmail(a, { email: input.email, code: codeA });
        await assert.rejects(
          auth.verifyEmail(a, { email: input.email, code: codeA }),
        );
        assert.equal(
          (await User.findById(second.user._id)).isEmailVerified,
          false,
        );
        await auth.verifyEmail(b, { email: input.email, code: codeB });
      },
    );
    await t.test(
      'reset link and password change apply only to issuing tenant',
      async () => {
        await auth.forgotPassword(a, { email: input.email });
        const mail = mails.at(-1);
        assert.match(
          mail.resetUrl,
          /^https:\/\/test-a\.drinksharbour\.com\/reset-password\?token=/,
        );
        await assert.rejects(
          auth.resetPassword(b, mail.resetToken, {
            newPassword: 'NewBottle123!',
          }),
        );
        await auth.resetPassword(a, mail.resetToken, {
          newPassword: 'NewBottle123!',
        });
        await assert.rejects(
          auth.resetPassword(a, mail.resetToken, { newPassword: 'Again123!' }),
        );
        await assert.rejects(
          auth.login(a, { email: input.email, password: input.password }),
        );
        assert.equal(
          (await auth.login(b, { email: input.email, password: 'Other123!' }))
            .user._id,
          second.user._id,
        );
        await assert.rejects(auth.me(b, first.token));
      },
    );
    await t.test(
      'MFA pending tokens are scoped and consumed once',
      async () => {
        await User.updateOne(
          { _id: first.user._id },
          { $set: { mfaEnabled: true, mfaBackupCodes: ['ONE-CODE'] } },
        );
        await assert.rejects(require('../services/mfa.service').verifyLoginMfa(first.user._id, 'ONE-CODE'));
    const pending = await auth.login(a, {
          email: input.email,
          password: 'NewBottle123!',
        });
        assert.equal(pending.mfaRequired, true);
        await assert.rejects(
          auth.verifyMfa(b, {
            pendingMfaToken: pending.pendingMfaToken,
            code: 'ONE-CODE',
          }),
        );
        const full = await auth.verifyMfa(a, {
          pendingMfaToken: pending.pendingMfaToken,
          code: 'ONE-CODE',
        });
        assert.equal((await auth.me(a, full.token))._id, first.user._id);
        await assert.rejects(
          auth.verifyMfa(a, {
            pendingMfaToken: pending.pendingMfaToken,
            code: 'ONE-CODE',
          }),
        );
      },
    );
    await t.test(
      'HTTP API keys select customer tenant and reject spoofing and foreign sessions',
      async () => {
        const Tenant = require('../models/Tenant');
        await Tenant.collection.insertMany(
          [a, b].map((x) => ({
            ...x,
            name: x.slug,
            status: 'approved',
            subscriptionStatus: 'active',
            plan: 'pro',
          })),
        );
        const keys = require('../services/apiKey.service');
        const ka = await keys.issueKey(a, new mongoose.Types.ObjectId(), {
          name: 'test-a',
          scopes: ['storefront:read'],
        });
        const kb = await keys.issueKey(b, new mongoose.Types.ObjectId(), {
          name: 'test-b',
          scopes: ['storefront:read'],
        });
        const express = require('express');
        const app = express();
        app.use(express.json());
        app.use(
          '/api/integrations/v1',
          require('../routes/storefrontIntegration.routes'),
        );
        const server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        try {
          const base = `http://127.0.0.1:${server.address().port}/api/integrations/v1/customers`;
          const call = async (path, key, body, token) => {
            const res = await fetch(base + path, {
              method: body ? 'POST' : 'GET',
              headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                ...(token ? { 'X-Customer-Token': token } : {}),
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            });
            return {
              status: res.status,
              data: await res.json(),
              cache: res.headers.get('cache-control'),
            };
          };
          const login = await call('/login', kb.secret, {
            email: input.email,
            password: 'Other123!',
          });
          assert.equal(login.status, 200);
          const token = login.data.data.token;
          assert.equal(
            (await call('/me', kb.secret, undefined, token)).data.data.tenantId,
            String(b._id),
          );
          assert.equal(
            (await call('/me', ka.secret, undefined, token)).status,
            401,
          );
          assert.equal(
            (await call('/me', 'invalid', undefined, token)).status,
            401,
          );
          assert.equal(
            (
              await call('/login', ka.secret, {
                email: input.email,
                password: 'Other123!',
                tenant: b._id,
              })
            ).status,
            400,
          );
          assert.equal(login.cache, 'private, no-store');
        } finally {
          await new Promise((resolve) => server.close(resolve));
        }
      },
    );
  },
);
