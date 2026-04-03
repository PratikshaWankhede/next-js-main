"use client";

import { AuthHero } from "@/features/auth/components/auth-hero";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { SignInSchema, signInSchema } from "../utils/sign-in-schema";

const RJ_LOGO =
  "https://rjtattoostudio.com/wp-content/uploads/2025/04/Black-and-Orange-Typography-T-shirtj-e1742288670418-300x103-1.webp";

export default function SignIn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInSchema>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInSchema) => {
    try {
      setIsLoading(true);
      await login(data.email, data.password);
      toast.success("Signed in successfully!");
      const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sign in. Please check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen w-full lg:grid-cols-2">
      {/* Left Column - RJ Tattoo Studio Branding */}
      <AuthHero />

      {/* Right Column - Sign In Form */}
      <div className="flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 lg:p-12">
        <div className="mx-auto w-full max-w-[400px] space-y-8">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-3 lg:hidden">
            <Link href="/" className="relative h-10 w-28 block">
              <Image
                src={RJ_LOGO}
                alt="RJ Tattoo Studio"
                fill
                className="object-contain object-left"
                sizes="112px"
              />
            </Link>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Welcome back
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Sign in to access the RJ Tattoo Studio admin portal
            </p>
          </div>

          <div className="space-y-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@example.com"
                          disabled={isLoading}
                          className="h-12 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-orange-500 focus:ring-orange-500/20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link
                          href="/reset-password-1"
                          className="text-sm text-orange-600 hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            disabled={isLoading}
                            className="h-12 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-orange-500 focus:ring-orange-500/20 pr-12"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="size-5" />
                            ) : (
                              <Eye className="size-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  className="h-12 w-full bg-orange-600 font-medium text-white transition-all hover:bg-orange-700 hover:shadow-lg hover:shadow-orange-500/25 border-0"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="size-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-center text-sm text-zinc-500">
            RJ Tattoo Studio CRM · Admin Portal
          </p>
        </div>
      </div>
    </div>
  );
}
