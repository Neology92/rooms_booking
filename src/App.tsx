import { useState } from "react";
import { en } from "./i18n/strings";
import { isConfigured } from "./lib/supabase";
import { useTripData } from "./hooks/useTripData";
import { ParticipantView } from "./pages/ParticipantView";
import { OrganizerDashboard } from "./pages/OrganizerDashboard";

type Tab = "participant" | "organizer";

export default function App() {
  const [tab, setTab] = useState<Tab>("participant");
  const data = useTripData();

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
        <ParticipantView data={data} />
      ) : (
        <OrganizerDashboard data={data} />
      )}
    </main>
  );
}
