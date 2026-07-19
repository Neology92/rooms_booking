import { useState } from "react";
import { useStrings, useLang } from "./i18n/I18nProvider";
import { isConfigured } from "./lib/supabase";
import { useTripData } from "./hooks/useTripData";
import { useTripId } from "./hooks/useTripId";
import { useIdentity } from "./hooks/useIdentity";
import { useOrganizer } from "./hooks/useOrganizer";
import { Onboarding } from "./components/Onboarding";
import { TripPicker } from "./components/TripPicker";
import { ParticipantView } from "./pages/ParticipantView";
import { OrganizerDashboard } from "./pages/OrganizerDashboard";

type Tab = "participant" | "organizer";

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang" role="group" aria-label="Language">
      <button
        className={lang === "en" ? "active" : ""}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <button
        className={lang === "pl" ? "active" : ""}
        onClick={() => setLang("pl")}
      >
        PL
      </button>
    </div>
  );
}

export default function App() {
  const s = useStrings();
  const [tab, setTab] = useState<Tab>("participant");
  const { tripId, select } = useTripId();
  const data = useTripData(tripId);
  const identity = useIdentity(data.trip?.id);
  const organizer = useOrganizer(data.trip?.id);
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

  const picker = (
    <TripPicker
      onSelect={select}
      onCreated={(id, passcode) => {
        // Store the organizer passcode for the freshly-claimed trip before we
        // navigate, so the dashboard opens unlocked.
        localStorage.setItem(`rb_org:${id}`, passcode);
        select(id);
      }}
    />
  );

  function body() {
    if (!isConfigured) {
      return <p className="banner banner--error">{s.app.missingConfig}</p>;
    }
    if (!tripId) return picker;
    if (data.loading) return <p>{s.app.loading}</p>;
    if (!data.trip) return picker; // stale/unknown ?trip= → back to the list
    return tab === "participant" ? (
      renderParticipant()
    ) : (
      <OrganizerDashboard
        data={data}
        passcode={organizer.passcode}
        onAuthed={organizer.save}
        onSignOut={organizer.clear}
        onReload={() => void data.reload()}
        onDeleted={() => {
          organizer.clear();
          setTab("participant");
          select(undefined);
        }}
      />
    );
  }

  const showTabs = isConfigured && !!tripId && !data.loading && !!data.trip;

  return (
    <main className="app">
      <header className="app__header">
        <h1>{data.trip?.name ?? s.tripPicker.title}</h1>
        <div className="header__controls">
          {showTabs && (
            <nav className="tabs">
              <button
                className={tab === "participant" ? "active" : ""}
                onClick={() => setTab("participant")}
              >
                {s.tabs.participant}
              </button>
              <button
                className={tab === "organizer" ? "active" : ""}
                onClick={() => setTab("organizer")}
              >
                {s.tabs.organizer}
              </button>
              <button className="linklike" onClick={() => select(undefined)}>
                {s.tripPicker.back}
              </button>
            </nav>
          )}
          <LangSwitch />
        </div>
      </header>

      {body()}
    </main>
  );
}
