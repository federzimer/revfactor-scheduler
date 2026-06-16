import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import type { User } from '@prisma/client';

// Bootstrap allowlist — used as a fallback so we can't lock ourselves out while
// migrating team membership into the database (User.active).
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow a teammate added via "Add user" (a User row created before they've ever
      // logged in) to link to their Google account on first sign-in. Safe here: a single
      // trusted Google provider and sign-in is still gated by the DB allowlist below.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      // Allow if an active team member exists in the DB, OR (bootstrap) the email is in ADMIN_EMAILS.
      const existing = await prisma.user.findUnique({ where: { email } });
      const allowed = existing ? existing.active : ADMIN_EMAILS.includes(email);
      if (!allowed) return false;

      // Persist the freshest OAuth scopes/tokens onto the already-linked Account.
      // NextAuth's PrismaAdapter only writes these on the FIRST account link, so without
      // this a re-consent (e.g. a teammate using "Connect Google Calendar" to grant the
      // calendar scope they declined the first time) would update Google but never the DB —
      // the reconnect would silently no-op. updateMany matches 0 rows on a first-ever
      // sign-in (the adapter's linkAccount stores the row then), so this is safe either way.
      // Prisma ignores `undefined` fields, so we only overwrite what Google actually returned.
      if (account?.provider === 'google' && account.providerAccountId) {
        await prisma.account.updateMany({
          where: { provider: 'google', providerAccountId: account.providerAccountId },
          data: {
            access_token: account.access_token,
            expires_at: typeof account.expires_at === 'number' ? account.expires_at : undefined,
            scope: account.scope,
            token_type: account.token_type,
            id_token: account.id_token,
            refresh_token: account.refresh_token ?? undefined,
          },
        });
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).role = (user as any).role || 'user';
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Resolve the full DB User (incl. role) for the current session, or null if not signed in.
 */
export async function getSessionUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

/**
 * Returns the session User only if they are an active super admin, otherwise null.
 * Routes use this to gate super-admin-only actions.
 */
export async function requireSuperAdmin(): Promise<User | null> {
  const user = await getSessionUser();
  if (!user || !user.active || user.role !== 'super_admin') return null;
  return user;
}

export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  });
  if (!account) return null;

  // Check if token is expired
  if (account.expires_at && account.expires_at * 1000 < Date.now()) {
    // Refresh the token
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: 'refresh_token',
          refresh_token: account.refresh_token!,
        }),
      });

      const tokens = await response.json();
      if (!response.ok) throw new Error(tokens.error);

      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
          refresh_token: tokens.refresh_token ?? account.refresh_token,
        },
      });

      return tokens.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  return account.access_token;
}
