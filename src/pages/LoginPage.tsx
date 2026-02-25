import React from "react";
import { GoogleLogin } from "../auth";
import type { AuthUser, Config } from "../types";

type Props = {
  config: Config | null;
  onLogin: (user: AuthUser) => void;
  onError: (msg: string) => void;
};

const LoginPage: React.FC<Props> = ({ config, onLogin, onError }) => {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-muted/60 bg-muted/20 p-6 text-center shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">Anmelden</h2>
      <p className="mb-4 text-subtle">Mit Google anmelden, um deine Toggl-Zeiten zu laden.</p>
      <GoogleLogin onLogin={onLogin} onError={onError} googleClientId={config?.googleClientId} />
    </div>
  );
};

export default LoginPage;
