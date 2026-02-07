import React, { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "./api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export type AuthUser = {
  email: string;
  name?: string | null;
  picture?: string | null;
};

type Props = {
  onLogin: (user: AuthUser) => void;
  onError: (message: string) => void;
};

declare global {
  interface Window {
    google?: typeof google;
  }

  namespace google {
    const accounts: {
      id: {
        initialize(options: { client_id: string; callback: (payload: { credential: string }) => void }): void;
        renderButton(target: HTMLElement, options?: Record<string, unknown>): void;
        prompt(): void;
      };
    };
  }
}

export const GoogleLogin: React.FC<Props> = ({ onLogin, onError }) => {
  const [ready, setReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      onError("Fehlende VITE_GOOGLE_CLIENT_ID in der Umgebung");

      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    script.onerror = () => onError("Google Script konnte nicht geladen werden");
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [onError]);

  useEffect(() => {
    if (!ready || !window.google || !buttonRef.current || !GOOGLE_CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (payload) => {
        (async () => {
          try {
            const user = await loginWithGoogle(payload.credential);
            onLogin(user);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Login fehlgeschlagen";
            onError(msg);
          }
        })();
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
    });

    window.google.accounts.id.prompt();
  }, [ready, onLogin, onError]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={buttonRef} />
    </div>
  );
};
