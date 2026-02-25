import React, { useState } from "react";

type Props = {
  onSaveToken: (token: string) => Promise<boolean>;
  saving: boolean;
};

const TokenInputPage: React.FC<Props> = ({ onSaveToken, saving }) => {
  const [tokenInput, setTokenInput] = useState("");

  return (
    <div className="w-full max-w-lg rounded-2xl border border-muted/60 bg-muted/20 p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">Toggl API Token hinterlegen</h2>
      <p className="mb-4 text-subtle">
        Dein Google-Login ist erledigt. Bitte füge jetzt deinen persönlichen Toggl API Token hinzu, damit die Zeiten
        geladen werden können. Du findest ihn unter{" "}
        <a className="underline" href="https://track.toggl.com/profile" target="_blank" rel="noreferrer">
          track.toggl.com/profile
        </a>
        .
      </p>
      <div className="flex flex-col gap-3">
        <input
          type="password"
          className="w-full rounded-xl border border-muted bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
          placeholder="Toggl API Token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
        />
        <button
          onClick={() => void onSaveToken(tokenInput)}
          disabled={saving || !tokenInput.trim()}
          className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Speichere…" : "Token speichern"}
        </button>
      </div>
    </div>
  );
};

export default TokenInputPage;
