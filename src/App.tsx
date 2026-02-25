import React from "react";
import { useAppData } from "./hooks/useAppData";
import LoginPage from "./pages/LoginPage";
import TokenInputPage from "./pages/TokenInputPage";
import DashboardPage from "./pages/DashboardPage";

const Spinner: React.FC = () => (
  <div className="flex flex-col items-center gap-3 text-subtle">
    <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span>Lade…</span>
  </div>
);

const App: React.FC = () => {
  const data = useAppData();

  const {
    config,
    loading,
    loadingData,
    error,
    user,
    savingToken,
    savingPreferences,
    daysOff,
    payouts,
    rateLimited,
    activeTab,
    setActiveTab,
    payoutOpen,
    pendingPayout,
    persistedPayout,
    hasChanged,
    canPayoutMore,
    summary,
    handleLogin,
    handleLogout,
    handleSaveToken,
    handleSavePreferences,
    handleToggleDayOff,
    handlePayoutPlus,
    handlePayoutMinus,
    handlePayoutConfirm,
    handleSwitchToHistory,
    handleCancelPayout,
  } = data;

  const tokenRequired = config && !config.testMode && config.needsTogglToken;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow">
          {error}
        </div>
      )}

      {loading ? (
        <main className="flex min-h-screen items-center justify-center">
          <Spinner />
        </main>
      ) : !user ? (
        <main className="flex min-h-screen items-center justify-center px-6">
          <LoginPage
            config={config}
            onLogin={(u) => void handleLogin(u)}
            onError={() => {}}
          />
        </main>
      ) : tokenRequired ? (
        <main className="flex min-h-screen items-center justify-center px-6">
          <TokenInputPage
            onSaveToken={handleSaveToken}
            saving={savingToken}
          />
        </main>
      ) : loadingData ? (
        <main className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-subtle">
            <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Lade Daten…</span>
          </div>
        </main>
      ) : summary ? (
        <DashboardPage
          summary={summary}
          config={config}
          user={user}
          daysOff={daysOff}
          payouts={payouts}
          rateLimited={rateLimited}
          activeTab={activeTab}
          payoutOpen={payoutOpen}
          pendingPayout={pendingPayout}
          persistedPayout={persistedPayout}
          hasChanged={hasChanged}
          canPayoutMore={canPayoutMore}
          savingToken={savingToken}
          savingPreferences={savingPreferences}
          onTabChange={setActiveTab}
          onSwitchToHistory={handleSwitchToHistory}
          onToggleDayOff={handleToggleDayOff}
          onLogout={() => void handleLogout()}
          onSaveToken={handleSaveToken}
          onSavePreferences={handleSavePreferences}
          onPayoutPlus={handlePayoutPlus}
          onPayoutMinus={handlePayoutMinus}
          onPayoutConfirm={() => void handlePayoutConfirm()}
          onCancelPayout={handleCancelPayout}
        />
      ) : (
        <main className="flex min-h-screen items-center justify-center">
          <div className="text-subtle">Keine Daten verfügbar.</div>
        </main>
      )}
    </div>
  );
};

export default App;
