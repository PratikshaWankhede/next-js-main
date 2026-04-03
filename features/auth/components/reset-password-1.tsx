"use client";

import { AuthHero } from "@/features/auth/components/auth-hero";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  emailSchema,
  EmailSchema,
  otpSchema,
  OtpSchema,
  passwordSchema,
  PasswordSchema,
} from "../utils/reset-password-schema";

const RJ_LOGO =
  "https://rjtattoostudio.com/wp-content/uploads/2025/04/Black-and-Orange-Typography-T-shirtj-e1742288670418-300x103-1.webp";

const steps = [
  {
    id: 1,
    title: "Verify Email",
    description: "Enter your account email",
    icon: Mail,
  },
  {
    id: 2,
    title: "Enter OTP",
    description: "Enter the 6-digit code sent to your email",
    icon: ShieldCheck,
  },
  {
    id: 3,
    title: "New Password",
    description: "Create a new secure password",
    icon: KeyRound,
  },
];

export default function ResetPassword1() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  const emailForm = useForm<EmailSchema>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OtpSchema>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const passwordForm = useForm<PasswordSchema>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const handleEmailSubmit = async (data: EmailSchema) => {
    try {
      setIsLoading(true);
      setEmail(data.email);
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const payload = (await res.json().catch(() => ({}))) as { otp?: string };

      setCurrentStep(2);
      if (payload.otp) {
        toast.success("Verification code generated (dev)", {
          description: `OTP: ${payload.otp}`,
        });
      } else {
        toast.success("Verification code sent to your email!");
      }
    } catch {
      toast.error("Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (data: OtpSchema) => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: data.otp }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        resetToken?: string;
        error?: string;
      };
      if (!res.ok || !payload.resetToken) {
        throw new Error(payload.error || "Invalid verification code");
      }

      setResetToken(payload.resetToken);
      setCurrentStep(3);
      toast.success("Email verified successfully!");
    } catch {
      toast.error("Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordSchema) => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          resetToken,
          password: data.password,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to reset password");
      }
      toast.success("Password reset successfully!");
      window.location.href = "/sign-in";
    } catch {
      toast.error("Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen w-full lg:grid-cols-2">
      {/* Left Column - RJ Tattoo Studio Branding + Steps */}
      <AuthHero>
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">
              Account Recovery
            </h2>
            <p className="text-zinc-400 text-sm">
              Securely reset your password in three simple steps. We&apos;ll send
              you a one-time code to verify your email.
            </p>
          </div>

          <div className="space-y-6">
            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;

              return (
                <div key={step.id} className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                      isCompleted &&
                        "border-orange-500 bg-orange-500/20 text-orange-400",
                      isActive &&
                        "border-orange-500 bg-orange-500/20 text-orange-400",
                      !isCompleted &&
                        !isActive &&
                        "border-zinc-700 bg-zinc-800/50 text-zinc-500",
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <span className="text-sm font-semibold">{step.id}</span>
                    )}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "size-4",
                          isCompleted && "text-orange-400",
                          isActive && "text-orange-400",
                          !isCompleted && !isActive && "text-zinc-500",
                        )}
                      />
                      <h3
                        className={cn(
                          "font-semibold",
                          isCompleted && "text-orange-400",
                          isActive && "text-white",
                          !isCompleted && !isActive && "text-zinc-500",
                        )}
                      >
                        {step.title}
                      </h3>
                    </div>
                    <p
                      className={cn(
                        "text-sm mt-0.5",
                        isActive ? "text-zinc-300" : "text-zinc-600",
                      )}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <blockquote className="text-sm italic text-zinc-400 border-l-2 border-orange-500/50 pl-4">
            Your security is our priority. Rest assured your account is in safe
            hands.
          </blockquote>
        </div>
      </AuthHero>

      {/* Right Column - Reset Password Form */}
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

          {/* Mobile Steps Indicator */}
          <div className="flex items-center justify-center gap-2 lg:hidden">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "h-2 w-8 rounded-full transition-all",
                  currentStep === step.id && "bg-orange-500",
                  currentStep > step.id && "bg-orange-500/60",
                  currentStep < step.id && "bg-zinc-300 dark:bg-zinc-700",
                )}
              />
            ))}
          </div>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">Reset Password</CardTitle>
                <ShieldCheck className="size-5 text-orange-500" />
              </div>
              <CardDescription>
                {currentStep === 1 &&
                  "Enter the email address associated with your account. We'll send you a verification code."}
                {currentStep === 2 &&
                  `We've sent a 6-digit verification code to ${email}. Please enter it below.`}
                {currentStep === 3 &&
                  "Create a new secure password for your account. Make sure it's at least 8 characters."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Step 1: Email */}
              {currentStep === 1 && (
                <Form {...emailForm}>
                  <form
                    onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="name@example.com"
                              disabled={isLoading}
                              className="h-12 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-orange-500 focus:ring-orange-500/20"
                              {...field}
                            />
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
                          <svg
                            className="size-4 animate-spin"
                            viewBox="0 0 24 24"
                          >
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
                          Sending...
                        </span>
                      ) : (
                        "Send Verification Code"
                      )}
                    </Button>
                  </form>
                </Form>
              )}

              {/* Step 2: OTP */}
              {currentStep === 2 && (
                <Form {...otpForm}>
                  <form
                    onSubmit={otpForm.handleSubmit(handleOtpSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={otpForm.control}
                      name="otp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verification Code</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="000000"
                              maxLength={6}
                              disabled={isLoading}
                              className="h-12 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-orange-500 focus:ring-orange-500/20 text-center text-lg tracking-[0.5em] font-mono"
                              {...field}
                            />
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
                          <svg
                            className="size-4 animate-spin"
                            viewBox="0 0 24 24"
                          >
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
                          Verifying...
                        </span>
                      ) : (
                        "Verify Code"
                      )}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        className="text-sm text-orange-600 hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                        onClick={() => {
                          toast.info("Verification code resent!");
                        }}
                      >
                        Didn&apos;t receive the code? Resend
                      </button>
                    </div>
                  </form>
                </Form>
              )}

              {/* Step 3: New Password */}
              {currentStep === 3 && (
                <Form {...passwordForm}>
                  <form
                    onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={passwordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter new password"
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
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirm new password"
                              disabled={isLoading}
                              className="h-12 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-orange-500 focus:ring-orange-500/20"
                              {...field}
                            />
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
                          <svg
                            className="size-4 animate-spin"
                            viewBox="0 0 24 24"
                          >
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
                          Resetting...
                        </span>
                      ) : (
                        "Reset Password"
                      )}
                    </Button>
                  </form>
                </Form>
              )}

              <div className="mt-6 text-center text-sm">
                <span className="text-zinc-500">Remember your password? </span>
                <Link
                  href="/sign-in"
                  className="text-orange-600 hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-zinc-500">
            RJ Tattoo Studio CRM · Admin Portal
          </p>
        </div>
      </div>
    </div>
  );
}
