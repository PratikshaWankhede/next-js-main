"use client";

import Image from "next/image";
import Link from "next/link";

const RJ_LOGO =
  "https://rjtattoostudio.com/wp-content/uploads/2025/04/Black-and-Orange-Typography-T-shirtj-e1742288670418-300x103-1.webp";
const RJ_HERO =
  "https://rjtattoostudio.com/wp-content/uploads/2025/05/custom-scaled.jpg";

interface AuthHeroProps {
  children?: React.ReactNode;
}

export function AuthHero({ children }: AuthHeroProps) {
  return (
    <div className="relative hidden overflow-hidden bg-zinc-950 lg:block">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <Image
          src={RJ_HERO}
          alt="RJ Tattoo Studio"
          fill
          className="object-cover opacity-30"
          priority
          sizes="(max-width: 1024px) 0vw, 50vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-zinc-950/95 via-zinc-950/90 to-zinc-950" />
        <div className="absolute inset-0 bg-linear-to-tr from-orange-600/10 via-transparent to-zinc-900/50" />
      </div>

      {/* Decorative elements */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl animate-pulse" />
      <div className="absolute bottom-1/3 left-1/4 h-48 w-48 rounded-full bg-amber-600/15 blur-3xl animate-[pulse_3s_ease-in-out_infinite_1s]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group w-fit">
          <div className="relative h-12 w-32 shrink-0 transition-transform group-hover:scale-105">
            <Image
              src={RJ_LOGO}
              alt="RJ Tattoo Studio"
              fill
              className="object-contain object-left"
              sizes="128px"
            />
          </div>
        </Link>

        {/* Center content */}
        <div className="flex flex-1 flex-col items-center justify-center space-y-8">
          {children ?? (
            <div className="text-center space-y-4 max-w-md">
              <p className="text-orange-400/90 text-sm font-medium uppercase tracking-[0.2em]">
                Looking for Custom Tattoos?
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                Great Art Starts with{" "}
                <span className="text-orange-400">Great Ink</span>
              </h2>
              <p className="text-zinc-400 text-base">
                Tap into the primal power and unwavering spirit. We don&apos;t
                just ink skin—we forge symbols of courage, resilience, and your
                unique inner battle.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} RJ Tattoo Studio. Admin Portal.
          </p>
        </div>
      </div>
    </div>
  );
}
