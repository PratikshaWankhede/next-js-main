import { db, mongoClientPromise } from "@/db";
import { USER } from "@/db/collections";
import type { UserRole } from "@/lib/rbac";
import { generateRandomUUID } from "@/helpers/generate-random-uuid";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  adapter: MongoDBAdapter(mongoClientPromise),
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const userDoc = await db.collection(USER).findOne<{
          id?: string;
          _id?: string;
          email: string;
          name?: string;
          image?: string | null;
          role?: UserRole;
          passwordHash?: string;
        }>({ email: email.toLowerCase() });

        if (!userDoc) return null;

        const passwordHash = userDoc.passwordHash;
        if (!passwordHash) {
          // You chose “force reset”, so older accounts might not have a hash yet.
          throw new Error("Password not set. Please reset your password.");
        }

        const ok = await bcrypt.compare(password, passwordHash);
        if (!ok) return null;

        const id =
          typeof userDoc.id === "string"
            ? userDoc.id
            : typeof userDoc._id === "string"
              ? userDoc._id
              : generateRandomUUID();

        return {
          id,
          name: userDoc.name ?? "",
          email: userDoc.email,
          image: userDoc.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (token.sub) {
        const dbUser = await db.collection(USER).findOne<{ role?: UserRole }>({
          id: token.sub,
        });
        token.role = (dbUser?.role ?? "sales") as UserRole;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role ?? "sales") as UserRole;
      }
      return session;
    },
  },
};

export const nextAuthHandler = NextAuth(authOptions);
