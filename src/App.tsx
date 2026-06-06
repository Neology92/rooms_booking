import { useState } from "react";
import { en } from "./i18n/strings";
import { isConfigured } from "./lib/supabase";
import { useTripData } from "./hooks/useTripData";
import { useIdentity } from "./hooks/useIdentity";
import { Onboarding } from "./components/Onboarding";
import { ParticipantView } from "./pages/ParticipantView";
import { OrganizerDashboard } from "./pages/OrganizerDashboard";

type Tab = "participant" | "organizer";

export default function App() {
  const [tab, setTab] = useState<Tab>("participant");
  const data = useTripData();
  const identity = useIdentity(data.trip?.id);
  const me = data.participants.find((p) => p.id === identity.id) ?? null;

  function renderParticipant() {
    if (!data.trip) return null;
    if (!me) {
      return (
        <Onboarding
          tripId={data.trip.id}
          onDone={(pid) => {
            identity.save(pid);
            void data.reload();
          }}
        />
      );
    }
    return <ParticipantView data={data} me={me} onReset={identity.clear} />;
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>{data.trip?.name ?? en.app.title}</h1>
        <nav className="tabs">
          <button
            className={tab === "participant" ? "active" : ""}
            onClick={() => setTab("participant")}
          >
            {en.tabs.participant}
          </button>
          <button
            className={tab === "organizer" ? "active" : ""}
            onClick={() => setTab("organizer")}
          >
            {en.tabs.organizer}
          </button>
        </nav>
      </header>

      {!isConfigured ? (
        <p className="banner banner--error">{en.app.missingConfig}</p>
      ) : data.loading ? (
        <p>{en.app.loading}</p>
      ) : tab === "participant" ? (
        renderParticipant()
      ) : (
        <OrganizerDashboard data={data} />
      )}
    </main>
  );
}
