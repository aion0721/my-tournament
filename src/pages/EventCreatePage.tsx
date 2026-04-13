import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EventCreateForm } from "../components/EventCreateForm";
import { HostAuthCard } from "../components/HostAuthCard";
import { useAppStore } from "../hooks/useAppStore";

export function EventCreatePage() {
  const navigate = useNavigate();
  const {
    state,
    currentUserName,
    isReady,
    loginHost,
    logout,
    createEvent,
    deleteEvent,
  } = useAppStore();
  const [error, setError] = useState<string | null>(null);

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.currentUserId) ?? null,
    [state.currentUserId, state.users],
  );

  const hostEvents = useMemo(
    () =>
      state.eventRecords.filter(
        (eventRecord) => eventRecord.event.hostUserId === state.currentUserId,
      ),
    [state.eventRecords, state.currentUserId],
  );

  useEffect(() => {
    document.title = "MyTournament";
  }, []);

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div className="stack">
            <img className="app-logo" src="/logo.png" alt="MyTournament logo" />
            <div>
              <span className="eyebrow">Tournament MVP</span>
              <h1>MyTournament</h1>
              <p className="lead">
                主催者はイベント作成と管理、参加者は共有 URL
                から参加できます。保存先は
                {state.storageMode === "supabase"
                  ? " Supabase"
                  : " localStorage"}{" "}
                です。
              </p>
            </div>
          </div>
          {currentUserName ? (
            <div className="button-row">
              <span className="badge">{currentUserName}</span>
              <button
                className="button-secondary"
                type="button"
                onClick={async () => {
                  await logout();
                  setError(null);
                }}
              >
                ログアウト
              </button>
            </div>
          ) : null}
        </div>
        {error ? <div className="notice">{error}</div> : null}
      </section>

      <div className="grid-2">
        <HostAuthCard
          currentUserName={currentUserName}
          onLogin={async (name) => {
            try {
              setError(null);
              await loginHost(name);
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "ログインに失敗しました。",
              );
            }
          }}
          onLogout={() => void logout()}
        />
        <EventCreateForm
          disabled={!isReady || !currentUser}
          onSubmit={async (input) => {
            if (!currentUser) {
              setError("イベント作成には主催者ログインが必要です。");
              return;
            }

            try {
              setError(null);
              const eventId = await createEvent(currentUser.id, input);
              navigate(`/events/${eventId}`);
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "イベント作成に失敗しました。",
              );
            }
          }}
        />
      </div>

      <section className="section-card stack">
        <div>
          <div className="section-title">主催イベント</div>
          <p className="muted">
            現在ログイン中の主催者が作成したイベント一覧です。
          </p>
        </div>
        {hostEvents.length === 0 ? (
          <div className="empty-state">まだイベントはありません。</div>
        ) : (
          <div className="list">
            {hostEvents.map(({ event, participants }) => (
              <div className="event-link-card section-card" key={event.id}>
                <div>
                  <strong>{event.name}</strong>
                  <div className="muted">
                    {participants.length} / {event.capacity} 人参加
                  </div>
                </div>
                <div className="topbar-links">
                  <Link className="chip-button" to={`/events/${event.id}`}>
                    ホスト画面
                  </Link>
                  <Link
                    className="chip-button"
                    to={`/join/${event.shareToken}`}
                  >
                    参加画面
                  </Link>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={async () => {
                      const shouldDelete = window.confirm(
                        `「${event.name}」を削除します。元に戻せません。`,
                      );
                      if (!shouldDelete) {
                        return;
                      }

                      try {
                        setError(null);
                        await deleteEvent(event.id);
                      } catch (caught) {
                        setError(
                          caught instanceof Error
                            ? caught.message
                            : "イベント削除に失敗しました。",
                        );
                      }
                    }}
                  >
                    イベント削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
