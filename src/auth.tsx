import React, { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "./api/client";
import type { AuthUser } from "./types";

export type { AuthUser };

type Props = {
  onLogin: (user: AuthUser) => void;
  onError: (message: string) => void;
  googleClientId?: string;
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

export const GoogleLogin: React.FC<Props> = ({ onLogin, onError, googleClientId }) => {
  const [ready, setReady] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!googleClientId) {
      onError("Fehlende Google Client ID (prüfe Backend-Konfiguration)");

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
    if (!ready || !window.google || !buttonRef.current || !googleClientId) return;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
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
