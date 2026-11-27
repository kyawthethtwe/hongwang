import { test as setup } from '@playwright/test';
import { GUEST, HOST, SESSION, signIn } from './helpers';

/** Signs each seeded account in once and saves the session for the golden paths. */
setup('sign in the guest and the host', async ({ browser }) => {
  for (const [email, file] of [
    [GUEST, SESSION.guest],
    [HOST, SESSION.host],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, email);
    await context.storageState({ path: file });
    await context.close();
  }
});
