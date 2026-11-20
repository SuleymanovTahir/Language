import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import { sendAccountEmail } from "./email.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be configured for account sign-in.");
const publicAppUrl = process.env.BETTER_AUTH_URL;
if (!publicAppUrl) throw new Error("BETTER_AUTH_URL must be configured for account sign-in.");

const baseURL = process.env.VERCEL
  ? {
      allowedHosts: [
        new URL(publicAppUrl).host,
        "language-*-suleymanovtahirs-projects.vercel.app",
        ...(process.env.VERCEL_ENV === "development" ? ["localhost:8443", "127.0.0.1:8443"] : []),
      ],
      protocol: "https" as const,
      fallback: publicAppUrl,
    }
  : publicAppUrl;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 8_000,
  allowExitOnIdle: true,
});

export async function ensureInitialAppRole(userId: string) {
  const client = await pool.connect();
  try {
    const account = await client.query(`SELECT email FROM "user" WHERE id=$1`, [userId]);
    if (!account.rows[0]) return;
    const email =
      typeof account.rows[0].email === "string" ? account.rows[0].email.toLocaleLowerCase() : "";
    const primaryOwnerEmail = process.env.LINGUAPLAY_OWNER_EMAIL?.trim().toLocaleLowerCase();
    const isConfiguredOwner = Boolean(primaryOwnerEmail && email === primaryOwnerEmail);
    const existing = await client.query(`SELECT role FROM linguaplay_user_roles WHERE user_id=$1`, [
      userId,
    ]);
    if (primaryOwnerEmail && !isConfiguredOwner) {
      if (existing.rows[0]?.role === "owner") {
        await client.query(
          `UPDATE linguaplay_user_roles SET role='admin',updated_at=now() WHERE user_id=$1`,
          [userId],
        );
      }
      await client.query(`UPDATE "user" SET role='user' WHERE id=$1 AND role<>'user'`, [userId]);
      return;
    }
    if (existing.rowCount && !isConfiguredOwner) return;

    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-owner-bootstrap'))");
    if (isConfiguredOwner) {
      await client.query(
        `UPDATE linguaplay_user_roles SET role='admin', updated_at=now() WHERE role='owner' AND user_id<>$1`,
        [userId],
      );
      await client.query(
        `INSERT INTO linguaplay_user_roles (user_id, role) VALUES ($1,'owner') ON CONFLICT (user_id) DO UPDATE SET role='owner', updated_at=now()`,
        [userId],
      );
      await client.query(`UPDATE "user" SET role='user' WHERE id<>$1 AND role<>'user'`, [userId]);
      await client.query(`UPDATE "user" SET role='admin' WHERE id=$1`, [userId]);
      await client.query("COMMIT");
      return;
    }
    const result = await client.query(
      `
      INSERT INTO linguaplay_user_roles (user_id, role)
      VALUES ($1, CASE WHEN EXISTS (SELECT 1 FROM linguaplay_user_roles WHERE role='owner') OR $2::boolean THEN 'student' ELSE 'owner' END)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING role
    `,
      [userId, Boolean(process.env.VERCEL)],
    );
    if (result.rows[0]?.role === "owner")
      await client.query(`UPDATE "user" SET role='admin' WHERE id=$1`, [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const auth = betterAuth({
  appName: "ClickLing",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) =>
      sendAccountEmail({
        to: user.email,
        subject: "Сброс пароля ClickLing",
        intro: "Вы запросили ссылку для создания нового пароля.",
        url,
        action: "Задать новый пароль",
      }),
    onExistingUserSignUp: async ({ user }: { user: { email: string } }) =>
      sendAccountEmail({
        to: user.email,
        subject: "Попытка регистрации в ClickLing",
        intro:
          "Для этого адреса уже существует аккаунт. Если это были вы, воспользуйтесь ссылкой для сброса пароля на странице входа.",
        url: publicAppUrl,
        action: "Открыть ClickLing",
      }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) =>
      sendAccountEmail({
        to: user.email,
        subject: "Подтвердите адрес ClickLing",
        intro: "Подтвердите адрес электронной почты, чтобы активировать личный кабинет.",
        url,
        action: "Подтвердить адрес",
      }),
    afterEmailVerification: async (user: { id: string }) => ensureInitialAppRole(user.id),
  },
  user: { deleteUser: { enabled: true } },
  plugins: [admin()],
});
